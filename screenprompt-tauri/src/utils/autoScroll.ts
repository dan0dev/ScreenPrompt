// MIT License - Copyright (c) 2026 ScreenPrompt Contributors

// Auto-scroll speed is a level from 1 to 20, each step adding a few lines per
// minute. Measuring in lines (not pixels) keeps the reading pace the same at any
// font size.

export const MIN_SCROLL_SPEED = 1;
export const MAX_SCROLL_SPEED = 20;
const LINES_PER_MINUTE_PER_STEP = 5;
const LINE_HEIGHT = 1.6; // the notes' line-height (TextEditor.css)
// A longer gap between frames means the window was hidden: don't make up for it
// by jumping ahead. Up to a second is still counted in full, so the speed stays
// right even if frames get throttled to a few per second.
const MAX_FRAME_GAP_MS = 1000;

export function clampScrollSpeed(speed: number): number {
  if (Number.isNaN(speed)) return MIN_SCROLL_SPEED;
  return Math.min(MAX_SCROLL_SPEED, Math.max(MIN_SCROLL_SPEED, Math.round(speed)));
}

export function linesPerMinute(speed: number): number {
  return speed * LINES_PER_MINUTE_PER_STEP;
}

export function scrollPixelsPerSecond(speed: number, fontSize: number): number {
  return (linesPerMinute(speed) / 60) * fontSize * LINE_HEIGHT;
}

/**
 * One animation step. `pos` is where the last step left the scroll (with
 * fractions, which the browser rounds away), `current` the element's scrollTop
 * now, `max` the furthest it can scroll.
 */
export function nextScrollPosition(
  pos: number,
  current: number,
  max: number,
  pixelsPerSecond: number,
  elapsedMs: number,
): { pos: number; atEnd: boolean } {
  // Moved by something else since the last step (the user scrolled): carry on from there
  const from = Math.abs(current - pos) > 1 ? current : pos;
  const next = Math.min(max, from + (pixelsPerSecond * Math.min(elapsedMs, MAX_FRAME_GAP_MS)) / 1000);
  return { pos: next, atEnd: next >= max - 0.5 };
}
