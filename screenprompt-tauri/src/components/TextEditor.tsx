// MIT License - Copyright (c) 2026 ScreenPrompt Contributors

import { useState, useEffect, useRef } from 'react';
import type { Config } from '../types';
import '../styles/TextEditor.css';

interface TextEditorProps {
  config: Config;
  text: string;
  onTextChange: (text: string) => void;
}

const PLACEHOLDER_TEXT = 'Enter your prompt here...';

function TextEditor({ config, text, onTextChange }: TextEditorProps) {
  const [localText, setLocalText] = useState(text);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setLocalText(text);
  }, [text]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setLocalText(e.target.value);
  };

  const handleBlur = () => {
    onTextChange(localText);
  };

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
        value={localText}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={PLACEHOLDER_TEXT}
        spellCheck={false}
      />
    </div>
  );
}

export default TextEditor;
