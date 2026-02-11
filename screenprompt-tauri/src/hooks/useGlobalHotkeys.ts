// MIT License - Copyright (c) 2026 ScreenPrompt Contributors

import { useEffect, useRef } from 'react';
import { register, unregisterAll } from '@tauri-apps/plugin-global-shortcut';

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
}

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

// Position preset key bindings per layout.
// Hungarian: Ctrl+Alt = AltGr on HU keyboards, so use Ctrl+Shift+1-9.
// English: Ctrl+Alt+1-9 (no AltGr conflict).
function positionPresetKeys(layout: string): string[] {
  if (layout === 'hu') {
    return Array.from({ length: 9 }, (_, i) => `CmdOrCtrl+Shift+${i + 1}`);
  }
  return Array.from({ length: 9 }, (_, i) => `CmdOrCtrl+Alt+${i + 1}`);
}

export function useGlobalHotkeys(handlers: HotkeyHandlers, layout: string) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    let mounted = true;
    const h = () => handlersRef.current;

    const registerAll = async () => {
      // Window controls
      await tryRegister('CmdOrCtrl+Shift+H', () => { if (mounted) h().toggleVisibility(); });
      await tryRegister('CmdOrCtrl+Shift+L', () => { if (mounted) h().toggleLock(); });
      await tryRegister('CmdOrCtrl+Shift+E', () => { if (mounted) h().quickEdit(); });

      // Emergency unlock via bare Escape is handled by a low-level keyboard hook in Rust

      // Font size
      await tryRegister('CmdOrCtrl+Shift+PageUp', () => { if (mounted) h().increaseFontSize(); });
      await tryRegister('CmdOrCtrl+Shift+PageDown', () => { if (mounted) h().decreaseFontSize(); });
      await tryRegister('CmdOrCtrl+Shift+Home', () => { if (mounted) h().resetFontSize(); });

      // Opacity
      await tryRegister('CmdOrCtrl+Shift+O', () => { if (mounted) h().cycleOpacity(); });

      // Position presets (3x3 grid)
      const presetKeys = positionPresetKeys(layout);
      for (let i = 0; i < 9; i++) {
        const index = i + 1;
        await tryRegister(presetKeys[i], () => { if (mounted) h().positionPreset(index); });
      }

      // Nudge window
      await tryRegister('CmdOrCtrl+Shift+ArrowUp', () => { if (mounted) h().nudge('up'); });
      await tryRegister('CmdOrCtrl+Shift+ArrowDown', () => { if (mounted) h().nudge('down'); });
      await tryRegister('CmdOrCtrl+Shift+ArrowLeft', () => { if (mounted) h().nudge('left'); });
      await tryRegister('CmdOrCtrl+Shift+ArrowRight', () => { if (mounted) h().nudge('right'); });

      // App controls
      await tryRegister('CmdOrCtrl+Shift+S', () => { if (mounted) h().toggleSettings(); });
      await tryRegister('CmdOrCtrl+Shift+R', () => { if (mounted) h().resetGeometry(); });
      await tryRegister('CmdOrCtrl+Shift+Q', () => { if (mounted) h().quit(); });
      await tryRegister('CmdOrCtrl+Shift+F1', () => { if (mounted) h().panic(); });

      // Text operations
      await tryRegister('CmdOrCtrl+Shift+C', () => { if (mounted) h().copyAll(); });
      await tryRegister('CmdOrCtrl+Shift+V', () => { if (mounted) h().pasteReplace(); });
      await tryRegister('CmdOrCtrl+Shift+Delete', () => { if (mounted) h().clearText(); });
    };

    registerAll();

    return () => {
      mounted = false;
      unregisterAll().catch((e) =>
        console.error('Failed to unregister hotkeys:', e),
      );
    };
  }, [layout]);
}
