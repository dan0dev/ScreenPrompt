// @vitest-environment jsdom
// MIT License - Copyright (c) 2026 ScreenPrompt Contributors

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UNDO_TIMEOUT_MS, useUndoableReplace } from './useUndoableReplace';

// The hook with its notes held in state, as App does
function setup(initial: string) {
  let text = initial;
  const replaceText = vi.fn(async (next: string) => {
    text = next;
    hook.rerender();
  });
  const hook = renderHook(() => useUndoableReplace(text, replaceText));
  return { hook, replaceText, current: () => text };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('useUndoableReplace', () => {
  it('offers undo after clearing, and undo brings the notes back', async () => {
    const { hook, current } = setup('my script');
    await act(() => hook.result.current.replaceUndoably('', 'cleared'));
    expect(current()).toBe('');
    expect(hook.result.current.undoable).toEqual({ previous: 'my script', action: 'cleared' });

    await act(() => hook.result.current.undo());
    expect(current()).toBe('my script');
    expect(hook.result.current.undoable).toBeNull();
  });

  it('offers undo after replacing from the clipboard', async () => {
    const { hook, current } = setup('old');
    await act(() => hook.result.current.replaceUndoably('new', 'replaced'));
    expect(current()).toBe('new');
    expect(hook.result.current.undoable?.action).toBe('replaced');
    await act(() => hook.result.current.undo());
    expect(current()).toBe('old');
  });

  it('does nothing when the notes would not change', async () => {
    const { hook, replaceText } = setup('same');
    await act(() => hook.result.current.replaceUndoably('same', 'replaced'));
    expect(replaceText).not.toHaveBeenCalled();
    expect(hook.result.current.undoable).toBeNull();
  });

  it('offers nothing to undo when the old notes were empty', async () => {
    const { hook, current } = setup('  \n');
    await act(() => hook.result.current.replaceUndoably('pasted', 'replaced'));
    expect(current()).toBe('pasted');
    expect(hook.result.current.undoable).toBeNull();
  });

  it('undoes only the latest change', async () => {
    const { hook, current } = setup('first');
    await act(() => hook.result.current.replaceUndoably('second', 'replaced'));
    await act(() => hook.result.current.replaceUndoably('', 'cleared'));
    await act(() => hook.result.current.undo());
    expect(current()).toBe('second');
    expect(hook.result.current.undoable).toBeNull();
  });

  it('expires after a while', async () => {
    const { hook } = setup('my script');
    await act(() => hook.result.current.replaceUndoably('', 'cleared'));
    act(() => vi.advanceTimersByTime(UNDO_TIMEOUT_MS - 100));
    expect(hook.result.current.undoable).not.toBeNull();
    act(() => vi.advanceTimersByTime(200));
    expect(hook.result.current.undoable).toBeNull();
  });

  it('restarts the timer for a newer change', async () => {
    const { hook } = setup('a');
    await act(() => hook.result.current.replaceUndoably('b', 'replaced'));
    act(() => vi.advanceTimersByTime(UNDO_TIMEOUT_MS - 1000));
    await act(() => hook.result.current.replaceUndoably('', 'cleared'));
    act(() => vi.advanceTimersByTime(2000));
    expect(hook.result.current.undoable?.previous).toBe('b');
  });

  it('can be dismissed, after which undo does nothing', async () => {
    const { hook, current, replaceText } = setup('my script');
    await act(() => hook.result.current.replaceUndoably('', 'cleared'));
    act(() => hook.result.current.dismiss());
    expect(hook.result.current.undoable).toBeNull();
    await act(() => hook.result.current.undo());
    expect(current()).toBe('');
    expect(replaceText).toHaveBeenCalledTimes(1);
  });
});
