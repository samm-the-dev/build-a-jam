/**
 * TagInput — Autocomplete tag input with chip display
 *
 * LEARNING NOTES - COMBOBOX PATTERN:
 *
 * 1. THE PATTERN:
 *    A combobox combines a text input with a dropdown list. Users can type to
 *    filter suggestions, or select from the list. This is common for tags,
 *    mentions, and search fields.
 *
 * 2. ANGULAR vs REACT:
 *    Angular: You might use Angular Material's mat-autocomplete or a custom
 *    directive with ControlValueAccessor for form integration.
 *    React: We build it from primitives — useState for the input value and
 *    dropdown state, filtered array for suggestions, keyboard handlers for
 *    navigation. No special form integration needed (just pass value/onChange).
 *
 * 3. ACCESSIBILITY:
 *    - role="combobox" on the input
 *    - aria-expanded for dropdown state
 *    - aria-controls linking to the listbox
 *    - role="listbox" on the dropdown
 *    - role="option" on each item
 *    - Keyboard: ArrowDown/Up to navigate, Enter to select, Escape to close
 */

import { useState, useRef } from 'react';
import { X } from 'lucide-react';

interface TagInputProps {
  /** Currently selected tags */
  value: string[];
  /** Called when tags change */
  onChange: (tags: string[]) => void;
  /** Available tags for autocomplete */
  suggestions: string[];
  /** Placeholder text */
  placeholder?: string;
  /** ID for the input element (for htmlFor on labels) */
  id?: string;
}

export function TagInput({
  value,
  onChange,
  suggestions,
  placeholder = 'Add tags...',
  id,
}: TagInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = 'tag-suggestions-listbox';

  // Filter suggestions based on input, excluding already selected tags
  const filtered = suggestions.filter(
    (tag) => tag.toLowerCase().includes(inputValue.toLowerCase()) && !value.includes(tag),
  );

  // Derive dropdown visibility from input state and focus
  const showDropdown = isFocused && inputValue.trim().length > 0;

  // Check if current input would be a custom (new) tag
  const isCustomTag =
    inputValue.trim() &&
    !suggestions.some((s) => s.toLowerCase() === inputValue.trim().toLowerCase());

  function addTag(tag: string) {
    const normalized = tag.trim().toLowerCase();
    if (normalized && !value.includes(normalized)) {
      onChange([...value, normalized]);
    }
    setInputValue('');
    setHighlightedIndex(-1);
    inputRef.current?.focus();
  }

  function removeTag(tag: string) {
    onChange(value.filter((t) => t !== tag));
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && filtered[highlightedIndex]) {
        addTag(filtered[highlightedIndex]);
      } else if (isCustomTag && highlightedIndex === filtered.length) {
        addTag(inputValue);
      } else if (inputValue.trim()) {
        // Add as custom tag
        addTag(inputValue);
      }
    } else if (e.key === ',') {
      e.preventDefault();
      if (inputValue.trim()) {
        addTag(inputValue);
      }
    } else if (e.key === 'Backspace' && !inputValue && value.length > 0) {
      // Remove last tag when backspacing on empty input
      removeTag(value[value.length - 1]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const maxIndex = isCustomTag ? filtered.length : filtered.length - 1;
      if (maxIndex >= 0) {
        setHighlightedIndex((prev) => (prev < maxIndex ? prev + 1 : 0));
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const maxIndex = isCustomTag ? filtered.length : filtered.length - 1;
      if (maxIndex >= 0) {
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : maxIndex));
      }
    } else if (e.key === 'Escape') {
      setHighlightedIndex(-1);
      inputRef.current?.blur();
    }
  }

  return (
    <div className="relative">
      {/* Tag chips + input wrapper — click anywhere to focus input */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- Click is convenience, keyboard interaction is on the input */}
      <div
        className="flex min-h-[42px] w-full cursor-text flex-wrap gap-1.5 rounded-lg border border-input bg-secondary px-2 py-1.5 transition-colors focus-within:border-primary"
        onClick={() => inputRef.current?.focus()}
      >
        {/* Selected tag chips */}
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-primary/20 px-2 py-0.5 text-xs text-primary"
          >
            {tag}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeTag(tag);
              }}
              className="transition-colors hover:text-destructive"
              aria-label={`Remove ${tag}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}

        {/* Text input with combobox role */}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setHighlightedIndex(-1);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            // Delay to allow clicking on suggestions
            setTimeout(() => setIsFocused(false), 150);
          }}
          placeholder={value.length === 0 ? placeholder : ''}
          className="min-w-[120px] flex-1 bg-transparent text-sm text-foreground placeholder-muted-foreground focus:outline-none"
          id={id}
          autoComplete="off"
          role="combobox"
          aria-expanded={showDropdown}
          aria-haspopup="listbox"
          aria-controls={listboxId}
          aria-autocomplete="list"
        />
      </div>

      {/* Autocomplete dropdown */}
      {showDropdown && (filtered.length > 0 || isCustomTag) && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-border bg-popover shadow-lg"
        >
          {filtered.map((tag, index) => (
            <li
              key={tag}
              role="option"
              aria-selected={index === highlightedIndex}
              className={`cursor-pointer px-3 py-2 text-sm transition-colors ${
                index === highlightedIndex
                  ? 'bg-accent text-accent-foreground'
                  : 'text-foreground hover:bg-accent/50'
              }`}
              onMouseEnter={() => setHighlightedIndex(index)}
              onMouseDown={(e) => {
                e.preventDefault(); // Prevent input blur
                addTag(tag);
              }}
            >
              {tag}
            </li>
          ))}

          {/* Option to add as custom tag */}
          {isCustomTag && (
            <li
              role="option"
              aria-selected={highlightedIndex === filtered.length}
              className={`cursor-pointer border-t border-border px-3 py-2 text-sm transition-colors ${
                highlightedIndex === filtered.length
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent/50'
              }`}
              onMouseEnter={() => setHighlightedIndex(filtered.length)}
              onMouseDown={(e) => {
                e.preventDefault();
                addTag(inputValue);
              }}
            >
              Add "{inputValue.trim()}" as new tag
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

export default TagInput;
