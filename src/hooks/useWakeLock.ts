/**
 * useWakeLock — keeps the screen on while enabled
 *
 * LEARNING NOTES - WAKE LOCK API:
 *
 * 1. ANGULAR vs REACT:
 *    Angular: you'd create a WakeLockService with acquire()/release() methods,
 *    call them from ngOnInit/ngOnDestroy, and manage the lifecycle imperatively.
 *    React: a custom hook with a boolean `enabled` parameter — the effect
 *    cleanup handles acquire/release automatically based on state changes.
 *
 * 2. WHY A BOOLEAN PARAM (not manual request/release)?
 *    SessionPage already knows when the timer is running. Passing a boolean
 *    lets the hook manage the lifecycle declaratively — React's "describe the
 *    desired state" philosophy. The effect acquires when enabled flips to true,
 *    and the cleanup releases when it flips to false (or on unmount).
 *
 * 3. VISIBILITY RE-ACQUIRE:
 *    The spec requires re-acquiring the lock when the tab regains focus.
 *    Browsers automatically release wake locks when a tab goes to background.
 *    We listen for `visibilitychange` and re-acquire on 'visible'.
 *
 * 4. GRACEFUL DEGRADATION:
 *    Wake Lock API isn't supported on all browsers (notably Firefox desktop
 *    and older Safari). The hook checks `'wakeLock' in navigator` and
 *    returns `isSupported: false` — consumers can show/hide UI accordingly.
 *
 * 5. RACE CONDITION GUARDS:
 *    Both effects define a local `acquire()` helper so no cross-effect
 *    closure captures stale state. Three guards prevent sentinel leaks:
 *    - `cancelled` flag: if deps change while the request is in-flight,
 *      the resolved sentinel is released immediately.
 *    - Duplicate guard: if `wakeLockRef.current` is already set (rapid
 *      re-acquire), the new sentinel is released to avoid a leak.
 *    - Identity check on the `release` event: only clears the ref if the
 *      released sentinel is still the current one, preventing an older
 *      sentinel's event from nulling out a newer lock.
 */

import { useState, useEffect, useRef } from 'react';

export function useWakeLock(enabled: boolean) {
  // Check once on mount — the API won't suddenly appear mid-session
  const [isSupported] = useState(() => 'wakeLock' in navigator);
  const [isActive, setIsActive] = useState(false);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  // Primary effect: acquire/release based on `enabled`
  useEffect(() => {
    if (!enabled || !isSupported) return;

    let cancelled = false;

    async function acquire() {
      try {
        const sentinel = await navigator.wakeLock.request('screen');

        if (cancelled) {
          // Deps changed or cleanup ran while awaiting — release immediately.
          sentinel.release().catch(() => {});
          return;
        }

        if (wakeLockRef.current) {
          // A concurrent request already stored a sentinel — release duplicate.
          sentinel.release().catch(() => {});
          return;
        }

        wakeLockRef.current = sentinel;
        setIsActive(true);

        // The browser may release the lock (e.g., low battery). Track that.
        // Identity check prevents an older sentinel's event from nulling out
        // a newer lock acquired after a rapid enabled toggle.
        sentinel.addEventListener('release', () => {
          if (wakeLockRef.current === sentinel) {
            wakeLockRef.current = null;
            setIsActive(false);
          }
        });
      } catch {
        // request() throws if the page isn't visible or permission is denied.
        // Not an error worth surfacing — the lock just won't be active.
      }
    }

    void acquire();

    // Cleanup: release on pause, unmount, or navigation
    return () => {
      cancelled = true;
      wakeLockRef.current?.release().catch(() => {});
      wakeLockRef.current = null;
      setIsActive(false);
    };
  }, [enabled, isSupported]);

  // Visibility re-acquire: browser releases locks when tab goes to background.
  // Re-acquire when the tab comes back to foreground.
  useEffect(() => {
    if (!enabled || !isSupported) return;

    let cancelled = false;

    async function acquire() {
      try {
        const sentinel = await navigator.wakeLock.request('screen');

        if (cancelled) {
          sentinel.release().catch(() => {});
          return;
        }

        if (wakeLockRef.current) {
          sentinel.release().catch(() => {});
          return;
        }

        wakeLockRef.current = sentinel;
        setIsActive(true);

        sentinel.addEventListener('release', () => {
          if (wakeLockRef.current === sentinel) {
            wakeLockRef.current = null;
            setIsActive(false);
          }
        });
      } catch {
        // Swallow — same rationale as the primary effect.
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible' && !wakeLockRef.current) {
        void acquire();
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, isSupported]);

  return { isSupported, isActive } as const;
}
