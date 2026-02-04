# ScreenPrompt

**Your notes, scripts, and reminders—visible to you, invisible to everyone else.**

ScreenPrompt creates a transparent overlay on your screen that **you can see, but others can't** during screen sharing or recordings. It's completely invisible to screen capture software, video calls, and recordings.

![Windows](https://img.shields.io/badge/Windows-10%2B-blue)
![Python](https://img.shields.io/badge/Python-3.10%2B-green)
![License](https://img.shields.io/badge/License-MIT-yellow)

![ScreenPrompt Demo](https://github.com/dan0dev/ScreenPrompt/blob/main/hero-video-main.gif)

| Your Screen | What Others See |
|:--:|:--:|
| ![Your Screen](https://i.imgur.com/Se11s8b.jpeg) | ![Screen Share](https://i.imgur.com/fSqLQf0.png) |
| *Overlay visible on your display* | *Overlay invisible during screen share* |

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
- **Position Presets**: Quickly snap to screen corners or center
- **Persistent Settings**: Your preferences are saved between sessions
- **100% Local**: No internet connection, no data collection, no telemetry

## Requirements

- Windows 10 (Build 2004+) or Windows 11

## Installation

### Option 1: Windows Installer (Recommended)

1. Go to the [Releases](../../releases) page
2. Download `ScreenPrompt-{version}-Setup.exe`
3. Run the installer
4. Choose installation options:
   - ✅ Start Menu shortcuts (recommended)
   - ✅ Desktop shortcut (optional)
5. Launch from Start Menu or Desktop

**Features:**
- Professional Windows installer
- Automatic uninstaller in Add/Remove Programs
- Preserves settings when upgrading
- One-click installation

### Option 2: Run from Source

Requires Python 3.10 or higher.

1. Clone the repository:
   ```bash
   git clone https://github.com/dan0dev/ScreenPrompt.git
   cd ScreenPrompt
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Run the application:
   ```bash
   python src/main.py
   ```

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

### Position Presets (Numpad)

| Shortcut | Position |
|----------|----------|
| `Ctrl+Alt+Numpad 7/8/9` | Top-left / Top-center / Top-right |
| `Ctrl+Alt+Numpad 4/5/6` | Center-left / Center / Center-right |
| `Ctrl+Alt+Numpad 1/2/3` | Bottom-left / Bottom-center / Bottom-right |
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

Settings are stored in `%APPDATA%\ScreenPrompt\config.json` and include:

- Window position and size
- Opacity level
- Font family and size
- Text and background colors
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
