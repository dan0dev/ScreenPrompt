// @vitest-environment jsdom
// MIT License - Copyright (c) 2026 ScreenPrompt Contributors

import { useEffect, useState } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { EditorView } from '@codemirror/view';
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

// jsdom has no layout; CodeMirror measures text ranges, so give it empty boxes
beforeAll(() => {
  const empty = { x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, toJSON: () => ({}) };
  Range.prototype.getBoundingClientRect = () => empty as DOMRect;
  Range.prototype.getClientRects = () => Object.assign([], { item: () => null }) as unknown as DOMRectList;
});

const SAMPLE = '# Script\n\nHello **everyone** here.\nSecond line.\n\n- one\n- two';

interface HarnessProps {
  text?: string;
  markdown?: boolean;
  showFormatBar?: boolean;
  isLocked?: boolean;
  editRequest?: number;
  onChange?: (text: string) => void;
  autoScroll?: boolean;
  onAutoScrollStop?: () => void;
}

// TextEditor with its text held in state, as App does; `external` replaces the
// text from outside (like Clear or Paste-replace)
let external: (text: string) => void = () => {};
function Harness({
  text: initial = SAMPLE,
  markdown = true,
  showFormatBar = false,
  isLocked = false,
  editRequest = 0,
  onChange,
  autoScroll = false,
  onAutoScrollStop = () => {},
}: HarnessProps) {
  const [text, setText] = useState(initial);
  useEffect(() => {
    external = setText;
  }, []);
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
      autoScroll={autoScroll}
      onAutoScrollStop={onAutoScrollStop}
    />
  );
}

const view = () => EditorView.findFromDOM(document.querySelector('.cm-editor') as HTMLElement)!;
const doc = () => view().state.doc.toString();
const lineText = (n: number) => (document.querySelectorAll('.cm-line')[n - 1] as HTMLElement).textContent;
const focusAt = (pos: number) =>
  act(() => {
    view().focus();
    view().dispatch({ selection: { anchor: pos } });
  });
// CodeMirror reports a focus change a moment after the focus event
const settleFocus = () => act(async () => {
  await new Promise((resolve) => setTimeout(resolve, 50));
});
const selectRange = (from: number, to: number) => act(() => view().dispatch({ selection: { anchor: from, head: to } }));
const press = (key: string, mods: { ctrlKey?: boolean; shiftKey?: boolean } = {}) =>
  act(() => {
    fireEvent.keyDown(view().contentDOM, { key, ...mods });
  });
const type = (insert: string) =>
  act(() => {
    const at = view().state.selection.main.head;
    view().dispatch({ changes: { from: at, insert }, selection: { anchor: at + insert.length }, userEvent: 'input.type' });
  });

beforeEach(() => {
  openSpy.mockClear();
  Element.prototype.scrollBy = vi.fn();
});
afterEach(cleanup);

describe('editing', () => {
  it('shows the notes in the editor', () => {
    render(<Harness />);
    expect(doc()).toBe(SAMPLE);
    expect(view().contentDOM.getAttribute('spellcheck')).toBe('false');
  });

  it('reports typing', () => {
    const onChange = vi.fn();
    render(<Harness text="hi" onChange={onChange} />);
    focusAt(2);
    type(' there');
    expect(onChange).toHaveBeenLastCalledWith('hi there');
  });

  it('takes text replaced from outside without reporting it back, or putting it in undo', () => {
    const onChange = vi.fn();
    render(<Harness text="typed" onChange={onChange} />);
    focusAt(5);
    type('!');
    onChange.mockClear();
    act(() => external('pasted from clipboard'));
    expect(doc()).toBe('pasted from clipboard');
    expect(onChange).not.toHaveBeenCalled();
    press('z', { ctrlKey: true }); // undoes the typing, not the paste
    expect(doc()).toBe('pasted from clipboard');
  });

  it('takes Windows line endings from outside', () => {
    const onChange = vi.fn();
    render(<Harness text={'a\r\nb'} onChange={onChange} />);
    expect(doc()).toBe('a\nb');
    expect(view().state.doc.lines).toBe(2);
  });

  it('shows a placeholder when empty', () => {
    render(<Harness text="" />);
    expect(document.querySelector('.cm-placeholder')?.textContent).toMatch(/prompt/i);
  });
});

describe('format as you type', () => {
  it('formats the notes: headings, bold, bullets', () => {
    render(<Harness />);
    expect(document.querySelector('.cm-line.cm-md-h1')?.textContent).toBe('Script');
    expect(document.querySelector('.cm-md-strong')?.textContent).toBe('everyone');
    expect(document.querySelectorAll('.cm-md-bullet')).toHaveLength(2);
  });

  it('shows markers only on the line with the cursor', () => {
    render(<Harness />);
    expect(lineText(3)).toBe('Hello everyone here.');
    focusAt(SAMPLE.indexOf('Hello'));
    expect(lineText(3)).toBe('Hello **everyone** here.');
    expect(lineText(1)).toBe('Script'); // other lines stay clean
  });

  it('hides them again when the editor loses focus', async () => {
    render(<Harness />);
    focusAt(SAMPLE.indexOf('Hello'));
    // CodeMirror notices a lost focus shortly after the blur event
    await act(async () => {
      view().contentDOM.blur();
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(lineText(3)).toBe('Hello everyone here.');
  });

  it('formats while typing: closing ** makes it bold right away', () => {
    render(<Harness text="" />);
    focusAt(0);
    type('say **hi**');
    expect(document.querySelector('.cm-md-strong')?.textContent).toBe('**hi**');
    type('\nnext');
    expect(document.querySelector('.cm-md-strong')?.textContent).toBe('hi');
  });

  it('draws tables, and shows their source while editing inside', async () => {
    const table = '| Plan | Price |\n|------|-------|\n| Free | $0 |';
    const notes = `Intro\n\n${table}\n\nAfter`;
    render(<Harness text={notes} />);
    expect([...document.querySelectorAll('.cm-md-table td')].map((c) => c.textContent)).toEqual(['Free', '$0']);
    focusAt(notes.indexOf('Free'));
    await settleFocus();
    expect(document.querySelector('.cm-md-table')).toBeNull();
    expect(view().contentDOM.textContent).toContain('| Free | $0 |');
    focusAt(0); // back on the first line
    expect(document.querySelector('.cm-md-table')).not.toBeNull();
  });

  it('ticks a task box on click', () => {
    render(<Harness text="- [ ] buy milk" />);
    const box = document.querySelector('.cm-md-checkbox') as HTMLElement;
    expect(box.getAttribute('aria-checked')).toBe('false');
    act(() => {
      fireEvent.mouseDown(box);
    });
    expect(doc()).toBe('- [x] buy milk');
  });

  it('shows HTML and scripts in the notes as text, never as elements', () => {
    const payloads = '<script>alert(1)</script>\n<img src=x onerror=alert(1)>\n<iframe src="javascript:alert(1)">\n[x](javascript:alert(1))';
    render(<Harness text={payloads} />);
    const content = view().contentDOM;
    expect(content.querySelector('script, img, iframe, svg, object, embed')).toBeNull();
    expect(content.textContent).toContain('<script>alert(1)</script>');
    expect([...content.querySelectorAll('*')].some((el) => [...el.attributes].some((a) => /^on/i.test(a.name)))).toBe(false);
  });
});

describe('shortcuts', () => {
  it('Ctrl+B bolds the word at the cursor, Ctrl+Z undoes it in one step', () => {
    render(<Harness text="say hello now" />);
    focusAt(6);
    press('b', { ctrlKey: true });
    expect(doc()).toBe('say **hello** now');
    press('z', { ctrlKey: true });
    expect(doc()).toBe('say hello now');
  });

  it('Ctrl+I italicises the selection (not CodeMirror\'s own Ctrl+I)', () => {
    render(<Harness text="say hello now" />);
    focusAt(0);
    selectRange(4, 9);
    press('i', { ctrlKey: true });
    expect(doc()).toBe('say *hello* now');
  });

  it('Ctrl+B does nothing when Markdown is off', () => {
    render(<Harness text="say hello now" markdown={false} />);
    focusAt(6);
    press('b', { ctrlKey: true });
    expect(doc()).toBe('say hello now');
    expect(document.querySelector('.cm-md-h1, .cm-md-strong')).toBeNull();
  });

  it('turning Markdown off and on switches the formatting live', () => {
    const { rerender } = render(<Harness text="# Title" />);
    expect(document.querySelector('.cm-md-h1')).not.toBeNull();
    rerender(<Harness text="# Title" markdown={false} />);
    expect(document.querySelector('.cm-md-h1')).toBeNull();
    expect(lineText(1)).toBe('# Title');
    rerender(<Harness text="# Title" />);
    expect(document.querySelector('.cm-md-h1')).not.toBeNull();
  });
});

describe('formatting toolbar', () => {
  it('is hidden unless opened, while locked, and with Markdown off', () => {
    const { rerender } = render(<Harness />);
    expect(screen.queryByRole('toolbar')).toBeNull();
    rerender(<Harness showFormatBar />);
    expect(screen.getByRole('toolbar').querySelectorAll('button')).toHaveLength(8);
    rerender(<Harness showFormatBar isLocked />);
    expect(screen.queryByRole('toolbar')).toBeNull();
    rerender(<Harness showFormatBar markdown={false} />);
    expect(screen.queryByRole('toolbar')).toBeNull();
  });

  it('does not take focus from the editor', () => {
    render(<Harness showFormatBar />);
    expect(fireEvent.mouseDown(screen.getByRole('button', { name: /bold/i }))).toBe(false);
  });

  it('applies to the selection, and focuses the editor', () => {
    render(<Harness text="one two" showFormatBar />);
    selectRange(4, 7);
    fireEvent.click(screen.getByRole('button', { name: /^bold/i }));
    expect(doc()).toBe('one **two**');
    expect(view().hasFocus).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: /bulleted/i }));
    expect(doc()).toBe('- one **two**');
  });
});

describe('locked', () => {
  it('is read-only, with every marker hidden', () => {
    const { rerender } = render(<Harness />);
    focusAt(SAMPLE.indexOf('Hello'));
    expect(lineText(3)).toContain('**');
    rerender(<Harness isLocked />);
    expect(view().contentDOM.getAttribute('contenteditable')).toBe('false');
    expect(lineText(3)).toBe('Hello everyone here.');
    rerender(<Harness isLocked={false} />);
    expect(view().contentDOM.getAttribute('contenteditable')).toBe('true');
  });

  it('Ctrl+wheel scrolls the notes', async () => {
    render(<Harness isLocked />);
    await act(async () => {});
    listeners['locked-scroll']({ payload: -120 });
    expect(vi.mocked(Element.prototype.scrollBy).mock.contexts[0]).toBe(view().scrollDOM);
  });
});

describe('with App', () => {
  it('quick edit focuses the editor', () => {
    const { rerender } = render(<Harness />);
    expect(view().hasFocus).toBe(false);
    rerender(<Harness editRequest={1} />);
    expect(view().hasFocus).toBe(true);
  });

  it('starting auto-scroll leaves the editor', () => {
    const { rerender } = render(<Harness />);
    focusAt(0);
    rerender(<Harness autoScroll />);
    expect(view().hasFocus).toBe(false);
  });

  it('typing into the editor pauses auto-scroll', async () => {
    const stop = vi.fn();
    render(<Harness autoScroll onAutoScrollStop={stop} />);
    focusAt(0);
    await settleFocus();
    expect(stop).toHaveBeenCalled();
  });
});
