// @vitest-environment jsdom
// MIT License - Copyright (c) 2026 ScreenPrompt Contributors

import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CONFIG } from '../types';
import TextEditor from './TextEditor';

// Tauri bridges: capture the locked-scroll listener and link opens
const listeners: Record<string, (e: { payload: unknown }) => void> = {};
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(async (event: string, handler: (e: { payload: unknown }) => void) => {
    listeners[event] = handler;
    return () => delete listeners[event];
  }),
}));
const openSpy = vi.fn<(url: string) => Promise<void>>(async () => {});
vi.mock('@tauri-apps/plugin-shell', () => ({ open: (url: string) => openSpy(url) }));

const SAMPLE = '# Script\n\nHello **everyone** here.\nSecond line.\n\n- one\n- two\n\nSee [docs](https://example.com) or [mail](mailto:a@b.c).';

interface HarnessProps {
  text?: string;
  markdown?: boolean;
  showFormatBar?: boolean;
  isLocked?: boolean;
  editRequest?: number;
  onChange?: (text: string) => void;
}

// TextEditor with its text held in state, as App does
function Harness({ text: initial = SAMPLE, markdown = true, showFormatBar = false, isLocked = false, editRequest = 0, onChange }: HarnessProps) {
  const [text, setText] = useState(initial);
  return (
    <TextEditor
      config={{ ...DEFAULT_CONFIG, markdown, showFormatBar }}
      text={text}
      onTextChange={(t) => {
        setText(t);
        onChange?.(t);
      }}
      isLocked={isLocked}
      editRequest={editRequest}
    />
  );
}

const textarea = () => document.querySelector('textarea') as HTMLTextAreaElement;
const view = () => document.querySelector('.markdown-view') as HTMLElement | null;
const isEditing = () => !textarea().hidden && view() === null;

// jsdom has no editing commands: emulate the browser's insertText/delete on the
// focused textarea, the way typing changes it (the native value setter, which
// React's change tracking doesn't see, then an input event)
const setNativeValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!;
function emulateExecCommand() {
  document.execCommand = vi.fn((command: string, _ui?: boolean, value = '') => {
    const el = document.activeElement as HTMLTextAreaElement;
    if (command !== 'insertText' && command !== 'delete') return false;
    const insert = command === 'insertText' ? value : '';
    const { selectionStart: start, selectionEnd: end } = el;
    setNativeValue.call(el, el.value.slice(0, start) + insert + el.value.slice(end));
    el.setSelectionRange(start + insert.length, start + insert.length);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  });
}

// Start typing the way a user does: from the formatted view, or straight into
// the plain editor when it's showing
async function startTyping() {
  if (view()) fireEvent.keyDown(view()!, { key: 'Enter' });
  else await userEvent.click(textarea());
  expect(document.activeElement).toBe(textarea());
}

// Make a click on the formatted view land at `offset` within `node`
function clickViewAt(node: Node, offset: number) {
  document.caretPositionFromPoint = vi.fn(() => ({ offsetNode: node, offset }) as CaretPosition);
  fireEvent.click(node.nodeType === Node.TEXT_NODE ? node.parentElement! : (node as Element));
}

beforeEach(() => {
  // No caret lookup unless a test sets one up (jsdom has none)
  (document as { caretPositionFromPoint?: unknown }).caretPositionFromPoint = undefined;
  (document as { caretRangeFromPoint?: unknown }).caretRangeFromPoint = undefined;
  emulateExecCommand();
  Element.prototype.scrollBy = vi.fn();
  openSpy.mockClear();
});
afterEach(cleanup);

describe('switching between formatted view and editor', () => {
  it('shows the notes formatted while not typing', () => {
    render(<Harness />);
    expect(view()).not.toBeNull();
    expect(textarea().hidden).toBe(true);
    expect(view()!.querySelector('h1')?.textContent).toBe('Script');
    expect(view()!.querySelector('strong')?.textContent).toBe('everyone');
  });

  it('opens the editor with the caret where the formatted text was clicked', () => {
    render(<Harness />);
    const word = view()!.querySelector('strong')!.firstChild!;
    clickViewAt(word, 4); // "ever|yone"

    expect(isEditing()).toBe(true);
    expect(document.activeElement).toBe(textarea());
    const caret = textarea().selectionStart;
    expect(SAMPLE.slice(caret - 4, caret + 4)).toBe('everyone');
  });

  it('places the caret correctly in a later block', () => {
    render(<Harness />);
    const item = view()!.querySelectorAll('li')[1].firstChild!; // "two"
    clickViewAt(item, 1);
    expect(textarea().selectionStart).toBe(SAMPLE.indexOf('two') + 1);
  });

  it('places the caret correctly in notes pasted with Windows line endings', () => {
    const crlf = '# Title\r\n\r\nFirst para\r\n\r\nSecond para';
    render(<Harness text={crlf} />);
    const second = view()!.querySelectorAll('p')[1].firstChild!;
    clickViewAt(second, 7); // "Second |para"
    const caret = textarea().selectionStart;
    expect(textarea().value.slice(caret)).toBe('para');
  });

  it('puts the caret at the start of a line clicked right at its beginning', () => {
    render(<Harness />);
    const para = view()!.querySelectorAll('p')[0];
    const secondLine = [...para.childNodes].find((n) => n.textContent?.startsWith('Second'))!;
    clickViewAt(secondLine, 0);
    expect(textarea().selectionStart).toBe(SAMPLE.indexOf('Second line'));
  });

  it('keeps the old caret when the click misses the text', () => {
    render(<Harness />);
    textarea().setSelectionRange(5, 5);
    clickViewAt(view()!, 0);
    expect(isEditing()).toBe(true);
    expect(textarea().selectionStart).toBe(5);
  });

  it('goes back to formatted when the editor loses focus', () => {
    render(<Harness />);
    clickViewAt(view()!.querySelector('h1')!.firstChild!, 1);
    act(() => textarea().blur());
    expect(view()).not.toBeNull();
    expect(textarea().hidden).toBe(true);
  });

  it('opens the editor with Enter on the focused view', () => {
    render(<Harness />);
    fireEvent.keyDown(view()!, { key: 'Enter' });
    expect(isEditing()).toBe(true);
    expect(document.activeElement).toBe(textarea());
  });

  // jsdom has no layout: give block i the vertical span [i*100, i*100+100) and
  // put the view's top edge inside block 2
  function fakeLayout() {
    const v = view()!;
    v.getBoundingClientRect = () => ({ top: 250 }) as DOMRect;
    v.querySelectorAll<HTMLElement>('[data-src]').forEach((b, i) => {
      b.firstElementChild!.getBoundingClientRect = () => ({ top: i * 100, bottom: i * 100 + 100 }) as DOMRect;
    });
    fireEvent.scroll(v);
    return Number(v.querySelectorAll<HTMLElement>('[data-src]')[2].dataset.src);
  }

  it('opens with Enter at the exact line at the top of the view', () => {
    render(<Harness />);
    // The view's top edge is on the "e" of "Second line" (inside a paragraph)
    const para = view()!.querySelectorAll('p')[0];
    const secondLine = [...para.childNodes].find((n) => n.textContent?.startsWith('Second'))!;
    document.caretPositionFromPoint = vi.fn(() => ({ offsetNode: secondLine, offset: 1 }) as unknown as CaretPosition);
    fireEvent.scroll(view()!);
    fireEvent.keyDown(view()!, { key: 'Enter' });
    expect(textarea().selectionStart).toBe(SAMPLE.indexOf('Second line') + 1);
  });

  it('falls back to the older caret API', () => {
    render(<Harness />);
    const word = view()!.querySelector('strong')!.firstChild!;
    document.caretRangeFromPoint = vi.fn(() => {
      const r = document.createRange();
      r.setStart(word, 4);
      return r;
    });
    fireEvent.click(word.parentElement!);
    expect(textarea().selectionStart).toBe(SAMPLE.indexOf('everyone') + 4);
  });

  it('opens with Enter at the first paragraph on screen, not at the top', () => {
    render(<Harness />);
    const third = fakeLayout();
    fireEvent.keyDown(view()!, { key: 'Enter' });
    expect(textarea().selectionStart).toBe(third);
    expect(SAMPLE.slice(third)).toMatch(/^- one/);
  });

  it('quick edit also opens at the paragraph on screen', () => {
    const { rerender } = render(<Harness />);
    const third = fakeLayout();
    rerender(<Harness editRequest={1} />);
    expect(textarea().selectionStart).toBe(third);
  });

  it('quick edit with Markdown off keeps the caret where it was', () => {
    const { rerender } = render(<Harness markdown={false} />);
    textarea().setSelectionRange(7, 7);
    rerender(<Harness markdown={false} editRequest={1} />);
    expect(document.activeElement).toBe(textarea());
    expect(textarea().selectionStart).toBe(7);
  });

  it('does not switch when the click finishes a text selection', () => {
    render(<Harness />);
    const strong = view()!.querySelector('strong')!;
    const range = document.createRange();
    range.selectNodeContents(strong);
    window.getSelection()!.removeAllRanges(); // addRange is ignored while a range exists
    window.getSelection()!.addRange(range);
    clickViewAt(strong.firstChild!, 2);
    expect(view()).not.toBeNull();
    window.getSelection()!.removeAllRanges();
  });

  it('shows the plain editor for empty notes, and keeps it while typing the first characters', async () => {
    render(<Harness text="" />);
    expect(isEditing()).toBe(true);
    expect(textarea().placeholder).toMatch(/prompt/i);
    await userEvent.click(textarea());
    await userEvent.keyboard('**hi** there');
    expect(textarea().value).toBe('**hi** there');
    expect(isEditing()).toBe(true);
  });

  it('treats whitespace-only notes as empty', () => {
    render(<Harness text={'  \n '} />);
    expect(view()).toBeNull();
  });

  it('focuses the editor when quick edit asks for it', () => {
    const { rerender } = render(<Harness />);
    expect(view()).not.toBeNull();
    rerender(<Harness editRequest={1} />);
    expect(isEditing()).toBe(true);
    expect(document.activeElement).toBe(textarea());
  });
});

describe('formatting while typing', () => {
  it('Ctrl+B bolds the word at the caret, and again removes it', async () => {
    const onChange = vi.fn();
    render(<Harness text="say hello now" onChange={onChange} />);
    await startTyping();
    textarea().setSelectionRange(6, 6);
    await userEvent.keyboard('{Control>}b{/Control}');
    expect(textarea().value).toBe('say **hello** now');
    expect(onChange).toHaveBeenLastCalledWith('say **hello** now');
    await userEvent.keyboard('{Control>}b{/Control}');
    expect(textarea().value).toBe('say hello now');
  });

  it('Ctrl+I italicises the selection and keeps it selected', async () => {
    render(<Harness text="say hello now" />);
    await startTyping();
    textarea().setSelectionRange(4, 9);
    await userEvent.keyboard('{Control>}i{/Control}');
    expect(textarea().value).toBe('say *hello* now');
    expect(textarea().value.slice(textarea().selectionStart, textarea().selectionEnd)).toBe('hello');
  });

  it('leaves Ctrl+B alone when Markdown is off', async () => {
    render(<Harness text="say hello now" markdown={false} />);
    await startTyping();
    textarea().setSelectionRange(6, 6);
    const notPrevented = fireEvent.keyDown(textarea(), { key: 'b', ctrlKey: true });
    expect(notPrevented).toBe(true);
    expect(textarea().value).toBe('say hello now');
  });

  it('leaves Ctrl+Shift+B to the app shortcuts', async () => {
    render(<Harness text="say hello now" />);
    await startTyping();
    fireEvent.keyDown(textarea(), { key: 'B', ctrlKey: true, shiftKey: true });
    expect(textarea().value).toBe('say hello now');
  });

  it('still applies the change if editing commands are unavailable', async () => {
    document.execCommand = vi.fn(() => false);
    const onChange = vi.fn();
    render(<Harness text="say hello now" onChange={onChange} />);
    await startTyping();
    textarea().setSelectionRange(6, 6);
    await userEvent.keyboard('{Control>}b{/Control}');
    expect(onChange).toHaveBeenLastCalledWith('say **hello** now');
  });
});

describe('formatting toolbar', () => {
  it('is hidden unless opened, and while locked', () => {
    const { rerender } = render(<Harness />);
    expect(screen.queryByRole('toolbar')).toBeNull();
    rerender(<Harness showFormatBar />);
    expect(screen.getByRole('toolbar').querySelectorAll('button')).toHaveLength(8);
    rerender(<Harness showFormatBar isLocked />);
    expect(screen.queryByRole('toolbar')).toBeNull();
  });

  it('never shows when Markdown is off', () => {
    render(<Harness showFormatBar markdown={false} />);
    expect(screen.queryByRole('toolbar')).toBeNull();
  });

  it('does not steal focus from the editor', () => {
    render(<Harness showFormatBar />);
    const bold = screen.getByRole('button', { name: /bold/i });
    expect(fireEvent.mouseDown(bold)).toBe(false); // default (focus change) prevented
  });

  it('applies each style to the selection', async () => {
    render(<Harness text="word" showFormatBar />);
    await startTyping();
    // Each style wraps the still-selected word inside the earlier markers
    const steps: [RegExp, string][] = [
      [/^bold/i, '**word**'],
      [/^italic/i, '***word***'],
      [/^strikethrough/i, '***~~word~~***'],
      [/^code/i, '***~~`word`~~***'],
      [/^code/i, '***~~word~~***'],
    ];
    textarea().setSelectionRange(0, 4);
    for (const [name, expected] of steps) {
      fireEvent.click(screen.getByRole('button', { name }));
      expect(textarea().value).toBe(expected);
    }
  });

  it('applies line styles to the caret line', async () => {
    render(<Harness text={'a\nb'} showFormatBar />);
    await startTyping();
    textarea().setSelectionRange(3, 3);
    fireEvent.click(screen.getByRole('button', { name: /^heading/i }));
    expect(textarea().value).toBe('a\n# b');
    fireEvent.click(screen.getByRole('button', { name: /bulleted/i }));
    expect(textarea().value).toBe('a\n- b');
    fireEvent.click(screen.getByRole('button', { name: /numbered/i }));
    expect(textarea().value).toBe('a\n1. b');
    fireEvent.click(screen.getByRole('button', { name: /^quote/i }));
    expect(textarea().value).toBe('a\n> 1. b');
    // The caret stayed after "b" through every change
    expect(textarea().selectionStart).toBe(textarea().value.length);
    fireEvent.click(screen.getByRole('button', { name: /^quote/i }));
    expect(textarea().value).toBe('a\n1. b');
  });

  it('switches from the formatted view to the editor and applies there', () => {
    render(<Harness text={'one\ntwo'} showFormatBar />);
    expect(view()).not.toBeNull();
    textarea().setSelectionRange(5, 5); // last place edited: "t|wo"
    fireEvent.click(screen.getByRole('button', { name: /bulleted/i }));
    expect(isEditing()).toBe(true);
    expect(textarea().value).toBe('one\n- two');
  });
});

describe('locked mode', () => {
  it('shows formatted notes even while typing', async () => {
    const { rerender } = render(<Harness />);
    clickViewAt(view()!.querySelector('h1')!.firstChild!, 1);
    expect(isEditing()).toBe(true);
    rerender(<Harness isLocked />);
    expect(view()).not.toBeNull();
  });

  it('stays formatted after unlocking', () => {
    const { rerender } = render(<Harness />);
    clickViewAt(view()!.querySelector('h1')!.firstChild!, 1);
    rerender(<Harness isLocked />);
    rerender(<Harness isLocked={false} />);
    expect(view()).not.toBeNull();
  });

  it('Ctrl+wheel scrolls the formatted view', async () => {
    render(<Harness isLocked />);
    await act(async () => {});
    listeners['locked-scroll']({ payload: -120 }); // one notch down
    expect(Element.prototype.scrollBy).toHaveBeenCalledTimes(1);
    expect(vi.mocked(Element.prototype.scrollBy).mock.contexts[0]).toBe(view());
    const { top } = vi.mocked(Element.prototype.scrollBy).mock.calls[0][0] as ScrollToOptions;
    expect(top).toBeGreaterThan(0);
  });

  it('Ctrl+wheel scrolls the plain editor when Markdown is off', async () => {
    render(<Harness isLocked markdown={false} />);
    await act(async () => {});
    listeners['locked-scroll']({ payload: 120 });
    expect(vi.mocked(Element.prototype.scrollBy).mock.contexts[0]).toBe(textarea());
  });
});

describe('links', () => {
  it('open in the browser and keep the formatted view', () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('docs'));
    expect(openSpy).toHaveBeenCalledWith('https://example.com');
    expect(view()).not.toBeNull();
  });

  it('allow mailto', () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('mail'));
    expect(openSpy).toHaveBeenCalledWith('mailto:a@b.c');
  });

  it('never open other schemes', () => {
    render(<Harness text="[local](notes.md) and [file](file:///C:/x)" />);
    fireEvent.click(screen.getByText('local'));
    fireEvent.click(screen.getByText('file'));
    expect(openSpy).not.toHaveBeenCalled();
  });
});

describe('Markdown off', () => {
  it('always shows the plain editor with the raw text', () => {
    render(<Harness markdown={false} />);
    expect(view()).toBeNull();
    expect(textarea().hidden).toBe(false);
    expect(textarea().value).toBe(SAMPLE);
  });
});
