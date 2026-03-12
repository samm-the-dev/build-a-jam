/**
 * HomePage Component
 *
 * The main exercise browsing view — source filtering, tag filtering,
 * text search, and exercise list.
 *
 * ANGULAR vs REACT:
 * - Angular: this would be a "routed component" declared in a route config
 * - React: it's just a regular component passed as a Route element
 *
 * LEARNING NOTES:
 * - CONTROLLED INPUTS: The search input is a "controlled component" where
 *   React state is the single source of truth. The input's value comes from
 *   state, and onChange updates that state. This is different from Angular's
 *   two-way binding [(ngModel)] but achieves the same result with explicit
 *   one-way data flow.
 */

import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Star, Clock, PenLine, ArrowUp } from 'lucide-react';
import { toast } from 'sonner';
import { useSession } from '../context/SessionContext';
import { useExerciseFilter } from '../hooks/useExerciseFilter';
import { getExerciseById } from '../data/exercises';
import ExerciseList from './ExerciseList';
import ExerciseFilterBar from './ExerciseFilterBar';
import ExerciseFormDialog from './ExerciseFormDialog';
import ConfirmModal from './ConfirmModal';
import { Button } from './ui/button';
import type { Exercise } from '../types';

function HomePage() {
  const { state, dispatch } = useSession();
  const favoriteIds = state.favoriteExerciseIds;
  const exerciseFilter = useExerciseFilter();

  // Deep linking: ?exercise=learnimprov:zip-zap-zop opens the detail modal
  // for that exercise on page load (shared URL). The query param is cleared
  // immediately so refreshing doesn't re-open the modal.
  //
  // REACT LEARNING NOTE — LAZY STATE INITIALIZATION:
  // useState(() => ...) runs the initializer only once, on mount. We read
  // the query param here instead of in a useEffect so the modal opens on
  // the first render — no flash of the page without the modal.
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(() => {
    const id = searchParams.get('exercise');
    return id ? (getExerciseById(id) ?? null) : null;
  });

  // Clear the ?exercise= param after reading it (replace history so
  // Back button doesn't re-open the modal).
  // Functional form avoids mutating the existing URLSearchParams instance.
  useEffect(() => {
    setSearchParams(
      (prev) => {
        if (!prev.has('exercise')) return prev;
        const next = new URLSearchParams(prev);
        next.delete('exercise');
        return next;
      },
      { replace: true },
    );
  }, [setSearchParams]);

  // Scroll-to-top: show a floating button once the user scrolls past the
  // filter bar so they can jump back without a long swipe on mobile.
  const [showScrollTop, setShowScrollTop] = useState(false);
  const handleScroll = useCallback(() => {
    setShowScrollTop(window.scrollY > 400);
  }, []);
  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  // STATE: custom exercise create/edit/delete/copy
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);
  const [deletingExercise, setDeletingExercise] = useState<Exercise | null>(null);
  const [copyingExercise, setCopyingExercise] = useState<Exercise | null>(null);

  return (
    <div className="flex flex-col gap-8">
      <ExerciseFilterBar
        selectedSource={exerciseFilter.selectedSource}
        onSourceChange={exerciseFilter.handleSourceChange}
        featuredTags={exerciseFilter.featuredTags}
        allTags={exerciseFilter.allTags}
        selectedTags={exerciseFilter.selectedTags}
        onTagToggle={exerciseFilter.handleTagToggle}
        searchText={exerciseFilter.searchText}
        onSearchChange={exerciseFilter.setSearchText}
        idPrefix="home"
        hiddenCount={exerciseFilter.hiddenCount}
        showHidden={exerciseFilter.showHidden}
        onToggleShowHidden={exerciseFilter.toggleShowHidden}
      >
        {/* Action buttons rendered in the header row */}
        <div className="flex items-center gap-2">
          {/* Build button — hidden on mobile where BottomNav provides access */}
          <Button asChild className="hidden sm:inline-flex">
            <Link to="/prep">Build a jam!</Link>
          </Button>
          {/* Favorites & History — hidden on mobile, available via BottomNav menu */}
          <Button variant="secondary" size="icon" className="hidden sm:flex" asChild>
            <Link to="/favorites" aria-label="Favorites" title="Favorites">
              <Star className="h-5 w-5" />
            </Link>
          </Button>
          <Button variant="secondary" size="icon" className="hidden sm:flex" asChild>
            <Link to="/history" aria-label="Session history" title="Session history">
              <Clock className="h-5 w-5" />
            </Link>
          </Button>
        </div>
      </ExerciseFilterBar>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-foreground sm:text-2xl">
            Exercises ({exerciseFilter.filtered.length})
          </h2>
          <Button variant="outline" size="sm" onClick={() => setShowCreateForm(true)}>
            <PenLine className="mr-1 h-4 w-4" /> Create
          </Button>
        </div>
        <ExerciseList
          exercises={exerciseFilter.sorted}
          favoriteIds={favoriteIds}
          hiddenIds={state.hiddenExerciseIds}
          selectedExercise={selectedExercise}
          onSelectExercise={setSelectedExercise}
          onToggleFavorite={(id) => {
            const wasFavorite = favoriteIds.includes(id);
            dispatch({ type: 'TOGGLE_FAVORITE_EXERCISE', exerciseId: id });
            toast(wasFavorite ? 'Removed from favorites' : 'Added to favorites');
          }}
          onToggleHidden={(id) => {
            const wasHidden = state.hiddenExerciseIds.includes(id);
            dispatch({ type: 'TOGGLE_HIDDEN_EXERCISE', exerciseId: id });
            toast(wasHidden ? 'Exercise unhidden' : 'Exercise hidden');
          }}
          onCopyAsCustom={(exercise) => setCopyingExercise(exercise)}
          onEditExercise={(exercise) => setEditingExercise(exercise)}
          onDeleteExercise={(exercise) => setDeletingExercise(exercise)}
        />
      </div>

      {/* Create exercise dialog */}
      {showCreateForm && (
        <ExerciseFormDialog
          open={showCreateForm}
          onClose={() => setShowCreateForm(false)}
          onSave={(exercise) => {
            dispatch({ type: 'ADD_CUSTOM_EXERCISE', exercise });
            setShowCreateForm(false);
            toast(`Created "${exercise.name}"`);
          }}
        />
      )}

      {/* Edit exercise dialog */}
      {editingExercise && (
        <ExerciseFormDialog
          open={!!editingExercise}
          onClose={() => setEditingExercise(null)}
          existingExercise={editingExercise}
          onSave={(exercise) => {
            dispatch({ type: 'UPDATE_CUSTOM_EXERCISE', exercise });
            setEditingExercise(null);
            toast(`Updated "${exercise.name}"`);
          }}
        />
      )}

      {/* Copy-as-custom dialog — pre-fills form from sourced exercise, saves as new custom */}
      {copyingExercise && (
        <ExerciseFormDialog
          open={!!copyingExercise}
          onClose={() => setCopyingExercise(null)}
          prefillExercise={copyingExercise}
          onSave={(exercise) => {
            dispatch({ type: 'ADD_CUSTOM_EXERCISE', exercise });
            setCopyingExercise(null);
            toast(`Saved custom copy "${exercise.name}"`);
          }}
          onHideOriginal={() => {
            if (!state.hiddenExerciseIds.includes(copyingExercise.id)) {
              dispatch({ type: 'TOGGLE_HIDDEN_EXERCISE', exerciseId: copyingExercise.id });
            }
          }}
        />
      )}

      {/* Delete exercise confirmation */}
      {deletingExercise && (
        <ConfirmModal
          title="Delete exercise?"
          message={`Permanently delete "${deletingExercise.name}"? This cannot be undone.`}
          confirmLabel="Delete"
          variant="danger"
          onConfirm={() => {
            dispatch({ type: 'DELETE_CUSTOM_EXERCISE', exerciseId: deletingExercise.id });
            setDeletingExercise(null);
            toast('Exercise deleted');
          }}
          onCancel={() => setDeletingExercise(null)}
        />
      )}

      {/* Floating scroll-to-top button — appears after scrolling past the filter bar.
          Positioned above the bottom nav on mobile (bottom-20), higher on desktop (bottom-8). */}
      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className={`fixed bottom-20 right-4 z-40 rounded-full border border-border bg-card p-3 text-muted-foreground shadow-lg transition-all duration-200 hover:text-foreground sm:bottom-8 ${
          showScrollTop
            ? 'translate-y-0 opacity-100'
            : 'pointer-events-none translate-y-4 opacity-0'
        }`}
        aria-label="Scroll to top"
      >
        <ArrowUp className="h-5 w-5" />
      </button>
    </div>
  );
}

export default HomePage;
