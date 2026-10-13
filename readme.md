<p align="center">
  <img src="assets/icon-source-512.png" alt="ScreenPrompt" width="112" height="112">
</p>

<h1 align="center">ScreenPrompt</h1>

<p align="center">
  <b>Notes only you can see.</b><br>
  A transparent overlay for Windows that stays invisible in screen shares and recordings.
</p>

<p align="center">
  <a href="../../releases/latest"><b>Download for Windows</b></a>
  &nbsp;·&nbsp;
  <a href="../../issues/new?template=feature_request.md">Request a feature</a>
  &nbsp;·&nbsp;
  <a href="../../issues/new?template=bug_report.md">Report a bug</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Windows-10%2B-blue" alt="Windows 10+">
  <img src="https://img.shields.io/badge/License-MIT-yellow" alt="MIT">
  <a href="https://tooomm.github.io/github-release-stats/?username=dan0dev&repository=ScreenPrompt"><img src="https://img.shields.io/github/downloads/dan0dev/ScreenPrompt/total.svg" alt="Downloads"></a>
</p>

![ScreenPrompt demo](hero-video-main.gif)

| You see | They see |
|:---:|:---:|
| ![Your screen](https://i.imgur.com/wAmlwOe.png) | ![Screen share](https://i.imgur.com/G7RpK9e.png) |

## Why

Keep talking points, names, numbers, and scripts right where you're looking, so you never have to glance at a second screen or your phone mid-call.

Hidden from Zoom, Teams, OBS, and Snipping Tool.

## Features

- **Capture-proof**: excluded from screen shares and recordings
- **Always on top**: adjustable transparency and click-through lock
- **Keyboard-first**: every action has a shortcut
- **Make it yours**: font, size, colors, and position presets
- **Private**: your notes never leave your PC; no telemetry, no data collection. The only network request is an update check against GitHub releases, which you can turn off in Settings

## Quick start

1. Download `ScreenPrompt_x.y.z_x64-setup.exe` from [Releases](../../releases/latest)
2. Install and launch
3. Type or paste your notes, then share your screen as usual

Requires Windows 10 (build 2004+) or Windows 11.

## Essential shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+Shift+H` | Show / hide |
| `Ctrl+Shift+L` | Lock (click-through) |
| `Esc` | Unlock (or Ctrl+click the lock icon) |
| `Ctrl+Shift+E` | Edit text |
| `Ctrl+Shift+F1` | Panic close, works even when locked |

## Locked mode

Lock the overlay (`Ctrl+Shift+L` or the lock icon) when you're presenting, and it gets out of your way:

- **Clicks go through** to the app below, everywhere on the overlay, including the lock icon.
- **Scrolling over it moves your notes.** Hold `Ctrl` or `Shift` to scroll or zoom the app behind instead.
- **To unlock**, press `Esc` or `Ctrl`+click the lock icon. The bottom bar shows this while locked.
- **To edit quickly**, press `Ctrl+Shift+E`: it unlocks until you click away, then locks again.

<details>
<summary><b>All shortcuts</b></summary>

These work anywhere, even while the overlay is locked or another app has focus:

| Shortcut | Action |
|---|---|
| `Ctrl+Shift+O` | Cycle opacity |
| `Ctrl+Shift+Q` | Quit |

These work while the overlay is focused (click it, or press `Ctrl+Shift+E` when locked), so they
don't override the same keys in your other apps:

| Shortcut | Action |
|---|---|
| `Ctrl+Shift+PageUp` / `PageDown` | Font size up / down |
| `Ctrl+Shift+Home` | Reset font size |
| `Ctrl+Shift+S` | Settings |
| `Ctrl+Shift+C` | Copy all text |
| `Ctrl+Shift+V` | Paste and replace all |
| `Ctrl+Shift+Delete` | Clear all text |
| `Ctrl+Shift+Arrows` | Nudge window 20px |
| `Ctrl+Shift+R` | Reset size and position |

**Position presets** work anywhere (layout is auto-detected, or set it in Settings)

| Position | QWERTY | QWERTZ |
|---|---|---|
| Top row | `Ctrl+Alt+7/8/9` | `Ctrl+Shift+7/8/9` |
| Middle row | `Ctrl+Alt+4/5/6` | `Ctrl+Shift+4/5/6` |
| Bottom row | `Ctrl+Alt+1/2/3` | `Ctrl+Shift+1/2/3` |

</details>

<details>
<summary><b>Build from source</b></summary>

Requires Node.js 20+ and Rust 1.77+.

```bash
git clone https://github.com/dan0dev/ScreenPrompt.git
cd ScreenPrompt/screenprompt-tauri
npm install
npm run tauri build
```

The installer is written to `src-tauri/target/release/bundle/nsis/`.

</details>

---

Made for calls, demos, streams, and presentations. Not for cheating on exams or breaking any platform's rules.

[MIT License](LICENSE) · [Contributing](CONTRIBUTING.md)
