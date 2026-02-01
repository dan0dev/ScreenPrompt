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
