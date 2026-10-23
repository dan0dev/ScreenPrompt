// MIT License - Copyright (c) 2026 ScreenPrompt Contributors

// Markdown tables, drawn as real tables in the live preview. Like other
// formatting, the source shows while the cursor is in the table (to edit it), and
// the drawn table shows otherwise. A table replaces whole lines, which CodeMirror
// only allows from a state field (not a view plugin), hence this separate module.
// Tables are built element by element from the text, never from HTML.

import { EditorSelection, Prec, StateField, type EditorState, type Range } from '@codemirror/state';
import { Decoration, EditorView, WidgetType, keymap, type DecorationSet } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import type { SyntaxNode } from '@lezer/common';
import { markdownParser } from './markdownLanguage';
import { concealAllField, focusedField, selectedLines } from './livePreview';

export type Align = 'left' | 'center' | 'right' | null;

export interface ParsedTable {
  header: string[];
  align: Align[];
  rows: string[][];
}

// One row's cells: outer pipes optional, "\|" is a pipe inside a cell
function splitRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);
  const cells: string[] = [];
  let cell = '';
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\\' && s[i + 1] === '|') {
      cell += '|';
      i++;
    } else if (s[i] === '|') {
      cells.push(cell.trim());
      cell = '';
    } else {
      cell += s[i];
    }
  }
  cells.push(cell.trim());
  return cells;
}

function alignOf(delimiter: string): Align {
  const left = delimiter.startsWith(':');
  const right = delimiter.endsWith(':');
  return left && right ? 'center' : right ? 'right' : left ? 'left' : null;
}

/** A table's source (header, delimiter row, body rows) as cells. Rows are padded or cut to the header's width. */
export function parseTable(source: string): ParsedTable {
  const lines = source.split('\n').filter((line) => line.trim() !== '');
  const header = splitRow(lines[0] ?? '');
  const fit = (cells: string[]) => header.map((_, i) => cells[i] ?? '');
  return {
    header,
    align: fit(splitRow(lines[1] ?? '')).map(alignOf),
    rows: lines.slice(2).map((line) => fit(splitRow(line))),
  };
}

// Cell text with its inline formatting (bold, italic, code, links...), using the
// same Markdown parser as the editor. Markers are dropped; everything else goes in
// as text nodes.
const HIDDEN = new Set(['EmphasisMark', 'CodeMark', 'StrikethroughMark', 'LinkMark', 'URL', 'LinkTitle']);
const ELEMENTS: Record<string, string> = { StrongEmphasis: 'strong', Emphasis: 'em', Strikethrough: 'del', InlineCode: 'code' };

function appendInline(parent: HTMLElement, text: string) {
  const block = markdownParser.parse(text).topNode.firstChild;
  if (!block || block.name !== 'Paragraph') {
    parent.append(text);
    return;
  }
  build(parent, block, text);
}

function build(parent: HTMLElement, node: SyntaxNode, text: string) {
  let pos = node.from;
  for (let child = node.firstChild; child; child = child.nextSibling) {
    if (child.from > pos) parent.append(text.slice(pos, child.from));
    pos = child.to;
    if (HIDDEN.has(child.name) && !(child.name === 'URL' && node.name === 'Autolink')) continue;
    if (child.name === 'Escape') {
      parent.append(text.slice(child.from + 1, child.to));
    } else if (ELEMENTS[child.name]) {
      const el = document.createElement(ELEMENTS[child.name]);
      if (child.name === 'InlineCode') el.className = 'cm-md-code';
      build(el, child, text);
      parent.append(el);
    } else if (child.name === 'Link' || child.name === 'Image' || child.name === 'Autolink' || child.name === 'URL') {
      const el = document.createElement('span');
      el.className = 'cm-md-link';
      if (child.name === 'URL') el.append(text.slice(child.from, child.to));
      else build(el, child, text);
      parent.append(el);
    } else {
      parent.append(text.slice(child.from, child.to));
    }
  }
  if (node.to > pos) parent.append(text.slice(pos, node.to));
}

class TableWidget extends WidgetType {
  readonly source: string;
  constructor(source: string) {
    super();
    this.source = source;
  }
  eq(other: TableWidget) {
    return other.source === this.source;
  }
  toDOM() {
    const { header, align, rows } = parseTable(this.source);
    const wrap = document.createElement('div');
    wrap.className = 'cm-md-table-wrap';
    const table = document.createElement('table');
    table.className = 'cm-md-table';
    const addRow = (section: HTMLElement, cells: string[], tag: 'th' | 'td') => {
      const tr = document.createElement('tr');
      cells.forEach((cell, i) => {
        const el = document.createElement(tag);
        if (align[i]) el.style.textAlign = align[i]!;
        appendInline(el, cell);
        tr.append(el);
      });
      section.append(tr);
    };
    const thead = document.createElement('thead');
    addRow(thead, header, 'th');
    const tbody = document.createElement('tbody');
    rows.forEach((row) => addRow(tbody, row, 'td'));
    table.append(thead, tbody);
    wrap.append(table);
    return wrap;
  }
  ignoreEvent() {
    return false; // a click goes to the editor, putting the cursor in the table to edit it
  }
}

/** Drawn tables for every top-level table the cursor isn't in. Exported for tests. */
export function tableDecorations(state: EditorState): DecorationSet {
  const concealAll = state.field(concealAllField, false) ?? false;
  const focused = state.field(focusedField, false) ?? false;
  const reveal = focused && !concealAll ? selectedLines(state) : new Set<number>();
  const decorations: Range<Decoration>[] = [];
  for (let node = syntaxTree(state).topNode.firstChild; node; node = node.nextSibling) {
    if (node.name !== 'Table') continue;
    const first = state.doc.lineAt(node.from);
    const last = state.doc.lineAt(node.to);
    let editing = false;
    for (let n = first.number; n <= last.number; n++) if (reveal.has(n)) editing = true;
    if (editing) continue;
    const widget = new TableWidget(state.doc.sliceString(first.from, last.to));
    decorations.push(Decoration.replace({ widget, block: true }).range(first.from, last.to));
  }
  return Decoration.set(decorations);
}

const tableField = StateField.define<DecorationSet>({
  create: tableDecorations,
  update(value, tr) {
    if (tr.docChanged || tr.selection || tr.effects.length || syntaxTree(tr.startState) !== syntaxTree(tr.state)) {
      return tableDecorations(tr.state);
    }
    return value;
  },
  provide: (field) => EditorView.decorations.from(field),
});

// A drawn table is one block to the cursor, so up/down arrows would jump right
// over it. Stop at its first (or last) line instead, which shows its source.
function arrowIntoTable(view: EditorView, down: boolean): boolean {
  const range = view.state.selection.main;
  if (!range.empty) return false;
  const next = view.moveVertically(range, down);
  let target: number | null = null;
  view.state.field(tableField).between(0, view.state.doc.length, (from, to) => {
    if (down && range.head < from && next.head >= from) target = from;
    if (!down && range.head > to && next.head <= to) target = view.state.doc.lineAt(to).from;
  });
  if (target === null) return false;
  view.dispatch({ selection: EditorSelection.cursor(target), scrollIntoView: true, userEvent: 'select' });
  return true;
}

const tableKeys = Prec.high(keymap.of([
  { key: 'ArrowDown', run: (view) => arrowIntoTable(view, true) },
  { key: 'ArrowUp', run: (view) => arrowIntoTable(view, false) },
]));

/** Goes after livePreview(), whose focus and lock state it reads */
export function tablePreview() {
  return [tableField, tableKeys];
}
