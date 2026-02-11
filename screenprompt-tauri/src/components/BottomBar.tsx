// MIT License - Copyright (c) 2026 ScreenPrompt Contributors

import type { Config } from '../types';
import '../styles/BottomBar.css';

interface BottomBarProps {
  config: Config;
  setConfig: (updates: Partial<Config>) => Promise<void>;
  isLocked: boolean;
  onToggleLock: () => void;
}

const LockIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const UnlockIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 9.9-1" />
  </svg>
);

function BottomBar({ config, setConfig, isLocked, onToggleLock }: BottomBarProps) {
  const increaseFontSize = () => {
    const newSize = Math.min(48, config.fontSize + 1);
    setConfig({ fontSize: newSize });
  };

  const decreaseFontSize = () => {
    const newSize = Math.max(8, config.fontSize - 1);
    setConfig({ fontSize: newSize });
  };

  const clearText = () => {
    setConfig({ text: '' });
  };

  return (
    <div className="bottom-bar">
      <div className="font-size-controls">
        <button className="control-button font-btn" onClick={decreaseFontSize} title="Decrease font size">
          <svg width="10" height="10" viewBox="0 0 10 10">
            <line x1="1" y1="5" x2="9" y2="5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
        <span className="font-label">Aa</span>
        <button className="control-button font-btn" onClick={increaseFontSize} title="Increase font size">
          <svg width="10" height="10" viewBox="0 0 10 10">
            <line x1="1" y1="5" x2="9" y2="5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="5" y1="1" x2="5" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <button className="control-button clear-button" onClick={clearText} title="Clear text">
        reset
      </button>

      <div className="spacer" />

      <button
        className={`control-button lock-button ${isLocked ? 'locked' : ''}`}
        onClick={onToggleLock}
        title={isLocked ? 'Unlock (click-through disabled)' : 'Lock (click-through enabled)'}
      >
        {isLocked ? <LockIcon /> : <UnlockIcon />}
      </button>
    </div>
  );
}

export default BottomBar;
