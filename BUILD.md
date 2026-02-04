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

### Optional (for AV false positive mitigation)
- [Visual Studio Build Tools](https://visualstudio.microsoft.com/downloads/) (2022 or newer)
  - Required to build custom PyInstaller bootloader
  - See [AV False Positive Mitigation](#av-false-positive-mitigation) section below

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

---

## AV False Positive Mitigation

Some antivirus engines (notably SecureAge and Trapmine) may flag ScreenPrompt as malicious.
This is a **false positive** caused by PyInstaller's pre-built bootloader sharing binary
signatures with known malware samples.

### Solution: Custom Bootloader

Building PyInstaller's bootloader from source creates a unique binary signature that
won't match known malware hashes.

#### One-Time Setup

**Step 1: Install Visual Studio Build Tools**

```powershell
# Option A: Via winget
winget install Microsoft.VisualStudio.2022.BuildTools

# Then open Visual Studio Installer and add "Desktop development with C++" workload
```

Or download manually from https://visualstudio.microsoft.com/downloads/

**Required components:**
- MSVC C++ x64/x86 build tools
- Windows 10/11 SDK

**Step 2: Build and Install Custom PyInstaller**

```powershell
python scripts/setup_pyinstaller.py
```

This will:
1. Clone PyInstaller v6.18.0 source to `tools/pyinstaller-src/`
2. Build the bootloader using Visual Studio
3. Install the custom PyInstaller

**Step 3: Verify Installation**

```powershell
python scripts/setup_pyinstaller.py --check
# Should show: "Status: Custom bootloader is installed"
```

#### Building with Custom Bootloader

Once set up, regular builds will automatically use the custom bootloader:

```bash
python scripts/build.py --clean
python scripts/build.py --installer
```

The build script will display a message confirming custom PyInstaller is in use.

### Additional Mitigations Applied

The build configuration includes several AV-friendly settings:

1. **UPX Compression Disabled** - UPX-compressed executables are a common heuristic trigger
2. **Version Info Resource** - `version_info.txt` embeds proper metadata (company, description, etc.)
3. **Unique Bootloader** - Custom-built bootloader has unique binary signature

### Submitting False Positive Reports

If AV engines still flag the executable:

| AV Engine | Contact |
|-----------|---------|
| SecureAge | https://www.secureage.com/support or support@secureage.com |
| Trapmine | fp@trapmine.com |

Include in your report:
- SHA256 hash of the flagged file
- VirusTotal link
- GitHub repository URL (https://github.com/dan0dev/ScreenPrompt)
- MIT license information
- Explanation that this is an open-source screen capture tool

### Verification Checklist

After building with custom bootloader:

- [ ] Run `python scripts/setup_pyinstaller.py --check` - confirms custom install
- [ ] Run `python scripts/build.py --check-pyinstaller` - confirms build uses custom
- [ ] Upload to VirusTotal and compare detection count with previous build
- [ ] Test all functionality: hotkeys, screen capture, settings
