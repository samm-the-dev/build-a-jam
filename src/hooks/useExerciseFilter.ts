/**
 * useExerciseFilter — Shared hook for the exercise filter pipeline
 *
 * LEARNING NOTES - CUSTOM HOOKS FOR SHARED LOGIC:
 *
 * 1. ANGULAR vs REACT:
 *    Angular: you'd put reusable logic in a service (@Injectable) and inject it
 *    into multiple components via DI. The service holds state and provides methods.
 *    React: custom hooks extract reusable stateful logic. Each component that
 *    calls the hook gets its own independent copy of the state — unlike Angular
 *    services which are singletons by default.
 *
 * 2. WHY THIS HOOK:
 *    HomePage, PrepPage, and ExercisePickerDialog all use the exact same filter
 *    pipeline: source filter → tag computation → tag/text filter → favorites sort.
 *    Extracting this into a hook eliminates three copies of identical code while
 *    keeping each component's filter state independent (changing filters on the
 *    home page doesn't affect the session picker dialog).
 *
 * 3. THE PIPELINE:
 *    filterBySource(selectedSource)    → all exercises for chosen source
 *    getTagsForExercises(...)          → available tags for the tag filter UI
 *    filterExercises(..., tags, text)  → exercises matching current filters
 *    sortByFavorites(..., favoriteIds) → favorites float to the top
 *
 * 4. PERFORMANCE OPTIMIZATION (useMemo & useCallback):
 *
 *    useMemo — MEMOIZING COMPUTED VALUES:
 *    Angular: computed values in templates re-run on every change detection cycle.
 *    You'd use pure pipes or memoization libraries to avoid redundant work.
 *    React: useMemo caches a computed value and only recalculates when its
 *    dependencies change. Without it, the filter pipeline would run on every
 *    render — even if just the timer ticked or an unrelated state changed.
 *
 *    useCallback — STABLE FUNCTION REFERENCES:
 *    Angular: methods on a component class have stable identity (same function).
 *    React: functions defined inside a component are recreated every render.
 *    If passed as props, this can trigger unnecessary child re-renders (if the
 *    child uses React.memo). useCallback returns the same function reference
 *    unless dependencies change.
 *
 *    WHEN TO USE THEM:
 *    - useMemo: expensive computations (filtering 400+ exercises) or values
 *      passed to memoized children
 *    - useCallback: functions passed as props to memoized children, or used
 *      as dependencies in other hooks
 *    - Don't overuse — premature optimization adds complexity. Profile first.
 */

import { useState, useMemo, useCallback } from 'react';
import { useSession } from '../context/SessionContext';
import {
  filterBySource,
  getTagsForExercises,
  filterExercises,
  sortByFavorites,
  registerCustomExercises,
} from '../data/exercises';
import type { SourceFilter } from '../data/exercises';

export function useExerciseFilter() {
  const { state } = useSession();
  const [selectedSource, setSelectedSource] = useState<SourceFilter>('all');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [searchText, setSearchText] = useState('');
  // When true, hidden exercises are shown (dimmed) instead of filtered out
  const [showHidden, setShowHidden] = useState(false);

  // Sync custom exercises to module state BEFORE useMemo runs.
  // The SessionProvider also does this in a useEffect, but effects run AFTER render.
  // By calling it here, we ensure filterBySource sees current data during this render.
  // This is idempotent (safe to call multiple times with the same data).
  registerCustomExercises(state.customExercises);

  // useMemo: cache the source-filtered list until selectedSource or customExercises changes.
  // This prevents re-running filterBySource(~400 exercises) on every keystroke
  // in the search box or tag toggle.
  // Note: state.customExercises isn't used directly in the callback, but filterBySource
  // reads from the module-level customExercises variable. Including it here ensures the
  // memoized value recomputes when custom exercises are added/edited/deleted.
  const sourceFiltered = useMemo(
    () => filterBySource(selectedSource),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- customExercises triggers recalc via module state
    [selectedSource, state.customExercises],
  );

  // useMemo: tag lists only need recomputing when source filter changes
  const { featuredTags, allTags } = useMemo(
    () => getTagsForExercises(sourceFiltered),
    [sourceFiltered],
  );

  // useMemo: the heavy filter — iterates all exercises, checks tags & text.
  // Dependencies are the three things that affect the output.
  const filtered = useMemo(
    () => filterExercises(sourceFiltered, selectedTags, searchText),
    [sourceFiltered, selectedTags, searchText],
  );

  // useMemo: favorites sort only changes when filtered list or favorites change
  const sortedAll = useMemo(
    () => sortByFavorites(filtered, state.favoriteExerciseIds),
    [filtered, state.favoriteExerciseIds],
  );

  // Count hidden exercises that match the current filter (before hiding them).
  // Exposed so the UI can show "X hidden" and offer a toggle.
  const hiddenCount = useMemo(
    () => sortedAll.filter((ex) => state.hiddenExerciseIds.includes(ex.id)).length,
    [sortedAll, state.hiddenExerciseIds],
  );

  // When showHidden is off, exclude hidden exercises from the results.
  const sorted = useMemo(
    () =>
      showHidden ? sortedAll : sortedAll.filter((ex) => !state.hiddenExerciseIds.includes(ex.id)),
    [sortedAll, showHidden, state.hiddenExerciseIds],
  );

  const toggleShowHidden = useCallback(() => setShowHidden((prev) => !prev), []);

  // useCallback: stable function reference for source changes.
  // If ExerciseFilterBar were wrapped in React.memo, passing a new function
  // on every render would defeat the memoization. useCallback prevents that.
  const handleSourceChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedSource(event.target.value as SourceFilter);
    // Clear tag selections when changing source — tags differ between sources
    setSelectedTags([]);
  }, []);

  // useCallback: stable reference for tag toggle handler
  const handleTagToggle = useCallback((tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }, []);

  return {
    selectedSource,
    handleSourceChange,
    selectedTags,
    handleTagToggle,
    searchText,
    setSearchText,
    featuredTags,
    allTags,
    filtered,
    sorted,
    hiddenCount,
    showHidden,
    toggleShowHidden,
  };
}
