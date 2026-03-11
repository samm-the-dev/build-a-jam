/**
 * ExerciseDetailModal — Shows full exercise details in a Dialog overlay
 *
 * LEARNING NOTES - RADIX DIALOG:
 *
 * 1. ANGULAR vs REACT (LIBRARY):
 *    Angular: inject MatDialog service, call dialog.open(Component, config).
 *    React (Radix): compose Dialog primitives declaratively in JSX.
 *    Both handle focus trapping, Escape key, and backdrop click automatically.
 *
 * 2. WHAT RADIX DIALOG GIVES US (that our custom version didn't):
 *    - Focus trap: Tab cycles through focusable elements inside the dialog
 *    - Scroll lock: Body scroll is locked automatically (no manual useEffect)
 *    - Escape key: Built-in close handler (no manual keydown listener)
 *    - Portal: Content renders outside the DOM tree (avoids z-index wars)
 *    - ARIA: role="dialog", aria-describedby, aria-labelledby set for you
 *
 * 3. THE PATTERN:
 *    Parents still control visibility with `{exercise && <ExerciseDetailModal />}`.
 *    We render with `open={true}` and listen to `onOpenChange` to call `onClose`.
 *    This keeps the same interface — zero consumer changes needed.
 */

import { Copy, ExternalLink, Eye, EyeOff, Pencil, Share2, Trash2, X } from 'lucide-react';
import { shareExercise } from '../lib/share';
import { useSwipeToDismiss } from '../hooks/useSwipeToDismiss';
import type { Exercise } from '../types';
import { Badge } from './ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from './ui/dialog';
import { Button } from './ui/button';

interface ExerciseDetailModalProps {
  exercise: Exercise;
  onClose: () => void;
  /** Called when user clicks "Edit" — only shown for custom exercises */
  onEdit?: () => void;
  /** Called when user clicks "Delete" — only shown for custom exercises */
  onDelete?: () => void;
  /** Called when user wants to copy a sourced exercise as their own custom one */
  onCopyAsCustom?: () => void;
  /** Whether this exercise is currently hidden */
  isHidden?: boolean;
  /** Called when user toggles hidden status */
  onToggleHidden?: () => void;
}

function ExerciseDetailModal({
  exercise,
  onClose,
  onEdit,
  onDelete,
  onCopyAsCustom,
  isHidden,
  onToggleHidden,
}: ExerciseDetailModalProps) {
  // Swipe-to-dismiss: dragging the dialog down past 80px calls onClose.
  // The ref goes on DialogContent (the scrollable container) so the hook
  // can detect scroll position and only engage when the user is at the top.
  const { ref: swipeRef, style: swipeStyle } = useSwipeToDismiss(onClose);

  return (
    <Dialog
      open={true}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        ref={swipeRef}
        style={swipeStyle}
        className="scrollbar-dark max-h-[80vh] max-w-2xl gap-0 overflow-y-auto bg-card p-0"
      >
        {/* Drag handle — mobile only; swipe-to-dismiss is a touch gesture */}
        <div className="flex justify-center pt-3 sm:hidden">
          <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Header — title left, share + close icons right */}
        <DialogHeader className="border-b border-border px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <DialogTitle className="text-2xl font-bold text-primary">{exercise.name}</DialogTitle>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => void shareExercise(exercise)}
                className="rounded-sm p-1 opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                aria-label="Share exercise"
                title="Share"
              >
                <Share2 className="h-4 w-4" />
              </button>
              <DialogClose className="rounded-sm p-1 opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
                <X className="h-5 w-5" />
                <span className="sr-only">Close</span>
              </DialogClose>
            </div>
          </div>
          {exercise.alternativeNames && exercise.alternativeNames.length > 0 && (
            <DialogDescription className="mt-1 text-sm text-muted-foreground">
              Also known as: {exercise.alternativeNames.join(', ')}
            </DialogDescription>
          )}
          {/* Source attribution — in the header so the footer stays action-only */}
          {!exercise.isCustom && exercise.sourceUrl && (
            <a
              href={exercise.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-sm text-primary transition-colors hover:text-primary-hover"
            >
              Source <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </DialogHeader>

        {/* Body */}
        <div className="p-6">
          {exercise.summary && (
            <p className="mb-4 text-base italic text-secondary-foreground">{exercise.summary}</p>
          )}

          {exercise.tags.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-1">
              {exercise.tags.map((tag) => (
                <Badge key={tag} variant="outline" className="border-input text-xs text-primary">
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          {exercise.description ? (
            <div
              className="prose-exercise max-w-none leading-relaxed text-secondary-foreground"
              dangerouslySetInnerHTML={{ __html: exercise.description }}
            />
          ) : (
            <p className="italic text-muted-foreground">No description available.</p>
          )}
        </div>

        {/* Footer: secondary actions left, primary action rightmost */}
        <DialogFooter className="flex flex-row flex-wrap items-center gap-2 border-t border-border px-6 py-3">
          {/* Hide/Unhide — secondary, low-frequency, leftmost */}
          {onToggleHidden && (
            <Button
              variant="outline"
              size="sm"
              onClick={onToggleHidden}
              title={isHidden ? 'Unhide this exercise' : 'Hide this exercise from the list'}
            >
              {isHidden ? (
                <>
                  <Eye className="mr-1 h-3.5 w-3.5" /> Unhide
                </>
              ) : (
                <>
                  <EyeOff className="mr-1 h-3.5 w-3.5" /> Hide
                </>
              )}
            </Button>
          )}

          {/* Primary action: Copy (sourced) or Edit/Delete (custom) — rightmost */}
          {exercise.isCustom ? (
            <>
              {onDelete && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onDelete}
                  className="text-destructive hover:text-destructive/80"
                >
                  <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
                </Button>
              )}
              {onEdit && (
                <Button variant="outline" size="sm" onClick={onEdit}>
                  <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                </Button>
              )}
            </>
          ) : (
            onCopyAsCustom && (
              <Button size="sm" onClick={onCopyAsCustom}>
                <Copy className="mr-1 h-3.5 w-3.5" /> Copy as custom
              </Button>
            )
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ExerciseDetailModal;
