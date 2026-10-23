// MIT License - Copyright (c) 2026 ScreenPrompt Contributors

import { useEffect, useRef } from 'react';
import { register, unregister, unregisterAll } from '@tauri-apps/plugin-global-shortcut';

export interface HotkeyHandlers {
  toggleVisibility: () => void;
  toggleLock: () => void;
  quickEdit: () => void;
  emergencyUnlock: () => void;
  increaseFontSize: () => void;
  decreaseFontSize: () => void;
  resetFontSize: () => void;
  cycleOpacity: () => void;
  positionPreset: (index: number) => void;
  nudge: (direction: 'up' | 'down' | 'left' | 'right') => void;
  toggleSettings: () => void;
  resetGeometry: () => void;
  quit: () => void;
  panic: () => void;
  copyAll: () => void;
  pasteReplace: () => void;
  clearText: () => void;
  toggleAutoScroll: () => void;
  scrollSlower: () => void;
  scrollFaster: () => void;
  toggleShortcuts: () => void;
  // Development builds only: show / hide the window in screen capture
  toggleCaptureVisible?: () => void;
}

// Auto-scroll speed keys (< and >, like video players). Registered only while
// auto-scroll runs, so the rest of the time they stay with other apps (Word uses
// them for font size).
const SCROLL_SPEED_KEYS = ['CmdOrCtrl+Shift+Comma', 'CmdOrCtrl+Shift+Period'] as const;

// Global shortcuts are kept to what must work while the overlay is locked or
// unfocused; everything else is overlay-only (see the keydown handler below).

// Wrapper that isolates each registration so one failure doesn't block the rest.
// Tauri 2 fires handlers on both Pressed and Released — we only act on Pressed.
async function tryRegister(shortcut: string, handler: () => void): Promise<boolean> {
  try {
    await register(shortcut, (event) => {
      if (event.state === 'Pressed') {
        handler();
      }
    });
    return true;
  } catch (error) {
    console.warn(`Failed to register hotkey "${shortcut}":`, error);
    return false;
  }
}

// Registration passes run one at a time. When the layout resolves (e.g. to 'hu')
// the effect re-runs while the first pass is still registering; overlapping passes
// left some keys bound to the dead first pass, so they silently did nothing.
let registrationQueue: Promise<unknown> = Promise.resolve();
function enqueue(task: () => Promise<unknown>) {
  registrationQueue = registrationQueue.then(task, task);
}

// Position preset key bindings per layout.
// Hungarian: Ctrl+Alt = AltGr on HU keyboards, so use Ctrl+Shift+1-9.
// English: Ctrl+Alt+1-9 (no AltGr conflict).
function positionPresetKeys(layout: string): string[] {
  if (layout === 'hu') {
    return Array.from({ length: 9 }, (_, i) => `CmdOrCtrl+Shift+${i + 1}`);
  }
  return Array.from({ length: 9 }, (_, i) => `CmdOrCtrl+Alt+${i + 1}`);
}

export function useGlobalHotkeys(handlers: HotkeyHandlers, layout: string, autoScrolling: boolean) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    let mounted = true;
    const h = () => handlersRef.current;

    const registerAll = async () => {
      if (!mounted) return; // Superseded before its turn came

      // Window controls
      await tryRegister('CmdOrCtrl+Shift+H', () => { if (mounted) h().toggleVisibility(); });
      await tryRegister('CmdOrCtrl+Shift+L', () => { if (mounted) h().toggleLock(); });
      await tryRegister('CmdOrCtrl+Shift+E', () => { if (mounted) h().quickEdit(); });

      // Emergency unlock via bare Escape is handled by a low-level keyboard hook in Rust

      // Opacity
      await tryRegister('CmdOrCtrl+Shift+O', () => { if (mounted) h().cycleOpacity(); });

      // Auto-scroll: start, pause, resume
      await tryRegister('CmdOrCtrl+Shift+Space', () => { if (mounted) h().toggleAutoScroll(); });

      // Position presets (3x3 grid)
      const presetKeys = positionPresetKeys(layout);
      for (let i = 0; i < 9; i++) {
        const index = i + 1;
        await tryRegister(presetKeys[i], () => { if (mounted) h().positionPreset(index); });
      }

      // App controls
      await tryRegister('CmdOrCtrl+Shift+Q', () => { if (mounted) h().quit(); });
      await tryRegister('CmdOrCtrl+Shift+F1', () => { if (mounted) h().panic(); });

      // Development builds only: screenshots of the app itself (release builds
      // don't register it, and the Rust command refuses there too)
      if (import.meta.env.DEV) {
        await tryRegister('CmdOrCtrl+Shift+F12', () => { if (mounted) h().toggleCaptureVisible?.(); });
      }
    };

    enqueue(registerAll);

    return () => {
      mounted = false;
      enqueue(() =>
        unregisterAll().catch((e) => console.error('Failed to unregister hotkeys:', e)),
      );
    };
  }, [layout]);

  // Speed keys while auto-scrolling. Also re-runs after a layout pass, whose
  // unregisterAll removes them; the queue keeps it after that pass.
  useEffect(() => {
    if (!autoScrolling) return;
    let mounted = true;
    const h = () => handlersRef.current;
    const [slower, faster] = SCROLL_SPEED_KEYS;
    enqueue(async () => {
      if (!mounted) return;
      await tryRegister(slower, () => { if (mounted) h().scrollSlower(); });
      await tryRegister(faster, () => { if (mounted) h().scrollFaster(); });
    });
    return () => {
      mounted = false;
      enqueue(() => Promise.all(SCROLL_SPEED_KEYS.map((key) => unregister(key).catch(() => {}))));
    };
  }, [autoScrolling, layout]);

  // Overlay-only shortcuts: these combos mean something in most other apps, so
  // they only act while the overlay has focus instead of being taken system-wide.
  // Handled in the capture phase and stopped there, so the editor never also acts
  // on them (CodeMirror binds some, e.g. Ctrl+Shift+Home selects to the top).
  useEffect(() => {
    const h = () => handlersRef.current;
    const actions: Record<string, () => void> = {
      PageUp: () => h().increaseFontSize(),
      PageDown: () => h().decreaseFontSize(),
      Home: () => h().resetFontSize(),
      ArrowUp: () => h().nudge('up'),
      ArrowDown: () => h().nudge('down'),
      ArrowLeft: () => h().nudge('left'),
      ArrowRight: () => h().nudge('right'),
      KeyS: () => h().toggleSettings(),
      KeyR: () => h().resetGeometry(),
      KeyC: () => h().copyAll(),
      KeyV: () => h().pasteReplace(),
      Delete: () => h().clearText(),
    };

    const onKeyDown = (e: KeyboardEvent) => {
      // F1 on its own: the shortcut list (the usual help key)
      if (e.code === 'F1' && !e.ctrlKey && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        e.stopPropagation();
        h().toggleShortcuts();
        return;
      }
      if (!e.ctrlKey || !e.shiftKey || e.altKey) return;
      const action = actions[e.code];
      if (!action) return;
      e.preventDefault();
      e.stopPropagation();
      action();
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, []);
}
