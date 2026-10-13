// MIT License - Copyright (c) 2026 ScreenPrompt Contributors

import type { Config } from '../types';
import '../styles/TextEditor.css';

interface TextEditorProps {
  config: Config;
  text: string;
  onTextChange: (text: string) => void;
}

const PLACEHOLDER_TEXT = 'Enter your prompt here...';

function TextEditor({ config, text, onTextChange }: TextEditorProps) {
  return (
    <div className="text-editor">
      <textarea
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
