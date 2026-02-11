<p align="center">
  <img src="assets/icon-source-512.png" alt="ScreenPrompt" width="128" height="128">
</p>

# ScreenPrompt

**Your notes, scripts, and reminders—visible to you, invisible to everyone else.**

ScreenPrompt creates a transparent overlay on your screen that **you can see, but others can't** during screen sharing or recordings. It's completely invisible to screen capture software, video calls, and recordings.

![Windows](https://img.shields.io/badge/Windows-10%2B-blue)
![Tauri](https://img.shields.io/badge/Tauri-2-blue)
![License](https://img.shields.io/badge/License-MIT-yellow)

![ScreenPrompt Demo](https://github.com/dan0dev/ScreenPrompt/blob/main/hero-video-main.gif)

<table>
<tr>
<th width="50%" align="center">Your Screen</th>
<th width="50%" align="center">What Others See</th>
</tr>
<tr>
<td align="center"><img src="https://i.imgur.com/wAmlwOe.png" alt="Your Screen"></td>
<td align="center"><img src="https://i.imgur.com/G7RpK9e.png" alt="Screen Share"></td>
</tr>
<tr>
<td align="center"><em>Overlay visible on your display</em></td>
<td align="center"><em>Overlay invisible during screen share</em></td>
</tr>
</table>

## 🎯 Why ScreenPrompt?

**The Problem:** During video calls or screen recordings, looking at notes on a second monitor (or looking away) makes you appear:
- Unprepared or unprofessional
- Like you're reading instead of speaking naturally
- Distracted or not engaged

**The Solution:** ScreenPrompt lets you read notes, scripts, or reminders **directly on your screen** while:
- ✅ **Others see only your shared content** - The overlay is invisible in their view
- ✅ **You appear natural and engaged** - Look at the camera while reading
- ✅ **No second monitor needed** - Works with single or multiple monitors
- ✅ **Read word-by-word seamlessly** - Nobody notices you're reading

**You see this:**
```
┌─────────────────────────────┐
│  Your Screen                │
│                             │
│  [ScreenPrompt Overlay]     │ ← You see your notes
│  • Key point 1              │
│  • Client name: John        │
│  • Next topic: pricing      │
│                             │
│  Your Presentation          │
└─────────────────────────────┘
```

**Others see this:**
```
┌─────────────────────────────┐
│  Your Screen                │
│                             │
│                             │ ← Notes are invisible
│                             │
│                             │
│                             │
│                             │
│  Your Presentation          │
└─────────────────────────────┘
```

## Features

- **Capture-Proof Overlay**: Window is excluded from screen capture (OBS, Zoom, Teams, Snipping Tool)
- **Transparent & Always-on-Top**: See your content while keeping notes visible
- **Click-Through Mode**: Lock the overlay so clicks pass through to applications beneath
- **Customizable Appearance**: Adjust opacity, font family, font size, text color, and background color
- **Keyboard Shortcuts**: Control everything without clicking
- **Keyboard Layout Support**: Auto-detects Hungarian (QWERTZ) or English (QWERTY) layout, with manual override in settings
- **Position Presets**: Quickly snap to screen corners or center
- **Persistent Settings**: Your preferences are saved between sessions
- **100% Local**: No internet connection, no data collection, no telemetry

## Requirements

- Windows 10 (Build 2004+) or Windows 11

## Installation

### Windows Installer (Recommended)

1. Go to the [Releases](../../releases) page
2. Download `ScreenPrompt_{version}_x64-setup.exe`
3. Run the installer
4. Launch from Start Menu or Desktop

If you're upgrading from the older Python-based version, the new installer will replace it.

### Build from Source

Requires [Node.js](https://nodejs.org/) 20+ and [Rust](https://rustup.rs/) 1.77+.

```bash
git clone https://github.com/dan0dev/ScreenPrompt.git
cd ScreenPrompt/screenprompt-tauri
npm install
npm run tauri build
```

The installer will be in `src-tauri/target/release/bundle/nsis/`.

## Usage

### Basic Controls

- **Drag the title bar** to move the window
- **Drag the bottom edge** to resize
- **Click the gear icon** to open settings
- **Click the lock icon** to toggle click-through mode

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+H` | Hide/Show overlay |
| `Ctrl+Shift+L` | Toggle lock (click-through) |
| `Ctrl+Shift+E` | Quick edit mode |
| `Escape` | Emergency unlock |
| `Ctrl+Shift+PageUp` | Increase font size |
| `Ctrl+Shift+PageDown` | Decrease font size |
| `Ctrl+Shift+Home` | Reset font size |
| `Ctrl+Shift+O` | Cycle opacity |
| `Ctrl+Shift+S` | Open settings |
| `Ctrl+Shift+Q` | Quit application |
| **`Ctrl+Shift+F1`** | **🚨 PANIC - Instant close (no confirmation)** |

### Position Presets

Shortcuts depend on your keyboard layout (auto-detected, or set in Settings):

**English (QWERTY):**

| Shortcut | Position |
|----------|----------|
| `Ctrl+Alt+7/8/9` | Top-left / Top-center / Top-right |
| `Ctrl+Alt+4/5/6` | Center-left / Center / Center-right |
| `Ctrl+Alt+1/2/3` | Bottom-left / Bottom-center / Bottom-right |

**Hungarian (QWERTZ):**

| Shortcut | Position |
|----------|----------|
| `Ctrl+Shift+7/8/9` | Top-left / Top-center / Top-right |
| `Ctrl+Shift+4/5/6` | Center-left / Center / Center-right |
| `Ctrl+Shift+1/2/3` | Bottom-left / Bottom-center / Bottom-right |

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+Arrows` | Nudge window 20px |

### Text Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+C` | Copy all text |
| `Ctrl+Shift+V` | Paste and replace all |
| `Ctrl+Shift+Delete` | Clear all text |

## 🚨 PANIC Button (Emergency Exit)

The **`Ctrl+Shift+F1`** hotkey provides an instant emergency exit:

- **No confirmation dialogs** - Closes immediately
- **Saves your settings** - Configuration is preserved
- **Works even when locked** - Bypasses click-through mode
- **Use in emergencies** - When you need to close the app instantly

This is different from `Ctrl+Shift+Q` which performs a normal close with cleanup.

## Configuration

Settings are stored locally via the app's config store and include:

- Window position and size
- Opacity level
- Font family and size
- Text and background colors
- Keyboard layout preference
- Lock state

## 💡 Real-World Use Cases

### ✅ Professional & Legitimate Uses

**Client Meetings & Sales Calls**
- Keep client names, key points, and talking points visible
- Reference technical details without looking unprepared
- Read important numbers or quotes naturally
- Appear confident and well-prepared

**Content Creation & Streaming**
- Read scripts word-by-word while appearing natural on camera
- Educational content: Tell stories "without reading"
- Live streams: Keep chat commands, schedules, reminders visible
- Tutorials: Follow step-by-step instructions smoothly

**Presentations & Public Speaking**
- Speaker notes that others can't see
- Teleprompter effect for professional delivery
- Read full sentences naturally while maintaining eye contact
- Reference data, statistics, quotes on the fly

**Video Calls & Remote Work**
- Meeting agendas and key discussion points
- Technical troubleshooting steps
- Interview questions and candidate notes
- Training sessions with reference materials

### ⛔ DO NOT Use For

**We built this for professional advantage, NOT for cheating:**

- ❌ Cheating on exams or assessments
- ❌ Violating academic integrity policies
- ❌ Breaking terms of service of any platform
- ❌ Any illegal or unethical activities

**You are solely responsible for how you use this software.**

## Privacy

ScreenPrompt runs **100% locally** on your machine:
- No internet connection required
- No data collection
- No telemetry
- No external servers

## License

MIT License - See [LICENSE](LICENSE) for details.

**THIS SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.** The authors are not responsible for any misuse of this software.

## Contributing

Contributions are welcome! Please read our [Contributing Guidelines](CONTRIBUTING.md) before submitting a pull request.

## Support

- **Bug Reports**: [Open an issue](../../issues/new?template=bug_report.md)
- **Feature Requests**: [Open an issue](../../issues/new?template=feature_request.md)
