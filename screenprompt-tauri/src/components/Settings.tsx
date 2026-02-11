// MIT License - Copyright (c) 2026 ScreenPrompt Contributors

import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-shell';
import { message } from '@tauri-apps/plugin-dialog';
import type { Config } from '../types';
import { TEXT_COLORS, BG_COLORS, FONT_FAMILIES } from '../types';
import '../styles/Settings.css';

interface SettingsProps {
  config: Config;
  setConfig: (updates: Partial<Config>) => Promise<void>;
  onClose: () => void;
  appVersion: string;
  updateAvailable: boolean;
  updateVersion: string;
  onUpdateInstall: () => void;
}

function Settings({ config, setConfig, onClose, appVersion, updateAvailable, updateVersion, onUpdateInstall }: SettingsProps) {
  const [opacity, setOpacity] = useState(config.opacity);
  const [fontFamily, setFontFamily] = useState(config.fontFamily);
  const [fontSize, setFontSize] = useState(config.fontSize);
  const [fontColor, setFontColor] = useState(config.fontColor);
  const [bgColor, setBgColor] = useState(config.bgColor);
  const [autoCheckUpdates, setAutoCheckUpdates] = useState(config.autoCheckUpdates);
  const [keyboardLayout, setKeyboardLayout] = useState(config.keyboardLayout);

  const handleOpacityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setOpacity(value);
    setConfig({ opacity: value }); // Real-time preview
  };

  const handleFontFamilyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setFontFamily(value);
  };

  const handleFontSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (value >= 8 && value <= 48) {
      setFontSize(value);
    }
  };

  const handleTextColorClick = (color: string) => {
    setFontColor(color);
  };

  const handleBgColorClick = (color: string) => {
    setBgColor(color);
  };

  const handleAutoCheckUpdatesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAutoCheckUpdates(e.target.checked);
  };

  const handleSave = async () => {
    await setConfig({
      opacity,
      fontFamily,
      fontSize,
      fontColor,
      bgColor,
      autoCheckUpdates,
      keyboardLayout,
    });
    onClose();
  };

  const handleCancel = async () => {
    // Restore original opacity
    await setConfig({ opacity: config.opacity });
    onClose();
  };

  const handleDocsClick = async () => {
    await open('https://github.com/dan0dev/ScreenPrompt');
  };

  const handleShowNotice = async () => {
    try {
      const noticeText = await invoke<string>('show_ethical_notice');
      await message(noticeText, {
        title: 'ScreenPrompt - Important Notice',
        kind: 'warning',
      });
    } catch (error) {
      console.error('Failed to show notice:', error);
    }
  };

  return (
    <div className="settings">
      <div className="settings-header">
        <h2>Settings</h2>
        <button className="close-button" onClick={handleCancel}>
          ✕
        </button>
      </div>

      <div className="settings-content">
        {/* Opacity */}
        <div className="settings-section">
          <label>
            <strong>Opacity</strong>
            <span className="opacity-value">{Math.round(opacity * 100)}%</span>
          </label>
          <input
            type="range"
            min="0.5"
            max="1"
            step="0.05"
            value={opacity}
            onChange={handleOpacityChange}
            className="opacity-slider"
          />
        </div>

        {/* Font */}
        <div className="settings-section">
          <label>
            <strong>Font</strong>
          </label>
          <div className="font-controls">
            <div className="font-row">
              <span className="font-label">Family:</span>
              <select value={fontFamily} onChange={handleFontFamilyChange} className="font-select">
                {FONT_FAMILIES.map((family) => (
                  <option key={family} value={family}>
                    {family.split(',')[0].replace(/['"]/g, '')}
                  </option>
                ))}
              </select>
            </div>
            <div className="font-row">
              <span className="font-label">Size:</span>
              <input
                type="number"
                min="8"
                max="48"
                value={fontSize}
                onChange={handleFontSizeChange}
                className="font-size-input"
              />
              <span className="font-unit">pt</span>
            </div>
          </div>
        </div>

        {/* Text Color */}
        <div className="settings-section">
          <label>
            <strong>Text Color</strong>
          </label>
          <div className="color-palette">
            <div className="current-color" style={{ backgroundColor: fontColor }} />
            <div className="color-swatches">
              {TEXT_COLORS.map((color) => (
                <button
                  key={color}
                  className="color-swatch"
                  style={{ backgroundColor: color }}
                  onClick={() => handleTextColorClick(color)}
                  title={color}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Background Color */}
        <div className="settings-section">
          <label>
            <strong>Background Color</strong>
          </label>
          <div className="color-palette">
            <div className="current-color" style={{ backgroundColor: bgColor }} />
            <div className="color-swatches">
              {BG_COLORS.map((color) => (
                <button
                  key={color}
                  className="color-swatch"
                  style={{ backgroundColor: color }}
                  onClick={() => handleBgColorClick(color)}
                  title={color}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Updates */}
        <div className="settings-section">
          <label>
            <strong>Updates</strong>
          </label>
          <div className="updates-row">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={autoCheckUpdates}
                onChange={handleAutoCheckUpdatesChange}
              />
              Check for updates on startup
            </label>
          </div>
        </div>
        {/* Keyboard Layout */}
        <div className="settings-section">
          <label>
            <strong>Keyboard Layout</strong>
          </label>
          <div className="font-controls">
            <div className="font-row">
              <select
                value={keyboardLayout}
                onChange={(e) => setKeyboardLayout(e.target.value)}
                className="font-select"
              >
                <option value="auto">Auto-detect</option>
                <option value="hu">Hungarian (QWERTZ)</option>
                <option value="en">English (QWERTY)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="settings-version-info">
        <span className="version-label">v{appVersion}</span>
        {updateAvailable ? (
          <button className="version-update-link" onClick={onUpdateInstall}>
            v{updateVersion} available — install now
          </button>
        ) : (
          <span className="version-up-to-date">up-to-date</span>
        )}
      </div>

      <div className="settings-footer">
        <button className="docs-link" onClick={handleDocsClick}>
          Docs &amp; Help
        </button>
        <button className="docs-link" onClick={handleShowNotice}>
          Notice
        </button>
        <div className="footer-spacer" />
        <button className="button cancel-button" onClick={handleCancel}>
          Cancel
        </button>
        <button className="button save-button" onClick={handleSave}>
          Save
        </button>
      </div>
    </div>
  );
}

export default Settings;
