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

// Every visible character of every block must be found, in order, in that block's
// source: otherwise a click there would put the caret in the wrong place
function unmatchedChars(source: string) {
  const misses: string[] = [];
  const all = blocks(renderMarkdown(source));
  all.forEach((block, i) => {
    const start = Number(block.dataset.src);
    const end = i + 1 < all.length ? Number(all[i + 1].dataset.src) : source.length;
    const slice = source.slice(start, end);
    let j = 0;
    for (const ch of block.textContent ?? '') {
      if (/\s/.test(ch)) continue;
      const at = slice.indexOf(ch, j);
      if (at === -1) {
        misses.push(`${ch} in block ${i}: ${JSON.stringify(slice.slice(0, 30))}`);
        break;
      }
      j = at + 1;
    }
  });
  return misses;
}

const RICH = [
  '# Title',
  '',
  'Intro with **bold**, *italic*, ~~gone~~, `code` and a [link](https://example.com).',
  'Second line\tafter a tab.',
  '   ',
  '## Points',
  '- one',
  '  - nested',
  '- [ ] task',
  '- [x] done',
  '',
  '1. first',
  '2. second',
  '',
  '> quoted',
  '> > nested quote',
  '',
  '```',
  '<b>not html</b>',
  '```',
  '',
  '    indented code',
  '',
  '| a | b |',
  '|---|---|',
  '| 1 | 2 |',
  '',
  'Ref [link][r] and <https://auto.link>.',
  '',
  '[r]: https://example.com/ref',
  '',
  '***',
  'Last',
].join('\n');

describe('renderMarkdown, harder input', () => {
  it('renders nothing for empty or blank notes', () => {
    expect(renderMarkdown('')).toBe('');
    expect(renderMarkdown('  \n\n \t\n')).toBe('');
  });

  it('maps every block of a rich document back to its source', () => {
    expect(blocks(renderMarkdown(RICH)).length).toBeGreaterThan(10);
    expect(unmatchedChars(RICH)).toEqual([]);
  });

  it('keeps block offsets increasing and inside the notes', () => {
    const all = blocks(renderMarkdown(RICH));
    const starts = all.map((b) => Number(b.dataset.src));
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
    expect(Math.max(...starts)).toBeLessThan(RICH.length);
    // Each block starts at its own text, not at the blank lines before it
    // (a code block starts at its fence, or at its indentation)
    all.forEach((b, i) => {
      if (b.querySelector('pre')) expect(RICH.slice(starts[i])).toMatch(/^(```| {4})/);
      else expect(RICH[starts[i]]).not.toMatch(/\s/);
    });
  });

  it('renders tables, task lists, nested lists and rules', () => {
    const root = document.createElement('div');
    root.innerHTML = renderMarkdown(RICH);
    expect(root.querySelector('table td')?.textContent).toBe('1');
    expect(root.querySelectorAll('input[type="checkbox"]')).toHaveLength(2);
    root.querySelectorAll('input').forEach((i) => expect(i.disabled).toBe(true));
    expect(root.querySelector('ul ul li')?.textContent).toBe('nested');
    expect(root.querySelector('blockquote blockquote')).not.toBeNull();
    expect(root.querySelector('hr')).not.toBeNull();
    expect(root.querySelector('a[href="https://example.com/ref"]')?.textContent).toBe('link');
    expect(root.querySelector('a[href="https://auto.link"]')).not.toBeNull();
  });

  it('shows HTML inside code blocks as text', () => {
    const root = document.createElement('div');
    root.innerHTML = renderMarkdown(RICH);
    expect(root.querySelector('pre code')?.textContent).toContain('<b>not html</b>');
    expect(root.querySelector('pre b')).toBeNull();
  });

  it('copes with Windows line endings', () => {
    const html = renderMarkdown('# A\r\n\r\nline one\r\nline two');
    expect(html).toContain('<h1>A</h1>');
    expect(html).toContain('line one<br>line two');
  });

  // A generous budget: this guards against an algorithmic blow-up, not exact speed
  // (which depends on the machine and what else it's doing); the browser tests time it
  it('renders long notes without blowing up', () => {
    const big = Array.from({ length: 2000 }, (_, i) => `## Part ${i}\n\nSome **bold** text and a list:\n- a\n- b`).join('\n\n');
    const t = performance.now();
    renderMarkdown(big);
    expect(performance.now() - t).toBeLessThan(3000);
  });
});

describe('renderMarkdown never produces live script', () => {
  const PAYLOADS = [
    '<script>alert(1)</script>',
    '<img src=x onerror=alert(1)>',
    '<svg onload=alert(1)>',
    '<iframe src="javascript:alert(1)"></iframe>',
    '<a href="javascript:alert(1)">x</a>',
    '[x](javascript:alert(1))',
    '[x](JaVaScRiPt:alert(1))',
    '[x](  javascript:alert(1))',
    '[x](&#106;avascript:alert(1))',
    '[x](vbscript:msgbox(1))',
    '[x](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)',
    '![x](javascript:alert(1))',
    '<javascript:alert(1)>',
    '[x](https://ok.com "a\\" onmouseover=\\"alert(1)")',
    '<style>body{display:none}</style>',
    '<div style="position:fixed;inset:0">cover</div>',
    '`<script>` and **<img src=x onerror=alert(1)>**',
  ];

  it.each(PAYLOADS)('%s', (payload) => {
    const root = document.createElement('div');
    root.innerHTML = renderMarkdown(payload);
    expect(root.querySelector('script, iframe, svg, img, style, object, embed, form')).toBeNull();
    for (const el of root.querySelectorAll('*')) {
      for (const attr of el.attributes) {
        expect(attr.name).not.toMatch(/^on|^style$/i);
        if (attr.name === 'href') expect(attr.value.trim()).toMatch(/^(https?:|mailto:|#|[^:]*$)/i);
      }
    }
  });
});

describe('sourceOffsetFor, more cases', () => {
  it('skips heading markers', () => {
    expect(sourceOffsetFor('# Title', 'Ti')).toBe(4);
  });

  it('skips escape backslashes', () => {
    expect(sourceOffsetFor('\\*x', '*')).toBe(2);
  });

  it('lands after link syntax correctly', () => {
    const source = 'see [the docs](https://x.y) now';
    expect(sourceOffsetFor(source, 'see the docs no')).toBe(source.indexOf('w'));
  });

  it('handles an empty rendered prefix', () => {
    expect(sourceOffsetFor('# Title', '')).toBe(0);
  });
});
