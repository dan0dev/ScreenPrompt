# ScreenPrompt

A transparent overlay window for Windows that is **invisible to screen capture software**. Perfect for presentations, video calls, content creation, and keeping notes visible while screen sharing.

![Windows](https://img.shields.io/badge/Windows-10%2B-blue)
![Python](https://img.shields.io/badge/Python-3.10%2B-green)
![License](https://img.shields.io/badge/License-MIT-yellow)

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
- Python 3.10 or higher

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/screenprompt.git
   cd screenprompt
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
| `Ctrl+Shift++` | Increase font size |
| `Ctrl+Shift+-` | Decrease font size |
| `Ctrl+Shift+0` | Reset font size |
| `Ctrl+Shift+O` | Cycle opacity |
| `Ctrl+Shift+,` | Open settings |
| `Ctrl+Shift+Q` | Quit application |

### Position Presets (Numpad-style)

| Shortcut | Position |
|----------|----------|
| `Ctrl+Shift+7/8/9` | Top-left / Top-center / Top-right |
| `Ctrl+Shift+4/5/6` | Center-left / Center / Center-right |
| `Ctrl+Shift+1/2/3` | Bottom-left / Bottom-center / Bottom-right |
| `Ctrl+Shift+Arrows` | Nudge window 20px |

### Text Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+C` | Copy all text |
| `Ctrl+Shift+V` | Paste and replace all |
| `Ctrl+Shift+Delete` | Clear all text |

## Configuration

Settings are stored in `%APPDATA%\ScreenPrompt\config.json` and include:

- Window position and size
- Opacity level
- Font family and size
- Text and background colors
- Lock state

## Known Limitations

- **Browser-based screen sharing** (Google Meet, Discord Web, browser-based Teams) shows a black box instead of hiding the window. This is a limitation of the browser's `getDisplayMedia` API, not our software. Use native desktop applications (Zoom, OBS, Teams desktop) for proper capture exclusion.

## Intended Use and Ethical Notice

ScreenPrompt is intended for **legitimate use only**, such as:
- Presentations and meetings
- Content creation
- Personal productivity
- Keeping reference notes visible while screen sharing

**DO NOT use this software for:**
- Cheating on exams or assessments
- Violating academic integrity policies
- Breaking terms of service of any platform
- Any illegal activities

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
