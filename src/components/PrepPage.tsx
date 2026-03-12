/**
 * PrepPage Component — Build a session by adding exercises
 *
 * LEARNING NOTES - useReducer via Context:
 *
 * 1. ANGULAR vs REACT:
 *    Angular: inject a service, call methods (service.addExercise(...))
 *    React: call dispatch({ type: 'ADD_EXERCISE', ... }) — pure data in,
 *    the reducer figures out the new state. No mutation.
 *
 * 2. WHY DISPATCH + ACTIONS?
 *    - Clear audit trail of what happened
 *    - Reducer is a pure function — easy to test
 *    - Multiple components can dispatch without prop drilling callbacks
 *    - Similar to NgRx if you've used that in Angular
 */

import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { ArrowRight, Coffee, GripVertical, Minus, Plus, Star } from 'lucide-react';
import { toast } from 'sonner';
import { useSession } from '../context/SessionContext';
import { getExerciseById, BREAK_EXERCISE_ID, getExerciseName } from '../data/exercises';
import type { Exercise, SessionExercise } from '../types';
import { type ConfirmConfig, confirmRemove } from '../lib/confirmations';
import { useTemplateSaver } from '../hooks/useTemplateSaver';
import { useExerciseFilter } from '../hooks/useExerciseFilter';
import ExerciseFilterBar from './ExerciseFilterBar';
import ExerciseDetailModal from './ExerciseDetailModal';
import ConfirmModal from './ConfirmModal';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';

// ---------------------------------------------------------------------------
// SortablePrepItem — a single draggable exercise in the prep queue
// ---------------------------------------------------------------------------

interface SortablePrepItemProps {
  id: string;
  index: number;
  se: SessionExercise;
  /** Exercise number excluding breaks — undefined for break items */
  exerciseNumber: number | undefined;
  onDurationChange: (index: number, duration: number) => void;
  onRequestRemove: () => void;
  onShowDetail: (exercise: Exercise) => void;
}

function SortablePrepItem({
  id,
  index,
  se,
  exerciseNumber,
  onDurationChange,
  onRequestRemove,
  onShowDetail,
}: SortablePrepItemProps) {
  const isBreak = se.exerciseId === BREAK_EXERCISE_ID;
  const exercise = isBreak ? undefined : getExerciseById(se.exerciseId);
  const name = isBreak ? 'Break' : (exercise?.name ?? se.exerciseId);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.5 : undefined,
  };

  return (
    <Card ref={setNodeRef} style={style}>
      <CardContent className="px-3 py-3">
        {/* Row 1: name + duration stepper + drag handle */}
        <div className="flex items-center gap-2">
          <span className="w-5 shrink-0 text-center">
            {isBreak ? (
              <Coffee className="inline h-4 w-4 text-muted-foreground" />
            ) : (
              <span className="text-sm text-muted-foreground">{exerciseNumber}.</span>
            )}
          </span>
          <span className="min-w-0 flex-1 truncate font-medium text-foreground">{name}</span>
          {/* Duration stepper — most-used control, sits at eye level with name */}
          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              onClick={() => onDurationChange(index, Math.max(1, se.duration - 1))}
              disabled={se.duration <= 1}
              className="rounded border border-input bg-secondary p-0.5 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
              aria-label={`Decrease duration for ${name}`}
            >
              <Minus className="h-3 w-3" />
            </button>
            <span className="min-w-[4ch] text-center text-xs text-foreground">
              <span className="font-medium">{se.duration}</span>
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
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="shrink-0 cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
            aria-label={`Drag to reorder ${name}`}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        </div>

        {/* Row 2: summary */}
        {exercise?.summary && (
          <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{exercise.summary}</p>
        )}

        {/* Row 3: tags + actions */}
        <div className="mt-2 flex items-end justify-between gap-2">
          <div className="flex flex-wrap gap-1">
            {exercise?.tags?.map((tag) => (
              <Badge key={tag} variant="outline" className="border-input text-xs text-primary">
                {tag}
              </Badge>
            ))}
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <button
              type="button"
              onClick={onRequestRemove}
              className="text-xs text-destructive transition-colors hover:text-destructive/80"
              aria-label={`Remove ${name}`}
            >
              Remove
            </button>
            {exercise && (
              <button
                type="button"
                onClick={() => onShowDetail(exercise)}
                className="inline-flex items-center gap-1 text-xs text-primary transition-colors hover:text-primary-hover"
              >
                Details <ArrowRight className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PrepPage() {
  const { state, dispatch } = useSession();
  const navigate = useNavigate();
  const [defaultDuration, setDefaultDuration] = useState(10);
  const exerciseFilter = useExerciseFilter();
  const [detailExercise, setDetailExercise] = useState<Exercise | null>(null);
  const [confirm, setConfirm] = useState<ConfirmConfig | null>(null);
  const template = useTemplateSaver();

  // Scroll-position fades: hide top fade at scroll top, bottom fade at scroll bottom
  const [showTopFade, setShowTopFade] = useState(false);
  const [showBottomFade, setShowBottomFade] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);
  const handleListScroll = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    setShowTopFade(el.scrollTop > 0);
    setShowBottomFade(el.scrollTop + el.clientHeight < el.scrollHeight - 1);
  }, []);

  // Sensors for drag-and-drop — must be called before early return (Rules of Hooks)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // If there's no current session, create one on first visit
  if (!state.currentSession) {
    dispatch({ type: 'CREATE_SESSION' });
    return null; // Re-render will happen with the new session
  }

  const sessionExercises = state.currentSession.exercises;

  // Exercise IDs already in the queue — used to swap "+ Add" for "In queue"
  const queuedExerciseIds = new Set(sessionExercises.map((ex) => ex.exerciseId));

  // Total time for the session
  const totalMinutes = sessionExercises.reduce((sum, ex) => sum + ex.duration, 0);

  // Precompute exercise numbers (excluding breaks) for display.
  // E.g., [Exercise=1, Break=undefined, Exercise=2, Exercise=3]
  const exerciseNumbers: (number | undefined)[] = [];
  let exerciseCount = 0;
  for (const se of sessionExercises) {
    if (se.exerciseId === BREAK_EXERCISE_ID) {
      exerciseNumbers.push(undefined);
    } else {
      exerciseCount++;
      exerciseNumbers.push(exerciseCount);
    }
  }

  function handleAddExercise(exerciseId: string) {
    dispatch({ type: 'ADD_EXERCISE', exerciseId, duration: defaultDuration });
  }

  function handleRemoveExercise(index: number) {
    dispatch({ type: 'REMOVE_EXERCISE', index });
  }

  function handleDurationChange(index: number, duration: number) {
    dispatch({ type: 'SET_DURATION', index, duration });
  }

  // Stable IDs for dnd-kit — slotId is generated when exercises are added
  const sortableIds = sessionExercises.map((se, i) => se.slotId ?? `prep-${i}`);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIndex = sortableIds.indexOf(String(active.id));
    const toIndex = sortableIds.indexOf(String(over.id));
    if (fromIndex === -1 || toIndex === -1) return;
    dispatch({ type: 'REORDER_EXERCISES', from: fromIndex, to: toIndex });
  }

  function handleStartSession() {
    dispatch({ type: 'START_SESSION' });
    void navigate(`/session/${state.currentSession!.id}`);
  }

  return (
    <div>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Left column: exercise library with filtering */}
        <div>
          <ExerciseFilterBar
            selectedSource={exerciseFilter.selectedSource}
            onSourceChange={exerciseFilter.handleSourceChange}
            featuredTags={exerciseFilter.featuredTags}
            allTags={exerciseFilter.allTags}
            selectedTags={exerciseFilter.selectedTags}
            onTagToggle={exerciseFilter.handleTagToggle}
            searchText={exerciseFilter.searchText}
            onSearchChange={exerciseFilter.setSearchText}
            idPrefix="prep"
          />

          <div className="my-4 flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Default duration:</span>
            <button
              type="button"
              onClick={() => setDefaultDuration((d) => Math.max(1, d - 1))}
              disabled={defaultDuration <= 1}
              className="rounded border border-input bg-secondary p-1 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
              aria-label="Decrease default duration"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="min-w-[5ch] text-center text-sm text-foreground">
              <span className="font-medium">{defaultDuration}</span>
              <span className="text-muted-foreground"> min</span>
            </span>
            <button
              type="button"
              onClick={() => setDefaultDuration((d) => Math.min(60, d + 1))}
              disabled={defaultDuration >= 60}
              className="rounded border border-input bg-secondary p-1 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
              aria-label="Increase default duration"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          <h2 className="mb-3 text-xl font-semibold text-foreground">
            Exercises ({exerciseFilter.filtered.length})
          </h2>
          <div className="relative">
            <div
              className={`pointer-events-none absolute inset-x-0 top-0 z-10 h-10 bg-gradient-to-b from-background to-transparent transition-opacity duration-100 ${showTopFade ? 'opacity-100' : 'opacity-0'}`}
            />
            <div
              ref={listRef}
              onScroll={handleListScroll}
              className="scrollbar-dark max-h-[40vh] space-y-3 overflow-y-auto pr-2 lg:max-h-[60vh]"
            >
              {exerciseFilter.sorted.map((exercise) => (
                <Card key={exercise.id}>
                  <CardHeader className="py-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base text-primary">{exercise.name}</CardTitle>
                      {queuedExerciseIds.has(exercise.id) ? (
                        <span className="shrink-0 text-xs italic text-muted-foreground">
                          In queue
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleAddExercise(exercise.id)}
                          className="shrink-0 text-sm text-primary hover:text-primary-hover"
                        >
                          + Add
                        </button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="pb-3 pt-0">
                    {exercise.summary && (
                      <p className="line-clamp-2 text-sm text-muted-foreground">
                        {exercise.summary}
                      </p>
                    )}
                    <div className="mt-2 flex items-end justify-between">
                      <div className="flex flex-wrap gap-1">
                        {exercise.tags.map((tag) => (
                          <Badge
                            key={tag}
                            variant="outline"
                            className="border-input text-xs text-primary"
                          >
                            {tag}
                          </Badge>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => setDetailExercise(exercise)}
                        className="ml-2 inline-flex shrink-0 items-center gap-1 text-xs text-primary transition-colors hover:text-primary-hover"
                      >
                        Details <ArrowRight className="h-3 w-3" />
                      </button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div
              className={`pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-background to-transparent transition-opacity duration-100 ${showBottomFade ? 'opacity-100' : 'opacity-0'}`}
            />
          </div>
        </div>

        {/* Right column: session queue */}
        <div>
          <div className="mb-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-foreground">Session Queue</h2>
              {sessionExercises.length > 0 && (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => template.start(state.currentSession?.name ?? '')}
                    className="inline-flex items-center gap-1 text-sm text-star transition-colors hover:text-star/80"
                    title="Save as favorite"
                  >
                    <Star className="h-4 w-4 fill-current" /> Save
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setConfirm({
                        title: 'Clear queue?',
                        message: `Remove all ${sessionExercises.length} exercise${sessionExercises.length !== 1 ? 's' : ''} from the queue?`,
                        confirmLabel: 'Clear',
                        onConfirm: () => {
                          dispatch({ type: 'CLEAR_SESSION' });
                          setConfirm(null);
                          toast('Queue cleared');
                        },
                      })
                    }
                    className="text-sm text-muted-foreground transition-colors hover:text-destructive"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>
            {sessionExercises.length > 0 && (
              <p className="mt-1 text-sm text-muted-foreground">
                {sessionExercises.length} exercise{sessionExercises.length !== 1 && 's'}
                {' · '}
                {totalMinutes} min
              </p>
            )}
          </div>

          {/* Inline form for naming the template */}
          {template.isSaving && (
            <div className="mb-4 flex items-center gap-2">
              <input
                type="text"
                value={template.templateName}
                onChange={(e) => template.setTemplateName(e.target.value)}
                placeholder="Favorite name..."
                className="flex-1 rounded border border-input bg-secondary px-3 py-1 text-sm text-foreground focus:border-primary focus:outline-none"
                autoFocus // eslint-disable-line jsx-a11y/no-autofocus -- conditionally rendered after user action
                onKeyDown={(e) => {
                  if (e.key === 'Enter') template.save();
                  if (e.key === 'Escape') template.cancel();
                }}
              />
              <Button size="sm" onClick={template.save} disabled={!template.templateName.trim()}>
                Save
              </Button>
              <Button variant="ghost" size="sm" onClick={template.cancel}>
                Cancel
              </Button>
            </div>
          )}

          {sessionExercises.length === 0 ? (
            <p className="italic text-muted-foreground">
              No exercises yet. Add some from the library.
            </p>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
              modifiers={[restrictToVerticalAxis, restrictToParentElement]}
            >
              <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
                <div className="space-y-3">
                  {sessionExercises.map((se, index) => {
                    const name = getExerciseName(se);
                    return (
                      <SortablePrepItem
                        key={sortableIds[index]}
                        id={sortableIds[index]}
                        index={index}
                        se={se}
                        exerciseNumber={exerciseNumbers[index]}
                        onDurationChange={handleDurationChange}
                        onShowDetail={(exercise) => setDetailExercise(exercise)}
                        onRequestRemove={() =>
                          setConfirm(
                            confirmRemove(name, () => {
                              handleRemoveExercise(index);
                              setConfirm(null);
                            }),
                          )
                        }
                      />
                    );
                  })}
                </div>
              </SortableContext>
            </DndContext>
          )}

          {sessionExercises.length > 0 && (
            <div className="mt-6 flex flex-col gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  dispatch({
                    type: 'ADD_EXERCISE',
                    exerciseId: BREAK_EXERCISE_ID,
                    duration: 5,
                  });
                  toast('Break added');
                }}
              >
                <Coffee className="mr-1 h-4 w-4" /> Add Break
              </Button>
              <Button size="lg" className="w-full" onClick={handleStartSession}>
                Start Session ({totalMinutes} min)
              </Button>
            </div>
          )}
        </div>
      </div>
      {detailExercise && (
        <ExerciseDetailModal exercise={detailExercise} onClose={() => setDetailExercise(null)} />
      )}
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
    </div>
  );
}

export default PrepPage;
