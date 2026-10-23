// MIT License - Copyright (c) 2026 ScreenPrompt Contributors

import type { UndoAction } from '../hooks/useUndoableReplace';
import '../styles/UndoBar.css';

interface UndoBarProps {
  action: UndoAction;
  onUndo: () => void;
  // Sits above the formatting toolbar when that's open
  aboveFormatBar: boolean;
}

const MESSAGES: Record<UndoAction, string> = {
  cleared: 'Notes cleared',
  replaced: 'Notes replaced from clipboard',
};

/** "Notes cleared · Undo", shown for a few seconds after Clear or Paste-replace */
function UndoBar({ action, onUndo, aboveFormatBar }: UndoBarProps) {
  return (
    <div className={`undo-bar${aboveFormatBar ? ' above-format-bar' : ''}`} role="status">
      <span className="undo-message">{MESSAGES[action]}</span>
      <button className="undo-button" onClick={onUndo} title="Undo (Ctrl+Z)">
        Undo
      </button>
    </div>
  );
}

export default UndoBar;
