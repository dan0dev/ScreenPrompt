// MIT License - Copyright (c) 2026 ScreenPrompt Contributors

import { describe, expect, it } from 'vitest';
import {
  MAX_SCROLL_SPEED,
  MIN_SCROLL_SPEED,
  clampScrollSpeed,
  linesPerMinute,
  nextScrollPosition,
  scrollPixelsPerSecond,
} from './autoScroll';

describe('scroll speed', () => {
  it('is measured in lines per minute, so it reads the same at any font size', () => {
    expect(linesPerMinute(4)).toBe(20);
    // 20 lines/min of 18px text at line-height 1.6 = 20 * 28.8px per 60s
    expect(scrollPixelsPerSecond(4, 18)).toBeCloseTo((20 * 18 * 1.6) / 60);
    expect(scrollPixelsPerSecond(4, 36)).toBeCloseTo(2 * scrollPixelsPerSecond(4, 18));
  });

  it('grows in even steps', () => {
    expect(linesPerMinute(2) - linesPerMinute(1)).toBe(linesPerMinute(10) - linesPerMinute(9));
  });

  it('stays within its range', () => {
    expect(clampScrollSpeed(0)).toBe(MIN_SCROLL_SPEED);
    expect(clampScrollSpeed(-3)).toBe(MIN_SCROLL_SPEED);
    expect(clampScrollSpeed(MAX_SCROLL_SPEED + 1)).toBe(MAX_SCROLL_SPEED);
    expect(clampScrollSpeed(7.6)).toBe(8);
    expect(clampScrollSpeed(Number.NaN)).toBe(MIN_SCROLL_SPEED);
  });
});

describe('nextScrollPosition', () => {
  it('advances by speed × time, keeping fractions', () => {
    const step = nextScrollPosition(100, 100, 1000, 10, 50); // 10px/s for 50ms
    expect(step.pos).toBeCloseTo(100.5);
    expect(step.atEnd).toBe(false);
  });

  it('accumulates sub-pixel steps even though the browser rounds scrollTop', () => {
    let pos = 0;
    for (let i = 0; i < 60; i++) pos = nextScrollPosition(pos, Math.round(pos), 1000, 6, 1000 / 60).pos;
    expect(pos).toBeCloseTo(6, 5); // one second at 6px/s
  });

  it('continues from where the user scrolled to', () => {
    const step = nextScrollPosition(100, 400, 1000, 10, 100);
    expect(step.pos).toBeCloseTo(401);
  });

  it('caps a long frame gap (window hidden) instead of jumping ahead', () => {
    const step = nextScrollPosition(0, 0, 100000, 100, 60_000);
    expect(step.pos).toBeLessThanOrEqual(25);
  });

  it('stops exactly at the end', () => {
    const step = nextScrollPosition(995, 995, 1000, 100, 100);
    expect(step.pos).toBe(1000);
    expect(step.atEnd).toBe(true);
  });
});
