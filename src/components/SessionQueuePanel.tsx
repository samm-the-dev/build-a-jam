/**
 * SessionQueuePanel — Collapsible panel for viewing and editing the session queue
 * during an active session.
 *
 * LEARNING NOTES - COMPONENT COMPOSITION & DRAG-AND-DROP:
 *
 * 1. ANGULAR vs REACT:
 *    Angular: you might use Angular CDK's DragDrop module with cdkDrag/cdkDropList
 *    directives. The CDK handles animation, placeholder rendering, and accessibility.
 *    React: we use @dnd-kit, which follows a hooks-based approach. Instead of
 *    directives, you wrap items with <SortableContext> and call useSortable() in
 *    each draggable item. Same concepts, different API surface.
 *
 * 2. @dnd-kit ARCHITECTURE:
 *    - DndContext: the provider (like cdkDropListGroup) — handles drag events
 *    - SortableContext: defines which items are sortable and in what order
 *    - useSortable(): hook on each item — returns refs, listeners, and transform
 *    - The library handles touch events, keyboard DnD (Space to pick up,
 *      arrows to move), and accessibility announcements automatically.
 *
 * 3. LIFTING STATE UP (revisited):
 *    The expand/collapse toggle is local state — no other component cares
 *    whether the panel is open. But the queue data and edit actions come
 *    from SessionContext via the parent. This split (local UI state vs.
 *    shared app state) is a core React pattern.
 */

import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ChevronDown,
  ChevronUp,
  Check,
  Play,
  Coffee,
  Minus,
  Plus,
  X,
  GripVertical,
} from 'lucide-react';
import type { SessionExercise } from '../types';
import { BREAK_EXERCISE_ID, getExerciseName, formatDuration } from '../data/exercises';
import { type ConfirmConfig, confirmRemove } from '../lib/confirmations';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import ConfirmModal from './ConfirmModal';

interface SessionQueuePanelProps {
  exercises: SessionExercise[];
  currentIndex: number;
  /** Seconds elapsed on the current exercise (for estimating end times) */
  timerElapsed: number;
  /** Current timestamp in ms (updated by parent's timer effect for purity) */
  now: number;
  onRemove: (index: number) => void;
  onDurationChange: (index: number, duration: number) => void;
  onReorder: (from: number, to: number) => void;
  onAddExercise: () => void;
  onAddBreak: () => void;
  onEditNotes: (index: number, notes: string) => void;
}

// ---------------------------------------------------------------------------
// SortableQueueItem — a single draggable upcoming exercise row
// ---------------------------------------------------------------------------

interface SortableQueueItemProps {
  id: string;
  index: number;
  /** Exercise number excluding breaks (undefined for breaks) */
  exerciseNumber?: number;
  se: SessionExercise;
  name: string;
  isBreak: boolean;
  onDurationChange: (index: number, duration: number) => void;
  onRequestRemove: () => void;
}

function SortableQueueItem({
  id,
  index,
  exerciseNumber,
  se,
  name,
  isBreak,
  onDurationChange,
  onRequestRemove,
}: SortableQueueItemProps) {
  // useSortable gives us everything needed to make this item draggable:
  // - attributes: ARIA attributes for accessibility
  // - listeners: event handlers for the drag handle
  // - setNodeRef: ref to attach to the DOM element
  // - transform/transition: CSS values for smooth animation during drag
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    // Raise the dragged item above others
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.5 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded-lg bg-card px-3 py-2 text-sm"
    >
      {/* Remove button — leftmost (destructive action away from primary) */}
      <button
        onClick={onRequestRemove}
        className="shrink-0 text-destructive transition-colors hover:text-destructive/80"
        aria-label={`Remove ${name}`}
      >
        <X className="h-4 w-4" />
      </button>

      {/* Number + icon — breaks show a coffee icon, exercises show their number */}
      <span className="w-5 shrink-0 text-center">
        {isBreak ? (
          <Coffee className="h-4 w-4 text-muted-foreground" />
        ) : (
          <span className="text-muted-foreground">{exerciseNumber}</span>
        )}
      </span>

      {/* Exercise name */}
      <span className="min-w-0 flex-1 truncate text-foreground">{name}</span>

      {/* Duration stepper — "m" directly next to the number */}
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={() => onDurationChange(index, Math.max(1, se.duration - 1))}
          disabled={se.duration <= 1}
          className="rounded border border-input bg-secondary p-0.5 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
          aria-label={`Decrease duration for ${name}`}
        >
          <Minus className="h-3 w-3" />
        </button>
        <span className="min-w-[3ch] text-center text-xs font-medium text-foreground">
          {se.duration}
          <span className="text-muted-foreground">m</span>
        </span>
        <button
          type="button"
          onClick={() => onDurationChange(index, Math.min(60, se.duration + 1))}
          disabled={se.duration >= 60}
          className="rounded border border-input bg-secondary p-0.5 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
          aria-label={`Increase duration for ${name}`}
        >
          <Plus className="h-3 w-3" />
        </button>
      </div>

      {/* Drag handle — rightmost, only this element triggers dragging */}
      <button
        {...attributes}
        {...listeners}
        className="shrink-0 cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
        aria-label={`Drag to reorder ${name}`}
      >
        <GripVertical className="h-4 w-4" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SessionQueuePanel — main component
// ---------------------------------------------------------------------------

/** Format a Date as a short locale time string (e.g., "2:45 PM") */
function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function SessionQueuePanel({
  exercises,
  currentIndex,
  timerElapsed,
  now,
  onRemove,
  onDurationChange,
  onReorder,
  onAddExercise,
  onAddBreak,
  onEditNotes,
}: SessionQueuePanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [editingNotesIndex, setEditingNotesIndex] = useState<number | null>(null);
  const [confirm, setConfirm] = useState<ConfirmConfig | null>(null);

  // Precompute exercise numbers (excluding breaks) for display.
  // E.g., [Exercise=1, Break=undefined, Exercise=2, Exercise=3, Break=undefined]
  const exerciseNumbers: (number | undefined)[] = [];
  let exerciseCount = 0;
  for (const se of exercises) {
    if (se.exerciseId === BREAK_EXERCISE_ID) {
      exerciseNumbers.push(undefined);
    } else {
      exerciseCount++;
      exerciseNumbers.push(exerciseCount);
    }
  }

  // Estimated end times — based on device clock + remaining durations.
  // The current exercise's remaining time is (target - elapsed), then each
  // subsequent exercise adds its full duration. Uses ~ prefix to signal
  // these are estimates (exercises rarely hit their target exactly).
  //
  // REACT LEARNING NOTE — RENDER PURITY:
  // The `now` prop comes from SessionPage's state, updated by the timer
  // effect. This keeps render pure: Date.now() is only called inside an
  // effect (effects are allowed to be impure), not during render. The
  // React compiler enforces this — render functions must be idempotent.
  const currentTarget = exercises[currentIndex]?.duration ?? 0;
  const currentRemainingSeconds = Math.max(0, currentTarget * 60 - timerElapsed);
  const totalRemainingSeconds = exercises
    .slice(currentIndex + 1)
    .reduce((sum, ex) => sum + ex.duration * 60, currentRemainingSeconds);

  const currentExerciseEndTime = new Date(now + currentRemainingSeconds * 1000);
  const sessionEndTime = new Date(now + totalRemainingSeconds * 1000);

  // Upcoming exercises (the sortable portion of the queue)
  const upcomingExercises = exercises.slice(currentIndex + 1);
  // Stable IDs for dnd-kit — slotId is generated when the exercise is added
  // to the queue, so it doesn't change when items are reordered. This prevents
  // the "snap back then animate" flicker caused by index-based IDs.
  // Falls back to index-based IDs for exercises added before slotId existed.
  const sortableIds = upcomingExercises.map((se, i) => se.slotId ?? `upcoming-${i}`);

  // Sensors: pointer (mouse/touch) and keyboard for accessibility
  // The activation constraint prevents accidental drags on tap/click
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    // Convert sortable IDs back to actual exercise indices
    const fromSortableIndex = sortableIds.indexOf(String(active.id));
    const toSortableIndex = sortableIds.indexOf(String(over.id));
    if (fromSortableIndex === -1 || toSortableIndex === -1) return;

    // Offset by currentIndex + 1 to get real indices in the full array
    const fromIndex = currentIndex + 1 + fromSortableIndex;
    const toIndex = currentIndex + 1 + toSortableIndex;

    onReorder(fromIndex, toIndex);
  }

  return (
    <Card className="mt-6 text-left">
      <CardContent className="py-3">
        {/* Toggle button */}
        <button
          onClick={() => setIsExpanded((prev) => !prev)}
          aria-expanded={isExpanded}
          className="flex w-full items-center justify-between text-left"
        >
          <span className="font-medium text-foreground">
            Queue
            <span
              className="ml-2 font-normal text-muted-foreground"
              aria-label={`${upcomingExercises.length} upcoming, done around ${formatTime(sessionEndTime)}`}
            >
              {upcomingExercises.length} upcoming
              <span className="mx-1" aria-hidden="true">
                ·
              </span>
              done ~{formatTime(sessionEndTime)}
            </span>
          </span>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        {isExpanded && (
          <div className="scrollbar-dark mt-3 max-h-[40vh] space-y-1 overflow-y-auto">
            {/* Completed exercises — read-only, greyed out, check on right */}
            {exercises.slice(0, currentIndex).map((se, index) => {
              const name = getExerciseName(se);
              return (
                <div
                  key={`completed-${index}`}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm opacity-50"
                >
                  <span className="min-w-0 flex-1 truncate text-foreground">{name}</span>
                  {se.actualSeconds != null ? (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatDuration(se.actualSeconds)}
                    </span>
                  ) : (
                    <span className="shrink-0 text-xs text-muted-foreground">{se.duration}m</span>
                  )}
                  <button
                    onClick={() => setEditingNotesIndex(editingNotesIndex === index ? null : index)}
                    className="shrink-0 text-xs text-muted-foreground transition-colors hover:text-foreground"
                    title="Edit notes"
                  >
                    Notes
                  </button>
                  <Check className="h-4 w-4 shrink-0 text-muted-foreground" />
                </div>
              );
            })}

            {/* Current exercise — highlighted, locked, play icon on right */}
            {(() => {
              const se = exercises[currentIndex];
              const name = getExerciseName(se);
              return (
                <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1 truncate font-medium text-primary">{name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {se.duration}m
                    <span className="ml-1 text-primary/60">
                      ~{formatTime(currentExerciseEndTime)}
                    </span>
                  </span>
                  <Play className="h-4 w-4 shrink-0 fill-primary text-primary" />
                </div>
              );
            })()}

            {/* Upcoming exercises — sortable via drag-and-drop */}
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
              modifiers={[restrictToVerticalAxis, restrictToParentElement]}
            >
              <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
                {upcomingExercises.map((se, sortableIndex) => {
                  const realIndex = currentIndex + 1 + sortableIndex;
                  const name = getExerciseName(se);
                  const isBreak = se.exerciseId === BREAK_EXERCISE_ID;

                  return (
                    <SortableQueueItem
                      key={sortableIds[sortableIndex]}
                      id={sortableIds[sortableIndex]}
                      index={realIndex}
                      exerciseNumber={exerciseNumbers[realIndex]}
                      se={se}
                      name={name}
                      isBreak={isBreak}
                      onDurationChange={onDurationChange}
                      onRequestRemove={() =>
                        setConfirm(
                          confirmRemove(name, () => {
                            onRemove(realIndex);
                            setConfirm(null);
                          }),
                        )
                      }
                    />
                  );
                })}
              </SortableContext>
            </DndContext>

            {/* Notes editor for completed exercises */}
            {editingNotesIndex !== null && editingNotesIndex < currentIndex && (
              <div className="px-3 py-2">
                <textarea
                  value={exercises[editingNotesIndex]?.notes ?? ''}
                  onChange={(e) => onEditNotes(editingNotesIndex, e.target.value)}
                  placeholder={`Notes for ${getExerciseName(exercises[editingNotesIndex])}...`}
                  rows={2}
                  className="w-full resize-y rounded-lg border border-input bg-secondary p-2 text-sm text-secondary-foreground placeholder-muted-foreground transition-colors focus:border-primary focus:outline-none"
                />
              </div>
            )}
          </div>
        )}

        {/* Add buttons — always visible when expanded */}
        {isExpanded && (
          <div className="mt-3 flex gap-2 border-t border-input pt-3">
            <Button variant="outline" size="sm" onClick={onAddExercise} className="flex-1">
              <Plus className="mr-1 h-4 w-4" />
              Add Exercise
            </Button>
            <Button variant="outline" size="sm" onClick={onAddBreak} className="flex-1">
              <Coffee className="mr-1 h-4 w-4" />
              Add Break
            </Button>
          </div>
        )}
      </CardContent>

      {confirm && (
        <ConfirmModal
          title={confirm.title}
          message={confirm.message}
          confirmLabel={confirm.confirmLabel}
          variant="danger"
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
    </Card>
  );
}

export default SessionQueuePanel;
