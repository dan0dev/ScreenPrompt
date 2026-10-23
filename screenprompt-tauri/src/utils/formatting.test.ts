// MIT License - Copyright (c) 2026 ScreenPrompt Contributors

import { describe, expect, it } from 'vitest';
import { applyEditToString, toggleBlock, toggleInline, type BlockStyle, type InlineStyle } from './formatting';

// Text with the selection marked by [ and ] (or a lone | for a caret)
function parse(marked: string) {
  if (marked.includes('|')) {
    const pos = marked.indexOf('|');
    return { text: marked.replace('|', ''), start: pos, end: pos };
  }
  const start = marked.indexOf('[');
  const end = marked.indexOf(']') - 1;
  return { text: marked.replace('[', '').replace(']', ''), start, end };
}

function show(text: string, start: number, end: number) {
  return start === end
    ? text.slice(0, start) + '|' + text.slice(start)
    : text.slice(0, start) + '[' + text.slice(start, end) + ']' + text.slice(end);
}

function inline(input: string, style: InlineStyle) {
  const { text, start, end } = parse(input);
  const edit = toggleInline(text, start, end, style);
  return show(applyEditToString(text, edit), edit.selStart, edit.selEnd);
}

function block(input: string, style: BlockStyle) {
  const { text, start, end } = parse(input);
  const edit = toggleBlock(text, start, end, style);
  return show(applyEditToString(text, edit), edit.selStart, edit.selEnd);
}

describe('toggleInline', () => {
  it('wraps the selection and keeps it selected', () => {
    expect(inline('say [hello] now', 'bold')).toBe('say **[hello]** now');
    expect(inline('say [hello] now', 'italic')).toBe('say *[hello]* now');
    expect(inline('say [hello] now', 'strike')).toBe('say ~~[hello]~~ now');
    expect(inline('say [hello] now', 'code')).toBe('say `[hello]` now');
  });

  it('unwraps when the markers sit just outside the selection', () => {
    expect(inline('say **[hello]** now', 'bold')).toBe('say [hello] now');
    expect(inline('say ~~[hello]~~ now', 'strike')).toBe('say [hello] now');
  });

  it('unwraps when the selection includes the markers', () => {
    expect(inline('say [**hello**] now', 'bold')).toBe('say [hello] now');
  });

  it('tells bold and italic apart', () => {
    expect(inline('**[hello]**', 'italic')).toBe('***[hello]***');
    expect(inline('***[hello]***', 'italic')).toBe('**[hello]**');
    expect(inline('***[hello]***', 'bold')).toBe('*[hello]*');
    expect(inline('*[hello]*', 'bold')).toBe('***[hello]***');
  });

  it('keeps surrounding spaces outside the markers', () => {
    expect(inline('say[ hello ]now', 'bold')).toBe('say **[hello]** now');
  });

  it('styles the word under the caret', () => {
    expect(inline('say hel|lo now', 'bold')).toBe('say **hel|lo** now');
    expect(inline('say **hel|lo** now', 'bold')).toBe('say hel|lo now');
  });

  it('inserts an empty pair at a caret outside a word, and removes it again', () => {
    expect(inline('say |', 'bold')).toBe('say **|**');
    expect(inline('say **|**', 'bold')).toBe('say |');
  });

  it('styles each line of a multi-line selection', () => {
    expect(inline('[one\n\ntwo]', 'bold')).toBe('[**one**\n\n**two**]');
    expect(inline('[**one**\n\n**two**]', 'bold')).toBe('[one\n\ntwo]');
  });
});

describe('toggleBlock', () => {
  it('adds and removes bullets on every selected line', () => {
    expect(block('[one\ntwo]', 'bullet')).toBe('[- one\n- two]');
    expect(block('[- one\n- two]', 'bullet')).toBe('[one\ntwo]');
  });

  it('numbers lines in order and skips blank ones', () => {
    expect(block('[one\n\ntwo]', 'numbered')).toBe('[1. one\n\n2. two]');
  });

  it('switches one list type to another', () => {
    expect(block('[- one\n- two]', 'numbered')).toBe('[1. one\n2. two]');
  });

  it('cycles headings one, two, three, then off', () => {
    expect(block('Ti|tle', 'heading')).toBe('# Ti|tle');
    expect(block('# Ti|tle', 'heading')).toBe('## Ti|tle');
    expect(block('## Ti|tle', 'heading')).toBe('### Ti|tle');
    expect(block('### Ti|tle', 'heading')).toBe('Ti|tle');
  });

  it('works on the line the caret is in', () => {
    expect(block('one\ntw|o\nthree', 'quote')).toBe('one\n> tw|o\nthree');
    expect(block('one\n> tw|o\nthree', 'quote')).toBe('one\ntw|o\nthree');
  });

  it('ignores a line the selection only touches at its very start', () => {
    expect(block('[one\n]two', 'bullet')).toBe('[- one]\ntwo');
  });
});
