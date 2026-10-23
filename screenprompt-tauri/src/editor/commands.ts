// MIT License - Copyright (c) 2026 ScreenPrompt Contributors

import type { EditorState, TransactionSpec } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import { toggleBlock, toggleInline, type BlockStyle, type InlineStyle } from '../utils/formatting';

export type FormatStyle = InlineStyle | BlockStyle;

const INLINE_STYLES: readonly string[] = ['bold', 'italic', 'strike', 'code'] satisfies InlineStyle[];

/**
 * The transaction that toggles a style on the main selection (bold, list, ...),
 * as one undoable step. The text logic is utils/formatting's.
 */
export function formatTransaction(state: EditorState, style: FormatStyle): TransactionSpec {
  const doc = state.doc.toString();
  const { from, to } = state.selection.main;
  const edit = INLINE_STYLES.includes(style)
    ? toggleInline(doc, from, to, style as InlineStyle)
    : toggleBlock(doc, from, to, style as BlockStyle);
  return {
    changes: { from: edit.start, to: edit.end, insert: edit.insert },
    selection: { anchor: edit.selStart, head: edit.selEnd },
    scrollIntoView: true,
    userEvent: 'input.format',
  };
}

/** The web address of a link (or bare URL) at `pos`, or null */
export function linkAt(state: EditorState, pos: number): string | null {
  for (let node: ReturnType<ReturnType<typeof syntaxTree>['resolveInner']> | null = syntaxTree(state).resolveInner(pos, 1); node; node = node.parent) {
    if (node.name === 'URL') return state.doc.sliceString(node.from, node.to);
    if (node.name === 'Link' || node.name === 'Image' || node.name === 'Autolink') {
      const url = node.getChild('URL');
      return url ? state.doc.sliceString(url.from, url.to) : null;
    }
  }
  return null;
}
