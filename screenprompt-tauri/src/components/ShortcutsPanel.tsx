// MIT License - Copyright (c) 2026 ScreenPrompt Contributors

import { Fragment, useEffect } from 'react';
import { shortcutGroups } from '../utils/shortcuts';
import '../styles/Settings.css';
import '../styles/ShortcutsPanel.css';

interface ShortcutsPanelProps {
  // Resolved keyboard layout ('en' | 'hu'): position presets differ
  layout: string;
  onClose: () => void;
}

// "Ctrl+Shift+," -> key caps. Splits on "+" but keeps a "+" key itself.
function KeyCombo({ combo }: { combo: string }) {
  const parts = combo.split(/\+(?!$)/);
  return (
    <span className="key-combo">
      {parts.map((part, i) => (
        <Fragment key={i}>
          {i > 0 && <span className="key-plus">+</span>}
          <kbd>{part}</kbd>
        </Fragment>
      ))}
    </span>
  );
}

/** Keyboard shortcut cheat sheet, opened with F1 or from Settings */
function ShortcutsPanel({ layout, onClose }: ShortcutsPanelProps) {
  // Esc closes (F1 toggles it, via the app's key handler)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="settings shortcuts-panel">
      <div className="settings-header">
        <h2>Keyboard shortcuts</h2>
        <button className="close-button" onClick={onClose} title="Close (Esc)" aria-label="Close shortcuts">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="settings-content">
        {shortcutGroups(layout).map((group) => (
          <section className="settings-section" key={group.title} aria-label={group.title}>
            <span className="section-title">{group.title}</span>
            {group.note && <span className="shortcut-note">{group.note}</span>}
            <div className="section-card shortcut-list">
              {group.items.map((item) => (
                <div className="shortcut-row" key={item.action}>
                  <span className="shortcut-keys">
                    {item.keys.map((combo, i) => (
                      <Fragment key={combo}>
                        {i > 0 && <span className="key-or">/</span>}
                        <KeyCombo combo={combo} />
                      </Fragment>
                    ))}
                  </span>
                  <span className="shortcut-action">{item.action}</span>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

export default ShortcutsPanel;
