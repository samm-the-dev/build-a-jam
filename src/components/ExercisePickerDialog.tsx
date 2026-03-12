/**
 * ExercisePickerDialog — Modal for browsing and adding exercises mid-session
 *
 * LEARNING NOTES - DIALOG WITH CHILD STATE:
 *
 * 1. ANGULAR vs REACT:
 *    Angular: you'd pass data to MatDialog via inject(MAT_DIALOG_DATA) and
 *    emit results back via MatDialogRef.close(result).
 *    React: the dialog is just a component with its own local state for
 *    filters. The parent passes callbacks (onAdd, onClose) as props.
 *    No special injection mechanism needed — just props and composition.
 *
 * 2. STAYING OPEN FOR MULTI-ADD:
 *    Unlike a typical "pick one and close" dialog, this stays open so
 *    users can add multiple exercises in one go. The parent handles the
 *    actual dispatch; we just call onAdd(exerciseId) for each selection.
 *    A toast (from the parent) confirms each add.
 *
 * 3. REUSING ExerciseFilterBar:
 *    We reuse the same filter bar that HomePage and PrepPage use. The
 *    idPrefix prop avoids duplicate HTML IDs since the SessionPage's
 *    filter bar would conflict otherwise.
 */

import { useState } from 'react';
import { ArrowRight, Plus } from 'lucide-react';
import { toast } from 'sonner';
import type { Exercise } from '../types';
import { useSession } from '../context/SessionContext';
import { useExerciseFilter } from '../hooks/useExerciseFilter';
import ExerciseFilterBar from './ExerciseFilterBar';
import ExerciseDetailModal from './ExerciseDetailModal';
import ExerciseFormDialog from './ExerciseFormDialog';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';

interface ExercisePickerDialogProps {
  open: boolean;
  onClose: () => void;
  onAdd: (exerciseId: string) => void;
  /** Exercise IDs already in the session queue (shown as "In queue") */
  existingExerciseIds: string[];
}

function ExercisePickerDialog({
  open,
  onClose,
  onAdd,
  existingExerciseIds,
}: ExercisePickerDialogProps) {
  const { dispatch } = useSession();
  const exerciseFilter = useExerciseFilter();
  const [detailExercise, setDetailExercise] = useState<Exercise | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(isOpen) => {
          if (!isOpen) onClose();
        }}
      >
        <DialogContent
          onSwipeDismiss={onClose}
          className="flex max-h-[85vh] max-w-2xl flex-col bg-card"
        >
          <DialogHeader>
            <DialogTitle className="text-foreground">Add Exercise</DialogTitle>
            <DialogDescription>
              Browse the library and add exercises to your running session.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <ExerciseFilterBar
              selectedSource={exerciseFilter.selectedSource}
              onSourceChange={exerciseFilter.handleSourceChange}
              featuredTags={exerciseFilter.featuredTags}
              allTags={exerciseFilter.allTags}
              selectedTags={exerciseFilter.selectedTags}
              onTagToggle={exerciseFilter.handleTagToggle}
              searchText={exerciseFilter.searchText}
              onSearchChange={exerciseFilter.setSearchText}
              idPrefix="session-picker"
            />

            <div className="mb-2 mt-3 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {exerciseFilter.filtered.length} exercise
                {exerciseFilter.filtered.length !== 1 ? 's' : ''}
              </p>
              <Button variant="outline" size="sm" onClick={() => setShowCreateForm(true)}>
                <Plus className="mr-1 h-4 w-4" /> Create
              </Button>
            </div>

            {/* Compact exercise list */}
            <div className="space-y-2">
              {exerciseFilter.sorted.map((exercise) => {
                const inQueue = existingExerciseIds.includes(exercise.id);
                return (
                  <Card key={exercise.id}>
                    <CardHeader className="px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="truncate text-sm text-primary">
                          {exercise.name}
                        </CardTitle>
                        {inQueue ? (
                          <span className="shrink-0 text-xs italic text-muted-foreground">
                            In queue
                          </span>
                        ) : (
                          <button
                            onClick={() => onAdd(exercise.id)}
                            className="shrink-0 text-sm text-primary hover:text-primary-hover"
                          >
                            + Add
                          </button>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="px-3 pb-2 pt-0">
                      {exercise.summary && (
                        <p className="line-clamp-1 text-xs text-muted-foreground">
                          {exercise.summary}
                        </p>
                      )}
                      <div className="mt-1 flex items-end justify-between">
                        <div className="flex flex-wrap gap-1">
                          {exercise.tags.slice(0, 4).map((tag) => (
                            <Badge
                              key={tag}
                              variant="outline"
                              className="border-input text-xs text-primary"
                            >
                              {tag}
                            </Badge>
                          ))}
                          {exercise.tags.length > 4 && (
                            <span className="text-xs text-muted-foreground">
                              +{exercise.tags.length - 4}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => setDetailExercise(exercise)}
                          className="ml-2 inline-flex shrink-0 items-center gap-1 text-xs text-primary transition-colors hover:text-primary-hover"
                        >
                          Details <ArrowRight className="h-3 w-3" />
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          <DialogFooter>
            <Button onClick={onClose}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail modal — stacks on top of the picker dialog */}
      {detailExercise && (
        <ExerciseDetailModal exercise={detailExercise} onClose={() => setDetailExercise(null)} />
      )}

      {/* Create exercise form — stacks on top of the picker dialog */}
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
    </>
  );
}

export default ExercisePickerDialog;
