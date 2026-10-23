// MIT License - Copyright (c) 2026 ScreenPrompt Contributors

import { useEffect, useRef } from 'react';
import { nextScrollPosition } from '../utils/autoScroll';

/**
 * Scroll `getElement()` down at `pixelsPerSecond` while `running`, one step per
 * animation frame. Starting at the very end goes back to the top first; reaching
 * the end (or having nothing to scroll) calls `onEnd`. Speed changes apply
 * immediately, and a manual scroll just moves the position it continues from.
 */
export function useAutoScroll(
  running: boolean,
  getElement: () => HTMLElement | null,
  pixelsPerSecond: number,
  onEnd: () => void,
) {
  const latest = useRef({ getElement, pixelsPerSecond, onEnd });
  useEffect(() => {
    latest.current = { getElement, pixelsPerSecond, onEnd };
  });

  useEffect(() => {
    if (!running) return;
    let frame = 0;
    let last: number | null = null;
    let pos: number | null = null;

    const start = latest.current.getElement();
    if (start) {
      const max = start.scrollHeight - start.clientHeight;
      if (max > 0 && start.scrollTop >= max - 1) start.scrollTop = 0;
    }

    const tick = (now: number) => {
      const el = latest.current.getElement();
      if (el) {
        const max = el.scrollHeight - el.clientHeight;
        if (max <= 0) {
          latest.current.onEnd();
          return;
        }
        if (pos === null) pos = el.scrollTop;
        if (last !== null) {
          const step = nextScrollPosition(pos, el.scrollTop, max, latest.current.pixelsPerSecond, now - last);
          pos = step.pos;
          el.scrollTop = pos;
          if (step.atEnd) {
            latest.current.onEnd();
            return;
          }
        }
      }
      last = now;
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [running]);
}
