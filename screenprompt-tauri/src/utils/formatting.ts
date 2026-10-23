// MIT License - Copyright (c) 2026 ScreenPrompt Contributors

// Markdown formatting commands for the editor (bold, lists, ...). Each returns an
// Edit instead of touching the textarea, so the editor can apply it as one undoable
// step, and the logic stays testable without a DOM.

/** Replace text[start..end) with `insert`, then select selStart..selEnd */
export interface Edit {
  start: number;
  end: number;
  insert: string;
  selStart: number;
  selEnd: number;
}

export type InlineStyle = 'bold' | 'italic' | 'strike' | 'code';
export type BlockStyle = 'heading' | 'bullet' | 'numbered' | 'quote';

const INLINE_MARKERS: Record<InlineStyle, string> = {
  bold: '**',
  italic: '*',
  strike: '~~',
  code: '`',
};

// Leading structure of a line: indentation, quote markers, then one block marker
const LINE_STRUCTURE = /^(?:[ \t]*>[ \t]?)*[ \t]*(?:#{1,6}[ \t]+|[-*+][ \t]+|\d+[.)][ \t]+)?/;
const QUOTE_PART = /^(?:[ \t]*>[ \t]?)*[ \t]*/;
const BLOCK_MARKER = /^(?:#{1,6}[ \t]+|[-*+][ \t]+|\d+[.)][ \t]+)/;
const HEADING = /^(#{1,6})[ \t]+/;
const BULLET = /^[-*+][ \t]+/;
const NUMBER = /^\d+[.)][ \t]+/;
const QUOTE = /^[ \t]*>[ \t]?/;
const MAX_HEADING_LEVEL = 3;

const isWordChar = (ch: string | undefined) => ch !== undefined && /[\p{L}\p{N}_'’-]/u.test(ch);
const isSpace = (ch: string | undefined) => ch !== undefined && /\s/.test(ch);
// Start of the line holding pos. (text.lastIndexOf('\n', pos - 1) would still check
// index 0 at pos 0, mistaking a leading empty line for the line before.)
const lineStartOf = (text: string, pos: number) => text.slice(0, pos).lastIndexOf('\n') + 1;

export function applyEditToString(text: string, edit: Edit): string {
  return text.slice(0, edit.start) + edit.insert + text.slice(edit.end);
}

function runAtStart(s: string, ch: string): number {
  let n = 0;
  while (n < s.length && s[n] === ch) n++;
  return n;
}

function runAtEnd(s: string, ch: string): number {
  let n = 0;
  while (n < s.length && s[s.length - 1 - n] === ch) n++;
  return n;
}

// Whether n marker characters on each side already apply the style. Bold and
// italic share '*': *x* is italic, **x** bold, ***x*** both.
function hasStyle(style: InlineStyle, n: number): boolean {
  switch (style) {
    case 'bold':
    case 'strike':
      return n >= 2;
    case 'italic':
      return n % 2 === 1;
    case 'code':
      return n >= 1;
  }
}

function isStyled(s: string, style: InlineStyle): boolean {
  const marker = INLINE_MARKERS[style];
  const n = Math.min(runAtStart(s, marker[0]), runAtEnd(s, marker[0]));
  return s.length > marker.length * 2 && hasStyle(style, n);
}

/** Toggle bold/italic/strikethrough/code on the selection, or the word at the caret */
export function toggleInline(text: string, selStart: number, selEnd: number, style: InlineStyle): Edit {
  if (text.slice(selStart, selEnd).includes('\n')) {
    return toggleInlineLines(text, selStart, selEnd, style);
  }

  const marker = INLINE_MARKERS[style];
  const k = marker.length;
  const caret = selStart === selEnd ? selStart : null;
  let start = selStart;
  let end = selEnd;

  if (caret !== null) {
    // Caret inside a word: style the whole word
    if (isWordChar(text[caret - 1]) && isWordChar(text[caret])) {
      while (isWordChar(text[start - 1])) start--;
      while (isWordChar(text[end])) end++;
    }
  } else {
    // Markers can't hug spaces (** word ** isn't bold), and a selection that starts
    // at the line's list or heading marker shouldn't swallow it
    while (start < end && isSpace(text[start])) start++;
    while (end > start && isSpace(text[end - 1])) end--;
    const lineStart = lineStartOf(text, start);
    if (/^[ \t]*$/.test(text.slice(lineStart, start))) {
      const marked = text.slice(start, end).match(BLOCK_MARKER);
      if (marked && marked[0].length < end - start) start += marked[0].length;
    }
  }

  const inner = text.slice(start, end);
  // A caret stays a caret on the same character; a selection covers the text
  const select = (from: number, to: number, shift: number): [number, number] =>
    caret !== null ? [caret + shift, caret + shift] : [from, to];

  // Markers just outside the selection: remove them
  const outside = Math.min(runAtEnd(text.slice(0, start), marker[0]), runAtStart(text.slice(end), marker[0]));
  if (hasStyle(style, outside)) {
    const [s, e] = select(start - k, end - k, -k);
    return { start: start - k, end: end + k, insert: inner, selStart: s, selEnd: e };
  }

  // Markers inside the selection: remove them
  if (caret === null && isStyled(inner, style)) {
    const unwrapped = inner.slice(k, -k);
    return { start, end, insert: unwrapped, selStart: start, selEnd: start + unwrapped.length };
  }

  const [s, e] = select(start + k, end + k, k);
  return { start, end, insert: marker + inner + marker, selStart: s, selEnd: e };
}

// Markers can't span lines, so a multi-line selection styles each line on its own
function toggleInlineLines(text: string, start: number, end: number, style: InlineStyle): Edit {
  const marker = INLINE_MARKERS[style];
  const k = marker.length;
  const lines = text.slice(start, end).split('\n');
  const content = (line: string) => {
    const lead = line.match(LINE_STRUCTURE)![0];
    const body = line.slice(lead.length);
    const core = body.trimEnd();
    return { lead, core, trail: body.slice(core.length) };
  };

  const filled = lines.map(content).filter((p) => p.core !== '');
  const allStyled = filled.length > 0 && filled.every((p) => isStyled(p.core, style));

  const insert = lines
    .map((line) => {
      const { lead, core, trail } = content(line);
      if (core === '') return line;
      if (allStyled) return lead + core.slice(k, -k) + trail;
      return isStyled(core, style) ? line : lead + marker + core + marker + trail;
    })
    .join('\n');

  return { start, end, insert, selStart: start, selEnd: start + insert.length };
}

/** Toggle a heading, list or quote on every line the selection touches */
export function toggleBlock(text: string, selStart: number, selEnd: number, style: BlockStyle): Edit {
  // A selection ending at the very start of a line doesn't include that line
  const effectiveEnd = selEnd > selStart && text[selEnd - 1] === '\n' ? selEnd - 1 : selEnd;
  const start = lineStartOf(text, selStart);
  const lineEnd = text.indexOf('\n', effectiveEnd);
  const end = lineEnd === -1 ? text.length : lineEnd;

  const lines = text.slice(start, end).split('\n');
  // Blank lines stay as they are, unless the caret sits on one
  const active = (line: string) => line.trim() !== '' || lines.length === 1;
  const newLines = restyleLines(lines, active, style);
  const insert = newLines.join('\n');

  if (selStart === selEnd) {
    // Keep the caret on the same character of the line's text
    const oldLead = lines[0].match(LINE_STRUCTURE)![0].length;
    const newLead = newLines[0].match(LINE_STRUCTURE)![0].length;
    const caret = start + newLead + Math.max(0, selStart - start - oldLead);
    return { start, end, insert, selStart: caret, selEnd: caret };
  }
  return { start, end, insert, selStart: start, selEnd: start + insert.length };
}

function restyleLines(lines: string[], active: (line: string) => boolean, style: BlockStyle): string[] {
  const targets = lines.filter(active);

  if (style === 'quote') {
    const allQuoted = targets.every((line) => QUOTE.test(line));
    return lines.map((line) => {
      if (!active(line)) return line;
      if (allQuoted) return line.replace(/^([ \t]*)>[ \t]?/, '$1');
      return QUOTE.test(line) ? line : '> ' + line;
    });
  }

  // Lists and headings go after any quote markers, replacing an existing marker
  const split = (line: string) => {
    const lead = line.match(QUOTE_PART)![0];
    return { lead, body: line.slice(lead.length) };
  };
  const bare = (body: string) => body.replace(BLOCK_MARKER, '');

  if (style === 'heading') {
    // Each press steps the heading level: none, 1, 2, 3, then none again
    const first = targets.length ? split(targets[0]).body.match(HEADING) : null;
    const level = first ? first[1].length : 0;
    const next = level >= MAX_HEADING_LEVEL ? 0 : level + 1;
    return lines.map((line) => {
      if (!active(line)) return line;
      const { lead, body } = split(line);
      return lead + (next ? '#'.repeat(next) + ' ' : '') + bare(body);
    });
  }

  const pattern = style === 'bullet' ? BULLET : NUMBER;
  const allListed = targets.every((line) => pattern.test(split(line).body));
  let number = 0;
  return lines.map((line) => {
    if (!active(line)) return line;
    const { lead, body } = split(line);
    if (allListed) return lead + bare(body);
    number++;
    return lead + (style === 'bullet' ? '- ' : `${number}. `) + bare(body);
  });
}
