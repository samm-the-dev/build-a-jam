/**
 * ExerciseFormDialog — Create or edit a custom user-created exercise
 *
 * LEARNING NOTES - CONTROLLED FORMS + VALIDATION:
 *
 * 1. ANGULAR vs REACT:
 *    Angular: Reactive Forms with FormControl, FormGroup, and built-in
 *    Validators (Validators.required, Validators.minLength, etc.).
 *    React: "Controlled components" — each input's value is tied to state,
 *    and validation is just regular JavaScript in the submit handler.
 *    Simpler but less structured; Angular gives you a form object you
 *    can inspect (.valid, .dirty, .errors) while React is ad-hoc.
 *
 * 2. SLUG GENERATION:
 *    IDs are generated once at creation time and never change, even if
 *    the user later edits the name. This prevents breaking references
 *    in session queues, templates, and favorites. Same pattern used by
 *    scraped exercises (IDs are source-based, not name-based).
 *
 * 3. TIPTAP INTEGRATION:
 *    We use Tiptap (a headless rich text editor built on ProseMirror) for
 *    the description field. Tiptap works directly with HTML, so we no longer
 *    need to convert between plain text and HTML — the editor accepts HTML
 *    as input and outputs HTML when content changes. This provides a true
 *    WYSIWYG experience where users see formatting as they type.
 */

import { useState, useMemo } from 'react';
import type { Exercise } from '../types';
import { getCustomExercises, filterBySource, getTagsForExercises } from '../data/exercises';
import RichTextEditor from './RichTextEditor';
import TagInput from './TagInput';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';

interface ExerciseFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (exercise: Exercise) => void;
  /** If provided, we're editing this exercise (pre-fill fields, preserve ID) */
  existingExercise?: Exercise;
  /**
   * If provided, pre-fill form fields from this exercise for a "copy as custom" flow.
   * Unlike existingExercise, a new ID is generated on save so the original is untouched.
   * The source attribution (sourceUrl) is carried over silently for proper attribution.
   */
  prefillExercise?: Exercise;
  /**
   * Called after save when the user has checked "hide original".
   * Only relevant in copy mode (prefillExercise set). The parent should
   * dispatch TOGGLE_HIDDEN_EXERCISE for prefillExercise.id.
   */
  onHideOriginal?: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Generate a URL-friendly slug from a name.
 * E.g., "My Cool Exercise!" → "my-cool-exercise"
 */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Generate a unique ID for a custom exercise.
 * Appends a short random suffix to avoid collisions when names are similar.
 */
function generateCustomId(name: string): string {
  const slug = slugify(name) || 'exercise';
  const suffix = Math.random().toString(36).slice(2, 6);
  return `custom:${slug}-${suffix}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function ExerciseFormDialog({
  open,
  onClose,
  onSave,
  existingExercise,
  prefillExercise,
  onHideOriginal,
}: ExerciseFormDialogProps) {
  const isEditing = !!existingExercise;
  // The source to pre-fill from: editing beats copy-prefill beats empty
  const prefill = existingExercise ?? prefillExercise;

  // Pre-fill from existing exercise when editing, or from source exercise when copying.
  const [name, setName] = useState(prefill?.name ?? '');
  const [description, setDescription] = useState(prefill?.description ?? '');
  const [tags, setTags] = useState<string[]>(prefill?.tags ?? []);
  const [summary, setSummary] = useState(prefill?.summary ?? '');
  const [error, setError] = useState('');
  // In copy mode: offer to hide the original so it stops appearing in the list.
  // Default on — the most common reason to copy is to replace it with your version.
  const [hideOriginal, setHideOriginal] = useState(true);

  // Get all available tags from the exercise library for autocomplete
  const availableTags = useMemo(() => {
    const allExercises = filterBySource('all');
    const { allTags } = getTagsForExercises(allExercises);
    return allTags;
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Name is required.');
      return;
    }

    // Check for duplicate names among custom exercises (by slug comparison).
    // Only check for new exercises, or if the name changed during editing.
    if (!isEditing || trimmedName !== existingExercise?.name) {
      const newSlug = slugify(trimmedName);
      const duplicate = getCustomExercises().find(
        (ex) => ex.id !== existingExercise?.id && slugify(ex.name) === newSlug,
      );
      if (duplicate) {
        setError('An exercise with a similar name already exists.');
        return;
      }
    }

    const exercise: Exercise = {
      // Keep existing ID on edit — changing IDs would break favorites, session history,
      // and template references. The random suffix prevents collisions even if names change.
      // For copies (prefillExercise), generate a fresh ID so the original is untouched.
      id: existingExercise?.id ?? generateCustomId(trimmedName),
      name: trimmedName,
      tags, // Already an array from TagInput
      description, // Tiptap outputs HTML directly
      summary: summary.trim() || undefined,
      isCustom: true,
      // Carry over source attribution when copying a sourced exercise
      sourceUrl: existingExercise?.sourceUrl ?? prefillExercise?.sourceUrl,
    };

    onSave(exercise);
    if (!isEditing && prefillExercise && hideOriginal) {
      onHideOriginal?.();
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <DialogContent onSwipeDismiss={onClose} className="max-w-2xl bg-card">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {isEditing ? 'Edit Exercise' : prefillExercise ? 'Copy as Custom' : 'Create Exercise'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update your custom exercise.'
              : prefillExercise
                ? `Customise a copy of "${prefillExercise.name}".`
                : 'Add your own exercise to the library.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name (required) */}
          <div>
            <label
              htmlFor="exercise-name"
              className="mb-1 block text-sm font-medium text-foreground"
            >
              Name <span className="text-destructive">*</span>
            </label>
            <input
              id="exercise-name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError('');
              }}
              placeholder="e.g., Zip Zap Zop"
              className="w-full rounded-lg border border-input bg-secondary px-3 py-2 text-sm text-foreground placeholder-muted-foreground transition-colors focus:border-primary focus:outline-none"
              autoComplete="off"
              data-form-type="other"
              autoFocus // eslint-disable-line jsx-a11y/no-autofocus -- dialog just opened
            />
          </div>

          {/* Summary (optional) */}
          <div>
            <label
              htmlFor="exercise-summary"
              className="mb-1 block text-sm font-medium text-foreground"
            >
              Summary <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <input
              id="exercise-summary"
              type="text"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Brief one-liner about what the exercise does"
              className="w-full rounded-lg border border-input bg-secondary px-3 py-2 text-sm text-foreground placeholder-muted-foreground transition-colors focus:border-primary focus:outline-none"
              autoComplete="off"
              data-form-type="other"
            />
          </div>

          {/* Description (optional) with Tiptap WYSIWYG editor */}
          <div>
            <RichTextEditor
              content={description}
              onChange={setDescription}
              placeholder="How to run the exercise, rules, variations..."
            >
              Description <span className="font-normal text-muted-foreground">(optional)</span>
            </RichTextEditor>
          </div>

          {/* Tags with autocomplete */}
          <div>
            <label
              htmlFor="exercise-tags"
              className="mb-1 block text-sm font-medium text-foreground"
            >
              Tags <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <TagInput
              id="exercise-tags"
              value={tags}
              onChange={setTags}
              suggestions={availableTags}
              placeholder="Add tags..."
            />
          </div>

          {/* Error message */}
          {error && <p className="text-sm text-destructive">{error}</p>}

          {/* Hide original — only shown in copy mode */}
          {prefillExercise && (
            <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={hideOriginal}
                onChange={(e) => setHideOriginal(e.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              Hide original ("{prefillExercise.name}") from the list
            </label>
          )}

          <DialogFooter className="gap-2">
            <Button type="submit">{isEditing ? 'Save Changes' : 'Create Exercise'}</Button>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default ExerciseFormDialog;
