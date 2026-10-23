// MIT License - Copyright (c) 2026 ScreenPrompt Contributors

import { Language, LanguageSupport, defineLanguageFacet } from '@codemirror/language';
import { GFM, parser } from '@lezer/markdown';

// Markdown with GitHub extensions (strikethrough, tables, task lists, bare links),
// built straight from the Lezer parser. @codemirror/lang-markdown would also pull in
// HTML, CSS and JavaScript support (for code blocks), which notes don't need.
export const markdownParser = parser.configure(GFM);
const markdownLanguage = new Language(defineLanguageFacet(), markdownParser, [], 'markdown');

export function markdown(): LanguageSupport {
  return new LanguageSupport(markdownLanguage);
}
