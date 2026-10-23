// @vitest-environment jsdom
// MIT License - Copyright (c) 2026 ScreenPrompt Contributors

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CONFIG } from '../types';
import { shortcutGroups } from '../utils/shortcuts';
import { useGlobalHotkeys, type HotkeyHandlers } from '../hooks/useGlobalHotkeys';
import ShortcutsPanel from './ShortcutsPanel';
import Settings from './Settings';

const registered = new Set<string>();
vi.mock('@tauri-apps/plugin-global-shortcut', () => ({
  register: vi.fn(async (key: string) => { registered.add(key); }),
  unregister: vi.fn(async (key: string) => { registered.delete(key); }),
  unregisterAll: vi.fn(async () => { registered.clear(); }),
}));
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async () => undefined) }));
vi.mock('@tauri-apps/plugin-shell', () => ({ open: vi.fn(async () => {}) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ message: vi.fn(async () => {}) }));

beforeEach(() => registered.clear());
afterEach(cleanup);

// Every handler is a spy, so a key press can be traced to what it did
function spyHandlers(): HotkeyHandlers {
  return new Proxy({} as Record<string, ReturnType<typeof vi.fn>>, {
    get: (target, name: string) => (target[name] ??= vi.fn()),
  }) as unknown as HotkeyHandlers;
}

function Keys({ h, layout, scrolling }: { h: HotkeyHandlers; layout: string; scrolling: boolean }) {
  useGlobalHotkeys(h, layout, scrolling);
  return null;
}

// "CmdOrCtrl+Shift+Comma" -> "Ctrl+Shift+,", as the sheet writes it
const display = (key: string) =>
  key.replace('CmdOrCtrl', 'Ctrl').replace('Comma', ',').replace('Period', '.');

const listed = (layout: string, group: string) =>
  shortcutGroups(layout).find((g) => g.title === group)!.items.flatMap((i) => i.keys);

describe.each(['en', 'hu'])('the cheat sheet matches the real shortcuts (%s layout)', (layout) => {
  it('lists every global shortcut the app registers', async () => {
    render(<Keys h={spyHandlers()} layout={layout} scrolling />);
    await waitFor(() => expect(registered.has('CmdOrCtrl+Shift+Comma')).toBe(true));
    // Tests run as a local build, so the local-only key is registered too
    const anywhere = [...listed(layout, 'Anywhere'), ...listed(layout, 'Local build')];
    const presetModifier = layout === 'hu' ? 'Ctrl+Shift' : 'Ctrl+Alt';

    for (const key of registered) {
      const shown = display(key);
      if (/\+[1-9]$/.test(shown)) {
        // Position presets are listed as one "1–9" entry; check the modifier
        expect(shown.startsWith(presetModifier + '+')).toBe(true);
        expect(anywhere.some((k) => k.startsWith(presetModifier + '+'))).toBe(true);
      } else {
        expect(anywhere, `${shown} is registered but not on the sheet`).toContain(shown);
      }
    }
  });

  it('registers every global shortcut it lists', async () => {
    render(<Keys h={spyHandlers()} layout={layout} scrolling />);
    await waitFor(() => expect(registered.has('CmdOrCtrl+Shift+Comma')).toBe(true));
    const shown = [...registered].map(display);
    for (const key of listed(layout, 'Anywhere')) {
      if (key === 'Esc') continue; // Rust keyboard hook while locked, not a registered shortcut
      // "Ctrl+Alt+1–9" stands for nine keys
      const keys = key.endsWith('1–9')
        ? Array.from({ length: 9 }, (_, i) => key.replace('1–9', String(i + 1)))
        : [key];
      for (const k of keys) expect(shown, `${k} is on the sheet but not registered`).toContain(k);
    }
  });
});

describe('focused-window shortcuts on the sheet all do something', () => {
  // The sheet's key name -> the KeyboardEvent.code the app listens for
  const CODES: Record<string, string> = {
    S: 'KeyS', C: 'KeyC', V: 'KeyV', R: 'KeyR', Delete: 'Delete', PageUp: 'PageUp',
    PageDown: 'PageDown', Home: 'Home', Arrows: 'ArrowUp', F1: 'F1',
  };

  for (const combo of listed('en', 'While ScreenPrompt is focused')) {
    it(combo, () => {
      const h = spyHandlers();
      render(<Keys h={h} layout="en" scrolling={false} />);
      const key = combo.split('+').pop()!;
      const withMods = combo.startsWith('Ctrl+Shift+');
      fireEvent.keyDown(window, { code: CODES[key], key, ctrlKey: withMods, shiftKey: withMods });
      const called = Object.values(h as unknown as Record<string, ReturnType<typeof vi.fn>>).filter((f) => f.mock.calls.length);
      expect(called, `${combo} did nothing`).toHaveLength(1);
    });
  }

  it('F1 with modifiers is not the cheat sheet (Ctrl+Shift+F1 is panic)', () => {
    const h = spyHandlers();
    render(<Keys h={h} layout="en" scrolling={false} />);
    fireEvent.keyDown(window, { code: 'F1', key: 'F1', ctrlKey: true, shiftKey: true });
    expect(h.toggleShortcuts).not.toHaveBeenCalled();
  });
});

describe('ShortcutsPanel', () => {
  it('shows every group and its shortcuts', () => {
    render(<ShortcutsPanel layout="en" onClose={() => {}} />);
    for (const group of shortcutGroups('en')) {
      const section = screen.getByRole('region', { name: group.title });
      for (const item of group.items) expect(within(section).getByText(item.action)).toBeTruthy();
    }
  });

  it('draws each key as a key cap', () => {
    render(<ShortcutsPanel layout="en" onClose={() => {}} />);
    const row = screen.getByText('Start / pause / resume auto-scroll').closest('.shortcut-row')!;
    expect([...row.querySelectorAll('kbd')].map((k) => k.textContent)).toEqual(['Ctrl', 'Shift', 'Space']);
    const speed = screen.getByText(/Slower \/ faster/).closest('.shortcut-row')!;
    expect([...speed.querySelectorAll('kbd')].map((k) => k.textContent)).toEqual(['Ctrl', 'Shift', ',', 'Ctrl', 'Shift', '.']);
  });

  it('shows the position keys for the keyboard layout', () => {
    render(<ShortcutsPanel layout="hu" onClose={() => {}} />);
    const row = screen.getByText(/Move to a screen spot/).closest('.shortcut-row')!;
    expect(row.textContent).toContain('Shift');
    expect(row.textContent).not.toContain('Alt');
    cleanup();
    render(<ShortcutsPanel layout="en" onClose={() => {}} />);
    expect(screen.getByText(/Move to a screen spot/).closest('.shortcut-row')!.textContent).toContain('Alt');
  });

  it('closes with the button and with Esc', () => {
    const onClose = vi.fn();
    render(<ShortcutsPanel layout="en" onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close shortcuts' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

describe('from Settings', () => {
  it('opens as a sub-page and comes back with unsaved changes kept', () => {
    render(
      <Settings
        config={DEFAULT_CONFIG}
        setConfig={vi.fn(async () => {})}
        onClose={() => {}}
        appVersion="1.2.0"
        updateAvailable={false}
        updateVersion=""
        onUpdateInstall={() => {}}
        layout="en"
      />,
    );
    const markdown = screen.getByLabelText('Format text (Markdown)') as HTMLInputElement;
    fireEvent.click(markdown); // unsaved change
    fireEvent.click(screen.getByRole('button', { name: 'Shortcuts' }));
    expect(screen.getByRole('heading', { name: 'Keyboard shortcuts' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Close shortcuts' }));
    expect((screen.getByLabelText('Format text (Markdown)') as HTMLInputElement).checked).toBe(false);
  });
});

describe('local-build-only shortcuts', () => {
  it('are on the sheet only in local builds', () => {
    expect(shortcutGroups('en', true).some((g) => g.title === 'Local build')).toBe(true);
    expect(shortcutGroups('en', false).some((g) => g.title === 'Local build')).toBe(false);
    const all = shortcutGroups('en', false).flatMap((g) => g.items.flatMap((i) => i.keys));
    expect(all).not.toContain('Ctrl+Shift+F12');
  });
});
