// MIT License - Copyright (c) 2026 ScreenPrompt Contributors

import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  availableMonitors,
  currentMonitor,
  getCurrentWindow,
  LogicalSize,
  PhysicalPosition,
} from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';
import { getVersion } from '@tauri-apps/api/app';
import { message } from '@tauri-apps/plugin-dialog';
import { readText, writeText } from '@tauri-apps/plugin-clipboard-manager';
import { useConfig } from './hooks/useConfig';
import { useUpdater } from './hooks/useUpdater';
import { useGlobalHotkeys } from './hooks/useGlobalHotkeys';
import { OPACITY_LEVELS, DEFAULT_CONFIG } from './types';
import { hasReleaseNotes, showWhatsNew } from './utils/whatsNew';
import TitleBar from './components/TitleBar';
import TextEditor from './components/TextEditor';
import Settings from './components/Settings';
import BottomBar from './components/BottomBar';
import './styles/App.css';

const appWindow = getCurrentWindow();
const NUDGE_PX = 20;
const DEFAULT_FONT_SIZE = 18;
const TEXT_SAVE_DELAY_MS = 400;
const GEOMETRY_SAVE_DELAY_MS = 400;
const CLOSE_SAVE_TIMEOUT_MS = 500;
// Windows parks minimized windows here; never persist it as a real position
const MINIMIZED_COORD = -32000;

// True if the point lies on any connected monitor (a saved position can point at
// a monitor that has since been unplugged)
async function isOnAnyMonitor(x: number, y: number): Promise<boolean> {
  const monitors = await availableMonitors();
  return monitors.some(
    (m) =>
      x >= m.position.x &&
      x < m.position.x + m.size.width &&
      y >= m.position.y &&
      y < m.position.y + m.size.height,
  );
}

function App() {
  const { config, setConfig, loading } = useConfig();
  const [showSettings, setShowSettings] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [opacityIndex, setOpacityIndex] = useState(1); // default 0.85 is index 1
  const quickEditRef = useRef(false);
  const restoredRef = useRef(false);

  // Text being edited. null until the user types, so the saved text shows until then.
  const [draftText, setDraftText] = useState<string | null>(null);
  const draftRef = useRef<string | null>(null);
  const text = draftText ?? config.text;

  const [resolvedLayout, setResolvedLayout] = useState('en');
  const updater = useUpdater(config.autoCheckUpdates);

  // Sync opacity index from config on load
  useEffect(() => {
    const idx = OPACITY_LEVELS.indexOf(config.opacity);
    if (idx !== -1) setOpacityIndex(idx);
  }, [config.opacity]);

  // Show ethical notice on first run
  useEffect(() => {
    const showEthicalNotice = async () => {
      if (!config.firstRunShown) {
        try {
          const noticeText = await invoke<string>('show_ethical_notice');
          await message(noticeText, {
            title: 'ScreenPrompt - Important Notice',
            kind: 'warning',
          });
          await setConfig({ firstRunShown: true });
        } catch (error) {
          console.error('Failed to show ethical notice:', error);
        }
      }
    };

    if (!loading) {
      showEthicalNotice();
    }
  }, [config.firstRunShown, loading, setConfig]);

  // Resolve keyboard layout ('auto' -> detect from OS)
  useEffect(() => {
    const resolve = async () => {
      if (config.keyboardLayout === 'auto') {
        const detected = await invoke<string>('detect_keyboard_layout');
        setResolvedLayout(detected);
      } else {
        setResolvedLayout(config.keyboardLayout);
      }
    };
    if (!loading) resolve();
  }, [config.keyboardLayout, loading]);

  // Switch click-through mode and the hooks that go with it (scroll forwarding,
  // lock-button click, Esc). Does not persist; callers decide that.
  const applyLock = useCallback(async (locked: boolean) => {
    await invoke('set_click_through', { window: appWindow, enabled: locked });
    setIsLocked(locked);

    if (locked) {
      await invoke('install_scroll_hook', { window: appWindow }).catch((e: unknown) =>
        console.error('Scroll hook install failed:', e),
      );
      await invoke('install_keyboard_hook').catch((e: unknown) =>
        console.error('Keyboard hook install failed:', e),
      );
    } else {
      await invoke('uninstall_scroll_hook').catch((e: unknown) =>
        console.error('Scroll hook uninstall failed:', e),
      );
      await invoke('uninstall_keyboard_hook').catch((e: unknown) =>
        console.error('Keyboard hook uninstall failed:', e),
      );
    }
  }, []);

  // Toggle click-through mode
  const toggleLock = useCallback(async () => {
    try {
      const newLocked = !isLocked;
      await applyLock(newLocked);
      await setConfig({ locked: newLocked });
    } catch (error) {
      console.error('Failed to toggle lock:', error);
    }
  }, [isLocked, applyLock, setConfig]);

  // Emergency unlock - always unlocks. No isLocked guard: if React state and the
  // window ever disagree, bailing out here would leave the user with no way back.
  const emergencyUnlock = useCallback(async () => {
    try {
      await applyLock(false);
      await setConfig({ locked: false });
    } catch (error) {
      console.error('Emergency unlock failed:', error);
    }
  }, [applyLock, setConfig]);

  // Quick edit: unlock, focus, auto-relock on blur
  const quickEdit = useCallback(async () => {
    if (!isLocked) return;
    try {
      await applyLock(false);
      quickEditRef.current = true;
      await appWindow.setFocus();
    } catch (error) {
      console.error('Quick edit failed:', error);
    }
  }, [isLocked, applyLock]);

  // Listen for Escape key (from keyboard hook) to emergency unlock
  useEffect(() => {
    const unlisten = listen('emergency-unlock', () => {
      emergencyUnlock();
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [emergencyUnlock]);

  // Windows doesn't run our own keyboard hook for keys typed into the overlay
  // itself, so when the locked overlay has focus (e.g. right after locking it, or
  // a restored lock), Esc arrives here instead
  useEffect(() => {
    if (!isLocked) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') emergencyUnlock();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isLocked, emergencyUnlock]);

  // Listen for window blur to re-lock after quick edit
  useEffect(() => {
    const unlisten = appWindow.onFocusChanged(async ({ payload: focused }) => {
      if (!focused && quickEditRef.current) {
        quickEditRef.current = false;
        try {
          await applyLock(true);
          await setConfig({ locked: true });
        } catch (error) {
          console.error('Quick edit re-lock failed:', error);
        }
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [applyLock, setConfig]);

  // Restore saved size, position and lock state once, then show the window.
  // Position is stored in physical px (unambiguous across monitors), size in
  // logical px (keeps the same visual size at any display scaling).
  useEffect(() => {
    if (loading || restoredRef.current) return;
    restoredRef.current = true;

    const restore = async () => {
      try {
        await appWindow.setSize(new LogicalSize(config.width, config.height));
        // Probe a point inside the title bar, so a window hanging partly off-screen still counts
        if (await isOnAnyMonitor(config.x + 40, config.y + 10)) {
          await appWindow.setPosition(new PhysicalPosition(config.x, config.y));
        } else {
          await appWindow.center();
        }
      } catch (error) {
        console.error('Failed to restore window geometry:', error);
      }

      // "What's new" once per version after an update, before the overlay appears:
      // the overlay (and a saved lock) only comes up once it's dismissed. Fresh
      // installs get the first-run notice instead, so just record the version.
      try {
        const version = await getVersion();
        if (config.lastSeenVersion !== version) {
          if (config.firstRunShown && hasReleaseNotes(version)) {
            await showWhatsNew(version);
          }
          await setConfig({ lastSeenVersion: version });
        }
      } catch (error) {
        console.error("Failed to show what's new:", error);
      }

      await appWindow.show();

      if (config.locked) {
        await applyLock(true).catch((e: unknown) => console.error('Failed to restore lock:', e));
      }
    };

    restore();
  }, [loading, config, applyLock, setConfig]);

  // Persist position and size after the user (or a preset/nudge) moves or resizes
  useEffect(() => {
    let timer: number | undefined;

    const scheduleSave = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(async () => {
        try {
          const [pos, size, scale] = await Promise.all([
            appWindow.outerPosition(),
            appWindow.innerSize(),
            appWindow.scaleFactor(),
          ]);
          if (pos.x <= MINIMIZED_COORD || pos.y <= MINIMIZED_COORD) return;
          const logical = size.toLogical(scale);
          await setConfig({
            x: pos.x,
            y: pos.y,
            width: Math.round(logical.width),
            height: Math.round(logical.height),
          });
        } catch (error) {
          console.error('Failed to save window geometry:', error);
        }
      }, GEOMETRY_SAVE_DELAY_MS);
    };

    const unlistenMoved = appWindow.onMoved(scheduleSave);
    const unlistenResized = appWindow.onResized(scheduleSave);

    return () => {
      window.clearTimeout(timer);
      unlistenMoved.then((fn) => fn());
      unlistenResized.then((fn) => fn());
    };
  }, [setConfig]);

  // Save typed text shortly after typing stops
  useEffect(() => {
    if (draftText === null) return;
    const timer = window.setTimeout(() => setConfig({ text: draftText }), TEXT_SAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [draftText, setConfig]);

  // Flush unsaved text before any close (X button, quit, panic), so the last
  // keystrokes aren't lost to the save delay. Capped so closing never hangs.
  useEffect(() => {
    const unlisten = appWindow.onCloseRequested(async () => {
      if (draftRef.current === null) return;
      await Promise.race([
        setConfig({ text: draftRef.current }),
        new Promise((resolve) => window.setTimeout(resolve, CLOSE_SAVE_TIMEOUT_MS)),
      ]);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [setConfig]);

  // Toggle settings panel
  const toggleSettings = useCallback(() => {
    setShowSettings((prev) => !prev);
  }, []);

  // Toggle visibility
  const toggleVisibility = useCallback(async () => {
    if (isVisible) {
      await appWindow.hide();
      setIsVisible(false);
    } else {
      await appWindow.show();
      await appWindow.setFocus();
      setIsVisible(true);
    }
  }, [isVisible]);

  // Font size controls
  const increaseFontSize = useCallback(async () => {
    const newSize = Math.min(48, config.fontSize + 1);
    await setConfig({ fontSize: newSize });
  }, [config.fontSize, setConfig]);

  const decreaseFontSize = useCallback(async () => {
    const newSize = Math.max(8, config.fontSize - 1);
    await setConfig({ fontSize: newSize });
  }, [config.fontSize, setConfig]);

  const resetFontSize = useCallback(async () => {
    await setConfig({ fontSize: DEFAULT_FONT_SIZE });
  }, [setConfig]);

  // Cycle opacity
  const cycleOpacity = useCallback(async () => {
    const nextIndex = (opacityIndex + 1) % OPACITY_LEVELS.length;
    setOpacityIndex(nextIndex);
    await setConfig({ opacity: OPACITY_LEVELS[nextIndex] });
  }, [opacityIndex, setConfig]);

  // Position presets (3x3 grid: Num1=bottom-left ... Num9=top-right).
  // Works in physical px against the current monitor's work area, so it lands
  // correctly at any display scaling, on any monitor, and clear of the taskbar.
  const positionPreset = useCallback(async (index: number) => {
    try {
      const monitor = await currentMonitor();
      if (!monitor) return;
      const area = monitor.workArea;
      const size = await appWindow.outerSize();

      // Map numpad positions:
      // 7=TL 8=TC 9=TR
      // 4=ML 5=MC 6=MR
      // 1=BL 2=BC 3=BR
      const col = ((index - 1) % 3); // 0=left, 1=center, 2=right
      const row = 2 - Math.floor((index - 1) / 3); // 0=top, 1=mid, 2=bottom

      const freeW = area.size.width - size.width;
      const freeH = area.size.height - size.height;
      const x = area.position.x + (col === 0 ? 0 : col === 1 ? freeW / 2 : freeW);
      const y = area.position.y + (row === 0 ? 0 : row === 1 ? freeH / 2 : freeH);

      await appWindow.setPosition(new PhysicalPosition(Math.round(x), Math.round(y)));
    } catch (error) {
      console.error('Position preset failed:', error);
    }
  }, []);

  // Nudge window (NUDGE_PX logical px, scaled to the display)
  const nudge = useCallback(async (direction: 'up' | 'down' | 'left' | 'right') => {
    try {
      const [pos, scale] = await Promise.all([appWindow.outerPosition(), appWindow.scaleFactor()]);
      const step = Math.round(NUDGE_PX * scale);
      let x = pos.x;
      let y = pos.y;

      switch (direction) {
        case 'up': y -= step; break;
        case 'down': y += step; break;
        case 'left': x -= step; break;
        case 'right': x += step; break;
      }

      await appWindow.setPosition(new PhysicalPosition(x, y));
    } catch (error) {
      console.error('Nudge failed:', error);
    }
  }, []);

  // Reset window geometry
  const resetGeometry = useCallback(async () => {
    try {
      await appWindow.setSize(new LogicalSize(DEFAULT_CONFIG.width, DEFAULT_CONFIG.height));
      await appWindow.setPosition(new PhysicalPosition(DEFAULT_CONFIG.x, DEFAULT_CONFIG.y));
    } catch (error) {
      console.error('Reset geometry failed:', error);
    }
  }, []);

  // Quit
  const quit = useCallback(async () => {
    await invoke('uninstall_scroll_hook').catch(() => {});
    await invoke('uninstall_keyboard_hook').catch(() => {});
    await appWindow.close();
  }, []);

  // Panic - instant close
  const panic = useCallback(async () => {
    await invoke('uninstall_scroll_hook').catch(() => {});
    await invoke('uninstall_keyboard_hook').catch(() => {});
    await appWindow.close();
  }, []);

  // Copy all text. The clipboard goes through the native plugin: the web clipboard
  // API makes WebView2 pop a permission prompt.
  const copyAll = useCallback(async () => {
    try {
      await writeText(text);
    } catch (error) {
      console.error('Copy failed:', error);
    }
  }, [text]);

  // Replace all text and save it right away (not a typing burst, so no delay)
  const replaceText = useCallback(async (newText: string) => {
    draftRef.current = newText;
    setDraftText(newText);
    await setConfig({ text: newText });
  }, [setConfig]);

  // Paste and replace all text
  const pasteReplace = useCallback(async () => {
    try {
      await replaceText(await readText());
    } catch (error) {
      console.error('Paste failed:', error);
    }
  }, [replaceText]);

  // Clear text
  const clearText = useCallback(async () => {
    await replaceText('');
  }, [replaceText]);

  // Register global hotkeys
  useGlobalHotkeys({
    toggleVisibility,
    toggleLock,
    quickEdit,
    emergencyUnlock,
    increaseFontSize,
    decreaseFontSize,
    resetFontSize,
    cycleOpacity,
    positionPreset,
    nudge,
    toggleSettings,
    resetGeometry,
    quit,
    panic,
    copyAll,
    pasteReplace,
    clearText,
  }, resolvedLayout);

  // Track text as it's typed (saved after a short pause, or on close)
  const updateText = (newText: string) => {
    draftRef.current = newText;
    setDraftText(newText);
  };

  // Handle update badge click (user dismissed the auto-popup earlier)
  const handleUpdateClick = async () => {
    if (!updater.updateAvailable) return;
    await updater.downloadAndInstall();
  };

  if (loading) {
    return null;
  }

  // Opacity is applied as element opacity on the whole overlay: the window is
  // uniformly opaque at the OS level (capture-exclusion uses LWA_ALPHA), so
  // real see-through isn't available — this dims the overlay, matching the
  // historical behavior. Settings always renders fully opaque for legibility.
  const appStyle = showSettings
    ? undefined
    : { backgroundColor: config.bgColor, opacity: config.opacity };

  return (
    <div className={`app${showSettings ? ' settings-open' : ''}`} style={appStyle}>
      {showSettings ? (
        <Settings
          config={config}
          setConfig={setConfig}
          onClose={toggleSettings}
          appVersion={updater.appVersion}
          updateAvailable={updater.updateAvailable}
          updateVersion={updater.updateVersion}
          onUpdateInstall={handleUpdateClick}
        />
      ) : (
        <>
          <TitleBar
            onSettingsClick={toggleSettings}
            checked={updater.checked}
            updateAvailable={updater.updateAvailable}
            updateVersion={updater.updateVersion}
            appVersion={updater.appVersion}
            onUpdateClick={handleUpdateClick}
          />

          <TextEditor config={config} text={text} onTextChange={updateText} />

          <BottomBar
            config={config}
            setConfig={setConfig}
            isLocked={isLocked}
            onToggleLock={toggleLock}
            onClearText={clearText}
          />
        </>
      )}
    </div>
  );
}

export default App;
