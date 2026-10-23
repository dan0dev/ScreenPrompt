// MIT License - Copyright (c) 2026 ScreenPrompt Contributors

import { EditorSelection, EditorState } from '@codemirror/state';
import { ensureSyntaxTree } from '@codemirror/language';
import { describe, expect, it } from 'vitest';
import { markdown } from './markdownLanguage';
import { formatTransaction, linkAt, type FormatStyle } from './commands';

function apply(doc: string, anchor: number, head: number, style: FormatStyle) {
  const state = EditorState.create({ doc, selection: EditorSelection.single(anchor, head) });
  const next = state.update(formatTransaction(state, style)).state;
  const sel = next.selection.main;
  return { doc: next.doc.toString(), selected: next.doc.sliceString(sel.from, sel.to), from: sel.from };
}

describe('formatTransaction', () => {
  it('wraps the selection and keeps it selected', () => {
    expect(apply('say hello', 4, 9, 'bold')).toEqual({ doc: 'say **hello**', selected: 'hello', from: 6 });
  });

  it('works on a backwards selection', () => {
    expect(apply('say hello', 9, 4, 'italic').doc).toBe('say *hello*');
  });

  it('styles the word at the caret', () => {
    expect(apply('say hello', 6, 6, 'strike').doc).toBe('say ~~hello~~');
  });

  it('applies line styles', () => {
    expect(apply('a\nb', 3, 3, 'bullet').doc).toBe('a\n- b');
    expect(apply('a\nb', 3, 3, 'heading').doc).toBe('a\n# b');
  });

  it('is one undoable step, marked as formatting', () => {
    const state = EditorState.create({ doc: 'x', selection: { anchor: 0, head: 1 } });
    const tr = state.update(formatTransaction(state, 'code'));
    expect(tr.isUserEvent('input.format')).toBe(true);
  });
});

describe('linkAt', () => {
  const at = (doc: string, find: string) => {
    const state = EditorState.create({ doc, extensions: [markdown()] });
    ensureSyntaxTree(state, state.doc.length, 5000);
    return linkAt(state, doc.indexOf(find));
  };

  it('finds the URL of a link from its text', () => {
    expect(at('see [the docs](https://x.y/z) now', 'docs')).toBe('https://x.y/z');
  });

  it('finds autolinks and bare URLs', () => {
    expect(at('go to <https://a.b> or https://c.d', 'a.b')).toBe('https://a.b');
    expect(at('go to https://c.d today', 'c.d')).toBe('https://c.d');
  });

  it('finds nothing in plain text', () => {
    expect(at('just words here', 'words')).toBeNull();
  });
});
