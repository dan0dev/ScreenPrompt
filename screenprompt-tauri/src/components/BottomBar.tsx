// MIT License - Copyright (c) 2026 ScreenPrompt Contributors

import { useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { Config } from '../types';
import '../styles/BottomBar.css';

interface BottomBarProps {
  config: Config;
  setConfig: (updates: Partial<Config>) => Promise<void>;
  isLocked: boolean;
  onToggleLock: () => void;
  onClearText: () => void;
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

function BottomBar({ config, setConfig, isLocked, onToggleLock, onClearText }: BottomBarProps) {
  const lockButtonRef = useRef<HTMLButtonElement>(null);

  // While locked the window ignores the mouse, so the Rust mouse hook watches for
  // clicks on the lock button instead. Tell it where the button is, in physical px.
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
    // Resizing or moving to a monitor with different scaling shifts the button
    window.addEventListener('resize', reportZone);
    return () => window.removeEventListener('resize', reportZone);
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
        <span className="lock-hint">
          <span className="lock-hint-prefix">Locked · </span>Esc to unlock
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
        </>
      )}

      <div className="spacer" />

      <button
        ref={lockButtonRef}
        className={`control-button lock-button ${isLocked ? 'locked' : ''}`}
        onClick={onToggleLock}
        title={isLocked ? 'Unlock (Esc)' : 'Lock (click-through enabled)'}
        aria-label={isLocked ? 'Unlock click-through' : 'Lock click-through'}
        aria-pressed={isLocked}
      >
        {isLocked ? <LockIcon /> : <UnlockIcon />}
      </button>
    </div>
  );
}

export default BottomBar;
