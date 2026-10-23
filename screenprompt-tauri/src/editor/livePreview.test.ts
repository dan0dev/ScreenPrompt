// MIT License - Copyright (c) 2026 ScreenPrompt Contributors

import { EditorState } from '@codemirror/state';
import { ensureSyntaxTree } from '@codemirror/language';
import type { Decoration } from '@codemirror/view';
import { describe, expect, it } from 'vitest';
import { markdown } from './markdownLanguage';
import { buildDecorations, selectedLines } from './livePreview';

// What a line looks like with the decorations applied: hidden text removed,
// widgets drawn as • / [x] / [ ], styled spans as {class:text}, line classes listed
interface LineView {
  text: string;
  classes: string[];
}

function preview(doc: string, reveal: number[] = []): LineView[] {
  const state = EditorState.create({ doc, extensions: [markdown()] });
  ensureSyntaxTree(state, state.doc.length, 5000);
  const set = buildDecorations(state, [{ from: 0, to: state.doc.length }], new Set(reveal));

  const hidden: { from: number; to: number; widget?: string }[] = [];
  const marks: { from: number; to: number; cls: string }[] = [];
  const lineClasses = new Map<number, string[]>();
  set.between(0, state.doc.length, (from, to, deco: Decoration) => {
    const spec = deco.spec as { class?: string; widget?: { toDOM: () => HTMLElement } };
    if (from === to && spec.class) {
      const n = state.doc.lineAt(from).number;
      lineClasses.set(n, [...(lineClasses.get(n) ?? []), spec.class]);
    } else if (spec.class) {
      marks.push({ from, to, cls: spec.class });
    } else {
      const widget = spec.widget ? widgetText(spec.widget) : undefined;
      hidden.push({ from, to, widget });
    }
  });

  const out: LineView[] = [];
  for (let n = 1; n <= state.doc.lines; n++) {
    const line = state.doc.line(n);
    let text = '';
    // Close spans ending at pos, then open those starting there (outer first)
    const boundary = (pos: number) => {
      text += '}'.repeat(marks.filter((m) => m.to === pos && m.from < pos).length);
      text += marks
        .filter((m) => m.from === pos)
        .sort((a, b) => b.to - a.to)
        .map((m) => `{${m.cls.replace('cm-md-', '')}:`)
        .join('');
    };
    for (let pos = line.from; pos < line.to; ) {
      boundary(pos);
      const h = hidden.find((r) => r.from === pos);
      if (h) {
        text += h.widget ?? '';
        // Spans can end inside hidden text: close them at its end
        for (let p = pos + 1; p < h.to; p++) text += '}'.repeat(marks.filter((m) => m.to === p).length);
        pos = h.to;
        continue;
      }
      text += state.doc.sliceString(pos, pos + 1);
      pos++;
    }
    text += '}'.repeat(marks.filter((m) => m.to === line.to && m.from < line.to).length);
    out.push({ text, classes: (lineClasses.get(n) ?? []).map((c) => c.replace(/cm-md-/g, '')) });
  }
  return out;
}

function widgetText(widget: { toDOM: () => HTMLElement }) {
  // Widgets build DOM; describe them without one
  const w = widget as unknown as { checked?: boolean; constructor: { name: string } };
  if (w.constructor.name === 'BulletWidget') return '•';
  if (w.constructor.name === 'CheckboxWidget') return w.checked ? '[x]' : '[ ]';
  return '?';
}

const text = (doc: string, reveal?: number[]) => preview(doc, reveal).map((l) => l.text);

describe('live preview: headings', () => {
  it('sizes heading lines and hides the # marker', () => {
    const lines = preview('# Big\n## Medium\n### Small\n#### Bold only');
    expect(lines.map((l) => l.text)).toEqual(['Big', 'Medium', 'Small', 'Bold only']);
    expect(lines.map((l) => l.classes)).toEqual([['h1'], ['h2'], ['h3'], ['h4']]);
  });

  it('shows the # on the cursor line', () => {
    expect(text('# Big\n## Medium', [1])).toEqual(['# Big', 'Medium']);
  });

  it('styles setext headings and hides their underline', () => {
    const lines = preview('Title\n=====');
    expect(lines[0].classes).toEqual(['h1']);
    expect(lines[1]).toEqual({ text: '', classes: [] });
  });
});

describe('live preview: inline styles', () => {
  it('formats and hides markers', () => {
    expect(text('**bold** *it* ***both*** ~~gone~~ `code`')).toEqual([
      '{strong:bold} {em:it} {em:{strong:both}} {strike:gone} {code:code}',
    ]);
  });

  it('keeps markers (still styled) on the cursor line only', () => {
    expect(text('**a**\n**b**', [2])).toEqual(['{strong:a}', '{strong:**b**}']);
  });

  it('keeps underscores-style emphasis working', () => {
    expect(text('_it_ __bold__')).toEqual(['{em:it} {strong:bold}']);
  });

  it('shows escaped characters without the backslash', () => {
    expect(text('\\*not italic\\*')).toEqual(['*not italic*']);
  });

  it('leaves HTML-looking text as typed', () => {
    expect(text('<context>keep **this**</context>')).toEqual(['<context>keep {strong:this}</context>']);
  });
});

describe('live preview: links', () => {
  it('shows only the link text, underlined', () => {
    expect(text('see [the docs](https://x.y "Title") now')).toEqual(['see {link:the docs} now']);
  });

  it('shows the whole link syntax on the cursor line', () => {
    expect(text('[docs](https://x.y)', [1])).toEqual(['{link:[docs](https://x.y)}']);
  });

  it('shows autolinks without angle brackets, and bare URLs as links', () => {
    expect(text('<https://a.b> and https://c.d')).toEqual(['{link:https://a.b} and {link:https://c.d}']);
  });

  it('shows images as their alt text, as a link', () => {
    expect(text('![diagram](pic.png)')).toEqual(['{link:diagram}']);
  });
});

describe('live preview: blocks', () => {
  it('draws bullets, keeps numbers, nests', () => {
    expect(text('- one\n  - two\n1. first')).toEqual(['• one', '  • two', '1. first']);
  });

  it('shows the dash on the cursor line', () => {
    expect(text('- one\n- two', [2])).toEqual(['• one', '- two']);
  });

  it('draws task checkboxes', () => {
    expect(text('- [x] done\n- [ ] open')).toEqual(['[x] done', '[ ] open']);
  });

  it('marks quote lines and hides the >', () => {
    const lines = preview('> quoted\n> more');
    expect(lines.map((l) => l.text)).toEqual(['quoted', 'more']);
    expect(lines.every((l) => l.classes.includes('quote'))).toBe(true);
  });

  it('shades code blocks and hides the fences unless the cursor is in the block', () => {
    const lines = preview('```\ncode **not bold**\n```');
    expect(lines.map((l) => l.text)).toEqual(['', 'code **not bold**', '']);
    expect(lines[0].classes).toEqual(['codeblock fence']);
    expect(lines[1].classes).toEqual(['codeblock']);
    expect(text('```\ncode\n```', [2])).toEqual(['```', 'code', '```']);
  });

  it('draws a rule for ---', () => {
    const lines = preview('above\n\n---\n\nbelow');
    expect(lines[2]).toEqual({ text: '', classes: ['hr'] });
    expect(text('above\n\n---', [3])[2]).toBe('---');
  });
});

describe('selectedLines', () => {
  it('covers every line a selection touches', () => {
    const state = EditorState.create({ doc: 'a\nb\nc\nd', selection: { anchor: 2, head: 5 } });
    expect([...selectedLines(state)]).toEqual([2, 3]);
  });
});
