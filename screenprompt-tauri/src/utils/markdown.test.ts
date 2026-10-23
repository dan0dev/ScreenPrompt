// @vitest-environment jsdom
// MIT License - Copyright (c) 2026 ScreenPrompt Contributors

import { describe, expect, it } from 'vitest';
import { renderMarkdown, sourceOffsetFor } from './markdown';

function blocks(html: string) {
  const root = document.createElement('div');
  root.innerHTML = html;
  return [...root.querySelectorAll<HTMLElement>('[data-src]')];
}

describe('renderMarkdown', () => {
  it('formats the basics', () => {
    const html = renderMarkdown('# Title\n\n**bold** *it* ~~gone~~ `code`\n\n- a\n- b');
    expect(html).toContain('<h1>Title</h1>');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em>it</em>');
    expect(html).toContain('<del>gone</del>');
    expect(html).toContain('<code>code</code>');
    expect(html).toContain('<li>a</li>');
  });

  it('keeps single line breaks, like the plain editor', () => {
    expect(renderMarkdown('line one\nline two')).toContain('line one<br>line two');
  });

  it('shows prompt-style tags as text instead of swallowing them', () => {
    const html = renderMarkdown('<context>\nUse **this**\n</context>');
    expect(html).toContain('&lt;context&gt;');
    expect(html).toContain('<strong>this</strong>');
  });

  it('never lets markup run script', () => {
    const html = renderMarkdown(
      '<img src=x onerror="alert(1)"> <script>alert(2)</script>\n\n[click](javascript:alert(3))',
    );
    const root = document.createElement('div');
    root.innerHTML = html;
    expect(root.querySelector('img, script')).toBeNull();
    expect(root.querySelector('[onerror]')).toBeNull();
    expect(root.querySelector('a')?.getAttribute('href') ?? '').not.toMatch(/javascript/i);
  });

  it('turns images into links instead of loading them', () => {
    const html = renderMarkdown('![diagram](https://example.com/d.png)');
    expect(html).not.toContain('<img');
    expect(html).toContain('href="https://example.com/d.png"');
    expect(html).toContain('diagram');
  });

  it('tags each block with where it starts in the source', () => {
    const text = '# Title\n\nFirst para\n\n- a\n- b';
    const starts = blocks(renderMarkdown(text)).map((b) => Number(b.dataset.src));
    expect(starts).toEqual([0, text.indexOf('First'), text.indexOf('- a')]);
  });
});

describe('sourceOffsetFor', () => {
  it('maps a click past formatting markers back into the source', () => {
    const source = 'Some **bold** words';
    expect(sourceOffsetFor(source, 'Some bo')).toBe(source.indexOf('ld'));
  });

  it('skips list markers and markup whitespace', () => {
    const source = '- one\n- two';
    expect(sourceOffsetFor(source, '\none\ntw')).toBe(source.indexOf('o', 7));
  });

  it('maps entities to their source characters', () => {
    const source = 'a &amp; b';
    expect(sourceOffsetFor(source, 'a & ')).toBe(source.indexOf('b'));
  });

  it('falls back to the end when the text cannot be matched', () => {
    expect(sourceOffsetFor('abc', 'xyz')).toBe(3);
  });
});
