# -*- mode: python ; coding: utf-8 -*-

# AV Mitigation: Disable UPX compression to avoid heuristic triggers
# Custom bootloader should be built via scripts/setup_pyinstaller.py

a = Analysis(
    ['src/main.py'],
    pathex=['src'],  # Add src to path so local modules are found
    binaries=[],
    datas=[('assets', 'assets'), ('version.txt', '.')],
    hiddenimports=['keyboard', 'config_manager', 'settings_ui', 'updater'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='ScreenPrompt',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,  # Disabled to avoid AV heuristic triggers
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=['assets/icon.ico'],
    version='version_info.txt',  # EXE metadata for AV trust
)
coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,  # Disabled to avoid AV heuristic triggers
    upx_exclude=[],
    name='ScreenPrompt',
)
