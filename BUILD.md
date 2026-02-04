# ScreenPrompt Build Instructions

## Prerequisites

### Required
- Python 3.10 or higher
- PyInstaller: `pip install pyinstaller`
- Icon generation: PIL/Pillow (if generating icon)

### Optional (for NSIS installer)
- [NSIS 3.0+](https://nsis.sourceforge.io/Download)
  - Download and install from official website
  - Installer will automatically detect NSIS in common locations

## Build Commands

### Basic Executable Build
```bash
# Build to dist/ScreenPrompt/ directory (faster startup)
python scripts/build.py

# Clean build
python scripts/build.py --clean

# Single file executable (slower startup, but portable)
python scripts/build.py --onefile
```

### NSIS Installer Build
```bash
# Build both executable and NSIS installer
python scripts/build.py --installer

# Build only NSIS installer (requires existing PyInstaller build)
python scripts/build.py --nsis-only
```

## Output Files

### PyInstaller Only
- **Directory mode**: `dist/ScreenPrompt/ScreenPrompt.exe` + dependencies
- **One-file mode**: `dist/ScreenPrompt.exe` (single portable file)

### NSIS Installer
- `dist/ScreenPrompt-{version}-Setup.exe`
  - Professional Windows installer
  - Includes uninstaller
  - Creates Start Menu shortcuts
  - Optional desktop shortcut
  - Registers in Add/Remove Programs

## Version Management

Edit `version.txt` in the project root to change the version number:
```
1.0.0
```

The NSIS installer will automatically use this version for:
- Installer filename (`ScreenPrompt-1.0.0-Setup.exe`)
- Program name in installer UI
- Version info in Add/Remove Programs

## NSIS Installer Features

- **Compression**: LZMA solid compression for smallest size
- **Version checking**: Detects existing installation
- **Uninstaller**: Full uninstall support
- **Registry integration**: Properly registered in Windows
- **Shortcuts**: Start Menu + optional Desktop shortcut
- **Settings preservation**: User config in `%APPDATA%\ScreenPrompt` preserved on uninstall

## Troubleshooting

### NSIS not found
If you get "NSIS not found" error:
1. Download from https://nsis.sourceforge.io/Download
2. Install to default location (`C:\Program Files (x86)\NSIS\`)
3. Or add NSIS to your PATH
4. Run `python scripts/build.py --nsis-only` again

### Icon missing
If icon is missing:
```bash
python scripts/create_icon.py
```

### Clean build
Remove all build artifacts:
```bash
python scripts/build.py --clean
```

## Build Pipeline Example

```bash
# Full clean release build with installer
python scripts/build.py --clean
python scripts/build.py --installer

# Result: dist/ScreenPrompt-1.0.0-Setup.exe
```

## Distribution

The NSIS installer (`ScreenPrompt-{version}-Setup.exe`) is the recommended distribution format:
- Professional appearance
- Easy installation/uninstallation
- Familiar to Windows users
- Smaller download size (LZMA compression)
- No manual setup required
