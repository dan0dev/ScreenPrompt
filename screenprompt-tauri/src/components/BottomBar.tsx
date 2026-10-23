// MIT License - Copyright (c) 2026 ScreenPrompt Contributors

import { useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import type { Config } from '../types';
import { linesPerMinute, MAX_SCROLL_SPEED, MIN_SCROLL_SPEED } from '../utils/autoScroll';
import '../styles/BottomBar.css';

interface BottomBarProps {
  config: Config;
  setConfig: (updates: Partial<Config>) => Promise<void>;
  isLocked: boolean;
  onToggleLock: () => void;
  onClearText: () => void;
  autoScrolling: boolean;
  onToggleAutoScroll: () => void;
  onScrollSpeed: (delta: number) => void;
}

const ICON = {
  width: 14,
  height: 14,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

const LockIcon = () => (
  <svg {...ICON}>
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const UnlockIcon = () => (
  <svg {...ICON}>
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 9.9-1" />
  </svg>
);

const ClearIcon = () => (
  <svg {...ICON}>
    <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6" />
  </svg>
);

const FormatIcon = () => (
  <svg {...ICON}>
    <path d="M4 7V4h16v3M9 20h6M12 4v16" />
  </svg>
);

const PlayIcon = () => (
  <svg {...ICON} fill="currentColor" strokeWidth={1.25}>
    <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10-6.5a1 1 0 0 0 0-1.72l-10-6.5A1 1 0 0 0 8 5.5Z" />
  </svg>
);

const PauseIcon = () => (
  <svg {...ICON} fill="currentColor" stroke="none">
    <rect x="6" y="5" width="4" height="14" rx="1" />
    <rect x="14" y="5" width="4" height="14" rx="1" />
  </svg>
);

const MinusIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12">
    <line x1="2" y1="6" x2="10" y2="6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
  </svg>
);

const PlusIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12">
    <line x1="2" y1="6" x2="10" y2="6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    <line x1="6" y1="2" x2="6" y2="10" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
  </svg>
);

function BottomBar({
  config,
  setConfig,
  isLocked,
  onToggleLock,
  onClearText,
  autoScrolling,
  onToggleAutoScroll,
  onScrollSpeed,
}: BottomBarProps) {
  const speedTitle = `Scroll speed ${config.scrollSpeed} (${linesPerMinute(config.scrollSpeed)} lines/min)`;
  const lockButtonRef = useRef<HTMLButtonElement>(null);

  // While locked the window ignores the mouse, so the Rust mouse hook watches for
  // Ctrl+click on the lock button instead. Tell it where the button is, in physical px.
  useEffect(() => {
    if (!isLocked) return;

    const reportZone = () => {
      const rect = lockButtonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const scale = window.devicePixelRatio;
      invoke('set_unlock_zone', {
        x: Math.round(rect.left * scale),
        y: Math.round(rect.top * scale),
        width: Math.round(rect.width * scale),
        height: Math.round(rect.height * scale),
      }).catch((e: unknown) => console.error('Failed to set unlock zone:', e));
    };

    reportZone();
    // Resizing shifts the button; moving to a monitor with different scaling changes
    // devicePixelRatio, which doesn't reliably fire a DOM resize, so watch both
    window.addEventListener('resize', reportZone);
    const unlistenScale = getCurrentWindow().onScaleChanged(reportZone);
    return () => {
      window.removeEventListener('resize', reportZone);
      unlistenScale.then((fn) => fn());
    };
  }, [isLocked]);

  const increaseFontSize = () => {
    const newSize = Math.min(48, config.fontSize + 1);
    setConfig({ fontSize: newSize });
  };

  const decreaseFontSize = () => {
    const newSize = Math.max(8, config.fontSize - 1);
    setConfig({ fontSize: newSize });
  };

  return (
    <div className="bottom-bar">
      {isLocked ? (
        // The only way to learn how to unlock while locked: a locked window gets no
        // hover, so a tooltip would never show
        <span className="lock-hint" role="status">
          <span className="lock-hint-wide">Locked · Esc or Ctrl+click to unlock</span>
          <span className="lock-hint-narrow">Esc / Ctrl+click to unlock</span>
        </span>
      ) : (
        <>
          <div className="font-size-controls">
            <button className="control-button font-btn" onClick={decreaseFontSize} title="Decrease font size" aria-label="Decrease font size">
              <svg width="12" height="12" viewBox="0 0 12 12">
                <line x1="2" y1="6" x2="10" y2="6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
              </svg>
            </button>
            <span className="font-label">Aa</span>
            <button className="control-button font-btn" onClick={increaseFontSize} title="Increase font size" aria-label="Increase font size">
              <svg width="12" height="12" viewBox="0 0 12 12">
                <line x1="2" y1="6" x2="10" y2="6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                <line x1="6" y1="2" x2="6" y2="10" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <button className="control-button clear-button" onClick={onClearText} title="Clear all text" aria-label="Clear all text">
            <ClearIcon />
          </button>

          {config.markdown && (
            <button
              className={`control-button format-toggle${config.showFormatBar ? ' active' : ''}`}
              // Don't take focus: the formatting buttons act on the editor's selection
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setConfig({ showFormatBar: !config.showFormatBar })}
              title={config.showFormatBar ? 'Hide formatting' : 'Show formatting'}
              aria-label="Formatting toolbar"
              aria-pressed={config.showFormatBar}
            >
              <FormatIcon />
            </button>
          )}
        </>
      )}

      <div className="spacer" />

      {isLocked ? (
        // Locked: the buttons can't be clicked, so just show that it's running
        autoScrolling && (
          <span className="scroll-status" role="status" title={speedTitle}>
            <PlayIcon />
            {config.scrollSpeed}
          </span>
        )
      ) : (
        <div className="scroll-controls">
          <button
            className={`control-button scroll-toggle${autoScrolling ? ' active' : ''}`}
            onClick={onToggleAutoScroll}
            title={autoScrolling ? 'Pause auto-scroll (Ctrl+Shift+Space)' : 'Start auto-scroll (Ctrl+Shift+Space)'}
            aria-label={autoScrolling ? 'Pause auto-scroll' : 'Start auto-scroll'}
            aria-pressed={autoScrolling}
          >
            {autoScrolling ? <PauseIcon /> : <PlayIcon />}
          </button>
          <div className="scroll-speed" role="group" aria-label={speedTitle} title={speedTitle}>
            <button
              className="control-button font-btn"
              onClick={() => onScrollSpeed(-1)}
              disabled={config.scrollSpeed <= MIN_SCROLL_SPEED}
              aria-label="Slower"
            >
              <MinusIcon />
            </button>
            <span className="speed-label">{config.scrollSpeed}</span>
            <button
              className="control-button font-btn"
              onClick={() => onScrollSpeed(1)}
              disabled={config.scrollSpeed >= MAX_SCROLL_SPEED}
              aria-label="Faster"
            >
              <PlusIcon />
            </button>
          </div>
        </div>
      )}

      <button
        ref={lockButtonRef}
        className={`control-button lock-button ${isLocked ? 'locked' : ''}`}
        onClick={onToggleLock}
        title={isLocked ? 'Unlock: Esc, or Ctrl+click here' : 'Lock (click-through enabled)'}
        aria-label={isLocked ? 'Unlock click-through' : 'Lock click-through'}
        aria-pressed={isLocked}
      >
        {isLocked ? <LockIcon /> : <UnlockIcon />}
      </button>
    </div>
  );
}

export default BottomBar;
