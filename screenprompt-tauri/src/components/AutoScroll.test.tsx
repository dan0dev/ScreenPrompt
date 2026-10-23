// @vitest-environment jsdom
// MIT License - Copyright (c) 2026 ScreenPrompt Contributors

import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Config } from '../types';
import { DEFAULT_CONFIG } from '../types';
import { scrollPixelsPerSecond } from '../utils/autoScroll';
import { useGlobalHotkeys, type HotkeyHandlers } from '../hooks/useGlobalHotkeys';
import TextEditor from './TextEditor';
import BottomBar from './BottomBar';
import Settings from './Settings';

vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => {}) }));
vi.mock('@tauri-apps/plugin-shell', () => ({ open: vi.fn(async () => {}) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ message: vi.fn(async () => {}) }));
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async () => undefined) }));
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({ onScaleChanged: async () => () => {} }),
}));

// Global shortcuts: track what's registered and let tests press them
const registered = new Map<string, (e: { state: string }) => void>();
vi.mock('@tauri-apps/plugin-global-shortcut', () => ({
  register: vi.fn(async (key: string, handler: (e: { state: string }) => void) => {
    registered.set(key, handler);
  }),
  unregister: vi.fn(async (key: string) => {
    registered.delete(key);
  }),
  unregisterAll: vi.fn(async () => {
    registered.clear();
  }),
}));

// Animation frames, stepped by hand: frame(ms) advances the clock and runs one frame
let frames: FrameRequestCallback[] = [];
let clock = 0;
function frame(ms = 16) {
  clock += ms;
  const run = frames;
  frames = [];
  act(() => run.forEach((cb) => cb(clock)));
}

// jsdom has no layout: give an element a real-feeling scroll box (once; it
// keeps its scroll position across re-renders)
const boxed = new WeakSet<HTMLElement>();
function scrollBox(el: HTMLElement, scrollHeight: number, clientHeight = 200) {
  if (boxed.has(el)) return;
  boxed.add(el);
  let top = 0;
  Object.defineProperty(el, 'scrollHeight', { configurable: true, get: () => scrollHeight });
  Object.defineProperty(el, 'clientHeight', { configurable: true, get: () => clientHeight });
  Object.defineProperty(el, 'scrollTop', {
    configurable: true,
    get: () => top,
    // Browsers clamp and round to whole pixels (at 100% scaling)
    set: (v: number) => { top = Math.round(Math.min(Math.max(v, 0), scrollHeight - clientHeight)); },
  });
}

const SAMPLE = '# Script\n\n' + Array.from({ length: 40 }, (_, i) => `Line ${i + 1}`).join('\n');
const view = () => document.querySelector('.markdown-view') as HTMLElement;
const textarea = () => document.querySelector('textarea') as HTMLTextAreaElement;

interface HarnessProps {
  initial?: boolean;
  markdown?: boolean;
  scrollSpeed?: number;
  height?: number;
  onStop?: () => void;
}

// TextEditor with auto-scroll state held the way App holds it, plus a toggle
function Harness({ initial = false, markdown = true, scrollSpeed = 4, height = 1200, onStop }: HarnessProps) {
  const [on, setOn] = useState(initial);
  return (
    <>
      <button onClick={() => setOn((v) => !v)}>toggle</button>
      <span data-testid="state">{on ? 'on' : 'off'}</span>
      <TextEditor
        config={{ ...DEFAULT_CONFIG, markdown, scrollSpeed }}
        text={SAMPLE}
        onTextChange={() => {}}
        isLocked={false}
        editRequest={0}
        autoScroll={on}
        onAutoScrollStop={() => {
          setOn(false);
          onStop?.();
        }}
      />
      <div ref={(el) => { if (el) scrollBox((document.querySelector('.markdown-view') ?? document.querySelector('textarea'))!, height); }} />
    </>
  );
}

const state = () => screen.getByTestId('state').textContent;
const toggle = () => fireEvent.click(screen.getByText('toggle'));
const pxPerSecond = scrollPixelsPerSecond(4, DEFAULT_CONFIG.fontSize);

beforeEach(() => {
  frames = [];
  clock = 0;
  window.requestAnimationFrame = (cb) => frames.push(cb);
  window.cancelAnimationFrame = () => { frames = []; };
  registered.clear();
});
afterEach(cleanup);

describe('auto-scroll in the editor', () => {
  it('scrolls the formatted view at the set speed', () => {
    render(<Harness />);
    toggle();
    frame(0); // first frame only records the time
    for (let i = 0; i < 60; i++) frame(1000 / 60);
    expect(view().scrollTop).toBe(Math.round(pxPerSecond)); // one second's worth
    expect(state()).toBe('on');
  });

  it('pauses, and resumes from the same place', () => {
    render(<Harness />);
    toggle();
    frame(0);
    for (let i = 0; i < 120; i++) frame(1000 / 60);
    toggle(); // pause
    const paused = view().scrollTop;
    expect(frames).toHaveLength(0);
    frame(5000);
    expect(view().scrollTop).toBe(paused);
    toggle(); // resume
    frame(0);
    frame(500);
    expect(view().scrollTop).toBeGreaterThan(paused);
  });

  it('stops by itself at the end', () => {
    const onStop = vi.fn();
    render(<Harness height={260} onStop={onStop} />); // 60px to scroll
    toggle();
    frame(0);
    for (let i = 0; i < 60 && state() === 'on'; i++) frame(250);
    expect(view().scrollTop).toBe(60);
    expect(onStop).toHaveBeenCalledTimes(1);
    expect(state()).toBe('off');
  });

  it('starts over from the top when started at the end', () => {
    render(<Harness height={260} />);
    view().scrollTop = 60;
    toggle();
    expect(view().scrollTop).toBe(0);
  });

  it('stops right away when there is nothing to scroll', () => {
    render(<Harness height={200} />);
    toggle();
    frame(0);
    expect(state()).toBe('off');
  });

  it('continues from where the user scrolled to', () => {
    render(<Harness />);
    toggle();
    frame(0);
    frame(100);
    view().scrollTop = 500; // wheel
    frame(100);
    expect(view().scrollTop).toBeGreaterThanOrEqual(500);
    expect(view().scrollTop).toBeLessThan(510);
  });

  it('uses the new speed immediately', () => {
    const { rerender } = render(<Harness initial scrollSpeed={1} />);
    frame(0);
    frame(200);
    const slow = view().scrollTop;
    rerender(<Harness initial scrollSpeed={20} />);
    frame(200);
    expect(view().scrollTop - slow).toBeGreaterThan(slow * 10);
  });

  it('pauses when you start typing', () => {
    render(<Harness />);
    toggle();
    frame(0);
    fireEvent.keyDown(view(), { key: 'Enter' }); // open the editor
    expect(state()).toBe('off');
  });

  it('leaves the editor when started while typing', () => {
    render(<Harness markdown={false} />);
    textarea().focus();
    expect(document.activeElement).toBe(textarea());
    toggle();
    expect(document.activeElement).not.toBe(textarea());
  });

  it('scrolls the plain editor when Markdown is off', () => {
    render(<Harness markdown={false} />);
    toggle();
    frame(0);
    for (let i = 0; i < 60; i++) frame(1000 / 60);
    expect(textarea().scrollTop).toBe(Math.round(pxPerSecond));
  });
});

function renderBar(props: Partial<{ config: Partial<Config>; isLocked: boolean; autoScrolling: boolean }> = {}) {
  const onToggleAutoScroll = vi.fn();
  const onScrollSpeed = vi.fn();
  render(
    <BottomBar
      config={{ ...DEFAULT_CONFIG, ...props.config }}
      setConfig={vi.fn(async () => {})}
      isLocked={props.isLocked ?? false}
      onToggleLock={() => {}}
      onClearText={() => {}}
      autoScrolling={props.autoScrolling ?? false}
      onToggleAutoScroll={onToggleAutoScroll}
      onScrollSpeed={onScrollSpeed}
    />,
  );
  return { onToggleAutoScroll, onScrollSpeed };
}

describe('bottom bar auto-scroll controls', () => {
  it('starts and pauses', () => {
    let { onToggleAutoScroll } = renderBar();
    const start = screen.getByRole('button', { name: 'Start auto-scroll' });
    expect(start.getAttribute('aria-pressed')).toBe('false');
    expect(start.title).toContain('Ctrl+Shift+Space');
    fireEvent.click(start);
    expect(onToggleAutoScroll).toHaveBeenCalledTimes(1);
    cleanup();

    ({ onToggleAutoScroll } = renderBar({ autoScrolling: true }));
    const pause = screen.getByRole('button', { name: 'Pause auto-scroll' });
    expect(pause.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(pause);
    expect(onToggleAutoScroll).toHaveBeenCalledTimes(1);
  });

  it('shows and steps the speed', () => {
    const { onScrollSpeed } = renderBar({ config: { scrollSpeed: 7 } });
    expect(screen.getByRole('group', { name: /scroll speed 7/i }).textContent).toContain('7');
    fireEvent.click(screen.getByRole('button', { name: 'Slower' }));
    fireEvent.click(screen.getByRole('button', { name: 'Faster' }));
    expect(onScrollSpeed.mock.calls).toEqual([[-1], [1]]);
  });

  it('disables stepping past the limits', () => {
    renderBar({ config: { scrollSpeed: 1 } });
    expect((screen.getByRole('button', { name: 'Slower' }) as HTMLButtonElement).disabled).toBe(true);
    cleanup();
    renderBar({ config: { scrollSpeed: 20 } });
    expect((screen.getByRole('button', { name: 'Faster' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('while locked, shows only a status, and only while scrolling', () => {
    renderBar({ isLocked: true, autoScrolling: true, config: { scrollSpeed: 6 } });
    expect(screen.queryByRole('button', { name: /auto-scroll/i })).toBeNull();
    expect(document.querySelector('.scroll-status')?.textContent).toBe('6');
    cleanup();
    renderBar({ isLocked: true, autoScrolling: false });
    expect(document.querySelector('.scroll-status')).toBeNull();
  });
});

describe('Settings speed slider', () => {
  it('shows the speed and saves a change', async () => {
    const setConfig = vi.fn(async () => {});
    const onClose = vi.fn();
    render(
      <Settings
        config={{ ...DEFAULT_CONFIG, scrollSpeed: 4 }}
        setConfig={setConfig}
        onClose={onClose}
        appVersion="1.2.0"
        updateAvailable={false}
        updateVersion=""
        onUpdateInstall={() => {}}
        layout="en"
      />,
    );
    const slider = screen.getByLabelText('Auto-scroll speed') as HTMLInputElement;
    expect(slider.value).toBe('4');
    expect(screen.getByText(/4 · 20 lines\/min/)).toBeTruthy();
    fireEvent.change(slider, { target: { value: '9' } });
    expect(screen.getByText(/9 · 45 lines\/min/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(setConfig).toHaveBeenCalledWith(expect.objectContaining({ scrollSpeed: 9 }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});

describe('auto-scroll hotkeys', () => {
  const handlers = (): HotkeyHandlers => {
    const noop = () => {};
    return {
      toggleVisibility: noop, toggleLock: noop, quickEdit: noop, emergencyUnlock: noop,
      increaseFontSize: noop, decreaseFontSize: noop, resetFontSize: noop, cycleOpacity: noop,
      positionPreset: noop, nudge: noop, toggleSettings: noop, resetGeometry: noop, quit: noop,
      panic: noop, copyAll: noop, pasteReplace: noop, clearText: noop,
      toggleAutoScroll: vi.fn(), scrollSlower: vi.fn(), scrollFaster: vi.fn(), toggleShortcuts: noop,
    };
  };

  function Keys({ h, scrolling }: { h: HotkeyHandlers; scrolling: boolean }) {
    useGlobalHotkeys(h, 'en', scrolling);
    return null;
  }

  const press = (key: string) => registered.get(key)!({ state: 'Pressed' });

  it('Ctrl+Shift+Space is always there and toggles', async () => {
    const h = handlers();
    render(<Keys h={h} scrolling={false} />);
    await waitFor(() => expect(registered.has('CmdOrCtrl+Shift+Space')).toBe(true));
    press('CmdOrCtrl+Shift+Space');
    registered.get('CmdOrCtrl+Shift+Space')!({ state: 'Released' }); // releases are ignored
    expect(h.toggleAutoScroll).toHaveBeenCalledTimes(1);
  });

  it('speed keys exist only while scrolling', async () => {
    const h = handlers();
    const { rerender } = render(<Keys h={h} scrolling={false} />);
    await waitFor(() => expect(registered.has('CmdOrCtrl+Shift+Space')).toBe(true));
    expect(registered.has('CmdOrCtrl+Shift+Comma')).toBe(false);

    rerender(<Keys h={h} scrolling />);
    await waitFor(() => expect(registered.has('CmdOrCtrl+Shift+Period')).toBe(true));
    press('CmdOrCtrl+Shift+Comma');
    press('CmdOrCtrl+Shift+Period');
    expect(h.scrollSlower).toHaveBeenCalledTimes(1);
    expect(h.scrollFaster).toHaveBeenCalledTimes(1);

    rerender(<Keys h={h} scrolling={false} />);
    await waitFor(() => expect(registered.has('CmdOrCtrl+Shift+Comma')).toBe(false));
    expect(registered.has('CmdOrCtrl+Shift+Period')).toBe(false);
    expect(registered.has('CmdOrCtrl+Shift+Space')).toBe(true);
  });
});
