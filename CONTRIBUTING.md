# Contributing to ScreenPrompt

Thank you for your interest in contributing to ScreenPrompt! This document provides guidelines and instructions for contributing.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for everyone.

## Project Scope

ScreenPrompt is a teleprompter and notes overlay for presentations, streams, recordings, and calls.
Pull requests that add AI answer generation, exam or interview assistance, or ways to evade
proctoring software are out of scope and will be declined.

## How to Contribute

### Reporting Bugs

1. **Check existing issues** to see if the bug has already been reported
2. If not, [open a new issue](../../issues/new?template=bug_report.md) with:
   - Clear, descriptive title
   - Steps to reproduce
   - Expected vs actual behavior
   - Windows version and app version
   - Screenshots if applicable

### Requesting Features

1. **Check existing issues** for similar requests
2. [Open a feature request](../../issues/new?template=feature_request.md) with:
   - Clear description of the feature
   - Use case / why it would be useful
   - Any implementation ideas (optional)

### Submitting Pull Requests

1. **Fork the repository** and create your branch from `main`
2. **Follow the code style** (see below)
3. **Test your changes** thoroughly
4. **Update documentation** if needed
5. **Submit a pull request** with a clear description

## Development Setup

Requires [Node.js](https://nodejs.org/) 20+ and [Rust](https://rustup.rs/) 1.77+.

1. Clone your fork:
   ```bash
   git clone https://github.com/yourusername/screenprompt.git
   cd screenprompt/screenprompt-tauri
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the application in development mode:
   ```bash
   npm run tauri dev
   ```

4. Build a release installer:
   ```bash
   npm run tauri build
   ```
   The installer will be in `src-tauri/target/release/bundle/nsis/`.

## Code Style Guidelines

### General

- **Language**: All code, comments, and documentation must be in English
- **Frontend**: TypeScript + React, following the existing ESLint config (`npm run lint`)
- **Backend**: Rust (2021 edition), formatted with `cargo fmt` and checked with `cargo clippy`
- **Line length**: 100 characters max

### Naming Conventions

- **TypeScript**: `camelCase` for variables/functions, `PascalCase` for components/types, `UPPER_SNAKE_CASE` for constants
- **Rust**: `snake_case` for functions/variables, `PascalCase` for types/structs, `SCREAMING_SNAKE_CASE` for constants

### Documentation

- Add doc comments to public functions, structs, and components
- Keep comments concise and meaningful
- Update README.md for user-facing changes

## Testing

### Manual Testing Checklist

Before submitting a PR, verify:

- [ ] Application starts without errors
- [ ] Window appears and is draggable
- [ ] Settings panel opens and closes correctly
- [ ] Changes in settings apply in real-time
- [ ] Settings are saved and persist after restart
- [ ] Capture exclusion works in OBS/Zoom
- [ ] Keyboard shortcuts function correctly
- [ ] Click-through mode works and can be unlocked
- [ ] No errors in console output

### Test with Screen Capture

Test capture exclusion with:
- OBS Studio
- Zoom screen share
- Windows Snipping Tool
- Microsoft Teams (desktop app)

## Architecture

```
screenprompt/
├── screenprompt-tauri/
│   ├── src/               # React/TypeScript frontend
│   │   ├── components/    # UI components (overlay, settings, lock tip, etc.)
│   │   ├── hooks/         # React hooks (config, global shortcuts, updater)
│   │   └── utils/         # Update checker, "what's new" release notes
│   └── src-tauri/
│       └── src/           # Rust backend
│           ├── main.rs          # App entry point
│           ├── lib.rs           # Tauri app wiring and commands
│           ├── windows_api.rs   # Capture exclusion / click-through
│           ├── dialog.rs        # Native task dialog, excluded from capture
│           ├── keyboard_hook.rs # Esc to unlock while locked
│           └── mouse_hook.rs    # Ctrl+click unlock and scrolling while locked
├── readme.md              # User documentation
├── CONTRIBUTING.md        # This file
└── LICENSE                # MIT License
```

### How locked mode works

Locking makes the whole window click-through (`windows_api.rs`), so the overlay itself
receives no mouse input. Two low-level hooks, installed only while locked, handle the rest:

- `mouse_hook.rs`: a **Ctrl**+click on the lock icon unlocks; every other click passes
  through. A plain wheel over the overlay scrolls the notes (`TextEditor` listens for
  `locked-scroll`); with Ctrl, Shift or Alt held it passes through to the app behind.
  `BottomBar` reports the lock icon's position in physical pixels.
- `keyboard_hook.rs`: **Esc** anywhere unlocks. Windows doesn't run this hook for keys
  typed into ScreenPrompt's own window, so `App` also handles Esc while the overlay has
  focus.

Global shortcuts (`useGlobalHotkeys.ts`) are limited to what must work while locked or
unfocused; everything else is a plain keydown handler that only acts while the overlay
is focused, so common shortcuts keep working in other apps.

## Releasing

1. Bump the version in `package.json`, `package-lock.json` (2 places), `src-tauri/Cargo.toml`,
   `src-tauri/Cargo.lock` and `src-tauri/tauri.conf.json`.
2. Add the release's entry to `src/utils/whatsNew.ts`, keyed by the new version. Without one,
   updating users see no "what's new" dialog.
3. Build with `npm run tauri build` and upload `ScreenPrompt_<version>_x64-setup.exe` to the
   GitHub release. The in-app updater looks for an asset ending in `-setup.exe` on the latest
   release, so keep that name.

## License

By contributing to ScreenPrompt, you agree that your contributions are licensed under the
[MIT License](LICENSE), the same license that covers the project.

## Questions?

If you have questions, feel free to open an issue with the "question" label.

Thank you for contributing!
