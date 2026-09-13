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

  const layouts = [
    { value: 'auto', label: 'Auto' },
    { value: 'en', label: 'English' },
    { value: 'hu', label: 'Hungarian' },
  ];

  return (
    <div className="settings">
      <div className="settings-header">
        <h2>Settings</h2>
        <button className="close-button" onClick={handleCancel} title="Close settings" aria-label="Close settings">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="settings-content">
        {/* Appearance */}
        <section className="settings-section">
          <span className="section-title">Appearance</span>
          <div className="section-card">
            <div className="control-field">
              <div className="field-row">
                <span className="field-label">Opacity</span>
                <span className="field-value">{Math.round(opacity * 100)}%</span>
              </div>
              <input
                id="opacity"
                type="range"
                min="0.1"
                max="1"
                step="0.05"
                value={opacity}
                onChange={handleOpacityChange}
                className="opacity-slider"
              />
            </div>

            <div className="control-field">
              <label className="field-label" htmlFor="font-family">Font</label>
              <select id="font-family" value={fontFamily} onChange={handleFontFamilyChange} className="select-input">
                {FONT_FAMILIES.map((family) => (
                  <option key={family} value={family}>
                    {family.split(',')[0].replace(/['"]/g, '')}
                  </option>
                ))}
              </select>
            </div>

            <div className="control-field">
              <label className="field-label" htmlFor="font-size">Size</label>
              <div className="field-inline">
                <input
                  id="font-size"
                  type="number"
                  min="8"
                  max="48"
                  value={fontSize}
                  onChange={handleFontSizeChange}
                  className="number-input"
                />
                <span className="field-suffix">px</span>
              </div>
            </div>
          </div>
        </section>

        {/* Colors */}
        <section className="settings-section">
          <span className="section-title">Colors</span>
          <div className="section-card">
            <div className="control-field">
              <span className="field-label">Text</span>
              <div className="swatch-row">
                <span className="swatch-preview" style={{ backgroundColor: fontColor }} />
                <div className="swatch-grid">
                  {TEXT_COLORS.map((color) => (
                    <button
                      key={color}
                      className={`swatch${fontColor.toUpperCase() === color.toUpperCase() ? ' selected' : ''}`}
                      style={{ backgroundColor: color }}
                      onClick={() => handleTextColorClick(color)}
                      title={color}
                      aria-label={`Text color ${color}`}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="control-field">
              <span className="field-label">Background</span>
              <div className="swatch-row">
                <span className="swatch-preview" style={{ backgroundColor: bgColor }} />
                <div className="swatch-grid">
                  {BG_COLORS.map((color) => (
                    <button
                      key={color}
                      className={`swatch${bgColor.toUpperCase() === color.toUpperCase() ? ' selected' : ''}`}
                      style={{ backgroundColor: color }}
                      onClick={() => handleBgColorClick(color)}
                      title={color}
                      aria-label={`Background color ${color}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Behavior */}
        <section className="settings-section">
          <span className="section-title">Behavior</span>
          <div className="section-card">
            <label className="toggle" htmlFor="auto-updates">
              <span className="toggle-text">Check for updates on startup</span>
              <input
                id="auto-updates"
                type="checkbox"
                checked={autoCheckUpdates}
                onChange={handleAutoCheckUpdatesChange}
              />
              <span className="toggle-track" aria-hidden="true" />
            </label>

            <div className="control-field">
              <span className="field-label">Keyboard layout</span>
              <div className="segmented" role="group" aria-label="Keyboard layout">
                {layouts.map((l) => (
                  <button
                    key={l.value}
                    className={`segment${keyboardLayout === l.value ? ' selected' : ''}`}
                    onClick={() => setKeyboardLayout(l.value)}
                    aria-pressed={keyboardLayout === l.value}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="settings-version-info">
        <span className="version-label">v{appVersion}</span>
        {updateAvailable ? (
          <button className="version-update-link" onClick={onUpdateInstall}>
            v{updateVersion} available — install now
          </button>
        ) : (
          <span className="version-up-to-date">Up to date</span>
        )}
      </div>

      <div className="settings-footer">
        <button className="link-button" onClick={handleDocsClick}>
          Docs &amp; Help
        </button>
        <button className="link-button" onClick={handleShowNotice}>
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
