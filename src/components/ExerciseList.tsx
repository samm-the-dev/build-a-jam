/**
 * ExerciseList Component
 *
 * LEARNING NOTES:
 *
 * 1. LIST RENDERING:
 *    Angular: *ngFor="let exercise of exercises"
 *    React: exercises.map((exercise) => ...)
 *
 * 2. KEY PROP:
 *    Angular: trackBy function (optional but recommended)
 *    React: key prop (REQUIRED for lists, React uses it for reconciliation)
 *
 * 3. CONDITIONAL RENDERING:
 *    Angular: *ngIf
 *    React: && operator or ternary
 *
 * 4. COMPONENT COMPOSITION:
 *    Similar to Angular, just import and use like <ExerciseCard />
 *
 * 5. MODAL STATE MANAGEMENT:
 *    - Modal state lives in this component (lifted state pattern)
 *    - ExerciseCard receives onClick prop to trigger modal
 *    - Modal renders conditionally when selectedExercise is not null
 *    - We reuse ExerciseDetailModal rather than duplicating modal markup
 */

import { useState } from 'react';
import type { Exercise } from '../types';
import ExerciseCard from './ExerciseCard';
import ExerciseDetailModal from './ExerciseDetailModal';

interface ExerciseListProps {
  exercises: Exercise[];
  favoriteIds?: string[];
  onToggleFavorite?: (id: string) => void;
  /** IDs of exercises the user has hidden */
  hiddenIds?: string[];
  onToggleHidden?: (id: string) => void;
  /** Called when user wants to copy a sourced exercise as custom */
  onCopyAsCustom?: (exercise: Exercise) => void;
  /** Called when user wants to edit a custom exercise from the detail modal */
  onEditExercise?: (exercise: Exercise) => void;
  /** Called when user wants to delete a custom exercise from the detail modal */
  onDeleteExercise?: (exercise: Exercise) => void;
  /**
   * Controlled selection — when provided, the parent manages which exercise
   * is shown in the detail modal. Used by HomePage for deep linking
   * (opening a specific exercise from a shared URL).
   *
   * REACT LEARNING NOTE — CONTROLLED vs UNCONTROLLED:
   * Same pattern as form inputs: when the parent passes value + onChange,
   * the component is "controlled". When omitted, it manages its own state
   * internally. This dual-mode approach keeps the component flexible —
   * FavoritesPage uses it uncontrolled, HomePage uses it controlled.
   */
  selectedExercise?: Exercise | null;
  onSelectExercise?: (exercise: Exercise | null) => void;
}

function ExerciseList({
  exercises,
  favoriteIds,
  onToggleFavorite,
  hiddenIds,
  onToggleHidden,
  onCopyAsCustom,
  onEditExercise,
  onDeleteExercise,
  selectedExercise: controlledSelected,
  onSelectExercise: controlledSetSelected,
}: ExerciseListProps) {
  // Dual-mode: controlled (parent manages) or uncontrolled (internal state).
  // `undefined` = prop not provided (uncontrolled); `null` = explicitly no selection.
  // Using `??` here would break controlled mode: a parent setting `null` to close
  // the modal would lose to a non-null `internalSelected`. Check `!== undefined` instead.
  const [internalSelected, setInternalSelected] = useState<Exercise | null>(null);
  const isControlled = controlledSelected !== undefined && controlledSetSelected !== undefined;
  const selectedExercise = isControlled ? controlledSelected : internalSelected;
  const setSelectedExercise = isControlled ? controlledSetSelected : setInternalSelected;

  // Early return pattern - like *ngIf but at component level
  if (exercises.length === 0) {
    return (
      <div className="py-12 text-center text-lg text-muted-foreground">
        <p>No exercises found. Try adjusting your filters.</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Map over array to render list - like *ngFor */}
        {exercises.map((exercise) => (
          // Key is REQUIRED - React uses it to track which items changed
          <ExerciseCard
            key={exercise.id}
            exercise={exercise}
            onClick={() => setSelectedExercise(exercise)}
            isFavorite={favoriteIds?.includes(exercise.id)}
            onToggleFavorite={onToggleFavorite ? () => onToggleFavorite(exercise.id) : undefined}
            isHidden={hiddenIds?.includes(exercise.id)}
          />
        ))}
      </div>

      {/* MODAL: Reuses ExerciseDetailModal (Escape key, scroll lock, alt names) */}
      {selectedExercise && (
        <ExerciseDetailModal
          exercise={selectedExercise}
          onClose={() => setSelectedExercise(null)}
          onEdit={
            selectedExercise.isCustom && onEditExercise
              ? () => {
                  const ex = selectedExercise;
                  setSelectedExercise(null);
                  onEditExercise(ex);
                }
              : undefined
          }
          onDelete={
            selectedExercise.isCustom && onDeleteExercise
              ? () => {
                  const ex = selectedExercise;
                  setSelectedExercise(null);
                  onDeleteExercise(ex);
                }
              : undefined
          }
          onCopyAsCustom={
            !selectedExercise.isCustom && onCopyAsCustom
              ? () => {
                  const ex = selectedExercise;
                  setSelectedExercise(null);
                  onCopyAsCustom(ex);
                }
              : undefined
          }
          isHidden={hiddenIds?.includes(selectedExercise.id)}
          onToggleHidden={onToggleHidden ? () => onToggleHidden(selectedExercise.id) : undefined}
        />
      )}
    </>
  );
}

export default ExerciseList;
