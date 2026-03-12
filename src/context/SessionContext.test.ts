/**
 * SessionContext reducer tests
 *
 * LEARNING NOTES - TESTING REDUCERS:
 *
 * 1. WHY REDUCERS ARE EASY TO TEST:
 *    Reducers are pure functions: given the same (state, action), they always
 *    return the same new state. No side effects, no async, no DOM.
 *    This makes them ideal for unit testing.
 *
 * 2. TEST PATTERN:
 *    - Set up initial state (often the real initial state + some modifications)
 *    - Dispatch an action
 *    - Assert the resulting state matches expectations
 *
 * 3. ANGULAR vs REACT:
 *    Angular/NgRx: you'd test reducers the same way — pure functions.
 *    The testing pattern is identical because reducers are framework-agnostic.
 */

import { describe, it, expect } from 'vitest';
import {
  _testReducer as reducer,
  _testInitialState as initialState,
  _testTimerReducer as timerReducer,
  type _TestSessionState as SessionState,
  type _TestTimerState as TimerState,
} from './SessionContext';
import type { Exercise, Session } from '../types';

// Helper to create a mock exercise
function mockExercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: 'custom:test-ex',
    name: 'Test Exercise',
    tags: [],
    description: '',
    isCustom: true,
    ...overrides,
  };
}

// Helper to create a mock session
function mockSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'test-session-1',
    exercises: [],
    isTemplate: false,
    createdAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('sessionReducer', () => {
  // -------------------------------------------------------------------------
  // CREATE_SESSION
  // -------------------------------------------------------------------------
  describe('CREATE_SESSION', () => {
    it('creates a new empty session', () => {
      const state = reducer(initialState, { type: 'CREATE_SESSION' });

      expect(state.currentSession).not.toBeNull();
      expect(state.currentSession?.exercises).toEqual([]);
      expect(state.currentSession?.isTemplate).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // ADD_EXERCISE
  // -------------------------------------------------------------------------
  describe('ADD_EXERCISE', () => {
    it('adds an exercise to an empty queue', () => {
      // First create a session
      let state = reducer(initialState, { type: 'CREATE_SESSION' });

      // Add an exercise
      state = reducer(state, {
        type: 'ADD_EXERCISE',
        exerciseId: 'learnimprov:zip-zap-zop',
        duration: 10,
      });

      expect(state.currentSession?.exercises).toHaveLength(1);
      expect(state.currentSession?.exercises[0].exerciseId).toBe('learnimprov:zip-zap-zop');
      expect(state.currentSession?.exercises[0].duration).toBe(10);
    });

    it('appends exercises to existing queue', () => {
      let state = reducer(initialState, { type: 'CREATE_SESSION' });
      state = reducer(state, { type: 'ADD_EXERCISE', exerciseId: 'ex1', duration: 5 });
      state = reducer(state, { type: 'ADD_EXERCISE', exerciseId: 'ex2', duration: 10 });

      expect(state.currentSession?.exercises).toHaveLength(2);
      expect(state.currentSession?.exercises[0].exerciseId).toBe('ex1');
      expect(state.currentSession?.exercises[1].exerciseId).toBe('ex2');
    });

    it('does nothing if no session exists', () => {
      const state = reducer(initialState, {
        type: 'ADD_EXERCISE',
        exerciseId: 'ex1',
        duration: 5,
      });

      expect(state.currentSession).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // REMOVE_EXERCISE
  // -------------------------------------------------------------------------
  describe('REMOVE_EXERCISE', () => {
    it('removes an exercise by index', () => {
      let state = reducer(initialState, { type: 'CREATE_SESSION' });
      state = reducer(state, { type: 'ADD_EXERCISE', exerciseId: 'ex1', duration: 5 });
      state = reducer(state, { type: 'ADD_EXERCISE', exerciseId: 'ex2', duration: 5 });
      state = reducer(state, { type: 'ADD_EXERCISE', exerciseId: 'ex3', duration: 5 });

      state = reducer(state, { type: 'REMOVE_EXERCISE', index: 1 });

      expect(state.currentSession?.exercises).toHaveLength(2);
      expect(state.currentSession?.exercises[0].exerciseId).toBe('ex1');
      expect(state.currentSession?.exercises[1].exerciseId).toBe('ex3');
    });
  });

  // -------------------------------------------------------------------------
  // START_SESSION
  // -------------------------------------------------------------------------
  describe('START_SESSION', () => {
    it('sets currentExerciseIndex to 0', () => {
      let state = reducer(initialState, { type: 'CREATE_SESSION' });
      state = reducer(state, { type: 'ADD_EXERCISE', exerciseId: 'ex1', duration: 5 });

      state = reducer(state, { type: 'START_SESSION' });

      expect(state.currentExerciseIndex).toBe(0);
    });

    it('resets timer state', () => {
      let state: SessionState = {
        ...initialState,
        currentSession: mockSession({ exercises: [{ exerciseId: 'ex1', duration: 5, order: 0 }] }),
        timerElapsed: 100,
        timerCumulative: 500,
      };

      state = reducer(state, { type: 'START_SESSION' });

      expect(state.timerElapsed).toBe(0);
      expect(state.timerCumulative).toBe(0);
      expect(state.timerPaused).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // TIMER_TICK (via main reducer delegation)
  // -------------------------------------------------------------------------
  describe('TIMER_TICK', () => {
    it('increments elapsed and cumulative time by 1 second', () => {
      const state: SessionState = {
        ...initialState,
        timerElapsed: 10,
        timerCumulative: 100,
      };

      const newState = reducer(state, { type: 'TIMER_TICK' });

      expect(newState.timerElapsed).toBe(11);
      expect(newState.timerCumulative).toBe(101);
    });
  });

  // -------------------------------------------------------------------------
  // TOGGLE_FAVORITE_EXERCISE
  // -------------------------------------------------------------------------
  describe('TOGGLE_FAVORITE_EXERCISE', () => {
    it('adds exercise to favorites when not favorited', () => {
      const state = reducer(initialState, {
        type: 'TOGGLE_FAVORITE_EXERCISE',
        exerciseId: 'ex1',
      });

      expect(state.favoriteExerciseIds).toContain('ex1');
    });

    it('removes exercise from favorites when already favorited', () => {
      const state: SessionState = {
        ...initialState,
        favoriteExerciseIds: ['ex1', 'ex2'],
      };

      const newState = reducer(state, {
        type: 'TOGGLE_FAVORITE_EXERCISE',
        exerciseId: 'ex1',
      });

      expect(newState.favoriteExerciseIds).not.toContain('ex1');
      expect(newState.favoriteExerciseIds).toContain('ex2');
    });
  });

  // -------------------------------------------------------------------------
  // RENAME_SESSION_TEMPLATE
  // -------------------------------------------------------------------------
  describe('RENAME_SESSION_TEMPLATE', () => {
    it('updates the name of a session template', () => {
      const template: Session = {
        id: 'template-1',
        name: 'Old Name',
        exercises: [],
        isTemplate: true,
        createdAt: '2024-01-01T00:00:00.000Z',
      };

      const state: SessionState = {
        ...initialState,
        sessions: [template],
      };

      const newState = reducer(state, {
        type: 'RENAME_SESSION_TEMPLATE',
        sessionId: 'template-1',
        name: 'New Name',
      });

      expect(newState.sessions[0].name).toBe('New Name');
    });
  });

  // -------------------------------------------------------------------------
  // NEXT_EXERCISE
  // -------------------------------------------------------------------------
  describe('NEXT_EXERCISE', () => {
    it('advances to the next exercise and resets elapsed timer', () => {
      const state: SessionState = {
        ...initialState,
        currentSession: mockSession({
          exercises: [
            { exerciseId: 'ex1', duration: 5, order: 0 },
            { exerciseId: 'ex2', duration: 5, order: 1 },
          ],
        }),
        currentExerciseIndex: 0,
        timerElapsed: 300,
        timerCumulative: 300,
      };

      const newState = reducer(state, { type: 'NEXT_EXERCISE' });

      expect(newState.currentExerciseIndex).toBe(1);
      expect(newState.timerElapsed).toBe(0);
      // Cumulative should NOT reset
      expect(newState.timerCumulative).toBe(300);
    });

    it('sets index to null when completing the last exercise', () => {
      const state: SessionState = {
        ...initialState,
        currentSession: mockSession({
          exercises: [{ exerciseId: 'ex1', duration: 5, order: 0 }],
        }),
        currentExerciseIndex: 0,
      };

      const newState = reducer(state, { type: 'NEXT_EXERCISE' });

      expect(newState.currentExerciseIndex).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // TOGGLE_HIDDEN_EXERCISE
  // -------------------------------------------------------------------------
  describe('TOGGLE_HIDDEN_EXERCISE', () => {
    it('adds exercise to hidden list when not hidden', () => {
      const state = reducer(initialState, {
        type: 'TOGGLE_HIDDEN_EXERCISE',
        exerciseId: 'ex1',
      });

      expect(state.hiddenExerciseIds).toContain('ex1');
    });

    it('removes exercise from hidden list when already hidden', () => {
      const state: SessionState = {
        ...initialState,
        hiddenExerciseIds: ['ex1', 'ex2'],
      };

      const newState = reducer(state, {
        type: 'TOGGLE_HIDDEN_EXERCISE',
        exerciseId: 'ex1',
      });

      expect(newState.hiddenExerciseIds).not.toContain('ex1');
      expect(newState.hiddenExerciseIds).toContain('ex2');
    });
  });

  // -------------------------------------------------------------------------
  // ADD_CUSTOM_EXERCISE
  // -------------------------------------------------------------------------
  describe('ADD_CUSTOM_EXERCISE', () => {
    const customExercise = mockExercise({ id: 'custom:test-ex-abc1', tags: ['warm-up'] });

    it('adds a custom exercise to the list', () => {
      const state = reducer(initialState, {
        type: 'ADD_CUSTOM_EXERCISE',
        exercise: customExercise,
      });

      expect(state.customExercises).toHaveLength(1);
      expect(state.customExercises[0].id).toBe('custom:test-ex-abc1');
    });

    it('appends to existing custom exercises', () => {
      const state: SessionState = {
        ...initialState,
        customExercises: [mockExercise({ id: 'custom:existing', name: 'Existing' })],
      };

      const newState = reducer(state, {
        type: 'ADD_CUSTOM_EXERCISE',
        exercise: customExercise,
      });

      expect(newState.customExercises).toHaveLength(2);
      expect(newState.customExercises[1].id).toBe('custom:test-ex-abc1');
    });
  });

  // -------------------------------------------------------------------------
  // UPDATE_CUSTOM_EXERCISE
  // -------------------------------------------------------------------------
  describe('UPDATE_CUSTOM_EXERCISE', () => {
    it('updates an existing custom exercise by ID', () => {
      const state: SessionState = {
        ...initialState,
        customExercises: [mockExercise({ id: 'custom:ex1', name: 'Original', tags: ['warm-up'] })],
      };

      const newState = reducer(state, {
        type: 'UPDATE_CUSTOM_EXERCISE',
        exercise: mockExercise({ id: 'custom:ex1', name: 'Updated', tags: ['focus'] }),
      });

      expect(newState.customExercises).toHaveLength(1);
      expect(newState.customExercises[0].name).toBe('Updated');
      expect(newState.customExercises[0].tags).toEqual(['focus']);
    });

    it('leaves other exercises unchanged', () => {
      const state: SessionState = {
        ...initialState,
        customExercises: [
          mockExercise({ id: 'custom:ex1', name: 'First' }),
          mockExercise({ id: 'custom:ex2', name: 'Second' }),
        ],
      };

      const newState = reducer(state, {
        type: 'UPDATE_CUSTOM_EXERCISE',
        exercise: mockExercise({ id: 'custom:ex1', name: 'Updated' }),
      });

      expect(newState.customExercises[0].name).toBe('Updated');
      expect(newState.customExercises[1].name).toBe('Second');
    });
  });

  // -------------------------------------------------------------------------
  // DELETE_CUSTOM_EXERCISE
  // -------------------------------------------------------------------------
  describe('DELETE_CUSTOM_EXERCISE', () => {
    it('removes the exercise from customExercises', () => {
      const state: SessionState = {
        ...initialState,
        customExercises: [mockExercise({ id: 'custom:ex1' })],
      };

      const newState = reducer(state, {
        type: 'DELETE_CUSTOM_EXERCISE',
        exerciseId: 'custom:ex1',
      });

      expect(newState.customExercises).toHaveLength(0);
    });

    it('also removes from favorites and hidden lists', () => {
      const state: SessionState = {
        ...initialState,
        customExercises: [mockExercise({ id: 'custom:ex1' })],
        favoriteExerciseIds: ['custom:ex1', 'other-ex'],
        hiddenExerciseIds: ['custom:ex1'],
      };

      const newState = reducer(state, {
        type: 'DELETE_CUSTOM_EXERCISE',
        exerciseId: 'custom:ex1',
      });

      expect(newState.customExercises).toHaveLength(0);
      expect(newState.favoriteExerciseIds).toEqual(['other-ex']);
      expect(newState.hiddenExerciseIds).toEqual([]);
    });
  });
});

// =============================================================================
// Timer Sub-Reducer Tests
// =============================================================================
//
// LEARNING NOTES - TESTING SUB-REDUCERS:
//
// Sub-reducers are even easier to test than full reducers because:
// 1. Smaller state shape — only the fields the sub-reducer owns
// 2. Fewer actions — only the actions the sub-reducer handles
// 3. No dependencies — doesn't need sessions, exercises, or other concerns
//
// This isolation is one of the main benefits of the sub-reducer pattern.
// You can test timer logic without setting up a mock session.

describe('timerReducer (sub-reducer)', () => {
  // Default timer state for tests
  const defaultTimerState: TimerState = {
    timerElapsed: 0,
    timerCumulative: 0,
    timerPaused: false,
  };

  // -------------------------------------------------------------------------
  // TIMER_TICK
  // -------------------------------------------------------------------------
  describe('TIMER_TICK', () => {
    it('increments elapsed and cumulative when not paused', () => {
      const state: TimerState = {
        timerElapsed: 10,
        timerCumulative: 100,
        timerPaused: false,
      };

      const newState = timerReducer(state, { type: 'TIMER_TICK' });

      expect(newState.timerElapsed).toBe(11);
      expect(newState.timerCumulative).toBe(101);
    });

    it('does nothing when paused', () => {
      const state: TimerState = {
        timerElapsed: 10,
        timerCumulative: 100,
        timerPaused: true,
      };

      const newState = timerReducer(state, { type: 'TIMER_TICK' });

      expect(newState.timerElapsed).toBe(10);
      expect(newState.timerCumulative).toBe(100);
    });
  });

  // -------------------------------------------------------------------------
  // TIMER_PAUSE / TIMER_RESUME
  // -------------------------------------------------------------------------
  describe('TIMER_PAUSE', () => {
    it('sets timerPaused to true', () => {
      const newState = timerReducer(defaultTimerState, { type: 'TIMER_PAUSE' });

      expect(newState.timerPaused).toBe(true);
    });
  });

  describe('TIMER_RESUME', () => {
    it('sets timerPaused to false', () => {
      const state: TimerState = { ...defaultTimerState, timerPaused: true };

      const newState = timerReducer(state, { type: 'TIMER_RESUME' });

      expect(newState.timerPaused).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // TIMER_RESET
  // -------------------------------------------------------------------------
  describe('TIMER_RESET', () => {
    it('resets elapsed to 0 but preserves cumulative', () => {
      const state: TimerState = {
        timerElapsed: 300,
        timerCumulative: 900,
        timerPaused: false,
      };

      const newState = timerReducer(state, { type: 'TIMER_RESET' });

      expect(newState.timerElapsed).toBe(0);
      // Cumulative is NOT reset — it tracks total session time
      expect(newState.timerCumulative).toBe(900);
    });
  });
});
