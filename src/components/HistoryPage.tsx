/**
 * HistoryPage Component — View completed session history
 *
 * LEARNING NOTES - READING FROM CONTEXT:
 *
 * 1. ANGULAR vs REACT:
 *    Angular: inject a service, subscribe to an observable of past sessions
 *    React: useSession() hook gives us the full state including
 *    completedSessions — no subscription needed, React re-renders
 *    automatically when context changes.
 *
 * 2. DATE FORMATTING:
 *    We store dates as ISO strings for JSON serialisation. To display
 *    them, we create a Date object and use toLocaleDateString/
 *    toLocaleTimeString. The browser's Intl API handles locale-aware
 *    formatting without any library.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronRight, Star, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useSession } from '../context/SessionContext';
import {
  getExerciseById,
  formatDuration,
  formatDate,
  formatTime,
  BREAK_EXERCISE_ID,
} from '../data/exercises';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import ConfirmModal from './ConfirmModal';
import ExerciseDetailModal from './ExerciseDetailModal';
import { Button } from './ui/button';
import type { Exercise } from '../types';
import type { ConfirmConfig } from '../lib/confirmations';

function HistoryPage() {
  const { state, dispatch } = useSession();
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [detailExercise, setDetailExercise] = useState<Exercise | null>(null);

  // Confirmation modal state: stores a callback to run on confirm
  const [confirm, setConfirm] = useState<ConfirmConfig | null>(null);
  // Inline save-as-template form (tracks which reversed index is being named)
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [templateName, setTemplateName] = useState('');

  // Show newest first
  const sessions = [...state.completedSessions].reverse();

  function handleDeleteSession(reversedIndex: number) {
    // Convert reversed index back to the original completedSessions index
    const originalIndex = state.completedSessions.length - 1 - reversedIndex;
    // Inline object to preserve "from your history" wording
    setConfirm({
      title: 'Delete session?',
      message: 'This will permanently remove this session from your history.',
      confirmLabel: 'Delete',
      onConfirm: () => {
        dispatch({ type: 'DELETE_COMPLETED_SESSION', index: originalIndex });
        setConfirm(null);
        toast('Session deleted');
        // If the deleted entry was expanded, collapse it
        if (expandedIndex === reversedIndex) setExpandedIndex(null);
      },
    });
  }

  function handleSaveAsTemplate(reversedIndex: number) {
    const name = templateName.trim();
    if (!name) return;
    const originalIndex = state.completedSessions.length - 1 - reversedIndex;
    dispatch({ type: 'SAVE_COMPLETED_AS_TEMPLATE', completedSessionIndex: originalIndex, name });
    toast.success(`Saved "${name}" to favorites`);
    setSavingIndex(null);
    setTemplateName('');
  }

  function handleClearAll() {
    setConfirm({
      title: 'Clear all history?',
      message: `This will permanently delete all ${sessions.length} session${sessions.length !== 1 ? 's' : ''} from your history.`,
      confirmLabel: 'Clear All',
      onConfirm: () => {
        dispatch({ type: 'CLEAR_COMPLETED_SESSIONS' });
        setConfirm(null);
        setExpandedIndex(null);
        toast('History cleared');
      },
    });
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">Session History</h1>
        {sessions.length > 0 && (
          <button
            onClick={handleClearAll}
            className="text-sm text-muted-foreground transition-colors hover:text-destructive"
          >
            Clear All
          </button>
        )}
      </div>

      {sessions.length === 0 ? (
        <div className="py-12 text-center">
          <p className="mb-4 text-lg text-muted-foreground">No sessions yet.</p>
          <Link
            to="/prep"
            className="inline-flex items-center gap-1 text-primary transition-colors hover:text-primary-hover"
          >
            Build your first jam <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {sessions.map((session, i) => {
            const plannedMinutes = session.exercises.reduce((sum, ex) => sum + ex.duration, 0);
            const actualTotalSeconds = session.exercises.reduce(
              (sum, ex) => sum + (ex.actualSeconds ?? 0),
              0,
            );
            const hasActualTime = session.exercises.some((ex) => ex.actualSeconds != null);

            const isExpanded = expandedIndex === i;

            return (
              <Card key={session.sessionId}>
                <CardContent className="py-4">
                  {/* Header — clickable to expand/collapse */}
                  <button
                    onClick={() => setExpandedIndex(isExpanded ? null : i)}
                    className="w-full text-left"
                  >
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-2">
                        <ChevronRight
                          className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                        />
                        <span className="font-semibold text-foreground">
                          {formatDate(session.completedAt)}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {formatTime(session.completedAt)}
                        </span>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {session.exercises.length} exercise
                        {session.exercises.length !== 1 && 's'}
                        {' · '}
                        {hasActualTime ? (
                          <>
                            {formatDuration(actualTotalSeconds)} / {plannedMinutes} min planned
                          </>
                        ) : (
                          <>{plannedMinutes} min</>
                        )}
                      </span>
                    </div>

                    {/* Collapsed: exercise names as non-interactive badges (tap row to expand) */}
                    {!isExpanded && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {session.exercises.map((se, j) => {
                          const isBreak = se.exerciseId === BREAK_EXERCISE_ID;
                          const ex = isBreak ? undefined : getExerciseById(se.exerciseId);
                          return (
                            <Badge
                              key={se.slotId ?? j}
                              variant="outline"
                              className={`border-input text-xs ${
                                ex ? 'text-primary' : 'text-secondary-foreground'
                              }`}
                            >
                              {isBreak ? 'Break' : (ex?.name ?? se.exerciseId)}
                            </Badge>
                          );
                        })}
                      </div>
                    )}
                  </button>

                  {/* Expanded: full exercise details */}
                  {isExpanded && (
                    <div className="mt-4 space-y-3">
                      {session.exercises.map((se, j) => (
                        <div key={se.slotId ?? j} className="border-l-2 border-border pl-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-foreground">
                              <span className="mr-2 text-muted-foreground">{j + 1}.</span>
                              {(() => {
                                if (se.exerciseId === BREAK_EXERCISE_ID) return 'Break';
                                const ex = getExerciseById(se.exerciseId);
                                return ex ? (
                                  <button
                                    onClick={() => setDetailExercise(ex)}
                                    className="text-primary transition-colors hover:text-primary-hover"
                                  >
                                    {ex.name}
                                  </button>
                                ) : (
                                  se.exerciseId
                                );
                              })()}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {se.actualSeconds != null ? (
                                <>
                                  {formatDuration(se.actualSeconds)}{' '}
                                  <span className="text-muted-foreground">/ {se.duration} min</span>
                                </>
                              ) : (
                                <>{se.duration} min</>
                              )}
                            </span>
                          </div>
                          {se.notes && (
                            <p className="mt-1 text-sm text-muted-foreground">{se.notes}</p>
                          )}
                        </div>
                      ))}

                      {/* Session notes */}
                      {session.notes && (
                        <div className="mt-3 border-t pt-3">
                          <p className="mb-1 text-xs text-muted-foreground">Session notes</p>
                          <p className="text-sm text-secondary-foreground">{session.notes}</p>
                        </div>
                      )}

                      {/* Actions: save as template + delete */}
                      <div className="mt-3 border-t pt-3">
                        {savingIndex === i ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={templateName}
                              onChange={(e) => setTemplateName(e.target.value)}
                              placeholder="Favorite name..."
                              className="flex-1 rounded border border-input bg-secondary px-3 py-1 text-sm text-foreground focus:border-primary focus:outline-none"
                              autoFocus // eslint-disable-line jsx-a11y/no-autofocus -- conditionally rendered after user action
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveAsTemplate(i);
                                if (e.key === 'Escape') {
                                  setSavingIndex(null);
                                  setTemplateName('');
                                }
                              }}
                            />
                            <Button
                              size="sm"
                              onClick={() => handleSaveAsTemplate(i)}
                              disabled={!templateName.trim()}
                            >
                              Save
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSavingIndex(null);
                                setTemplateName('');
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 sm:gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDeleteSession(i)}
                              title="Delete session"
                              className="text-destructive hover:text-destructive/80"
                            >
                              <Trash2 className="h-4 w-4 sm:mr-1" />
                              <span className="hidden sm:inline">Delete</span>
                            </Button>
                            <div className="flex-1" />
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSavingIndex(i);
                                setTemplateName('');
                              }}
                              title="Save as favorite"
                              className="text-star hover:text-star/80"
                            >
                              <Star className="h-4 w-4 fill-current sm:mr-1" />
                              <span className="hidden sm:inline">Save</span>
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

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

export default HistoryPage;
