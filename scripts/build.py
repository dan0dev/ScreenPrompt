"""
Build script for ScreenPrompt executable.

Usage:
    python scripts/build.py                # Build executable only
    python scripts/build.py --clean        # Clean build
    python scripts/build.py --onefile      # Single file (larger startup time)
    python scripts/build.py --installer    # Build PyInstaller + NSIS installer
    python scripts/build.py --nsis-only    # Build NSIS installer (requires existing build)

AV Mitigation:
    For reduced AV false positives, run scripts/setup_pyinstaller.py first
    to build a custom PyInstaller bootloader with a unique binary signature.
"""

import os
import sys
import shutil
import subprocess
import argparse

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CUSTOM_PYINSTALLER_PATH = os.path.join(PROJECT_ROOT, 'tools', 'pyinstaller-src')


def check_custom_pyinstaller():
    """Check if custom PyInstaller bootloader is installed."""
    try:
        import PyInstaller
        pyinstaller_path = PyInstaller.__path__[0]

        # Check if it's our custom build
        if 'pyinstaller-src' in pyinstaller_path or CUSTOM_PYINSTALLER_PATH in pyinstaller_path:
            print(f"Using custom PyInstaller from: {pyinstaller_path}")
            return True
        else:
            print(f"Warning: Using standard PyInstaller from: {pyinstaller_path}")
            print("For reduced AV false positives, run: python scripts/setup_pyinstaller.py")
            print("This will build a custom bootloader with a unique binary signature.\n")
            return False
    except ImportError:
        print("Error: PyInstaller not installed. Run: pip install pyinstaller")
        return False


def clean_build():
    """Remove build artifacts."""
    dirs_to_remove = ['build', 'dist', '__pycache__']
    files_to_remove = []

    for dir_name in dirs_to_remove:
        dir_path = os.path.join(PROJECT_ROOT, dir_name)
        if os.path.exists(dir_path):
            print(f"Removing {dir_path}...")
            shutil.rmtree(dir_path)

    # Clean __pycache__ in src
    src_cache = os.path.join(PROJECT_ROOT, 'src', '__pycache__')
    if os.path.exists(src_cache):
        print(f"Removing {src_cache}...")
        shutil.rmtree(src_cache)

    print("Clean complete.")


def build(onefile=False, noupx=False):
    """Build the executable."""
    os.chdir(PROJECT_ROOT)

    # Check PyInstaller installation
    check_custom_pyinstaller()

    # Ensure icon exists
    icon_path = os.path.join(PROJECT_ROOT, 'assets', 'icon.ico')
    if not os.path.exists(icon_path):
        print("Icon not found, generating...")
        subprocess.run([sys.executable, 'scripts/create_icon.py'], check=True)

    # Version info for EXE metadata
    version_info_path = os.path.join(PROJECT_ROOT, 'version_info.txt')

    # Build command
    if onefile:
        # One-file build (slower startup but single file)
        cmd = [
            sys.executable, '-m', 'PyInstaller',
            '--noconfirm',
            '--clean',
            '--windowed',
            '--onefile',
            '--name', 'ScreenPrompt',
            '--icon', icon_path,
            '--add-data', f'assets{os.pathsep}assets',
            '--hidden-import', 'keyboard',
        ]
        # Add version info if it exists
        if os.path.exists(version_info_path):
            cmd.extend(['--version-file', version_info_path])
        # Disable UPX for AV mitigation (default for onefile mode now)
        if noupx:
            cmd.append('--noupx')
        cmd.append('src/main.py')
    else:
        # Use spec file for one-dir build
        cmd = [
            sys.executable, '-m', 'PyInstaller',
            '--noconfirm',
            '--clean',
            'ScreenPrompt.spec'
        ]

    print(f"Running: {' '.join(cmd)}")
    result = subprocess.run(cmd)

    if result.returncode == 0:
        if onefile:
            exe_path = os.path.join(PROJECT_ROOT, 'dist', 'ScreenPrompt.exe')
        else:
            exe_path = os.path.join(PROJECT_ROOT, 'dist', 'ScreenPrompt', 'ScreenPrompt.exe')

        if os.path.exists(exe_path):
            size_mb = os.path.getsize(exe_path) / (1024 * 1024)
            print(f"\nBuild successful!")
            print(f"Executable: {exe_path}")
            print(f"Size: {size_mb:.1f} MB")
        else:
            print("\nBuild completed but executable not found at expected location.")
    else:
        print(f"\nBuild failed with return code {result.returncode}")
        sys.exit(1)


def check_nsis():
    """Check if NSIS is installed."""
    nsis_paths = [
        r"C:\Program Files (x86)\NSIS\makensis.exe",
        r"C:\Program Files\NSIS\makensis.exe",
    ]

    for path in nsis_paths:
        if os.path.exists(path):
            return path

    # Try to find in PATH
    try:
        result = subprocess.run(['where', 'makensis'],
                                capture_output=True, text=True)
        if result.returncode == 0:
            return result.stdout.strip().split('\n')[0]
    except Exception:
        pass

    return None


def get_python_arch():
    """Get the architecture of the current Python interpreter."""
    import struct
    return 'x64' if struct.calcsize('P') * 8 == 64 else 'x86'


def build_nsis_installer(arch=None):
    """Build NSIS installer."""
    os.chdir(PROJECT_ROOT)

    # Auto-detect architecture if not specified
    if arch is None:
        arch = get_python_arch()

    # Check if PyInstaller build exists
    dist_dir = os.path.join(PROJECT_ROOT, 'dist', 'ScreenPrompt')
    if not os.path.exists(dist_dir):
        print("Error: PyInstaller build not found.")
        print("Please run 'python scripts/build.py' first to build the executable.")
        sys.exit(1)

    # Check if NSIS is installed
    makensis = check_nsis()
    if not makensis:
        print("\nError: NSIS not found!")
        print("Please install NSIS from: https://nsis.sourceforge.io/Download")
        print("After installation, run this script again with --nsis-only")
        sys.exit(1)

    # Read version
    version_file = os.path.join(PROJECT_ROOT, 'version.txt')
    if os.path.exists(version_file):
        with open(version_file, 'r') as f:
            version = f.read().strip()
    else:
        version = "1.0.0"
        print(f"Warning: version.txt not found, using default version {version}")

    # Build installer
    nsi_script = os.path.join(PROJECT_ROOT, 'installer.nsi')
    if not os.path.exists(nsi_script):
        print(f"Error: NSIS script not found at {nsi_script}")
        sys.exit(1)

    print(f"\nBuilding NSIS installer using: {makensis}")
    print(f"Version: {version}")
    print(f"Architecture: {arch}")

    cmd = [makensis, '/V3', f'/DARCH={arch}', nsi_script]
    result = subprocess.run(cmd)

    if result.returncode == 0:
        installer_path = os.path.join(PROJECT_ROOT, 'dist', f'ScreenPrompt_{version}_{arch}-setup.exe')
        if os.path.exists(installer_path):
            size_mb = os.path.getsize(installer_path) / (1024 * 1024)
            print("\n" + "="*60)
            print("NSIS INSTALLER BUILD SUCCESSFUL!")
            print("="*60)
            print(f"Installer: {installer_path}")
            print(f"Size: {size_mb:.1f} MB")
            print(f"Architecture: {arch}")
            print("="*60)
        else:
            print("\nInstaller build completed but file not found at expected location.")
    else:
        print(f"\nNSIS build failed with return code {result.returncode}")
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description='Build ScreenPrompt executable')
    parser.add_argument('--clean', action='store_true', help='Clean build artifacts')
    parser.add_argument('--onefile', action='store_true', help='Build single executable')
    parser.add_argument('--noupx', action='store_true', help='Disable UPX compression (for AV mitigation in onefile mode)')
    parser.add_argument('--installer', action='store_true', help='Build executable + NSIS installer')
    parser.add_argument('--nsis-only', action='store_true', help='Build NSIS installer only (requires existing build)')
    parser.add_argument('--arch', choices=['x64', 'x86'], help='Target architecture (auto-detected from Python if not specified)')
    parser.add_argument('--check-pyinstaller', action='store_true', help='Check PyInstaller installation status')
    args = parser.parse_args()

    if args.check_pyinstaller:
        check_custom_pyinstaller()
        return

    # Auto-detect architecture from current Python
    arch = args.arch if args.arch else get_python_arch()
    print(f"Target architecture: {arch}")

    if args.clean:
        clean_build()
        if not (args.onefile or args.installer):
            return

    if args.nsis_only:
        build_nsis_installer(arch=arch)
        return

    build(onefile=args.onefile, noupx=args.noupx)

    if args.installer:
        print("\n" + "="*60)
        print("PyInstaller build complete, now building NSIS installer...")
        print("="*60 + "\n")
        build_nsis_installer(arch=arch)


if __name__ == '__main__':
    main()
