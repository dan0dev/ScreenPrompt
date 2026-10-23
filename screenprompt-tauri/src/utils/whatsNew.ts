// MIT License - Copyright (c) 2026 ScreenPrompt Contributors

import { invoke } from '@tauri-apps/api/core';

const REPO_URL = 'https://github.com/dan0dev/ScreenPrompt';
const FEATURE_REQUEST_URL = `${REPO_URL}/issues/new?template=feature_request.md`;

// "What's new", shown once after updating to a version listed here (App's restore
// step compares config.lastSeenVersion with the running version). Bundled with the
// app, so it works offline. Keep it to a few lines and one ask; items may contain
// <a href="https://…"> links. Versions without an entry show nothing, so add one
// here for every release that should announce itself (see CONTRIBUTING.md).
const RELEASE_NOTES: Record<string, string[]> = {
  '1.2.0': [
    'Auto-scroll: press Ctrl+Shift+Space (or ▶ in the bottom bar) and your notes scroll by '
      + 'themselves. Press it again to pause. Ctrl+Shift+, and Ctrl+Shift+. change the speed.',
    'Formatted notes: headings, bold, lists and more format as you type (Markdown), or use '
      + 'Ctrl+B, Ctrl+I and the T button. Ctrl+click opens a link. Thanks '
      + '<a href="https://github.com/gauravkhuraana">@gauravkhuraana</a> for the idea. '
      + 'Prefer plain text? Turn it off in Settings.',
    'Press F1 to see every keyboard shortcut.',
    'Cleared or replaced your notes by accident? Undo (or Ctrl+Z) brings them back.',
    'From the next update on, updates install in one click, and the download is a third smaller.',
  ],
  '1.1.3': [
    'Locked mode has a way out: press Esc or Ctrl+click the lock icon. Thanks '
      + '<a href="https://github.com/gauravkhuraana">@gauravkhuraana</a> for reporting it.',
    'While locked, clicks and scrolling go through to the app behind. Hold Ctrl and '
      + 'scroll over the overlay to move your notes.',
    'Copy, paste, clear and nudge shortcuts now only work while ScreenPrompt is focused, '
      + 'so they no longer override those keys in your other apps.',
    'Your notes, window position and lock state are remembered, and notes save as you type.',
  ],
};

export function hasReleaseNotes(version: string): boolean {
  return version in RELEASE_NOTES;
}

/** Show the native, capture-excluded "what's new" dialog; resolves once it's dismissed */
export async function showWhatsNew(version: string): Promise<void> {
  const items = RELEASE_NOTES[version];
  if (!items) return;

  const content = items.map((item) => `• ${item}`).join('\n\n')
    + `\n\nGot an idea? <a href="${FEATURE_REQUEST_URL}">Request a feature</a>`;

  await invoke('show_info_dialog', {
    title: "What's new in ScreenPrompt",
    heading: `What's new in v${version}`,
    content,
    footer: '',
    button: 'Got it',
  });
}
