// MIT License - Copyright (c) 2026 ScreenPrompt Contributors

import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow, LogicalPosition, LogicalSize } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';
import { message } from '@tauri-apps/plugin-dialog';
import { useConfig } from './hooks/useConfig';
import { useUpdater } from './hooks/useUpdater';
import { useGlobalHotkeys } from './hooks/useGlobalHotkeys';
import { OPACITY_LEVELS, DEFAULT_CONFIG } from './types';
import TitleBar from './components/TitleBar';
import TextEditor from './components/TextEditor';
import Settings from './components/Settings';
import BottomBar from './components/BottomBar';
import './styles/App.css';

const appWindow = getCurrentWindow();
const NUDGE_PX = 20;
const DEFAULT_FONT_SIZE = 14;

function App() {
  const { config, setConfig, loading } = useConfig();
  const [showSettings, setShowSettings] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [opacityIndex, setOpacityIndex] = useState(1); // default 0.85 is index 1
  const quickEditRef = useRef(false);

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

  // Toggle click-through mode
  const toggleLock = useCallback(async () => {
    try {
      const newLocked = !isLocked;
      await invoke('set_click_through', { window: appWindow, enabled: newLocked });
      setIsLocked(newLocked);
      await setConfig({ locked: newLocked });

      // Install/uninstall scroll + keyboard hooks
      if (newLocked) {
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
    } catch (error) {
      console.error('Failed to toggle lock:', error);
    }
  }, [isLocked, setConfig]);

  // Emergency unlock - always unlocks
  const emergencyUnlock = useCallback(async () => {
    if (!isLocked) return;
    try {
      await invoke('set_click_through', { window: appWindow, enabled: false });
      setIsLocked(false);
      await setConfig({ locked: false });
      await invoke('uninstall_scroll_hook').catch(() => {});
      await invoke('uninstall_keyboard_hook').catch(() => {});
    } catch (error) {
      console.error('Emergency unlock failed:', error);
    }
  }, [isLocked, setConfig]);

  // Quick edit: unlock, focus, auto-relock on blur
  const quickEdit = useCallback(async () => {
    if (!isLocked) return;
    try {
      await invoke('set_click_through', { window: appWindow, enabled: false });
      setIsLocked(false);
      await invoke('uninstall_scroll_hook').catch(() => {});
      await invoke('uninstall_keyboard_hook').catch(() => {});
      quickEditRef.current = true;
      await appWindow.setFocus();
    } catch (error) {
      console.error('Quick edit failed:', error);
    }
  }, [isLocked]);

  // Listen for Escape key (from keyboard hook) to emergency unlock
  useEffect(() => {
    const unlisten = listen('emergency-unlock', () => {
      emergencyUnlock();
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [emergencyUnlock]);

  // Listen for window blur to re-lock after quick edit
  useEffect(() => {
    const unlisten = appWindow.onFocusChanged(async ({ payload: focused }) => {
      if (!focused && quickEditRef.current) {
        quickEditRef.current = false;
        try {
          await invoke('set_click_through', { window: appWindow, enabled: true });
          setIsLocked(true);
          await setConfig({ locked: true });
          await invoke('install_scroll_hook', { window: appWindow }).catch(() => {});
          await invoke('install_keyboard_hook').catch(() => {});
        } catch (error) {
          console.error('Quick edit re-lock failed:', error);
        }
      }
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

  // Position presets (3x3 grid: Num1=bottom-left ... Num9=top-right)
  const positionPreset = useCallback(async (index: number) => {
    try {
      const [screenW, screenH] = await invoke<[number, number]>('get_screen_size', {
        window: appWindow,
      });
      const w = config.width;
      const h = config.height;

      // Map numpad positions:
      // 7=TL 8=TC 9=TR
      // 4=ML 5=MC 6=MR
      // 1=BL 2=BC 3=BR
      const col = ((index - 1) % 3); // 0=left, 1=center, 2=right
      const row = 2 - Math.floor((index - 1) / 3); // 0=top, 1=mid, 2=bottom

      const x = col === 0 ? 0 : col === 1 ? (screenW - w) / 2 : screenW - w;
      const y = row === 0 ? 0 : row === 1 ? (screenH - h) / 2 : screenH - h;

      await appWindow.setPosition(new LogicalPosition(Math.round(x), Math.round(y)));
      await setConfig({ x: Math.round(x), y: Math.round(y) });
    } catch (error) {
      console.error('Position preset failed:', error);
    }
  }, [config.width, config.height, setConfig]);

  // Nudge window
  const nudge = useCallback(async (direction: 'up' | 'down' | 'left' | 'right') => {
    try {
      const pos = await appWindow.outerPosition();
      let x = pos.x;
      let y = pos.y;

      switch (direction) {
        case 'up': y -= NUDGE_PX; break;
        case 'down': y += NUDGE_PX; break;
        case 'left': x -= NUDGE_PX; break;
        case 'right': x += NUDGE_PX; break;
      }

      await appWindow.setPosition(new LogicalPosition(x, y));
      await setConfig({ x, y });
    } catch (error) {
      console.error('Nudge failed:', error);
    }
  }, [setConfig]);

  // Reset window geometry
  const resetGeometry = useCallback(async () => {
    try {
      await appWindow.setSize(new LogicalSize(DEFAULT_CONFIG.width, DEFAULT_CONFIG.height));
      await appWindow.setPosition(new LogicalPosition(DEFAULT_CONFIG.x, DEFAULT_CONFIG.y));
      await setConfig({
        x: DEFAULT_CONFIG.x,
        y: DEFAULT_CONFIG.y,
        width: DEFAULT_CONFIG.width,
        height: DEFAULT_CONFIG.height,
      });
    } catch (error) {
      console.error('Reset geometry failed:', error);
    }
  }, [setConfig]);

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

  // Copy all text
  const copyAll = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(config.text);
    } catch (error) {
      console.error('Copy failed:', error);
    }
  }, [config.text]);

  // Paste and replace all text
  const pasteReplace = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      await setConfig({ text });
    } catch (error) {
      console.error('Paste failed:', error);
    }
  }, [setConfig]);

  // Clear text
  const clearText = useCallback(async () => {
    await setConfig({ text: '' });
  }, [setConfig]);

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

  // Update text in config
  const updateText = async (text: string) => {
    await setConfig({ text });
  };

  // Handle update badge click (user dismissed the auto-popup earlier)
  const handleUpdateClick = async () => {
    if (!updater.updateAvailable) return;
    await updater.downloadAndInstall();
  };

  // Show window once content is ready
  useEffect(() => {
    if (!loading) {
      appWindow.show();
    }
  }, [loading]);

  if (loading) {
    return null;
  }

  return (
    <div
      className="app"
      style={{
        backgroundColor: config.bgColor,
        opacity: config.opacity,
      }}
    >
      <TitleBar
        onSettingsClick={toggleSettings}
        checked={updater.checked}
        updateAvailable={updater.updateAvailable}
        updateVersion={updater.updateVersion}
        appVersion={updater.appVersion}
        onUpdateClick={handleUpdateClick}
      />

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
        <TextEditor config={config} text={config.text} onTextChange={updateText} />
      )}

      <BottomBar
        config={config}
        setConfig={setConfig}
        isLocked={isLocked}
        onToggleLock={toggleLock}
      />
    </div>
  );
}

export default App;
