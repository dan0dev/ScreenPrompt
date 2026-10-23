// MIT License - Copyright (c) 2026 ScreenPrompt Contributors

import { Marked, type TokensList } from 'marked';
import DOMPurify from 'dompurify';

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const md = new Marked({
  gfm: true,
  breaks: true, // a single Enter starts a new line, as in the plain editor
  tokenizer: {
    // No raw HTML: prompts often contain tags like <context>, which should show as
    // typed rather than vanish. Returning undefined (not false) skips the token,
    // so the text falls through to a paragraph and gets escaped.
    html: () => undefined,
    tag: () => undefined,
  },
  renderer: {
    // Show images as links: loading them would fetch remote URLs from the overlay
    image({ href, text }) {
      return `<a href="${escapeHtml(href)}">${escapeHtml(text || href)}</a>`;
    },
  },
});

/**
 * Render notes to sanitized HTML. Each top-level block is wrapped in
 * <div data-src="offset">, its start in `source`, so a click on the rendered
 * text can put the caret at the same place in the editor.
 */
export function renderMarkdown(source: string): string {
  const tokens = md.lexer(source);
  let html = '';
  let cursor = 0;

  for (const token of tokens) {
    const found = source.indexOf(token.raw, cursor);
    const start = found === -1 ? cursor : found;
    cursor = start + token.raw.length;
    if (token.type === 'space') continue;

    const block = Object.assign([token], { links: tokens.links }) as TokensList;
    html += `<div data-src="${start}">${md.parser(block)}</div>`;
  }

  // Markdown escapes what it renders, but notes are pasted from anywhere, and this
  // webview can call into the app, so sanitize regardless
  return DOMPurify.sanitize(html, { FORBID_TAGS: ['img', 'style'], FORBID_ATTR: ['style'] });
}

const ENTITY = /^&(?:#\d+|#x[0-9a-f]+|[a-z][a-z0-9]*);/i;

/**
 * Map a point in a rendered block back to its source: `renderedBefore` is the
 * block's visible text up to that point. Rendered text is (nearly) the source
 * minus its markers, so walk the source matching each visible character in order.
 * Falls back to the end of the block if the text can't be matched.
 */
export function sourceOffsetFor(source: string, renderedBefore: string): number {
  let j = 0;
  for (const ch of renderedBefore) {
    if (/\s/.test(ch)) {
      // Markup adds whitespace of its own (between list items, say), so only
      // consume whitespace the source actually has here
      if (j < source.length && /\s/.test(source[j])) j++;
      continue;
    }
    const at = source.indexOf(ch, j);
    if (at === -1) return source.length;
    // "&amp;" renders as "&": skip the rest of the entity
    const entity = ch === '&' ? source.slice(at).match(ENTITY) : null;
    j = at + (entity ? entity[0].length : 1);
  }
  return j;
}
