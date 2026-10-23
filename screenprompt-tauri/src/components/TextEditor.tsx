// MIT License - Copyright (c) 2026 ScreenPrompt Contributors

import { useEffect, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-shell';
import { Annotation, Compartment, EditorState, Prec, Transaction } from '@codemirror/state';
import { EditorView, keymap, placeholder } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import type { Config } from '../types';
import { useAutoScroll } from '../hooks/useAutoScroll';
import { scrollPixelsPerSecond } from '../utils/autoScroll';
import { markdown } from '../editor/markdownLanguage';
import { livePreview, setConcealAll } from '../editor/livePreview';
import { formatTransaction, linkAt, type FormatStyle } from '../editor/commands';
import FormatBar from './FormatBar';
import '../styles/TextEditor.css';

interface TextEditorProps {
  config: Config;
  text: string;
  onTextChange: (text: string) => void;
  isLocked: boolean;
  // Bumped to focus the editor (quick edit)
  editRequest: number;
  // Auto-scroll is running; it stops itself at the end, or when typing starts
  autoScroll: boolean;
  onAutoScrollStop: () => void;
}

const PLACEHOLDER_TEXT = 'Enter your prompt here...';
const WHEEL_DELTA = 120; // one wheel notch
const LINES_PER_NOTCH = 3; // Windows default

// Marks changes that come from App (Clear, Paste-replace, Undo of those), so they
// aren't reported back as typing
const fromProps = Annotation.define<boolean>();

const markdownMode = new Compartment();
const editable = new Compartment();

const format = (style: FormatStyle) => (view: EditorView) => {
  view.dispatch(formatTransaction(view.state, style));
  return true;
};

// Ctrl+click opens a link in the browser (a plain click places the cursor)
const linkClicks = EditorView.domEventHandlers({
  mousedown(event, view) {
    if (!event.ctrlKey || event.button !== 0) return false;
    const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
    const url = pos === null ? null : linkAt(view.state, pos);
    if (!url || !/^(https?:|mailto:)/i.test(url)) return false;
    event.preventDefault();
    open(url).catch((error: unknown) => console.error('Failed to open link:', error));
    return true;
  },
});

// Markdown on: live preview plus its shortcuts. Off: plain text.
function markdownExtensions(on: boolean) {
  if (!on) return [];
  return [
    markdown(),
    livePreview(),
    linkClicks,
    // Above the default keymap, which uses Ctrl+I for "select parent syntax"
    Prec.high(keymap.of([
      { key: 'Mod-b', run: format('bold') },
      { key: 'Mod-i', run: format('italic') },
    ])),
  ];
}

function TextEditor({ config, text, onTextChange, isLocked, editRequest, autoScroll, onAutoScrollStop }: TextEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  // Callbacks the editor's listeners call, kept current without rebuilding it
  const latest = useRef({ onTextChange, onAutoScrollStop, autoScroll });
  useEffect(() => {
    latest.current = { onTextChange, onAutoScrollStop, autoScroll };
  });

  // Create the editor once; props flow in through the effects below
  useEffect(() => {
    const view = new EditorView({
      parent: hostRef.current!,
      state: EditorState.create({
        doc: text,
        extensions: [
          history(),
          keymap.of([...historyKeymap, ...defaultKeymap]),
          EditorView.lineWrapping,
          placeholder(PLACEHOLDER_TEXT),
          EditorView.contentAttributes.of({
            spellcheck: 'false',
            autocorrect: 'off',
            autocapitalize: 'off',
            'aria-label': 'Notes',
          }),
          markdownMode.of(markdownExtensions(config.markdown)),
          editable.of(EditorView.editable.of(!isLocked)),
          EditorView.updateListener.of((update) => {
            if (update.docChanged && !update.transactions.some((tr) => tr.annotation(fromProps))) {
              latest.current.onTextChange(update.state.doc.toString());
            }
            // Typing pauses auto-scroll
            if (update.focusChanged && update.view.hasFocus && latest.current.autoScroll) {
              latest.current.onAutoScrollStop();
            }
          }),
        ],
      }),
    });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Mount only: later changes to these arrive through the effects below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Text replaced from outside (Clear, Paste-replace, Undo of those). Kept out of
  // the editor's undo history: App's Undo bar covers these.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const next = text.replace(/\r\n?/g, '\n');
    if (view.state.doc.toString() === next) return;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: next },
      annotations: [fromProps.of(true), Transaction.addToHistory.of(false)],
    });
  }, [text]);

  useEffect(() => {
    viewRef.current?.dispatch({ effects: markdownMode.reconfigure(markdownExtensions(config.markdown)) });
  }, [config.markdown]);

  // Locked: presenting. Read-only, and every marker hidden.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: [editable.reconfigure(EditorView.editable.of(!isLocked)), setConcealAll.of(isLocked)],
    });
    if (isLocked) view.contentDOM.blur();
  }, [isLocked]);

  // Quick edit: focus, with the cursor where you're reading rather than wherever
  // it was last (which may be far off screen)
  useEffect(() => {
    const view = viewRef.current;
    if (!view || editRequest === 0) return;
    const box = view.scrollDOM.getBoundingClientRect();
    const head = view.coordsAtPos(view.state.selection.main.head);
    const onScreen = head !== null && head.top >= box.top && head.bottom <= box.bottom;
    if (!onScreen) {
      const style = getComputedStyle(view.contentDOM);
      const top = view.posAtCoords({
        x: box.left + (parseFloat(style.paddingLeft) || 0) + 1,
        y: box.top + (parseFloat(style.paddingTop) || 0) + 1,
      });
      if (top !== null) view.dispatch({ selection: { anchor: top } });
    }
    view.focus();
  }, [editRequest]);

  // Starting auto-scroll means presenting: leave the editor
  useEffect(() => {
    if (autoScroll && viewRef.current?.hasFocus) viewRef.current.contentDOM.blur();
  }, [autoScroll]);

  useAutoScroll(
    autoScroll,
    () => viewRef.current?.scrollDOM ?? null,
    scrollPixelsPerSecond(config.scrollSpeed, config.fontSize),
    onAutoScrollStop,
  );

  // While locked the window ignores the mouse, so the Rust mouse hook catches
  // Ctrl+wheel over the overlay and sends its delta here (a plain wheel goes to the
  // app behind)
  useEffect(() => {
    const unlisten = listen<number>('locked-scroll', ({ payload: delta }) => {
      const view = viewRef.current;
      if (!view) return;
      const lineHeight = view.defaultLineHeight || config.fontSize * 1.6;
      view.scrollDOM.scrollBy({ top: (-delta / WHEEL_DELTA) * LINES_PER_NOTCH * lineHeight });
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [config.fontSize]);

  const handleFormat = (style: FormatStyle) => {
    const view = viewRef.current;
    if (!view) return;
    view.focus();
    format(style)(view);
  };

  return (
    <div className="text-editor">
      <div
        ref={hostRef}
        className={`editor-host${config.markdown ? ' live-preview' : ''}`}
        style={{
          fontFamily: config.fontFamily,
          fontSize: `${config.fontSize}px`,
          color: config.fontColor,
          backgroundColor: config.bgColor,
          ['--editor-bg' as string]: config.bgColor,
        }}
      />

      {config.markdown && config.showFormatBar && !isLocked && <FormatBar onFormat={handleFormat} />}
    </div>
  );
}

export default TextEditor;
