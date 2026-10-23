// MIT License - Copyright (c) 2026 ScreenPrompt Contributors

import { useCallback, useEffect, useState } from 'react';

export type UndoAction = 'cleared' | 'replaced';

export interface Undoable {
  previous: string;
  action: UndoAction;
}

export const UNDO_TIMEOUT_MS = 8000;

/**
 * Replacing all the notes at once (Clear, Paste-replace) can't be undone with the
 * textarea's own undo, so keep the notes from before the latest such change for a
 * while. One level: a newer change replaces what can be undone.
 */
export function useUndoableReplace(text: string, replaceText: (next: string) => Promise<void>) {
  const [undoable, setUndoable] = useState<Undoable | null>(null);

  const replaceUndoably = useCallback(
    async (next: string, action: UndoAction) => {
      if (next === text) return;
      await replaceText(next);
      // Going back to empty notes isn't worth offering
      setUndoable(text.trim() ? { previous: text, action } : null);
    },
    [text, replaceText],
  );

  const undo = useCallback(async () => {
    if (!undoable) return;
    setUndoable(null);
    await replaceText(undoable.previous);
  }, [undoable, replaceText]);

  const dismiss = useCallback(() => setUndoable(null), []);

  useEffect(() => {
    if (!undoable) return;
    const timer = window.setTimeout(() => setUndoable(null), UNDO_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [undoable]);

  return { undoable, replaceUndoably, undo, dismiss };
}
