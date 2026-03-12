/* eslint-disable react-refresh/only-export-components -- context files export hooks alongside providers */
/**
 * SessionContext — manages the Prep → Session → Notes workflow state
 *
 * LEARNING NOTES - REACT CONTEXT:
 *
 * 1. ANGULAR vs REACT:
 *    Angular: services are singletons injected via DI. State lives in the
 *    service and components subscribe to observables or signals.
 *    React: Context is the equivalent of a "global service". You create a
 *    Context, provide a value at the top of the tree, and consume it
 *    anywhere below via useContext (or a custom hook like useSession).
 *
 * 2. WHEN TO USE CONTEXT:
 *    - When multiple components at different nesting levels need the same data
 *    - When prop drilling (passing props through many layers) gets painful
 *    - Session state is a perfect example: Prep, Session, and Notes pages
 *      all need access to the current session
 *
 * 3. CONTEXT + REDUCER PATTERN:
 *    We use useReducer (not useState) because session state has multiple
 *    related actions. This is similar to Angular's NgRx/Redux pattern:
 *    dispatch an action → reducer produces new state → React re-renders.
 */

import { createContext, useContext, useReducer, useEffect, type ReactNode } from 'react';
import type { Exercise, Session, SessionExercise, CompletedSession } from '../types';
import { useStorage } from '../storage/StorageContext';
import { registerCustomExercises } from '../data/exercises';

// ---------------------------------------------------------------------------
// Storage keys
// ---------------------------------------------------------------------------

const STORAGE_KEYS = {
  CURRENT_SESSION: 'current-session',
  SESSIONS: 'sessions',
  COMPLETED_SESSIONS: 'completed-sessions',
  FAVORITE_EXERCISE_IDS: 'favorite-exercise-ids',
  CUSTOM_EXERCISES: 'custom-exercises',
  HIDDEN_EXERCISE_IDS: 'hidden-exercise-ids',
} as const;

// Runtime session state (exercise index, timer) lives in sessionStorage
// instead of localStorage. This state is ephemeral and tab-scoped:
// - Survives HMR and page refreshes (same tab) — fixes the navigation bug
// - Auto-cleans when the tab closes — no stale "exercise 3, 47s elapsed"
// - Doesn't leak across tabs — opening a second tab won't resume mid-session
//
// ANGULAR vs REACT:
// Angular services are singletons that survive route changes and HMR
// (the DI container keeps them alive). React re-initializes useReducer
// on HMR, losing in-memory state. sessionStorage bridges that gap for
// state that's too transient for localStorage but must survive reloads.
const SESSION_RUNTIME_KEY = 'session-runtime';

interface SessionRuntimeState {
  currentExerciseIndex: number | null;
  timerElapsed: number;
  timerCumulative: number;
  timerPaused: boolean;
}

function saveRuntimeState(runtime: SessionRuntimeState): void {
  try {
    sessionStorage.setItem(SESSION_RUNTIME_KEY, JSON.stringify(runtime));
  } catch {
    // sessionStorage full or unavailable — non-critical, just skip
  }
}

function loadRuntimeState(): SessionRuntimeState | null {
  try {
    const raw = sessionStorage.getItem(SESSION_RUNTIME_KEY);
    return raw ? (JSON.parse(raw) as SessionRuntimeState) : null;
  } catch {
    return null;
  }
}

function clearRuntimeState(): void {
  try {
    sessionStorage.removeItem(SESSION_RUNTIME_KEY);
  } catch {
    // non-critical
  }
}

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

interface SessionState {
  /** The session being built or run right now (null = idle) */
  currentSession: Session | null;
  /** Index of the exercise currently being run (null = not running) */
  currentExerciseIndex: number | null;
  /** Timer state — persisted so it survives route changes */
  timerElapsed: number;
  timerCumulative: number;
  timerPaused: boolean;
  /** Saved sessions (templates and one-offs) */
  sessions: Session[];
  /** History of completed sessions */
  completedSessions: CompletedSession[];
  /** IDs of individually-starred exercises */
  favoriteExerciseIds: string[];
  /** IDs of exercises the user has hidden (anti-favorite) */
  hiddenExerciseIds: string[];
  /** User-created exercises (persisted to storage, synced to exercises.ts) */
  customExercises: Exercise[];
  /** Whether initial load from storage has finished */
  loaded: boolean;
}

const initialState: SessionState = {
  currentSession: null,
  currentExerciseIndex: null,
  timerElapsed: 0,
  timerCumulative: 0,
  timerPaused: false,
  sessions: [],
  completedSessions: [],
  favoriteExerciseIds: [],
  hiddenExerciseIds: [],
  customExercises: [],
  loaded: false,
};

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

type SessionAction =
  | {
      type: 'HYDRATE';
      sessions: Session[];
      completedSessions: CompletedSession[];
      currentSession: Session | null;
      favoriteExerciseIds: string[];
      hiddenExerciseIds: string[];
      customExercises: Exercise[];
    }
  | { type: 'CREATE_SESSION'; name?: string }
  | { type: 'LOAD_SESSION'; session: Session }
  | { type: 'ADD_EXERCISE'; exerciseId: string; duration: number }
  | { type: 'REMOVE_EXERCISE'; index: number }
  | { type: 'SET_DURATION'; index: number; duration: number }
  | { type: 'SET_EXERCISE_NOTES'; index: number; notes: string }
  | { type: 'SET_ACTUAL_DURATION'; index: number; actualSeconds: number }
  | { type: 'INSERT_EXERCISE'; exerciseId: string; duration: number; atIndex: number }
  | { type: 'REORDER_EXERCISES'; from: number; to: number }
  | { type: 'START_SESSION' }
  | { type: 'NEXT_EXERCISE' }
  | { type: 'COMPLETE_SESSION'; notes: string }
  | { type: 'SAVE_AS_TEMPLATE'; name: string }
  | { type: 'CLEAR_SESSION' }
  | { type: 'DELETE_COMPLETED_SESSION'; index: number }
  | { type: 'CLEAR_COMPLETED_SESSIONS' }
  | { type: 'TOGGLE_FAVORITE_EXERCISE'; exerciseId: string }
  | { type: 'DELETE_SESSION_TEMPLATE'; sessionId: string }
  | { type: 'RENAME_SESSION_TEMPLATE'; sessionId: string; name: string }
  | { type: 'UPDATE_SESSION_TEMPLATE'; sessionId: string }
  | { type: 'SAVE_COMPLETED_AS_TEMPLATE'; completedSessionIndex: number; name: string }
  | { type: 'TIMER_TICK' }
  | { type: 'TIMER_PAUSE' }
  | { type: 'TIMER_RESUME' }
  | { type: 'TIMER_RESET' }
  | { type: 'ADD_CUSTOM_EXERCISE'; exercise: Exercise }
  | { type: 'UPDATE_CUSTOM_EXERCISE'; exercise: Exercise }
  | { type: 'DELETE_CUSTOM_EXERCISE'; exerciseId: string }
  | { type: 'TOGGLE_HIDDEN_EXERCISE'; exerciseId: string };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function reorder<T>(list: T[], from: number, to: number): T[] {
  const result = [...list];
  const [moved] = result.splice(from, 1);
  result.splice(to, 0, moved);
  return result.map((item, i) => ({ ...item, order: i }));
}

// ---------------------------------------------------------------------------
// Timer Sub-Reducer
// ---------------------------------------------------------------------------
//
// LEARNING NOTES - SUB-REDUCERS (REDUCER COMPOSITION):
//
// 1. WHAT IS A SUB-REDUCER?
//    A sub-reducer is a smaller reducer function that handles a slice of state.
//    The main reducer delegates to it for specific actions. This keeps each
//    reducer focused and testable.
//
// 2. ANGULAR vs REACT:
//    Angular/NgRx: Feature modules often have their own "slice" of the store.
//    @ngrx/store composes reducers automatically via combineReducers() or
//    StoreModule.forFeature(). Each feature reducer only sees its slice of state.
//
//    React: useReducer doesn't have built-in composition, so you do it manually.
//    The main reducer extracts the relevant state slice, passes it to the
//    sub-reducer, then merges the result back. More explicit, less magic.
//
// 3. WHEN TO USE SUB-REDUCERS:
//    - When a group of actions form a logical unit (timer, auth, cart, etc.)
//    - When the main reducer gets too long to read easily
//    - When you want to test a subset of logic in isolation
//    - When multiple reducers might share the same sub-reducer (DRY)
//
// 4. PATTERN:
//    The sub-reducer takes only the state slice it cares about:
//      timerReducer({ elapsed, cumulative, paused }, action) → new slice
//
//    The main reducer spreads the slice back into the full state:
//      return { ...state, ...timerReducer(timerSlice, action) };

/**
 * Timer state slice — the subset of SessionState that the timer sub-reducer manages.
 * Keeping this explicit makes it clear what the sub-reducer owns.
 */
interface TimerState {
  timerElapsed: number;
  timerCumulative: number;
  timerPaused: boolean;
}

/**
 * Timer actions — the subset of SessionAction that the timer sub-reducer handles.
 * TypeScript's discriminated union makes the switch exhaustive.
 */
type TimerAction =
  | { type: 'TIMER_TICK' }
  | { type: 'TIMER_PAUSE' }
  | { type: 'TIMER_RESUME' }
  | { type: 'TIMER_RESET' };

/**
 * Timer sub-reducer — handles all timer-related state transitions.
 *
 * This is a pure function that only knows about timer state. It doesn't know
 * about sessions, exercises, or any other part of the app. This isolation:
 * - Makes it easy to test (just pass timer state and actions)
 * - Makes it easy to reason about (all timer logic in one place)
 * - Makes it reusable (could be used by a different feature that needs a timer)
 */
function timerReducer(state: TimerState, action: TimerAction): TimerState {
  switch (action.type) {
    case 'TIMER_TICK':
      if (state.timerPaused) return state;
      return {
        ...state,
        // Defensive ?? 0 guards against HMR injecting new fields into
        // already-running state where timerElapsed might be undefined
        timerElapsed: (state.timerElapsed ?? 0) + 1,
        timerCumulative: (state.timerCumulative ?? 0) + 1,
      };

    case 'TIMER_PAUSE':
      return { ...state, timerPaused: true };

    case 'TIMER_RESUME':
      return { ...state, timerPaused: false };

    case 'TIMER_RESET':
      return { ...state, timerElapsed: 0 };
  }
}

// ---------------------------------------------------------------------------
// Main Reducer
// ---------------------------------------------------------------------------

/** Backfill slotId on exercises persisted before slotId was added (needed for DnD) */
function ensureSlotIds(exercises: SessionExercise[]): SessionExercise[] {
  return exercises.map((ex) => ({
    ...ex,
    slotId: ex.slotId ?? generateId(),
  }));
}

function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case 'HYDRATE': {
      // Backfill slotId on any session exercises that were persisted before
      // slotId was added (needed for drag-and-drop to work correctly)
      const hydratedSession = action.currentSession
        ? {
            ...action.currentSession,
            exercises: ensureSlotIds(action.currentSession.exercises),
          }
        : null;

      // Restore runtime state (exercise index, timer) from sessionStorage.
      // This survives HMR and page refreshes without polluting localStorage.
      const runtime = loadRuntimeState();
      // Only restore if there's an active session — stale runtime state from
      // a previous session should be ignored.
      const hasActiveSession = hydratedSession !== null;

      return {
        ...state,
        sessions: action.sessions,
        completedSessions: action.completedSessions,
        currentSession: hydratedSession,
        favoriteExerciseIds: action.favoriteExerciseIds,
        hiddenExerciseIds: action.hiddenExerciseIds ?? [],
        customExercises: action.customExercises ?? [],
        // Restore runtime state if we have an active session
        currentExerciseIndex: hasActiveSession && runtime ? runtime.currentExerciseIndex : null,
        timerElapsed: hasActiveSession && runtime ? runtime.timerElapsed : 0,
        timerCumulative: hasActiveSession && runtime ? runtime.timerCumulative : 0,
        timerPaused: hasActiveSession && runtime ? runtime.timerPaused : false,
        loaded: true,
      };
    }

    case 'CREATE_SESSION':
      return {
        ...state,
        currentSession: {
          id: generateId(),
          name: action.name,
          exercises: [],
          createdAt: new Date().toISOString(),
          isTemplate: false,
        },
        currentExerciseIndex: null,
      };

    case 'LOAD_SESSION':
      return {
        ...state,
        currentSession: {
          ...action.session,
          // Give it a new ID so the original template isn't mutated
          id: generateId(),
          createdAt: new Date().toISOString(),
          isTemplate: false,
          // Track which template this session came from (for update flow in NotesPage)
          sourceTemplateId: action.session.isTemplate ? action.session.id : undefined,
          // Ensure every exercise has a slotId for drag-and-drop stability.
          // Templates saved before slotId was added won't have them.
          exercises: ensureSlotIds(action.session.exercises),
        },
        currentExerciseIndex: null,
      };

    case 'ADD_EXERCISE': {
      if (!state.currentSession) return state;
      const newExercise: SessionExercise = {
        exerciseId: action.exerciseId,
        duration: action.duration,
        order: state.currentSession.exercises.length,
        slotId: generateId(),
      };
      return {
        ...state,
        currentSession: {
          ...state.currentSession,
          exercises: [...state.currentSession.exercises, newExercise],
        },
      };
    }

    // INSERT_EXERCISE — positional insertion used during live queue editing.
    // Unlike ADD_EXERCISE (which always appends), this inserts at a specific
    // index and adjusts currentExerciseIndex if needed.
    //
    // ANGULAR vs REACT:
    // Same pattern difference as ADD_EXERCISE. The key learning here is that
    // the reducer handles *all* the index bookkeeping in one place — the
    // component just says "insert at index 3" and the reducer figures out
    // whether the active pointer needs to move.
    case 'INSERT_EXERCISE': {
      if (!state.currentSession) return state;
      const newExercise: SessionExercise = {
        exerciseId: action.exerciseId,
        duration: action.duration,
        order: 0, // recalculated below
        slotId: generateId(),
      };
      const exercises = [...state.currentSession.exercises];
      exercises.splice(action.atIndex, 0, newExercise);
      const reordered = exercises.map((ex, i) => ({ ...ex, order: i }));

      // If inserting at or before the current exercise, bump the index
      let newIndex = state.currentExerciseIndex;
      if (newIndex !== null && action.atIndex <= newIndex) {
        newIndex = newIndex + 1;
      }

      return {
        ...state,
        currentSession: {
          ...state.currentSession,
          exercises: reordered,
        },
        currentExerciseIndex: newIndex,
      };
    }

    case 'REMOVE_EXERCISE': {
      if (!state.currentSession) return state;
      const filtered = state.currentSession.exercises
        .filter((_, i) => i !== action.index)
        .map((ex, i) => ({ ...ex, order: i }));

      // LEARNING NOTE — INDEX MANAGEMENT IN REDUCERS:
      // When a session is active, removing an exercise shifts indices.
      // If we remove an exercise *before* the current one, the current
      // pointer needs to shift down by 1 to keep pointing at the same
      // exercise. Removing *after* the current one requires no change.
      // Removing the *current* exercise is prevented in the UI, but we
      // handle it defensively here anyway.
      let newIndex = state.currentExerciseIndex;
      if (newIndex !== null) {
        if (action.index < newIndex) {
          newIndex = newIndex - 1;
        } else if (action.index === newIndex) {
          // Defensive: current exercise removed — clamp to valid range
          if (newIndex >= filtered.length) {
            newIndex = filtered.length > 0 ? filtered.length - 1 : null;
          }
        }
        // If queue is now empty, end the session
        if (filtered.length === 0) newIndex = null;
      }

      return {
        ...state,
        currentSession: {
          ...state.currentSession,
          exercises: filtered,
        },
        currentExerciseIndex: newIndex,
      };
    }

    case 'SET_DURATION': {
      if (!state.currentSession) return state;
      const updated = state.currentSession.exercises.map((ex, i) =>
        i === action.index ? { ...ex, duration: action.duration } : ex,
      );
      return {
        ...state,
        currentSession: {
          ...state.currentSession,
          exercises: updated,
        },
      };
    }

    case 'SET_EXERCISE_NOTES': {
      if (!state.currentSession) return state;
      const updated = state.currentSession.exercises.map((ex, i) =>
        i === action.index ? { ...ex, notes: action.notes } : ex,
      );
      return {
        ...state,
        currentSession: {
          ...state.currentSession,
          exercises: updated,
        },
      };
    }

    case 'SET_ACTUAL_DURATION': {
      if (!state.currentSession) return state;
      const updated = state.currentSession.exercises.map((ex, i) =>
        i === action.index ? { ...ex, actualSeconds: action.actualSeconds } : ex,
      );
      return {
        ...state,
        currentSession: {
          ...state.currentSession,
          exercises: updated,
        },
      };
    }

    case 'REORDER_EXERCISES': {
      if (!state.currentSession) return state;
      const reorderedExercises = reorder(state.currentSession.exercises, action.from, action.to);

      // Track where the currently-running exercise ended up after the move.
      // This future-proofs for drag-and-drop reordering during a session.
      let newIdx = state.currentExerciseIndex;
      if (newIdx !== null) {
        if (action.from === newIdx) {
          newIdx = action.to;
        } else if (action.from < newIdx && action.to >= newIdx) {
          newIdx = newIdx - 1;
        } else if (action.from > newIdx && action.to <= newIdx) {
          newIdx = newIdx + 1;
        }
      }

      return {
        ...state,
        currentSession: {
          ...state.currentSession,
          exercises: reorderedExercises,
        },
        currentExerciseIndex: newIdx,
      };
    }

    case 'START_SESSION':
      if (!state.currentSession || state.currentSession.exercises.length === 0) {
        return state;
      }
      return {
        ...state,
        currentExerciseIndex: 0,
        timerElapsed: 0,
        timerCumulative: 0,
        timerPaused: false,
      };

    case 'NEXT_EXERCISE': {
      if (state.currentExerciseIndex === null || !state.currentSession) return state;
      const next = state.currentExerciseIndex + 1;
      if (next >= state.currentSession.exercises.length) {
        // Past the last exercise — session is done
        return { ...state, currentExerciseIndex: null };
      }
      return { ...state, currentExerciseIndex: next, timerElapsed: 0, timerPaused: false };
    }

    case 'COMPLETE_SESSION': {
      if (!state.currentSession) return state;
      const completed: CompletedSession = {
        sessionId: state.currentSession.id,
        completedAt: new Date().toISOString(),
        exercises: state.currentSession.exercises,
        notes: action.notes,
      };
      return {
        ...state,
        completedSessions: [...state.completedSessions, completed],
        currentSession: null,
        currentExerciseIndex: null,
      };
    }

    case 'SAVE_AS_TEMPLATE': {
      if (!state.currentSession) return state;
      const template: Session = {
        ...state.currentSession,
        name: action.name,
        isTemplate: true,
      };
      return {
        ...state,
        sessions: [...state.sessions, template],
      };
    }

    case 'CLEAR_SESSION':
      return {
        ...state,
        currentSession: null,
        currentExerciseIndex: null,
      };

    case 'DELETE_COMPLETED_SESSION':
      return {
        ...state,
        completedSessions: state.completedSessions.filter((_, i) => i !== action.index),
      };

    case 'CLEAR_COMPLETED_SESSIONS':
      return {
        ...state,
        completedSessions: [],
      };

    case 'TOGGLE_FAVORITE_EXERCISE': {
      const ids = state.favoriteExerciseIds;
      const exists = ids.includes(action.exerciseId);
      return {
        ...state,
        favoriteExerciseIds: exists
          ? ids.filter((id) => id !== action.exerciseId)
          : [...ids, action.exerciseId],
      };
    }

    case 'DELETE_SESSION_TEMPLATE':
      return {
        ...state,
        sessions: state.sessions.filter((s) => s.id !== action.sessionId),
      };

    case 'RENAME_SESSION_TEMPLATE':
      return {
        ...state,
        sessions: state.sessions.map((s) =>
          s.id === action.sessionId ? { ...s, name: action.name } : s,
        ),
      };

    // UPDATE_SESSION_TEMPLATE — replace an existing template's exercises with current session
    // Used when user loads a template, modifies it during session, and wants to save changes
    // back to the original template instead of creating a new one.
    case 'UPDATE_SESSION_TEMPLATE': {
      if (!state.currentSession) return state;
      return {
        ...state,
        sessions: state.sessions.map((s) =>
          s.id === action.sessionId
            ? {
                ...s,
                exercises: state.currentSession!.exercises.map(
                  ({ exerciseId, duration, order }) => ({
                    exerciseId,
                    duration,
                    order,
                  }),
                ),
              }
            : s,
        ),
      };
    }

    case 'SAVE_COMPLETED_AS_TEMPLATE': {
      const completed = state.completedSessions[action.completedSessionIndex];
      if (!completed) return state;
      const template: Session = {
        id: generateId(),
        name: action.name,
        exercises: completed.exercises.map(({ exerciseId, duration, order }) => ({
          exerciseId,
          duration,
          order,
        })),
        createdAt: new Date().toISOString(),
        isTemplate: true,
      };
      return {
        ...state,
        sessions: [...state.sessions, template],
      };
    }

    // CUSTOM EXERCISE ACTIONS — CRUD for user-created exercises.
    //
    // ANGULAR vs REACT:
    // Angular: you'd have a service with methods like addExercise(),
    // updateExercise(), deleteExercise() that modify the service's
    // internal state (observable or signal).
    // React: these are reducer actions — pure functions that produce
    // new state. The pattern scales well: each action is independent,
    // and the reducer handles side effects (like cleaning up favorites
    // when an exercise is deleted).

    case 'ADD_CUSTOM_EXERCISE':
      return {
        ...state,
        customExercises: [...state.customExercises, action.exercise],
      };

    case 'UPDATE_CUSTOM_EXERCISE':
      return {
        ...state,
        customExercises: state.customExercises.map((ex) =>
          ex.id === action.exercise.id ? action.exercise : ex,
        ),
      };

    case 'DELETE_CUSTOM_EXERCISE':
      return {
        ...state,
        customExercises: state.customExercises.filter((ex) => ex.id !== action.exerciseId),
        // Also remove from favorites and hidden if starred or hidden
        favoriteExerciseIds: state.favoriteExerciseIds.filter((id) => id !== action.exerciseId),
        hiddenExerciseIds: state.hiddenExerciseIds.filter((id) => id !== action.exerciseId),
      };

    case 'TOGGLE_HIDDEN_EXERCISE': {
      const ids = state.hiddenExerciseIds;
      const exists = ids.includes(action.exerciseId);
      return {
        ...state,
        hiddenExerciseIds: exists
          ? ids.filter((id) => id !== action.exerciseId)
          : [...ids, action.exerciseId],
      };
    }

    // TIMER ACTIONS — delegated to the timer sub-reducer.
    //
    // Timer state persists in the reducer so it survives route changes.
    // Without this, navigating away from SessionPage and back would reset
    // the timer to 0 (because local useState resets on unmount).
    //
    // DELEGATION PATTERN:
    // 1. Extract the timer slice from full state
    // 2. Pass slice + action to timerReducer
    // 3. Spread the result back into full state
    //
    // This keeps timer logic isolated while still producing a full SessionState.
    case 'TIMER_TICK':
    case 'TIMER_PAUSE':
    case 'TIMER_RESUME':
    case 'TIMER_RESET': {
      const timerSlice: TimerState = {
        timerElapsed: state.timerElapsed,
        timerCumulative: state.timerCumulative,
        timerPaused: state.timerPaused,
      };
      return {
        ...state,
        ...timerReducer(timerSlice, action),
      };
    }

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Context + Provider
// ---------------------------------------------------------------------------

interface SessionContextValue {
  state: SessionState;
  dispatch: React.Dispatch<SessionAction>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(sessionReducer, initialState);
  const storage = useStorage();

  // Load persisted state on mount
  useEffect(() => {
    async function hydrate() {
      const [
        sessions,
        completedSessions,
        currentSession,
        favoriteExerciseIds,
        hiddenExerciseIds,
        customExercises,
      ] = await Promise.all([
        storage.load<Session[]>(STORAGE_KEYS.SESSIONS),
        storage.load<CompletedSession[]>(STORAGE_KEYS.COMPLETED_SESSIONS),
        storage.load<Session>(STORAGE_KEYS.CURRENT_SESSION),
        storage.load<string[]>(STORAGE_KEYS.FAVORITE_EXERCISE_IDS),
        storage.load<string[]>(STORAGE_KEYS.HIDDEN_EXERCISE_IDS),
        storage.load<Exercise[]>(STORAGE_KEYS.CUSTOM_EXERCISES),
      ]);
      dispatch({
        type: 'HYDRATE',
        sessions: sessions ?? [],
        completedSessions: completedSessions ?? [],
        currentSession: currentSession ?? null,
        favoriteExerciseIds: favoriteExerciseIds ?? [],
        hiddenExerciseIds: hiddenExerciseIds ?? [],
        customExercises: customExercises ?? [],
      });
    }
    void hydrate();
  }, [storage]);

  // Persist on every state change (after initial hydration)
  useEffect(() => {
    if (!state.loaded) return;
    void storage.save(STORAGE_KEYS.SESSIONS, state.sessions);
    void storage.save(STORAGE_KEYS.COMPLETED_SESSIONS, state.completedSessions);
    void storage.save(STORAGE_KEYS.FAVORITE_EXERCISE_IDS, state.favoriteExerciseIds);
    void storage.save(STORAGE_KEYS.HIDDEN_EXERCISE_IDS, state.hiddenExerciseIds);
    void storage.save(STORAGE_KEYS.CUSTOM_EXERCISES, state.customExercises);
    if (state.currentSession) {
      void storage.save(STORAGE_KEYS.CURRENT_SESSION, state.currentSession);
    } else {
      void storage.remove(STORAGE_KEYS.CURRENT_SESSION);
    }
  }, [
    state.sessions,
    state.completedSessions,
    state.currentSession,
    state.favoriteExerciseIds,
    state.hiddenExerciseIds,
    state.customExercises,
    state.loaded,
    storage,
  ]);

  // Persist runtime session state (exercise index, timer) to sessionStorage.
  // This runs on every tick, but sessionStorage writes are synchronous and fast
  // (~0.01ms), so the overhead is negligible compared to the 1-second timer interval.
  useEffect(() => {
    if (!state.loaded) return;
    if (state.currentExerciseIndex !== null) {
      saveRuntimeState({
        currentExerciseIndex: state.currentExerciseIndex,
        timerElapsed: state.timerElapsed,
        timerCumulative: state.timerCumulative,
        timerPaused: state.timerPaused,
      });
    } else {
      // Session not running (idle, completed, or cleared) — clean up
      clearRuntimeState();
    }
  }, [
    state.loaded,
    state.currentExerciseIndex,
    state.timerElapsed,
    state.timerCumulative,
    state.timerPaused,
  ]);

  // Bridge React state → module-level data in exercises.ts.
  // This lets getExerciseById(), filterBySource(), etc. see custom exercises
  // without threading context through every call site.
  //
  // REACT LEARNING NOTE — SYNCING STATE TO NON-REACT CODE:
  // This useEffect runs after every render where customExercises changed.
  // It's an "escape hatch" — React state is the source of truth, and we're
  // syncing a snapshot to a module variable. The Angular equivalent would be
  // a service subscribing to its own Observable and updating a cache.
  useEffect(() => {
    registerCustomExercises(state.customExercises);
  }, [state.customExercises]);

  return <SessionContext.Provider value={{ state, dispatch }}>{children}</SessionContext.Provider>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Access session state and dispatch actions.
 *
 * Usage:
 *   const { state, dispatch } = useSession();
 *   dispatch({ type: 'ADD_EXERCISE', exerciseId: '...', duration: 5 });
 */
export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error('useSession must be used within a <SessionProvider>');
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// Testing exports — used by unit tests to test reducer logic directly
// ---------------------------------------------------------------------------

export { sessionReducer as _testReducer, initialState as _testInitialState };
export { timerReducer as _testTimerReducer };
export type { SessionState as _TestSessionState, SessionAction as _TestSessionAction };
export type { TimerState as _TestTimerState, TimerAction as _TestTimerAction };
