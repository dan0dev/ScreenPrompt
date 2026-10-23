// MIT License - Copyright (c) 2026 ScreenPrompt Contributors

// What the shortcut cheat sheet shows. The keys themselves are registered in
// useGlobalHotkeys, TextEditor and App; shortcuts.test.ts checks this list
// against those, so a changed key can't leave the sheet out of date.

export interface Shortcut {
  // One or more key combos, e.g. ['Ctrl+Shift+,', 'Ctrl+Shift+.'] for a pair
  keys: string[];
  action: string;
}

export interface ShortcutGroup {
  title: string;
  note?: string;
  items: Shortcut[];
}

/** Position preset modifier: Ctrl+Alt is AltGr on Hungarian keyboards, so they use Ctrl+Shift */
export function positionModifier(layout: string): string {
  return layout === 'hu' ? 'Ctrl+Shift' : 'Ctrl+Alt';
}

// Defined behind import.meta.env.DEV, so release builds leave it out entirely
const DEV_GROUP: ShortcutGroup | null = import.meta.env.DEV
  ? {
    title: 'Development build',
    note: 'Only in npm run tauri dev, never in the installed app',
    items: [{ keys: ['Ctrl+Shift+F12'], action: 'Show / hide in screenshots and screen shares' }],
  }
  : null;

export function shortcutGroups(layout: string, dev: boolean = import.meta.env.DEV): ShortcutGroup[] {
  const pos = positionModifier(layout);
  const devGroup = dev && DEV_GROUP ? [DEV_GROUP] : [];
  return [
    {
      title: 'Anywhere',
      note: 'Work even while the overlay is locked or another app has focus',
      items: [
        { keys: ['Ctrl+Shift+H'], action: 'Show / hide' },
        { keys: ['Ctrl+Shift+L'], action: 'Lock (clicks go through)' },
        { keys: ['Esc'], action: 'Unlock (while locked)' },
        { keys: ['Ctrl+Shift+E'], action: 'Quick edit (unlocks until you click away)' },
        { keys: ['Ctrl+Shift+Space'], action: 'Start / pause / resume auto-scroll' },
        { keys: ['Ctrl+Shift+,', 'Ctrl+Shift+.'], action: 'Slower / faster (while auto-scrolling)' },
        { keys: ['Ctrl+Shift+O'], action: 'Cycle opacity' },
        { keys: [`${pos}+1–9`], action: 'Move to a screen spot, laid out like a numpad (7 top left, 3 bottom right)' },
        { keys: ['Ctrl+Shift+Q'], action: 'Quit' },
        { keys: ['Ctrl+Shift+F1'], action: 'Panic close' },
      ],
    },
    {
      title: 'While ScreenPrompt is focused',
      note: 'Click the overlay first, so these keys stay with your other apps',
      items: [
        { keys: ['F1'], action: 'This list' },
        { keys: ['Ctrl+Shift+S'], action: 'Settings' },
        { keys: ['Ctrl+Shift+PageUp', 'Ctrl+Shift+PageDown'], action: 'Font size up / down' },
        { keys: ['Ctrl+Shift+Home'], action: 'Reset font size' },
        { keys: ['Ctrl+Shift+C'], action: 'Copy all notes' },
        { keys: ['Ctrl+Shift+V'], action: 'Replace notes with the clipboard' },
        { keys: ['Ctrl+Shift+Delete'], action: 'Clear all notes' },
        { keys: ['Ctrl+Shift+Arrows'], action: 'Nudge the window' },
        { keys: ['Ctrl+Shift+R'], action: 'Reset size and position' },
      ],
    },
    {
      title: 'While typing',
      items: [
        { keys: ['Ctrl+B'], action: 'Bold' },
        { keys: ['Ctrl+I'], action: 'Italic' },
        { keys: ['Ctrl+Z'], action: 'Undo (also undoes Clear / Replace for a few seconds)' },
      ],
    },
    {
      title: 'Mouse',
      items: [
        { keys: ['Ctrl+Click'], action: 'On a link: open it in your browser' },
        { keys: ['Ctrl+Click'], action: 'On the lock icon: unlock (while locked)' },
        { keys: ['Click'], action: 'On a task checkbox: tick or untick it' },
        { keys: ['Ctrl+Wheel'], action: 'Scroll your notes while locked' },
      ],
    },
    ...devGroup,
  ];
}
