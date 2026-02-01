"""
Build script for ScreenPrompt executable.

Usage:
    python scripts/build.py
    python scripts/build.py --clean    # Clean build
    python scripts/build.py --onefile  # Single file (larger startup time)
"""

import os
import sys
import shutil
import subprocess
import argparse

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


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


def build(onefile=False):
    """Build the executable."""
    os.chdir(PROJECT_ROOT)

    # Ensure icon exists
    icon_path = os.path.join(PROJECT_ROOT, 'assets', 'icon.ico')
    if not os.path.exists(icon_path):
        print("Icon not found, generating...")
        subprocess.run([sys.executable, 'scripts/create_icon.py'], check=True)

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
            'src/main.py'
        ]
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


def main():
    parser = argparse.ArgumentParser(description='Build ScreenPrompt executable')
    parser.add_argument('--clean', action='store_true', help='Clean build artifacts')
    parser.add_argument('--onefile', action='store_true', help='Build single executable')
    args = parser.parse_args()

    if args.clean:
        clean_build()
        if not args.onefile:
            return

    build(onefile=args.onefile)


if __name__ == '__main__':
    main()
