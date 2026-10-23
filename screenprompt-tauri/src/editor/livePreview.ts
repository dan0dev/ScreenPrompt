// MIT License - Copyright (c) 2026 ScreenPrompt Contributors

// Live preview: notes stay Markdown text, but show formatted as you type. Markers
// (#, **, `, link URLs...) are hidden everywhere except on the lines the cursor is
// on, so they can still be edited; while locked, or when the editor doesn't have
// focus, they're hidden everywhere.

import { StateEffect, StateField, type EditorState, type Range } from '@codemirror/state';
import { Decoration, EditorView, ViewPlugin, WidgetType, type DecorationSet, type ViewUpdate } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import type { SyntaxNodeRef } from '@lezer/common';

/** Hide every marker, even on the cursor's line (locked: presenting) */
export const setConcealAll = StateEffect.define<boolean>();

export const concealAllField = StateField.define<boolean>({
  create: () => false,
  update(value, tr) {
    for (const effect of tr.effects) if (effect.is(setConcealAll)) value = effect.value;
    return value;
  },
});

/** Whether the editor has focus, as state (so state fields, like tables, can follow it) */
const setFocused = StateEffect.define<boolean>();

export const focusedField = StateField.define<boolean>({
  create: () => false,
  update(value, tr) {
    for (const effect of tr.effects) if (effect.is(setFocused)) value = effect.value;
    return value;
  },
});

const trackFocus = EditorView.focusChangeEffect.of((_state, focusing) => setFocused.of(focusing));

const hide = Decoration.replace({});
const lineClass = (cls: string) => Decoration.line({ class: cls });
const markClass = (cls: string) => Decoration.mark({ class: cls });

const STYLE_MARKS: Record<string, Decoration> = {
  StrongEmphasis: markClass('cm-md-strong'),
  Emphasis: markClass('cm-md-em'),
  Strikethrough: markClass('cm-md-strike'),
  InlineCode: markClass('cm-md-code'),
};
// Markers hidden off the cursor's line
const INLINE_MARKS = new Set(['EmphasisMark', 'StrikethroughMark']);

class BulletWidget extends WidgetType {
  eq() {
    return true;
  }
  toDOM() {
    const span = document.createElement('span');
    span.className = 'cm-md-bullet';
    span.textContent = '•';
    return span;
  }
}

class CheckboxWidget extends WidgetType {
  readonly checked: boolean;
  constructor(checked: boolean) {
    super();
    this.checked = checked;
  }
  eq(other: CheckboxWidget) {
    return other.checked === this.checked;
  }
  toDOM() {
    const box = document.createElement('span');
    box.className = `cm-md-checkbox${this.checked ? ' checked' : ''}`;
    box.setAttribute('role', 'checkbox');
    box.setAttribute('aria-checked', String(this.checked));
    return box;
  }
  ignoreEvent() {
    return false; // let the click through to toggleTaskOnClick
  }
}

const bullet = Decoration.replace({ widget: new BulletWidget() });
const checkbox = (checked: boolean) => Decoration.replace({ widget: new CheckboxWidget(checked) });

// Line numbers (1-based) the selection touches: their markers stay visible
export function selectedLines(state: EditorState): Set<number> {
  const lines = new Set<number>();
  for (const range of state.selection.ranges) {
    const first = state.doc.lineAt(range.from).number;
    const last = state.doc.lineAt(range.to).number;
    for (let n = first; n <= last; n++) lines.add(n);
  }
  return lines;
}

/**
 * The live-preview decorations for `ranges` of the document (the visible part),
 * with markers shown only on the `reveal` lines. Exported for tests.
 */
export function buildDecorations(
  state: EditorState,
  ranges: readonly { from: number; to: number }[],
  reveal: Set<number>,
): DecorationSet {
  const doc = state.doc;
  const decorations: Range<Decoration>[] = [];
  const lineOf = (pos: number) => doc.lineAt(pos);
  const revealed = (pos: number) => reveal.has(lineOf(pos).number);
  // Every line of a node (for blocks: headings, quotes, code)
  const eachLine = (from: number, to: number, fn: (lineFrom: number, n: number) => void) => {
    for (let pos = from; pos <= to; ) {
      const line = lineOf(pos);
      fn(line.from, line.number);
      pos = line.to + 1;
    }
  };
  const hideRange = (from: number, to: number) => {
    if (to > from) decorations.push(hide.range(from, to));
  };
  // A marker plus the space after it ("# ", "> ")
  const withSpace = (to: number) => (doc.sliceString(to, to + 1) === ' ' ? to + 1 : to);

  for (const { from, to } of ranges) {
    syntaxTree(state).iterate({
      from,
      to,
      enter: (node: SyntaxNodeRef) => {
        const name = node.name;

        const heading = /^(ATX|Setext)Heading([1-6])$/.exec(name);
        if (heading) {
          const level = heading[2];
          eachLine(node.from, node.to, (lineFrom) => {
            // A setext heading's underline (=== / ---) is a marker, not heading text
            if (heading[1] === 'Setext' && lineFrom > node.from && /^[=-]+\s*$/.test(doc.lineAt(lineFrom).text)) return;
            decorations.push(lineClass(`cm-md-h${level}`).range(lineFrom));
          });
          return;
        }

        if (name === 'HeaderMark') {
          if (!revealed(node.from)) {
            const parent = node.node.parent?.name ?? '';
            hideRange(node.from, parent.startsWith('ATX') ? withSpace(node.to) : node.to);
          }
          return;
        }

        if (STYLE_MARKS[name]) {
          if (node.to > node.from) decorations.push(STYLE_MARKS[name].range(node.from, node.to));
          return;
        }

        if (INLINE_MARKS.has(name)) {
          if (!revealed(node.from)) hideRange(node.from, node.to);
          return;
        }

        if (name === 'CodeMark') {
          // Inline code's backticks hide; a code block's fences are handled with the block
          if (node.node.parent?.name === 'InlineCode' && !revealed(node.from)) hideRange(node.from, node.to);
          return;
        }

        if (name === 'FencedCode' || name === 'CodeBlock') {
          const firstLine = lineOf(node.from).number;
          const lastLine = lineOf(node.to).number;
          let show = false;
          for (let n = firstLine; n <= lastLine; n++) if (reveal.has(n)) show = true;
          eachLine(node.from, node.to, (lineFrom, n) => {
            const isFence = name === 'FencedCode' && (n === firstLine || (n === lastLine && /^\s*(```|~~~)/.test(doc.line(n).text)));
            decorations.push(lineClass(isFence ? 'cm-md-codeblock cm-md-fence' : 'cm-md-codeblock').range(lineFrom));
            if (isFence && !show) hideRange(lineFrom, doc.line(n).to);
          });
          return false;
        }

        if (name === 'Blockquote') {
          eachLine(node.from, node.to, (lineFrom) => decorations.push(lineClass('cm-md-quote').range(lineFrom)));
          return;
        }

        if (name === 'QuoteMark') {
          if (!revealed(node.from)) hideRange(node.from, withSpace(node.to));
          return;
        }

        if (name === 'ListMark') {
          const list = node.node.parent?.parent?.name;
          if (list === 'BulletList' && !revealed(node.from)) {
            // A task item's marker is shown by its checkbox instead
            const task = node.node.nextSibling?.name === 'Task';
            decorations.push((task ? hide : bullet).range(node.from, task ? withSpace(node.to) : node.to));
          }
          return;
        }

        if (name === 'TaskMarker') {
          if (!revealed(node.from)) {
            const checked = /x/i.test(doc.sliceString(node.from, node.to));
            decorations.push(checkbox(checked).range(node.from, node.to));
          }
          return;
        }

        if (name === 'Link' || name === 'Image' || name === 'Autolink') {
          decorations.push(markClass('cm-md-link').range(node.from, node.to));
          if (!revealed(node.from)) {
            // Keep the link text; hide the brackets, URL and title
            const cursor = node.node.cursor();
            if (cursor.firstChild()) {
              do {
                if (cursor.name === 'LinkMark' || cursor.name === 'LinkTitle') hideRange(cursor.from, cursor.to);
                else if (cursor.name === 'URL' && name !== 'Autolink') hideRange(cursor.from, cursor.to);
              } while (cursor.nextSibling());
            }
            // The space between a URL and its title belongs to no node
            const url = node.node.getChild('URL');
            const title = node.node.getChild('LinkTitle');
            if (url && title && name !== 'Autolink') hideRange(url.to, title.from);
          }
          return false;
        }

        if (name === 'URL') {
          // A bare link in the text (GFM autolink)
          decorations.push(markClass('cm-md-link').range(node.from, node.to));
          return;
        }

        if (name === 'HorizontalRule') {
          decorations.push(lineClass('cm-md-hr').range(lineOf(node.from).from));
          if (!revealed(node.from)) hideRange(node.from, node.to);
          return;
        }

        if (name === 'Escape') {
          if (!revealed(node.from)) hideRange(node.from, node.from + 1);
          return;
        }
      },
    });
  }

  return Decoration.set(decorations, true);
}

function computeDecorations(view: EditorView): DecorationSet {
  const concealAll = view.state.field(concealAllField, false) ?? false;
  const reveal = view.hasFocus && !concealAll ? selectedLines(view.state) : new Set<number>();
  return buildDecorations(view.state, view.visibleRanges, reveal);
}

const previewPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = computeDecorations(view);
    }
    update(update: ViewUpdate) {
      if (
        update.docChanged ||
        update.viewportChanged ||
        update.selectionSet ||
        update.focusChanged ||
        syntaxTree(update.startState) !== syntaxTree(update.state) ||
        update.startState.field(concealAllField, false) !== update.state.field(concealAllField, false)
      ) {
        this.decorations = computeDecorations(update.view);
      }
    }
  },
  { decorations: (plugin) => plugin.decorations },
);

// Clicking a task's checkbox ticks or unticks it in the text
const toggleTaskOnClick = EditorView.domEventHandlers({
  mousedown(event, view) {
    const target = event.target as HTMLElement;
    if (!target.classList?.contains('cm-md-checkbox') || !view.state.facet(EditorView.editable)) return false;
    const pos = view.posAtDOM(target);
    const marker = view.state.doc.sliceString(pos, pos + 3);
    if (!/^\[[ xX]\]$/.test(marker)) return false;
    view.dispatch({
      changes: { from: pos + 1, to: pos + 2, insert: marker[1] === ' ' ? 'x' : ' ' },
      userEvent: 'input.task',
    });
    event.preventDefault();
    return true;
  },
});

export function livePreview() {
  return [concealAllField, focusedField, trackFocus, previewPlugin, toggleTaskOnClick];
}
