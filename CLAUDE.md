# CLAUDE.md – ScreenPrompt Rules (never forget)

## Core Rules

- Language: English only (UI, comments, logs, docs)
- License: MIT – include full MIT block + warranty disclaimer in every .py file header
- Ethical/Legal must-haves (copy-paste these everywhere):
  - First-run popup: "ScreenPrompt is for legitimate use (presentations, meetings, content creation). DO NOT use for cheating on exams or violating policies/laws/ToS. You are solely responsible."
  - README.md section: "Intended Use and Ethical Notice" with same warning + "AS IS, NO WARRANTY"
  - Privacy: "Runs 100% locally, no data collection, no telemetry"
- Windows only: Win10 Build 2004+ / Win11 – always check version before SetWindowDisplayAffinity
- MVP priority: overlay window → capture exclusion → basic text + opacity → position/size save → ethical popup
- Later: hotkeys, tray, multi-prompts, PyInstaller, WiX MSI

## Tech Rules

- Python 3.10+, Tkinter only (no PyQt until proven necessary)
- ctypes for user32.SetWindowDisplayAffinity(hwnd, 0x11) – WDA_EXCLUDEFROMCAPTURE
- Config: %APPDATA%\ScreenPrompt\config.json
- No external deps beyond stdlib + tkinter (pynput/keyboard only if hotkeys added)
- Test early/often: Zoom, Teams, OBS, Snipping Tool, multi-monitor

## Workflow Rules

- Always start complex tasks in plan mode
- Use subagents / multiple worktrees for parallel work (UI vs WinAPI vs config vs tests)
- After every bugfix or lesson: "Update CLAUDE.md with this rule"
- When stuck: "Re-plan from scratch" or "use subagents"
- Output format: short plan update → full code (filename) → run instructions → next steps/tests

## Implementation Patterns (Lessons Learned)

### Settings UI Pattern (2026-02-01)
- Use `ttk` widgets over plain `tk` for modern look
- Settings dialog should be modal (`transient` + `grab_set`)
- Always provide real-time preview via callback (e.g., `on_opacity_change`)
- Cancel must restore original values (reload from config)
- Config functions (`load_config`, `save_config`) should be standalone for reuse
- Merge saved config with defaults to handle missing keys gracefully
- Include standalone `if __name__ == "__main__"` test block for isolated testing
- Opacity slider range: 0.5–1.0 (below 0.5 is too transparent to read)

### Config Schema Standard (2026-02-01)
- Position keys: `x`, `y` (not `position_x`, `window_x`)
- Size keys: `width`, `height`
- Appearance: `opacity` (default 0.85), `font_family`, `font_size`, `font_color`, `bg_color`
- State: `text`, `first_run_shown`
- All modules MUST use identical key names to avoid data corruption
- Extract ConfigManager to standalone `config_manager.py` module for reuse
- Always merge saved config with defaults: `{**DEFAULT_CONFIG, **saved_config}`

### Tkinter on Windows (2026-02-01)
- Cursor names differ from X11: use `size_nw_se` not `se_resize`
- Valid Windows cursors: `arrow`, `hand2`, `size_nw_se`, `size_ns`, `size_we`, `watch`
- **Use default cursor everywhere** - no custom cursors on buttons, labels, or interactive elements
- **HWND Bug**: `winfo_id()` returns internal Tk frame, NOT the real window handle
  - WRONG: `hwnd = widget.winfo_id()`
  - RIGHT: `hwnd = GetParent(widget.winfo_id())` with fallback to `winfo_id()` if 0
  - Required for `SetWindowDisplayAffinity` to work on Toplevel windows

### SetWindowDisplayAffinity Black Box Fix (2026-02-01)
- **Problem**: Window shows as BLACK BOX in OBS/capture instead of invisible
- **Cause**: Per-pixel transparency (UpdateLayeredWindow) incompatible with display affinity
- **Fix**: Use SetLayeredWindowAttributes style instead. Order matters:
  1. `SetWindowLongPtrW(hwnd, GWL_EXSTYLE, ex_style | WS_EX_LAYERED)`
  2. `SetLayeredWindowAttributes(hwnd, 0, 255, LWA_ALPHA)` ← makes it compatible
  3. `SetWindowDisplayAffinity(hwnd, WDA_EXCLUDEFROMCAPTURE)`
- Configure ctypes argtypes for 64-bit: use `c_void_p` for HWND, not `c_int`
- Reference: https://learn.microsoft.com/en-us/answers/questions/700122/setwindowdisplayaffinity-on-windows-11

### Browser-Based Screen Share Limitation (2026-02-01)
- **Problem**: Black box in Google Meet, browser-based Teams, Discord web
- **Cause**: Browser `getDisplayMedia` API doesn't respect `SetWindowDisplayAffinity`
  - Native apps (Zoom desktop, OBS, Snipping Tool) work correctly
  - Browser apps (Chrome, Edge) show black box for excluded windows
  - This is a Windows/Chrome limitation, NOT fixable in our code
- **Workaround**: Embed settings as a **panel inside main overlay** instead of separate Toplevel
  - One window = one HWND = one capture exclusion = no extra black box
  - SettingsPanel (tk.Frame) instead of SettingsDialog (tk.Toplevel)
  - Use `pack()`/`pack_forget()` to show/hide panel
  - No separate `SetWindowDisplayAffinity` call needed for panel
- **UI Note**: Add warning banner in settings panel about browser limitations
- References:
  - https://learn.microsoft.com/en-us/answers/questions/700122/setwindowdisplayaffinity-on-windows-11
  - https://github.com/electron/electron/issues/12973
