// MIT License - Copyright (c) 2026 ScreenPrompt Contributors

import type { ReactNode } from 'react';
import type { BlockStyle, InlineStyle } from '../utils/formatting';
import '../styles/FormatBar.css';

export type FormatStyle = InlineStyle | BlockStyle;

interface FormatBarProps {
  onFormat: (style: FormatStyle) => void;
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

const BUTTONS: { style: FormatStyle; label: string; icon: ReactNode }[] = [
  { style: 'bold', label: 'Bold (Ctrl+B)', icon: <span className="format-glyph format-bold">B</span> },
  { style: 'italic', label: 'Italic (Ctrl+I)', icon: <span className="format-glyph format-italic">I</span> },
  { style: 'strike', label: 'Strikethrough', icon: <span className="format-glyph format-strike">S</span> },
  { style: 'heading', label: 'Heading (press again for smaller, then off)', icon: <span className="format-glyph">H</span> },
  {
    style: 'bullet',
    label: 'Bulleted list',
    icon: (
      <svg {...ICON}>
        <path d="M9 6h11M9 12h11M9 18h11" />
        <circle cx="4.5" cy="6" r="0.6" fill="currentColor" />
        <circle cx="4.5" cy="12" r="0.6" fill="currentColor" />
        <circle cx="4.5" cy="18" r="0.6" fill="currentColor" />
      </svg>
    ),
  },
  {
    style: 'numbered',
    label: 'Numbered list',
    icon: (
      <svg {...ICON}>
        <path d="M10 6h10M10 12h10M10 18h10M4 4.5l1.5-1V9M3.5 15.5a1.5 1.5 0 0 1 3 .5c0 1-3 2-3 3.5h3" />
      </svg>
    ),
  },
  {
    style: 'quote',
    label: 'Quote',
    icon: (
      <svg {...ICON}>
        <path d="M4 5v14M9 7h11M9 12h11M9 17h7" />
      </svg>
    ),
  },
  {
    style: 'code',
    label: 'Code',
    icon: (
      <svg {...ICON}>
        <path d="m8 7-5 5 5 5M16 7l5 5-5 5" />
      </svg>
    ),
  },
];

/** Formatting buttons above the bottom bar; each adds or removes Markdown markers */
function FormatBar({ onFormat }: FormatBarProps) {
  return (
    <div className="format-bar" role="toolbar" aria-label="Formatting">
      {BUTTONS.map(({ style, label, icon }) => (
        <button
          key={style}
          className="control-button format-button"
          // Keep focus (and the selection) in the editor
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onFormat(style)}
          title={label}
          aria-label={label}
        >
          {icon}
        </button>
      ))}
    </div>
  );
}

export default FormatBar;
