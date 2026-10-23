// @vitest-environment jsdom
// MIT License - Copyright (c) 2026 ScreenPrompt Contributors

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Config } from '../types';
import { DEFAULT_CONFIG } from '../types';
import BottomBar from './BottomBar';
import Settings from './Settings';

const invokeSpy = vi.fn<(cmd: string, args?: unknown) => Promise<unknown>>(async () => undefined);
vi.mock('@tauri-apps/api/core', () => ({ invoke: (cmd: string, args?: unknown) => invokeSpy(cmd, args) }));
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({ onScaleChanged: async () => () => {} }),
}));
vi.mock('@tauri-apps/plugin-shell', () => ({ open: vi.fn(async () => {}) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ message: vi.fn(async () => {}) }));

afterEach(() => {
  cleanup();
  invokeSpy.mockClear();
});

function renderBar(config: Partial<Config>, isLocked = false) {
  const setConfig = vi.fn(async () => {});
  render(
    <BottomBar
      config={{ ...DEFAULT_CONFIG, ...config }}
      setConfig={setConfig}
      isLocked={isLocked}
      onToggleLock={() => {}}
      onClearText={() => {}}
      autoScrolling={false}
      onToggleAutoScroll={() => {}}
      onScrollSpeed={() => {}}
    />,
  );
  return setConfig;
}

const formatToggle = () => screen.queryByRole('button', { name: 'Formatting toolbar' });

describe('bottom bar formatting toggle', () => {
  it('opens and closes the toolbar', () => {
    let setConfig = renderBar({ showFormatBar: false });
    expect(formatToggle()?.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(formatToggle()!);
    expect(setConfig).toHaveBeenCalledWith({ showFormatBar: true });
    cleanup();

    setConfig = renderBar({ showFormatBar: true });
    expect(formatToggle()?.getAttribute('aria-pressed')).toBe('true');
    expect(formatToggle()?.className).toContain('active');
    fireEvent.click(formatToggle()!);
    expect(setConfig).toHaveBeenCalledWith({ showFormatBar: false });
  });

  it("doesn't take focus from the editor", () => {
    renderBar({});
    expect(fireEvent.mouseDown(formatToggle()!)).toBe(false);
  });

  it('is gone when Markdown is off, and while locked', () => {
    renderBar({ markdown: false });
    expect(formatToggle()).toBeNull();
    cleanup();
    renderBar({}, true);
    expect(formatToggle()).toBeNull();
  });
});

function renderSettings(config: Partial<Config> = {}) {
  const setConfig = vi.fn(async () => {});
  const onClose = vi.fn();
  render(
    <Settings
      config={{ ...DEFAULT_CONFIG, ...config }}
      setConfig={setConfig}
      onClose={onClose}
      appVersion="1.2.0"
      updateAvailable={false}
      updateVersion=""
      onUpdateInstall={() => {}}
        layout="en"
    />,
  );
  return { setConfig, onClose, checkbox: screen.getByLabelText('Format text (Markdown)') as HTMLInputElement };
}

describe('Settings Markdown switch', () => {
  it('shows the current setting', () => {
    expect(renderSettings({ markdown: true }).checkbox.checked).toBe(true);
    cleanup();
    expect(renderSettings({ markdown: false }).checkbox.checked).toBe(false);
  });

  it('saves the change on Save', async () => {
    const { setConfig, onClose, checkbox } = renderSettings();
    fireEvent.click(checkbox);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(setConfig).toHaveBeenCalledWith(expect.objectContaining({ markdown: false }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('discards the change on Cancel', () => {
    const { setConfig, checkbox } = renderSettings();
    fireEvent.click(checkbox);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(setConfig).not.toHaveBeenCalledWith(expect.objectContaining({ markdown: false }));
  });
});

describe("what's new in 1.2.0", () => {
  it('exists and is shown through the dialog', async () => {
    const { hasReleaseNotes, showWhatsNew } = await import('../utils/whatsNew');
    expect(hasReleaseNotes('1.2.0')).toBe(true);
    await showWhatsNew('1.2.0');
    const [cmd, args] = invokeSpy.mock.calls[0] as [string, { heading: string; content: string }];
    expect(cmd).toBe('show_info_dialog');
    expect(args.heading).toBe("What's new in v1.2.0");
    expect(args.content).toMatch(/Markdown/);
    expect(args.content).toMatch(/Ctrl\+B/);
  });

  it('only contains plain text and https links (the dialog renders HTML)', async () => {
    const { showWhatsNew } = await import('../utils/whatsNew');
    await showWhatsNew('1.2.0');
    const { content } = invokeSpy.mock.calls[0][1] as { content: string };
    const tags = content.match(/<[^>]+>/g) ?? [];
    tags.forEach((tag) => expect(tag).toMatch(/^<a href="https:\/\/[^"]+">$|^<\/a>$/));
  });
});

describe('defaults', () => {
  it('formats Markdown out of the box, with the toolbar closed', () => {
    expect(DEFAULT_CONFIG.markdown).toBe(true);
    expect(DEFAULT_CONFIG.showFormatBar).toBe(false);
  });
});
