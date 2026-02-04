"""
Setup script to build custom PyInstaller bootloader.

This script automates the process of:
1. Cloning PyInstaller source code
2. Building the bootloader from source
3. Installing the custom PyInstaller

Why? PyInstaller's pre-built bootloader shares binary signatures with known malware,
causing AV false positives (especially SecureAge and Trapmine). Building from source
creates a unique binary signature.

Prerequisites:
- Visual Studio Build Tools (2022 or newer) with C++ workload
- Windows 10/11 SDK
- Python 3.10+

Usage:
    python scripts/setup_pyinstaller.py              # Full setup
    python scripts/setup_pyinstaller.py --check      # Check if custom bootloader is installed
    python scripts/setup_pyinstaller.py --clean      # Remove and reinstall

See BUILD.md for detailed instructions.
"""

import os
import sys
import shutil
import subprocess
import argparse

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOOLS_DIR = os.path.join(PROJECT_ROOT, 'tools')
PYINSTALLER_SRC = os.path.join(TOOLS_DIR, 'pyinstaller-src')
PYINSTALLER_VERSION = 'v6.18.0'


def find_vcvars():
    """Find Visual Studio vcvars64.bat for setting up build environment."""
    # Check multiple VS versions (newest first)
    # Note: VS 2026 uses folder "18", VS 2025 uses "17.x" patterns
    vs_versions = ['18', '2026', '2025', '2024', '2022']
    editions = ['BuildTools', 'Enterprise', 'Professional', 'Community']
    program_files = [r'C:\Program Files', r'C:\Program Files (x86)']

    for version in vs_versions:
        for edition in editions:
            for pf in program_files:
                path = rf"{pf}\Microsoft Visual Studio\{version}\{edition}\VC\Auxiliary\Build\vcvars64.bat"
                if os.path.exists(path):
                    return path

    return None


def check_prerequisites():
    """Check if all prerequisites are installed."""
    print("Checking prerequisites...")

    # Check Python version
    if sys.version_info < (3, 10):
        print(f"Error: Python 3.10+ required, found {sys.version}")
        return False

    # Check for git
    try:
        result = subprocess.run(['git', '--version'], capture_output=True, text=True)
        if result.returncode != 0:
            print("Error: git not found. Please install git.")
            return False
        print(f"  Git: {result.stdout.strip()}")
    except FileNotFoundError:
        print("Error: git not found. Please install git.")
        return False

    # Check for Visual Studio Build Tools
    vcvars = find_vcvars()
    if not vcvars:
        print("\nError: Visual Studio Build Tools not found!")
        print("\nTo install:")
        print("  Option A: winget install Microsoft.VisualStudio.2022.BuildTools")
        print("            (then add C++ workload via Visual Studio Installer)")
        print("  Option B: Download from https://visualstudio.microsoft.com/downloads/")
        print("            Select 'Desktop development with C++' workload")
        print("\nRequired components:")
        print("  - MSVC C++ x64/x86 build tools")
        print("  - Windows 10/11 SDK")
        return False
    print(f"  Visual Studio: {vcvars}")

    print("Prerequisites OK\n")
    return True


def clone_pyinstaller(force=False):
    """Clone PyInstaller source code."""
    if os.path.exists(PYINSTALLER_SRC):
        print(f"PyInstaller source already exists at {PYINSTALLER_SRC}")
        if force:
            response = 'y'
        else:
            try:
                response = input("Remove and re-clone? [y/N]: ").strip().lower()
            except EOFError:
                response = 'n'
        if response == 'y':
            print("Removing existing source...")
            shutil.rmtree(PYINSTALLER_SRC)
        else:
            print("Using existing source.")
            return True

    print(f"Creating tools directory...")
    os.makedirs(TOOLS_DIR, exist_ok=True)

    print(f"Cloning PyInstaller {PYINSTALLER_VERSION}...")
    cmd = [
        'git', 'clone',
        '--depth', '1',
        '--branch', PYINSTALLER_VERSION,
        'https://github.com/pyinstaller/pyinstaller.git',
        PYINSTALLER_SRC
    ]
    result = subprocess.run(cmd)
    if result.returncode != 0:
        print("Error: Failed to clone PyInstaller")
        return False

    print("Clone successful.\n")
    return True


def build_bootloader():
    """Build the PyInstaller bootloader from source."""
    vcvars = find_vcvars()
    if not vcvars:
        print("Error: Visual Studio Build Tools not found")
        return False

    bootloader_dir = os.path.join(PYINSTALLER_SRC, 'bootloader')
    if not os.path.exists(bootloader_dir):
        print(f"Error: Bootloader directory not found at {bootloader_dir}")
        return False

    print("Building bootloader...")
    print(f"  Directory: {bootloader_dir}")
    print(f"  Using: {vcvars}")

    # Create a batch script that sets up environment and runs waf
    build_script = os.path.join(TOOLS_DIR, '_build_bootloader.bat')
    with open(build_script, 'w') as f:
        f.write(f'@echo off\n')
        f.write(f'call "{vcvars}"\n')
        f.write(f'cd /d "{bootloader_dir}"\n')
        f.write(f'"{sys.executable}" waf distclean\n')
        # Use --target-arch to explicitly set pointer size (avoids detection issues)
        f.write(f'"{sys.executable}" waf configure --target-arch=64bit\n')
        f.write(f'"{sys.executable}" waf all\n')

    try:
        result = subprocess.run(['cmd', '/c', build_script], cwd=bootloader_dir)
        # Don't rely on return code - waf has logging issues that cause non-zero exit
    finally:
        # Clean up temp script
        if os.path.exists(build_script):
            os.remove(build_script)

    # Verify bootloader was built by checking for actual files
    bootloader_exe = os.path.join(PYINSTALLER_SRC, 'PyInstaller', 'bootloader', 'Windows-64bit-intel', 'runw.exe')
    if not os.path.exists(bootloader_exe):
        print(f"\nError: Built bootloader not found at {bootloader_exe}")
        print("Make sure Visual Studio Build Tools are properly installed.")
        return False

    print("\nBootloader built successfully!")
    print(f"  Location: {bootloader_exe}")

    # Print hash for verification
    try:
        import hashlib
        with open(bootloader_exe, 'rb') as f:
            sha256 = hashlib.sha256(f.read()).hexdigest()
        print(f"  SHA256: {sha256}")
    except Exception:
        pass

    return True


def install_custom_pyinstaller():
    """Install the custom-built PyInstaller."""
    print("\nInstalling custom PyInstaller...")

    # Uninstall existing PyInstaller
    print("  Uninstalling existing PyInstaller...")
    subprocess.run([sys.executable, '-m', 'pip', 'uninstall', 'pyinstaller', '-y'],
                   capture_output=True)

    # Install from source
    print("  Installing from source...")
    result = subprocess.run(
        [sys.executable, '-m', 'pip', 'install', PYINSTALLER_SRC],
        capture_output=True,
        text=True
    )

    if result.returncode != 0:
        print(f"Error: Installation failed")
        print(result.stderr)
        return False

    # Verify installation
    try:
        import importlib
        import PyInstaller
        importlib.reload(PyInstaller)
        pyinstaller_path = PyInstaller.__path__[0]
        print(f"\nCustom PyInstaller installed successfully!")
        print(f"  Path: {pyinstaller_path}")
        return True
    except ImportError as e:
        print(f"Error: Could not import PyInstaller after installation: {e}")
        return False


def check_installation():
    """Check if custom PyInstaller is installed."""
    try:
        import PyInstaller
        pyinstaller_path = PyInstaller.__path__[0]
        version = PyInstaller.__version__

        print(f"PyInstaller version: {version}")
        print(f"Installation path: {pyinstaller_path}")

        if 'pyinstaller-src' in pyinstaller_path.lower():
            print("\nStatus: Custom bootloader is installed")

            # Check bootloader hash
            bootloader_exe = os.path.join(pyinstaller_path, 'bootloader', 'Windows-64bit-intel', 'runw.exe')
            if os.path.exists(bootloader_exe):
                import hashlib
                with open(bootloader_exe, 'rb') as f:
                    sha256 = hashlib.sha256(f.read()).hexdigest()
                print(f"Bootloader SHA256: {sha256}")
            return True
        else:
            print("\nStatus: Standard PyInstaller is installed (not custom bootloader)")
            print("Run 'python scripts/setup_pyinstaller.py' to build custom bootloader")
            return False

    except ImportError:
        print("PyInstaller is not installed")
        return False


def clean_and_reinstall():
    """Remove custom PyInstaller and reinstall from PyPI."""
    print("Cleaning custom PyInstaller installation...")

    # Uninstall
    subprocess.run([sys.executable, '-m', 'pip', 'uninstall', 'pyinstaller', '-y'])

    # Remove source
    if os.path.exists(PYINSTALLER_SRC):
        print(f"Removing {PYINSTALLER_SRC}...")
        shutil.rmtree(PYINSTALLER_SRC)

    # Reinstall from PyPI
    print("Installing PyInstaller from PyPI...")
    subprocess.run([sys.executable, '-m', 'pip', 'install', 'pyinstaller'])

    print("Done. Standard PyInstaller reinstalled.")


def main():
    parser = argparse.ArgumentParser(
        description='Setup custom PyInstaller bootloader for AV mitigation'
    )
    parser.add_argument('--check', action='store_true',
                        help='Check if custom bootloader is installed')
    parser.add_argument('--clean', action='store_true',
                        help='Remove custom PyInstaller and reinstall from PyPI')
    parser.add_argument('--skip-prerequisites', action='store_true',
                        help='Skip prerequisite checks (for CI/automation)')
    args = parser.parse_args()

    if args.check:
        check_installation()
        return

    if args.clean:
        clean_and_reinstall()
        return

    print("=" * 60)
    print("PyInstaller Custom Bootloader Setup")
    print("=" * 60)
    print()
    print("This will build PyInstaller from source to create a unique")
    print("binary signature, reducing AV false positives.")
    print()

    # Check prerequisites
    if not args.skip_prerequisites:
        if not check_prerequisites():
            sys.exit(1)

    # Clone
    if not clone_pyinstaller():
        sys.exit(1)

    # Build
    if not build_bootloader():
        sys.exit(1)

    # Install
    if not install_custom_pyinstaller():
        sys.exit(1)

    print()
    print("=" * 60)
    print("SETUP COMPLETE")
    print("=" * 60)
    print()
    print("Custom PyInstaller is now installed. To build ScreenPrompt:")
    print("  python scripts/build.py --clean")
    print()
    print("To verify the installation:")
    print("  python scripts/setup_pyinstaller.py --check")
    print()


if __name__ == '__main__':
    main()
