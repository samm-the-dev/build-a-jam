/**
 * useSheetDismiss — swipe-down-to-close gesture for mobile bottom-sheet dialogs
 *
 * LEARNING NOTES - IMPERATIVE DOM MANIPULATION:
 *
 * 1. ANGULAR vs REACT:
 *    Angular: you'd use Renderer2 or @HostListener for DOM manipulation.
 *    React: refs give direct DOM access when React's declarative model
 *    isn't enough. Here we manipulate style properties directly for
 *    60fps drag performance — no React re-renders during the gesture.
 *
 * 2. WHY REACT TOUCH HANDLERS (not addEventListener)?
 *    The previous version used imperative addEventListener with { passive: false }
 *    so it could call e.preventDefault() to suppress scroll. But Radix Dialog
 *    already locks body scroll, so we don't need preventDefault. React's
 *    onTouchStart/onTouchMove/onTouchEnd handlers are simpler and don't need
 *    cleanup (React manages the listener lifecycle).
 *
 * 3. DAMPING:
 *    After the dismiss threshold (80px), additional drag is dampened by 0.5x.
 *    This gives a "rubber band" feel — the sheet resists over-dragging,
 *    signaling to the user that they've passed the dismiss point.
 *
 * 4. SCROLL-AWARE GUARD:
 *    We only engage the dismiss gesture when the element is scrolled to the top
 *    (scrollTop === 0) and the user drags downward. A 6px deadzone prevents
 *    accidental activation on small movements.
 *
 * Adapted from the ohm repo's useSheetDismiss hook.
 */

import { useRef, useCallback } from 'react';
import type { TouchEventHandler } from 'react';

const DISMISS_THRESHOLD = 80; // px dragged down to trigger dismiss
const RESISTANCE = 0.5; // dampen drag beyond threshold

/**
 * Adds a swipe-down-to-dismiss gesture for mobile bottom-sheet dialogs.
 * Only activates when the sheet content is scrolled to the top.
 *
 * Usage (wired into DialogContent internally — consumers just pass onSwipeDismiss):
 *   <DialogContent onSwipeDismiss={onClose}>
 */
export function useSheetDismiss(onDismiss: (() => void) | undefined) {
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const startY = useRef<number | null>(null);
  const currentY = useRef(0);
  const dragging = useRef(false);

  const applyTransform = (dy: number) => {
    const el = sheetRef.current;
    if (!el) return;
    if (dy <= 0) {
      el.style.transform = '';
      el.style.opacity = '';
      return;
    }
    // Rubber-band effect: dampen drag beyond threshold
    const clamped =
      dy > DISMISS_THRESHOLD ? DISMISS_THRESHOLD + (dy - DISMISS_THRESHOLD) * RESISTANCE : dy;
    el.style.transform = `translateY(${clamped}px)`;
    el.style.opacity = String(Math.max(0.5, 1 - clamped / 400));
  };

  const onTouchStart: TouchEventHandler = useCallback(
    (e) => {
      if (!onDismiss) return;
      const el = sheetRef.current;
      if (!el) return;
      // Only begin if content is scrolled to top
      if (el.scrollTop > 0) return;
      startY.current = e.touches[0]!.clientY;
      currentY.current = startY.current;
      dragging.current = false;
      // Remove transition during active drag for immediate response
      el.style.transition = 'none';
    },
    [onDismiss],
  );

  const onTouchMove: TouchEventHandler = useCallback(
    (e) => {
      if (!onDismiss || startY.current === null) return;
      const el = sheetRef.current;
      if (!el) return;

      currentY.current = e.touches[0]!.clientY;
      const dy = currentY.current - startY.current!;

      if (!dragging.current) {
        // 6px deadzone — need clear downward intent before activating
        if (dy < 6) return;
        // If user scrolled up or content now has scroll offset, abort
        if (el.scrollTop > 0) {
          startY.current = null;
          return;
        }
        dragging.current = true;
      }

      applyTransform(dy);
    },
    [onDismiss],
  );

  const onTouchEnd: TouchEventHandler = useCallback(() => {
    if (!onDismiss) return;
    const el = sheetRef.current;
    const dy = currentY.current - (startY.current ?? 0);
    startY.current = null;

    if (!dragging.current || !el) {
      if (el) {
        el.style.transition = '';
        el.style.transform = '';
        el.style.opacity = '';
      }
      dragging.current = false;
      return;
    }
    dragging.current = false;

    if (dy >= DISMISS_THRESHOLD) {
      // Animate out then dismiss
      el.style.transition = 'transform 0.2s ease-out, opacity 0.2s ease-out';
      el.style.transform = 'translateY(100%)';
      el.style.opacity = '0';
      setTimeout(() => onDismiss(), 180);
    } else {
      // Snap back
      el.style.transition = 'transform 0.2s ease-out, opacity 0.2s ease-out';
      el.style.transform = '';
      el.style.opacity = '';
    }
  }, [onDismiss]);

  const onTouchCancel: TouchEventHandler = useCallback(() => {
    const el = sheetRef.current;
    startY.current = null;
    dragging.current = false;
    if (el) {
      el.style.transition = '';
      el.style.transform = '';
      el.style.opacity = '';
    }
  }, []);

  return {
    sheetRef,
    touchHandlers: { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel },
  };
}
