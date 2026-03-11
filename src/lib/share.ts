/**
 * App-level share utilities — wraps the toolbox share module with toasts
 * and adds exercise-specific sharing helpers.
 *
 * LEARNING NOTES - MODULE LAYERING:
 *
 * 1. ANGULAR vs REACT:
 *    Angular: you'd extend a base service or inject a utility service into
 *    an app-specific one. React: just import a function and wrap it.
 *    No DI framework needed — ES module imports are the dependency graph.
 *
 * 2. WHY TWO LAYERS?
 *    The toolbox module (`.toolbox/lib/share.ts`) is pure — no toast
 *    dependency, returns a result enum. This module wraps it with sonner
 *    toasts and adds app-specific helpers (exercise deep links).
 *    Bio and ohm wrap the same toolbox module with their own toast
 *    implementations.
 */

import { toast } from 'sonner';
import { shareUrl as _shareUrl } from '../../.toolbox/lib/share';
import type { Exercise } from '../types';

/**
 * Share a URL with toast feedback.
 *
 * Uses the Web Share API on mobile, copies to clipboard on desktop.
 */
export async function shareUrl(url: string, title?: string): Promise<void> {
  const result = await _shareUrl(url, title);
  if (result === 'copied') toast.success('Link copied!');
  if (result === 'failed') toast.error('Could not copy link');
  // 'shared' and 'cancelled' need no toast — the OS handled it
}

/**
 * Share a specific exercise via deep link.
 *
 * Constructs a URL like `https://host/build-a-jam/?exercise=learnimprov:zip-zap-zop`
 * that opens HomePage with the exercise detail modal pre-opened.
 */
export async function shareExercise(exercise: Exercise): Promise<void> {
  // import.meta.env.BASE_URL is '/' in dev, '/build-a-jam/' in production
  const url = new URL(import.meta.env.BASE_URL, window.location.origin);
  url.searchParams.set('exercise', exercise.id);
  await shareUrl(url.toString(), exercise.name);
}
