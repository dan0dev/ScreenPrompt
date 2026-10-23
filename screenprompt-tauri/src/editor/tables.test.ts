// @vitest-environment jsdom
// MIT License - Copyright (c) 2026 ScreenPrompt Contributors

import { EditorState } from '@codemirror/state';
import { ensureSyntaxTree } from '@codemirror/language';
import type { WidgetType } from '@codemirror/view';
import { describe, expect, it } from 'vitest';
import { markdown } from './markdownLanguage';
import { concealAllField, focusedField } from './livePreview';
import { parseTable, tableDecorations } from './tables';

// The table from the user's report: no trailing pipe on the last row
const PLANS = '| Plan | Price | Users |\n|------|-------|-------|\n| Free | $0 | 1 |\n| Pro | $9 | 5 |\n| Team | $29 | 25';

describe('parseTable', () => {
  it('reads header, rows and cells', () => {
    expect(parseTable(PLANS)).toEqual({
      header: ['Plan', 'Price', 'Users'],
      align: [null, null, null],
      rows: [['Free', '$0', '1'], ['Pro', '$9', '5'], ['Team', '$29', '25']],
    });
  });

  it('reads column alignment', () => {
    expect(parseTable('a|b|c|d\n:--|:-:|--:|---').align).toEqual(['left', 'center', 'right', null]);
  });

  it('keeps empty cells in place and evens out short and long rows', () => {
    expect(parseTable('| a | b | c |\n|---|---|---|\n| 1 |  | 3 |\n| x |\n| p | q | r | extra |').rows).toEqual([
      ['1', '', '3'],
      ['x', '', ''],
      ['p', 'q', 'r'],
    ]);
  });

  it('treats \\| as a pipe inside a cell', () => {
    expect(parseTable('| a | b |\n|---|---|\n| x \\| y | z |').rows[0]).toEqual(['x | y', 'z']);
  });
});

// The drawn table for a document, as DOM, with the editor focused at `cursor`
function drawn(doc: string, opts: { cursor?: number; focused?: boolean; locked?: boolean } = {}) {
  // Focus and lock state set through their fields' initial values
  const state = EditorState.create({
    doc,
    selection: { anchor: opts.cursor ?? 0 },
    extensions: [
      markdown(),
      concealAllField.init(() => opts.locked ?? false),
      focusedField.init(() => opts.focused ?? false),
    ],
  });
  ensureSyntaxTree(state, state.doc.length, 5000);
  const widgets: { from: number; to: number; dom: HTMLElement }[] = [];
  tableDecorations(state).between(0, state.doc.length, (from, to, deco) => {
    const widget = (deco.spec as { widget?: WidgetType }).widget;
    if (widget) widgets.push({ from, to, dom: widget.toDOM(null as never) });
  });
  return widgets;
}

const cells = (table: HTMLElement, tag: string) => [...table.querySelectorAll(tag)].map((c) => c.textContent);

describe('drawn tables', () => {
  it('draws the reported table with every row and cell', () => {
    const [w] = drawn(`Intro\n\n${PLANS}\n\nAfter`);
    expect(w).toBeDefined();
    expect(cells(w.dom, 'th')).toEqual(['Plan', 'Price', 'Users']);
    expect(cells(w.dom, 'td')).toEqual(['Free', '$0', '1', 'Pro', '$9', '5', 'Team', '$29', '25']);
  });

  it('replaces exactly the table lines, leaving the text around it', () => {
    const doc = `Intro\n\n${PLANS}\n\nAfter`;
    const [w] = drawn(doc);
    expect(doc.slice(w.from, w.to)).toBe(PLANS);
  });

  it('draws formatting inside cells', () => {
    const [w] = drawn('| a | b |\n|---|---|\n| **bold** *it* | `code` ~~old~~ [site](https://x.y) |');
    expect(w.dom.querySelector('td strong')?.textContent).toBe('bold');
    expect(w.dom.querySelector('td em')?.textContent).toBe('it');
    expect(w.dom.querySelector('td code')?.textContent).toBe('code');
    expect(w.dom.querySelector('td del')?.textContent).toBe('old');
    expect(w.dom.querySelector('td .cm-md-link')?.textContent).toBe('site');
    expect(w.dom.textContent).not.toContain('**');
    expect(w.dom.textContent).not.toContain('https://x.y');
  });

  it('applies column alignment', () => {
    const [w] = drawn('| l | c | r |\n|:--|:-:|--:|\n| 1 | 2 | 3 |');
    expect([...w.dom.querySelectorAll('td')].map((td) => (td as HTMLElement).style.textAlign)).toEqual(['left', 'center', 'right']);
  });

  it('shows HTML in cells as text, never as elements', () => {
    const [w] = drawn('| a |\n|---|\n| <img src=x onerror=alert(1)> <script>alert(2)</script> |');
    expect(w.dom.querySelector('img, script')).toBeNull();
    expect(w.dom.textContent).toContain('<img src=x onerror=alert(1)>');
  });

  it('shows the source while editing inside the table', () => {
    const doc = `Intro\n\n${PLANS}`;
    expect(drawn(doc, { cursor: doc.indexOf('Pro'), focused: true })).toHaveLength(0);
  });

  it('stays drawn when the cursor is in it but the editor is not focused', () => {
    const doc = `Intro\n\n${PLANS}`;
    expect(drawn(doc, { cursor: doc.indexOf('Pro'), focused: false })).toHaveLength(1);
  });

  it('stays drawn while locked, even with the cursor in it', () => {
    const doc = `Intro\n\n${PLANS}`;
    expect(drawn(doc, { cursor: doc.indexOf('Pro'), focused: true, locked: true })).toHaveLength(1);
  });

  it('draws only real tables (a line of pipes alone is not one)', () => {
    expect(drawn('just | some | pipes')).toHaveLength(0);
  });
});
