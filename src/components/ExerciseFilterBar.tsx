/**
 * ExerciseFilterBar — Shared filter controls for exercise browsing
 *
 * Used by both HomePage and PrepPage. Combines source dropdown, tag filter,
 * and search input into a consistent, reusable filter bar.
 *
 * LEARNING NOTES - COMPONENT EXTRACTION:
 *
 * 1. ANGULAR vs REACT:
 *    Angular: you'd create a shared module with the component, export it
 *    React: just create the component file and import it — no module boilerplate
 *
 * 2. WHEN TO EXTRACT:
 *    When two components share the same UI pattern with the same props shape,
 *    that's a good signal to extract. Here, HomePage and PrepPage both had
 *    source dropdown + tag filter + search input with identical behaviour.
 *
 * 3. COMPOSITION WITH children:
 *    The component accepts optional children rendered in the header row.
 *    This lets each page add its own action buttons (e.g. "Build a jam!")
 *    without the filter bar needing to know about them.
 */

import { EyeOff, X } from 'lucide-react';
import TagFilter from './TagFilter';
import { sourceCounts } from '../data/exercises';
import type { SourceFilter } from '../data/exercises';

interface ExerciseFilterBarProps {
  /** Current source selection */
  selectedSource: SourceFilter;
  onSourceChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;

  /** Tag filter state */
  featuredTags: string[];
  allTags: string[];
  selectedTags: string[];
  onTagToggle: (tag: string) => void;

  /** Text search state */
  searchText: string;
  onSearchChange: (text: string) => void;

  /** Unique prefix for HTML ids (avoids duplicate ids when two instances exist) */
  idPrefix?: string;

  /** Hidden exercises — show count and toggle when any are hidden */
  hiddenCount?: number;
  showHidden?: boolean;
  onToggleShowHidden?: () => void;

  /** Optional content rendered to the right of the source dropdown (action buttons, etc.) */
  children?: React.ReactNode;
}

function ExerciseFilterBar({
  selectedSource,
  onSourceChange,
  featuredTags,
  allTags,
  selectedTags,
  onTagToggle,
  searchText,
  onSearchChange,
  idPrefix = 'filter',
  hiddenCount = 0,
  showHidden = false,
  onToggleShowHidden,
  children,
}: ExerciseFilterBarProps) {
  const sourceId = `${idPrefix}-source`;
  const searchId = `${idPrefix}-search`;

  return (
    <div className="flex flex-col gap-4">
      {/* Top row: source dropdown (left) + optional actions (right) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <label htmlFor={sourceId} className="shrink-0 font-medium text-secondary-foreground">
            Source:
          </label>
          <select
            id={sourceId}
            value={selectedSource}
            onChange={onSourceChange}
            className="min-w-0 rounded-lg border bg-card px-3 py-2 text-sm text-card-foreground focus:outline-none focus:ring-2 focus:ring-ring sm:px-4 sm:text-base"
          >
            <option value="all">All Sources ({sourceCounts.all})</option>
            <option value="learnimprov">learnimprov.com ({sourceCounts.learnimprov})</option>
            <option value="improwiki">improwiki.com ({sourceCounts.improwiki})</option>
            {sourceCounts.custom > 0 && (
              <option value="custom">My Exercises ({sourceCounts.custom})</option>
            )}
          </select>
        </div>
        {children}
      </div>

      {/* Tag filter */}
      <TagFilter
        featuredTags={featuredTags}
        allTags={allTags}
        selectedTags={selectedTags}
        onTagToggle={onTagToggle}
      />

      {/* Search input */}
      <div className="flex flex-col gap-2">
        <label htmlFor={searchId} className="font-medium text-secondary-foreground">
          Search exercises:
        </label>
        <div className="relative">
          <input
            id={searchId}
            type="text"
            value={searchText}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by name, description, or tags..."
            className="w-full rounded-lg border bg-card px-4 py-2 pr-10 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {searchText && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 px-2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {/* Show hidden toggle — only visible when exercises have been hidden */}
      {hiddenCount > 0 && onToggleShowHidden && (
        <button
          type="button"
          onClick={onToggleShowHidden}
          className="flex items-center gap-1.5 self-start text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <EyeOff className="h-4 w-4" />
          {showHidden ? `Hide ${hiddenCount} hidden` : `Show ${hiddenCount} hidden`}
        </button>
      )}
    </div>
  );
}

export default ExerciseFilterBar;
