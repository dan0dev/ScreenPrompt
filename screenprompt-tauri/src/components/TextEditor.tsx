// MIT License - Copyright (c) 2026 ScreenPrompt Contributors

import { useEffect, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import type { Config } from '../types';
import '../styles/TextEditor.css';

interface TextEditorProps {
  config: Config;
  text: string;
  onTextChange: (text: string) => void;
}

const PLACEHOLDER_TEXT = 'Enter your prompt here...';
const WHEEL_DELTA = 120; // one wheel notch
const LINES_PER_NOTCH = 3; // Windows default

function TextEditor({ config, text, onTextChange }: TextEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // While locked the window ignores the mouse, so the Rust mouse hook catches the
  // wheel over the overlay and sends its delta here
  useEffect(() => {
    const unlisten = listen<number>('locked-scroll', ({ payload: delta }) => {
      const el = textareaRef.current;
      if (!el) return;
      const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || config.fontSize * 1.6;
      el.scrollBy({ top: (-delta / WHEEL_DELTA) * LINES_PER_NOTCH * lineHeight });
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [config.fontSize]);

  return (
    <div className="text-editor">
      <textarea
        ref={textareaRef}
        className="text-area"
        style={{
          fontFamily: config.fontFamily,
          fontSize: `${config.fontSize}px`,
          color: config.fontColor,
          backgroundColor: config.bgColor,
        }}
        value={text}
        onChange={(e) => onTextChange(e.target.value)}
        placeholder={PLACEHOLDER_TEXT}
        spellCheck={false}
      />
    </div>
  );
}

export default TextEditor;
