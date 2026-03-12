/**
 * Type definitions for Build-a-Jam
 *
 * ANGULAR vs REACT:
 * - In Angular: you'd use interfaces in a *.model.ts file
 * - In React: same pattern, just TypeScript interfaces
 * - No decorators needed like @Injectable or @Component
 */

// ---------------------------------------------------------------------------
// Exercise Library
// ---------------------------------------------------------------------------

/**
 * An exercise in the library. This is the "what it is" definition —
 * duration lives on SessionExercise because it depends on context.
 */
export interface Exercise {
  id: string;
  name: string;
  tags: string[]; // normalized tags (lowercase, deduplicated, filtered)
  description: string; // concise AI-generated description (HTML or plain text)
  descriptionOriginal?: string; // full scraped description (cleaned HTML)
  description_raw?: string; // original HTML from source (before cleaning)
  summary?: string; // 1-2 line summary for quick scanning (optional)
  alternativeNames?: string[]; // other names this exercise goes by
  sourceUrl?: string; // attribution link back to origin site
  rawTags?: string[]; // original tags from source (before normalization)
  isCustom?: boolean; // true for user-created exercises
}

// ---------------------------------------------------------------------------
// Session Planning & Execution
// ---------------------------------------------------------------------------

/**
 * An exercise placed into a session queue. Duration is set here because
 * the same exercise might be 5 minutes in a quick warm-up or 15 minutes
 * when you want to dig deep.
 */
export interface SessionExercise {
  exerciseId: string; // reference to Exercise.id
  duration: number; // minutes — set during session prep
  order: number; // position in the queue
  slotId?: string; // unique ID per queue slot (for drag-and-drop stability)
  notes?: string; // notes specific to this slot
  actualSeconds?: number; // actual time spent (seconds), recorded during session
}

/**
 * A planned session — either a one-off or a reusable template.
 *
 * Dates are stored as ISO 8601 strings (not Date objects) so they
 * survive JSON serialisation to/from localStorage without needing
 * a reviver. Use `new Date(session.createdAt)` when you need a
 * Date object for display.
 */
export interface Session {
  id: string;
  name?: string; // optional label for templates
  exercises: SessionExercise[];
  createdAt: string; // ISO 8601
  isTemplate: boolean; // true = saved for reuse
  sourceTemplateId?: string; // ID of template this session was loaded from (for update flow)
}

/**
 * What actually happened after running a session.
 */
export interface CompletedSession {
  sessionId: string; // reference to Session.id
  completedAt: string; // ISO 8601
  exercises: SessionExercise[]; // what was actually run
  notes: string; // post-session reflections
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

/**
 * Async storage abstraction.
 *
 * ANGULAR vs REACT:
 * - Angular: you'd create an injectable service with an interface, then
 *   swap implementations via the DI container (useClass / useFactory)
 * - React: we expose the implementation through Context and consume it
 *   via a useStorage() hook. Swapping backends means changing which
 *   provider is rendered at the top of the tree.
 *
 * The interface is async even though localStorage is synchronous —
 * Google Drive, IndexedDB, or any future backend will be async, and
 * making all callers async from the start avoids a rewrite later.
 */
export interface StorageProvider {
  load<T>(key: string): Promise<T | null>;
  save<T>(key: string, data: T): Promise<void>;
  remove(key: string): Promise<void>;
}
