// MIT License - Copyright (c) 2026 ScreenPrompt Contributors

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-shell';
import type { Config } from '../types';
import { renderMarkdown, sourceOffsetFor } from '../utils/markdown';
import { toggleBlock, toggleInline, type BlockStyle, type Edit, type InlineStyle } from '../utils/formatting';
import FormatBar, { type FormatStyle } from './FormatBar';
import '../styles/TextEditor.css';

interface TextEditorProps {
  config: Config;
  text: string;
  onTextChange: (text: string) => void;
  isLocked: boolean;
  // Bumped to switch to editing and focus the text (quick edit)
  editRequest: number;
}

// Focus the editor once it's showing: at a caret position, at the first paragraph
// that was on screen ('visible'), or where it last was (null); then optionally run
// a follow-up such as a formatting command
interface FocusRequest {
  caret: number | 'visible' | null;
  then?: (el: HTMLTextAreaElement) => void;
}

const PLACEHOLDER_TEXT = 'Enter your prompt here...';
const WHEEL_DELTA = 120; // one wheel notch
const LINES_PER_NOTCH = 3; // Windows default
const INLINE_STYLES: readonly string[] = ['bold', 'italic', 'strike', 'code'] satisfies InlineStyle[];

// Apply a formatting edit through the browser's editing commands, so Ctrl+Z undoes
// it like typing. execCommand is deprecated but still the only way to do that in a
// textarea; if it ever stops working, fall back to a plain (non-undoable) change.
function applyEdit(el: HTMLTextAreaElement, edit: Edit) {
  el.focus();
  el.setSelectionRange(edit.start, edit.end);
  const done = edit.insert
    ? document.execCommand('insertText', false, edit.insert)
    : edit.start === edit.end || document.execCommand('delete');
  if (!done) {
    el.setRangeText(edit.insert, edit.start, edit.end);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }
  el.setSelectionRange(edit.selStart, edit.selEnd);
}

function applyStyle(el: HTMLTextAreaElement, style: FormatStyle) {
  const { value, selectionStart, selectionEnd } = el;
  applyEdit(
    el,
    INLINE_STYLES.includes(style)
      ? toggleInline(value, selectionStart, selectionEnd, style as InlineStyle)
      : toggleBlock(value, selectionStart, selectionEnd, style as BlockStyle),
  );
}

// The text position under a point. caretPositionFromPoint is the standard; older
// WebView2 runtimes only have caretRangeFromPoint.
function caretAtPoint(x: number, y: number): { node: Node; offset: number } | null {
  if (document.caretPositionFromPoint) {
    const pos = document.caretPositionFromPoint(x, y);
    return pos && { node: pos.offsetNode, offset: pos.offset };
  }
  const range = document.caretRangeFromPoint?.(x, y);
  return range && { node: range.startContainer, offset: range.startOffset };
}

// Where in the source a point on the rendered notes is, or null if it missed the text
function sourceOffsetAtPoint(view: HTMLElement, text: string, x: number, y: number): number | null {
  const pos = caretAtPoint(x, y);
  if (!pos) return null;
  const { node } = pos;
  const block = (node instanceof Element ? node : node.parentElement)?.closest<HTMLElement>('[data-src]');
  if (!block || !view.contains(block)) return null;

  const start = Number(block.dataset.src);
  const next = block.nextElementSibling as HTMLElement | null;
  const end = next?.dataset.src ? Number(next.dataset.src) : text.length;

  const range = document.createRange();
  range.setStart(block, 0);
  range.setEnd(node, pos.offset);
  const offset = start + sourceOffsetFor(text.slice(start, end), range.toString());
  // At the very start of a line after a line break the rendered text has no
  // newline to match (<br> has no text), so step past the source's one
  return pos.offset === 0 && text[offset] === '\n' ? offset + 1 : offset;
}

// Source offset of the text at the top edge of the formatted view
function topVisibleOffset(view: HTMLElement, text: string): number {
  const rect = view.getBoundingClientRect();
  const style = getComputedStyle(view);
  const x = rect.left + (parseFloat(style.paddingLeft) || 0) + 1;
  const y = rect.top + (parseFloat(style.paddingTop) || 0) + 1;
  return sourceOffsetAtPoint(view, text, x, y) ?? firstVisibleOffset(view);
}

// Fallback: the first block at least partly visible. Blocks run top to bottom, so
// binary search.
function firstVisibleOffset(view: HTMLElement): number {
  const blocks = view.querySelectorAll<HTMLElement>('[data-src]');
  const top = view.getBoundingClientRect().top;
  let lo = 0;
  let hi = blocks.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const bottom = blocks[mid].firstElementChild?.getBoundingClientRect().bottom ?? 0;
    if (bottom > top) {
      found = mid;
      hi = mid - 1;
    } else {
      lo = mid + 1;
    }
  }
  return found === -1 ? 0 : Number(blocks[found].dataset.src);
}

function TextEditor({ config, text: rawText, onTextChange, isLocked, editRequest }: TextEditorProps) {
  // The textarea turns Windows line endings (from pasted text) into \n, so do the
  // same here: positions in the formatted view must match positions in the editor
  const text = rawText.replace(/\r\n?/g, '\n');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState(false);
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);
  const handledFocusRef = useRef<FocusRequest | null>(null);
  // How far down the notes are scrolled (0-1), carried across the editor/view switch
  const scrollRatioRef = useRef(0);
  // Where the formatted view's visible text starts, so opening the editor without
  // a click (Enter, quick edit) starts there instead of jumping to the top
  const topVisibleRef = useRef(0);

  // Formatted notes show whenever you aren't typing: while locked, or once the
  // editor loses focus. The textarea stays mounted (hidden) so it keeps its
  // selection and undo history.
  const showRendered = config.markdown && text.trim() !== '' && (isLocked || !editing);
  const html = useMemo(() => (showRendered ? renderMarkdown(text) : ''), [showRendered, text]);

  const startEditing = (request: FocusRequest) => {
    setEditing(true);
    setFocusRequest(request);
  };

  // Locking always goes back to the formatted view
  const [wasLocked, setWasLocked] = useState(isLocked);
  if (isLocked !== wasLocked) {
    setWasLocked(isLocked);
    if (isLocked) setEditing(false);
  }

  const [seenEditRequest, setSeenEditRequest] = useState(editRequest);
  if (editRequest !== seenEditRequest) {
    setSeenEditRequest(editRequest);
    startEditing({ caret: 'visible' });
  }

  // Keep the same part of the notes in view when switching between the two
  useLayoutEffect(() => {
    const el = showRendered ? viewRef.current : textareaRef.current;
    if (!el) return;
    el.scrollTop = scrollRatioRef.current * (el.scrollHeight - el.clientHeight);
    if (showRendered) topVisibleRef.current = topVisibleOffset(el, text);
    // Only on switching: text changes while the view shows don't move the scroll
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showRendered]);

  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el || !focusRequest || showRendered || handledFocusRef.current === focusRequest) return;
    handledFocusRef.current = focusRequest;
    el.focus({ preventScroll: true });
    // 'visible' only means something if the formatted view was what was showing
    const caret = focusRequest.caret === 'visible' ? (config.markdown ? topVisibleRef.current : null) : focusRequest.caret;
    if (caret !== null) el.setSelectionRange(caret, caret);
    focusRequest.then?.(el);
  }, [focusRequest, showRendered, config.markdown]);

  // While locked the window ignores the mouse, so the Rust mouse hook catches
  // Ctrl+wheel over the overlay and sends its delta here (a plain wheel goes to the
  // app behind)
  useEffect(() => {
    const unlisten = listen<number>('locked-scroll', ({ payload: delta }) => {
      const el = viewRef.current ?? textareaRef.current;
      if (!el) return;
      const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || config.fontSize * 1.6;
      el.scrollBy({ top: (-delta / WHEEL_DELTA) * LINES_PER_NOTCH * lineHeight });
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [config.fontSize]);

  const trackScroll = (e: React.UIEvent<HTMLElement>) => {
    const el = e.currentTarget;
    const max = el.scrollHeight - el.clientHeight;
    scrollRatioRef.current = max > 0 ? el.scrollTop / max : 0;
    if (el === viewRef.current) topVisibleRef.current = topVisibleOffset(el, text);
  };

  const handleViewClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const link = (e.target as Element).closest('a');
    if (link) {
      // Open links in the browser; navigating would replace the overlay itself
      e.preventDefault();
      const href = link.getAttribute('href') ?? '';
      if (/^(https?:|mailto:)/i.test(href)) {
        open(href).catch((error: unknown) => console.error('Failed to open link:', error));
      }
      return;
    }
    // Selecting text (to copy it) shouldn't switch to the editor
    if (window.getSelection()?.isCollapsed === false) return;
    startEditing({ caret: sourceOffsetAtPoint(e.currentTarget, text, e.clientX, e.clientY) });
  };

  const handleFormat = (style: FormatStyle) => {
    const el = textareaRef.current;
    if (!el) return;
    if (showRendered) {
      startEditing({ caret: null, then: (shown) => applyStyle(shown, style) });
    } else {
      applyStyle(el, style);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!config.markdown || !e.ctrlKey || e.shiftKey || e.altKey) return;
    const style = ({ b: 'bold', i: 'italic' } as const)[e.key.toLowerCase()];
    if (!style) return;
    e.preventDefault();
    applyStyle(e.currentTarget, style);
  };

  const textStyle = {
    fontFamily: config.fontFamily,
    fontSize: `${config.fontSize}px`,
    color: config.fontColor,
    backgroundColor: config.bgColor,
  };

  return (
    <div className="text-editor">
      <textarea
        ref={textareaRef}
        className="text-area"
        style={textStyle}
        hidden={showRendered}
        value={text}
        onChange={(e) => onTextChange(e.target.value)}
        onFocus={() => setEditing(true)}
        onBlur={() => setEditing(false)}
        onKeyDown={handleKeyDown}
        onScroll={trackScroll}
        placeholder={PLACEHOLDER_TEXT}
        spellCheck={false}
      />

      {showRendered && (
        <div
          ref={viewRef}
          className="markdown-view"
          style={textStyle}
          tabIndex={0}
          onClick={handleViewClick}
          onKeyDown={(e) => e.key === 'Enter' && startEditing({ caret: 'visible' })}
          onScroll={trackScroll}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}

      {config.markdown && config.showFormatBar && !isLocked && <FormatBar onFormat={handleFormat} />}
    </div>
  );
}

export default TextEditor;
