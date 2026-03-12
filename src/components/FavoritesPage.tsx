/**
 * FavoritesPage Component — Browse saved templates and starred exercises
 *
 * LEARNING NOTES - COMBINING CONTEXT DATA:
 *
 * 1. This page reads two different pieces of state from SessionContext:
 *    - sessions[] (filtered to isTemplate) = saved session templates
 *    - favoriteExerciseIds[] = individually starred exercises
 *    Both live in the same context but serve different purposes.
 *
 * 2. ANGULAR vs REACT:
 *    Angular: you'd inject the service and combine observables with combineLatest
 *    React: just destructure both from the same context — simpler!
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, ChevronRight, Pencil, Play, Star, Trash2, Type } from 'lucide-react';
import { toast } from 'sonner';
import { useSession } from '../context/SessionContext';
import { getExerciseById, BREAK_EXERCISE_ID } from '../data/exercises';
import type { Exercise, Session } from '../types';
import { type ConfirmConfig, confirmDelete } from '../lib/confirmations';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import ConfirmModal from './ConfirmModal';
import ExerciseDetailModal from './ExerciseDetailModal';
import { Button } from './ui/button';

function FavoritesPage() {
  const { state, dispatch } = useSession();
  const navigate = useNavigate();
  const [expandedTemplateId, setExpandedTemplateId] = useState<string | null>(null);
  const [detailExercise, setDetailExercise] = useState<Exercise | null>(null);
  const [confirm, setConfirm] = useState<ConfirmConfig | null>(null);
  // Renaming state — null when not renaming, otherwise the template ID being edited
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Session templates (saved from prep or history)
  const templates = state.sessions.filter((s) => s.isTemplate);

  // Favorite exercises (starred individually)
  const favoriteExercises = state.favoriteExerciseIds
    .map((id) => getExerciseById(id))
    .filter((ex): ex is Exercise => ex != null);

  function handleEditTemplate(template: Session) {
    dispatch({ type: 'LOAD_SESSION', session: template });
    void navigate('/prep');
  }

  function handleStartTemplate(template: Session) {
    // Load the template and immediately start the session, skipping prep.
    // LOAD_SESSION creates a new session (with a new ID) from the template,
    // then START_SESSION sets currentExerciseIndex to 0. Both dispatches
    // happen synchronously before navigate. SessionPage reads state from
    // context (not from the URL param), so the ID in the URL is cosmetic.
    dispatch({ type: 'LOAD_SESSION', session: template });
    dispatch({ type: 'START_SESSION' });
    // Use template.id in the URL as a readable reference — SessionPage
    // will pick up the actual session from context state
    void navigate(`/session/${template.id}`);
  }

  function handleDeleteTemplate(sessionId: string) {
    setConfirm(
      confirmDelete('favorite', () => {
        dispatch({ type: 'DELETE_SESSION_TEMPLATE', sessionId });
        setConfirm(null);
        toast('Favorite deleted');
        if (expandedTemplateId === sessionId) setExpandedTemplateId(null);
      }),
    );
  }

  function handleStartRename(template: Session) {
    setRenamingId(template.id);
    setRenameValue(template.name ?? '');
  }

  function handleSaveRename() {
    if (renamingId && renameValue.trim()) {
      dispatch({
        type: 'RENAME_SESSION_TEMPLATE',
        sessionId: renamingId,
        name: renameValue.trim(),
      });
      toast('Renamed');
    }
    setRenamingId(null);
    setRenameValue('');
  }

  function handleCancelRename() {
    setRenamingId(null);
    setRenameValue('');
  }

  const isEmpty = templates.length === 0 && favoriteExercises.length === 0;

  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold text-foreground">Favorites</h1>

      {isEmpty ? (
        <div className="py-12 text-center">
          <p className="mb-2 text-lg text-muted-foreground">No favorites yet.</p>
          <p className="mb-4 text-muted-foreground">
            Star exercises from the home page, or save sessions as favorites from the prep or
            history pages.
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-primary transition-colors hover:text-primary-hover"
          >
            Browse exercises <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : (
        <div className="space-y-10">
          {/* Section 1: Session Templates */}
          {templates.length > 0 && (
            <section>
              <h2 className="mb-4 text-xl font-semibold text-foreground">
                Saved Sessions ({templates.length})
              </h2>
              <div className="space-y-4">
                {templates.map((template) => {
                  const totalMinutes = template.exercises.reduce((sum, ex) => sum + ex.duration, 0);
                  const isExpanded = expandedTemplateId === template.id;

                  return (
                    <Card key={template.id}>
                      <CardContent className="py-4">
                        {/* Header — clickable to expand/collapse */}
                        <button
                          onClick={() => setExpandedTemplateId(isExpanded ? null : template.id)}
                          className="w-full text-left"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <ChevronRight
                                className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                              />
                              <Star className="h-4 w-4 fill-star text-star" />
                              <span className="font-semibold text-foreground">
                                {template.name ?? 'Untitled'}
                              </span>
                            </div>
                            <span className="text-sm text-muted-foreground">
                              {template.exercises.length} exercise
                              {template.exercises.length !== 1 && 's'}
                              {' · '}
                              {totalMinutes} min
                            </span>
                          </div>

                          {/* Collapsed: exercise names as non-interactive badges (tap the row to expand) */}
                          {!isExpanded && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {template.exercises.map((se, j) => {
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

                        {/* Expanded: full exercise list + actions */}
                        {isExpanded && (
                          <div className="mt-4 space-y-3">
                            {template.exercises.map((se, j) => {
                              const isBreak = se.exerciseId === BREAK_EXERCISE_ID;
                              const ex = isBreak ? undefined : getExerciseById(se.exerciseId);
                              return (
                                <div key={se.slotId ?? j} className="border-l-2 border-border pl-3">
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm text-foreground">
                                      <span className="mr-2 text-muted-foreground">{j + 1}.</span>
                                      {isBreak ? (
                                        'Break'
                                      ) : ex ? (
                                        <button
                                          onClick={() => setDetailExercise(ex)}
                                          className="text-primary transition-colors hover:text-primary-hover"
                                        >
                                          {ex.name}
                                        </button>
                                      ) : (
                                        se.exerciseId
                                      )}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      {se.duration} min
                                    </span>
                                  </div>
                                </div>
                              );
                            })}

                            {/* Rename input — shown inline when renaming */}
                            {renamingId === template.id && (
                              <div className="mb-3 flex items-center gap-2">
                                <input
                                  type="text"
                                  value={renameValue}
                                  onChange={(e) => setRenameValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveRename();
                                    if (e.key === 'Escape') handleCancelRename();
                                  }}
                                  autoFocus // eslint-disable-line jsx-a11y/no-autofocus -- user just clicked rename
                                  className="flex-1 rounded border border-input bg-secondary px-2 py-1 text-sm text-foreground focus:border-primary focus:outline-none"
                                  placeholder="Favorite name..."
                                />
                                <Button size="sm" onClick={handleSaveRename}>
                                  Save
                                </Button>
                                <button
                                  onClick={handleCancelRename}
                                  className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                                >
                                  Cancel
                                </button>
                              </div>
                            )}

                            {/* Actions — icon buttons on mobile, labelled on desktop.
                                Order: destructive leftmost → secondary → primary rightmost. */}
                            <div className="mt-3 flex items-center gap-1 border-t pt-3 sm:gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDeleteTemplate(template.id)}
                                title="Delete"
                                className="text-destructive hover:text-destructive/80"
                              >
                                <Trash2 className="h-4 w-4 sm:mr-1" />
                                <span className="hidden sm:inline">Delete</span>
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleStartRename(template)}
                                title="Rename"
                              >
                                <Type className="h-4 w-4 sm:mr-1" />
                                <span className="hidden sm:inline">Rename</span>
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEditTemplate(template)}
                                title="Edit in prep"
                              >
                                <Pencil className="h-4 w-4 sm:mr-1" />
                                <span className="hidden sm:inline">Edit</span>
                              </Button>
                              <div className="flex-1" />
                              <Button
                                size="sm"
                                onClick={() => handleStartTemplate(template)}
                                title="Start session"
                              >
                                <Play className="h-4 w-4 sm:mr-1" />
                                <span className="hidden sm:inline">Start</span>
                              </Button>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>
          )}

          {/* Section 2: Favorite Exercises */}
          {favoriteExercises.length > 0 && (
            <section>
              <h2 className="mb-4 text-xl font-semibold text-foreground">
                Starred Exercises ({favoriteExercises.length})
              </h2>
              <div className="space-y-3">
                {favoriteExercises.map((exercise) => (
                  <Card key={exercise.id}>
                    <CardContent className="py-3">
                      <div className="flex items-center justify-between">
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          <button
                            onClick={() => {
                              dispatch({
                                type: 'TOGGLE_FAVORITE_EXERCISE',
                                exerciseId: exercise.id,
                              });
                              toast('Removed from favorites');
                            }}
                            className="shrink-0 text-star transition-colors hover:text-muted-foreground"
                            title="Remove from favorites"
                          >
                            <Star className="h-5 w-5 fill-current" />
                          </button>
                          <button
                            onClick={() => setDetailExercise(exercise)}
                            className="truncate text-left text-primary transition-colors hover:text-primary-hover"
                          >
                            {exercise.name}
                          </button>
                        </div>
                        <div className="ml-2 flex shrink-0 flex-wrap gap-1">
                          {exercise.tags.slice(0, 3).map((tag) => (
                            <Badge
                              key={tag}
                              variant="outline"
                              className="border-input text-xs text-primary"
                            >
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      {exercise.summary && (
                        <p className="ml-8 mt-1 line-clamp-1 text-sm text-muted-foreground">
                          {exercise.summary}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          )}
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

export default FavoritesPage;
