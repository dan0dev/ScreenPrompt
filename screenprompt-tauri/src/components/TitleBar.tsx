// MIT License - Copyright (c) 2026 ScreenPrompt Contributors

import { getCurrentWindow } from '@tauri-apps/api/window';
import '../styles/TitleBar.css';

const appWindow = getCurrentWindow();

interface TitleBarProps {
  onSettingsClick: () => void;
  checked?: boolean;
  updateAvailable?: boolean;
  updateVersion?: string;
  appVersion?: string;
  onUpdateClick?: () => void;
}

function TitleBar({ onSettingsClick, checked, updateAvailable, updateVersion, appVersion, onUpdateClick }: TitleBarProps) {
  const handleClose = async () => {
    await appWindow.close();
  };

  return (
    <div data-tauri-drag-region className="title-bar">
      <div data-tauri-drag-region className="title-left">
        <img src="/icon.png" alt="SP" className="title-icon" />
        <span data-tauri-drag-region className="title">ScreenPrompt</span>
      </div>
      <div className="title-bar-buttons">
        {updateAvailable ? (
          <button
            className="title-bar-button update-badge"
            onClick={onUpdateClick}
            title={`Update available: v${updateVersion}`}
          >
            v{updateVersion} available
          </button>
        ) : checked ? (
          <span className="version-badge" title="Up to date">
            v{appVersion} ✓
          </span>
        ) : null}
        <button className="title-bar-button settings" onClick={onSettingsClick} title="Settings">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
        <button className="title-bar-button close" onClick={handleClose} title="Close">
          ✕
        </button>
      </div>
    </div>
  );
}

export default TitleBar;
