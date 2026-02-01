# MIT License
#
# Copyright (c) 2026 ScreenPrompt Contributors
#
# Permission is hereby granted, free of charge, to any person obtaining a copy
# of this software and associated documentation files (the "Software"), to deal
# in the Software without restriction, including without limitation the rights
# to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
# copies of the Software, and to permit persons to whom the Software is
# furnished to do so, subject to the following conditions:
#
# The above copyright notice and this permission notice shall be included in all
# copies or substantial portions of the Software.
#
# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
# IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
# FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
# AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
# LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
# OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
# SOFTWARE.

"""
Unit tests for ScreenPrompt core functionality.

Run with: pytest test_core.py -v
"""

import json
import os
import sys
import tempfile
from pathlib import Path
from unittest import mock

import pytest


# =============================================================================
# ConfigManager Implementation (to be moved to main module later)
# =============================================================================

class ConfigManager:
    """Manages ScreenPrompt configuration storage and retrieval."""

    CONFIG_DIR = Path(os.environ.get('APPDATA', '')) / 'ScreenPrompt'
    CONFIG_FILE = CONFIG_DIR / 'config.json'

    @staticmethod
    def get_default_config() -> dict:
        """Return default configuration dictionary."""
        return {
            'opacity': 0.9,
            'font_size': 24,
            'font_family': 'Arial',
            'text_color': '#FFFFFF',
            'bg_color': '#000000',
            'window_x': 100,
            'window_y': 100,
            'window_width': 400,
            'window_height': 200,
            'first_run': True,
        }

    @classmethod
    def load_config(cls) -> dict:
        """Load configuration from file, returning defaults if missing."""
        default = cls.get_default_config()
        if not cls.CONFIG_FILE.exists():
            return default
        try:
            with open(cls.CONFIG_FILE, 'r', encoding='utf-8') as f:
                saved = json.load(f)
            # Merge with defaults to handle missing keys
            return {**default, **saved}
        except (json.JSONDecodeError, IOError):
            return default

    @classmethod
    def save_config(cls, config: dict) -> None:
        """Save configuration to file."""
        cls.CONFIG_DIR.mkdir(parents=True, exist_ok=True)
        with open(cls.CONFIG_FILE, 'w', encoding='utf-8') as f:
            json.dump(config, f, indent=2)


# =============================================================================
# WinAPI Constants and Functions
# =============================================================================

# Display affinity constants
WDA_EXCLUDEFROMCAPTURE = 0x11  # Windows 10 Build 2004+

# Window style constants for layered window fix
GWL_EXSTYLE = -20
WS_EX_LAYERED = 0x00080000
LWA_ALPHA = 0x02


def get_windows_build() -> int:
    """Get Windows build number. Returns 0 if not on Windows."""
    if sys.platform != 'win32':
        return 0
    try:
        import platform
        version = platform.version()
        # Windows version format: "10.0.19041" -> build 19041
        parts = version.split('.')
        if len(parts) >= 3:
            return int(parts[2])
    except (ValueError, IndexError):
        pass
    return 0


def is_capture_exclude_supported() -> bool:
    """Check if WDA_EXCLUDEFROMCAPTURE is supported (Win10 Build 2004+)."""
    # Windows 10 version 2004 = Build 19041
    return sys.platform == 'win32' and get_windows_build() >= 19041


def set_capture_exclude(hwnd: int) -> bool:
    """
    Set window to be excluded from screen capture.

    Uses the 3-step process to avoid black box issue:
    1. Add WS_EX_LAYERED style
    2. Apply SetLayeredWindowAttributes (NOT UpdateLayeredWindow)
    3. Apply SetWindowDisplayAffinity

    This is required because per-pixel transparency (UpdateLayeredWindow)
    is incompatible with SetWindowDisplayAffinity and causes a black box.

    Args:
        hwnd: Window handle

    Returns:
        True if successful, False otherwise
    """
    if not is_capture_exclude_supported():
        return False
    try:
        import ctypes
        from ctypes import c_void_p, c_int, c_uint, c_byte

        user32 = ctypes.windll.user32

        # Configure function signatures for 64-bit compatibility
        user32.GetWindowLongPtrW.argtypes = [c_void_p, c_int]
        user32.GetWindowLongPtrW.restype = c_void_p
        user32.SetWindowLongPtrW.argtypes = [c_void_p, c_int, c_void_p]
        user32.SetWindowLongPtrW.restype = c_void_p
        user32.SetLayeredWindowAttributes.argtypes = [c_void_p, c_uint, c_byte, c_uint]
        user32.SetLayeredWindowAttributes.restype = c_int
        user32.SetWindowDisplayAffinity.argtypes = [c_void_p, c_uint]
        user32.SetWindowDisplayAffinity.restype = c_int

        # Step 1: Add WS_EX_LAYERED style
        ex_style = user32.GetWindowLongPtrW(hwnd, GWL_EXSTYLE)
        user32.SetWindowLongPtrW(hwnd, GWL_EXSTYLE, ex_style | WS_EX_LAYERED)

        # Step 2: Use SetLayeredWindowAttributes (NOT UpdateLayeredWindow)
        # This makes window compatible with SetWindowDisplayAffinity
        user32.SetLayeredWindowAttributes(hwnd, 0, 255, LWA_ALPHA)

        # Step 3: NOW apply capture exclusion
        result = user32.SetWindowDisplayAffinity(hwnd, WDA_EXCLUDEFROMCAPTURE)
        return result != 0
    except (AttributeError, OSError):
        return False


def set_capture_exclude_simple(hwnd: int) -> bool:
    """
    Simple version of capture exclusion (may cause black box with some windows).

    DEPRECATED: Use set_capture_exclude() instead which handles layered windows.

    Args:
        hwnd: Window handle

    Returns:
        True if successful, False otherwise
    """
    if not is_capture_exclude_supported():
        return False
    try:
        import ctypes
        user32 = ctypes.windll.user32
        result = user32.SetWindowDisplayAffinity(hwnd, WDA_EXCLUDEFROMCAPTURE)
        return result != 0
    except (AttributeError, OSError):
        return False


# =============================================================================
# ConfigManager Tests
# =============================================================================

class TestConfigManager:
    """Tests for ConfigManager class."""

    def test_default_config_structure(self):
        """Verify default config has all required keys."""
        config = ConfigManager.get_default_config()

        required_keys = [
            'opacity',
            'font_size',
            'font_family',
            'text_color',
            'bg_color',
            'window_x',
            'window_y',
            'window_width',
            'window_height',
            'first_run',
        ]

        for key in required_keys:
            assert key in config, f"Missing required key: {key}"

    def test_default_config_values(self):
        """Verify default config values are sensible."""
        config = ConfigManager.get_default_config()

        # Opacity should be between 0.5 and 1.0 per CLAUDE.md
        assert 0.5 <= config['opacity'] <= 1.0

        # Font size should be positive
        assert config['font_size'] > 0

        # Colors should be valid hex
        assert config['text_color'].startswith('#')
        assert config['bg_color'].startswith('#')

        # Window dimensions should be positive
        assert config['window_width'] > 0
        assert config['window_height'] > 0

        # First run should be True by default
        assert config['first_run'] is True

    def test_save_and_load_config(self):
        """Roundtrip test: save config then load it back."""
        with tempfile.TemporaryDirectory() as tmpdir:
            # Temporarily override config paths
            original_dir = ConfigManager.CONFIG_DIR
            original_file = ConfigManager.CONFIG_FILE

            try:
                ConfigManager.CONFIG_DIR = Path(tmpdir)
                ConfigManager.CONFIG_FILE = Path(tmpdir) / 'config.json'

                test_config = {
                    'opacity': 0.75,
                    'font_size': 32,
                    'font_family': 'Consolas',
                    'text_color': '#00FF00',
                    'bg_color': '#333333',
                    'window_x': 200,
                    'window_y': 150,
                    'window_width': 500,
                    'window_height': 300,
                    'first_run': False,
                }

                ConfigManager.save_config(test_config)
                loaded = ConfigManager.load_config()

                assert loaded == test_config
            finally:
                ConfigManager.CONFIG_DIR = original_dir
                ConfigManager.CONFIG_FILE = original_file

    def test_load_missing_config_returns_default(self):
        """Loading non-existent config should return defaults."""
        with tempfile.TemporaryDirectory() as tmpdir:
            original_dir = ConfigManager.CONFIG_DIR
            original_file = ConfigManager.CONFIG_FILE

            try:
                ConfigManager.CONFIG_DIR = Path(tmpdir)
                ConfigManager.CONFIG_FILE = Path(tmpdir) / 'nonexistent.json'

                loaded = ConfigManager.load_config()
                default = ConfigManager.get_default_config()

                assert loaded == default
            finally:
                ConfigManager.CONFIG_DIR = original_dir
                ConfigManager.CONFIG_FILE = original_file

    def test_load_corrupt_config_returns_default(self):
        """Loading corrupted JSON should return defaults."""
        with tempfile.TemporaryDirectory() as tmpdir:
            original_dir = ConfigManager.CONFIG_DIR
            original_file = ConfigManager.CONFIG_FILE

            try:
                ConfigManager.CONFIG_DIR = Path(tmpdir)
                ConfigManager.CONFIG_FILE = Path(tmpdir) / 'config.json'

                # Write invalid JSON
                with open(ConfigManager.CONFIG_FILE, 'w') as f:
                    f.write('{ invalid json }')

                loaded = ConfigManager.load_config()
                default = ConfigManager.get_default_config()

                assert loaded == default
            finally:
                ConfigManager.CONFIG_DIR = original_dir
                ConfigManager.CONFIG_FILE = original_file

    def test_load_partial_config_merges_with_defaults(self):
        """Partial config should be merged with defaults."""
        with tempfile.TemporaryDirectory() as tmpdir:
            original_dir = ConfigManager.CONFIG_DIR
            original_file = ConfigManager.CONFIG_FILE

            try:
                ConfigManager.CONFIG_DIR = Path(tmpdir)
                ConfigManager.CONFIG_FILE = Path(tmpdir) / 'config.json'

                # Save only some keys
                partial_config = {'opacity': 0.6, 'font_size': 18}
                with open(ConfigManager.CONFIG_FILE, 'w') as f:
                    json.dump(partial_config, f)

                loaded = ConfigManager.load_config()

                # Should have the partial values
                assert loaded['opacity'] == 0.6
                assert loaded['font_size'] == 18

                # Should have defaults for missing keys
                default = ConfigManager.get_default_config()
                assert loaded['text_color'] == default['text_color']
                assert loaded['first_run'] == default['first_run']
            finally:
                ConfigManager.CONFIG_DIR = original_dir
                ConfigManager.CONFIG_FILE = original_file

    def test_config_path_uses_appdata(self):
        """Verify config directory uses %APPDATA%\\ScreenPrompt."""
        # Reset to get fresh path calculation
        appdata = os.environ.get('APPDATA', '')
        expected_dir = Path(appdata) / 'ScreenPrompt'

        # Note: We check the class attribute directly
        assert 'ScreenPrompt' in str(ConfigManager.CONFIG_DIR)
        if appdata:
            assert str(ConfigManager.CONFIG_DIR) == str(expected_dir)


# =============================================================================
# WinAPI Tests
# =============================================================================

class TestWinAPIConstants:
    """Tests for WinAPI constants and functions."""

    def test_wda_excludefromcapture_value(self):
        """Confirm WDA_EXCLUDEFROMCAPTURE is 0x11."""
        assert WDA_EXCLUDEFROMCAPTURE == 0x11
        assert WDA_EXCLUDEFROMCAPTURE == 17  # Decimal equivalent

    def test_layered_window_constants(self):
        """Confirm layered window constants for black box fix."""
        assert GWL_EXSTYLE == -20
        assert WS_EX_LAYERED == 0x00080000
        assert LWA_ALPHA == 0x02

    def test_windows_version_check_on_supported(self):
        """Test version check returns True for Build 19041+."""
        with mock.patch('sys.platform', 'win32'):
            with mock.patch('platform.version', return_value='10.0.19041'):
                assert is_capture_exclude_supported() is True

            with mock.patch('platform.version', return_value='10.0.22000'):
                assert is_capture_exclude_supported() is True

    def test_windows_version_check_on_unsupported(self):
        """Test version check returns False for older builds."""
        with mock.patch('sys.platform', 'win32'):
            with mock.patch('platform.version', return_value='10.0.18363'):
                assert is_capture_exclude_supported() is False

    def test_windows_version_check_non_windows(self):
        """Test version check returns False on non-Windows."""
        with mock.patch('sys.platform', 'linux'):
            assert is_capture_exclude_supported() is False

        with mock.patch('sys.platform', 'darwin'):
            assert is_capture_exclude_supported() is False

    def test_set_capture_exclude_uses_3_step_process(self):
        """Test that set_capture_exclude uses the 3-step layered window fix."""
        mock_user32 = mock.MagicMock()
        mock_user32.GetWindowLongPtrW.return_value = 0x100  # Some existing style
        mock_user32.SetWindowLongPtrW.return_value = 1
        mock_user32.SetLayeredWindowAttributes.return_value = 1
        mock_user32.SetWindowDisplayAffinity.return_value = 1  # Success

        with mock.patch('sys.platform', 'win32'):
            with mock.patch('platform.version', return_value='10.0.19041'):
                with mock.patch('ctypes.windll') as mock_windll:
                    mock_windll.user32 = mock_user32

                    test_hwnd = 12345
                    result = set_capture_exclude(test_hwnd)

                    # Step 1: Get existing extended style
                    mock_user32.GetWindowLongPtrW.assert_called_once_with(
                        test_hwnd, GWL_EXSTYLE
                    )

                    # Step 1b: Add WS_EX_LAYERED to existing style
                    mock_user32.SetWindowLongPtrW.assert_called_once_with(
                        test_hwnd, GWL_EXSTYLE, 0x100 | WS_EX_LAYERED
                    )

                    # Step 2: Apply SetLayeredWindowAttributes (NOT UpdateLayeredWindow)
                    mock_user32.SetLayeredWindowAttributes.assert_called_once_with(
                        test_hwnd, 0, 255, LWA_ALPHA
                    )

                    # Step 3: Apply capture exclusion
                    mock_user32.SetWindowDisplayAffinity.assert_called_once_with(
                        test_hwnd, WDA_EXCLUDEFROMCAPTURE
                    )

                    assert result is True

    def test_set_capture_exclude_call_order(self):
        """Test that the 3 steps are called in correct order."""
        call_order = []

        mock_user32 = mock.MagicMock()
        mock_user32.GetWindowLongPtrW.side_effect = lambda *args: (call_order.append('GetWindowLongPtrW'), 0)[1]
        mock_user32.SetWindowLongPtrW.side_effect = lambda *args: (call_order.append('SetWindowLongPtrW'), 1)[1]
        mock_user32.SetLayeredWindowAttributes.side_effect = lambda *args: (call_order.append('SetLayeredWindowAttributes'), 1)[1]
        mock_user32.SetWindowDisplayAffinity.side_effect = lambda *args: (call_order.append('SetWindowDisplayAffinity'), 1)[1]

        with mock.patch('sys.platform', 'win32'):
            with mock.patch('platform.version', return_value='10.0.19041'):
                with mock.patch('ctypes.windll') as mock_windll:
                    mock_windll.user32 = mock_user32

                    set_capture_exclude(12345)

                    # Verify order: get style -> set style -> layered attrs -> affinity
                    assert call_order == [
                        'GetWindowLongPtrW',
                        'SetWindowLongPtrW',
                        'SetLayeredWindowAttributes',
                        'SetWindowDisplayAffinity'
                    ]

    def test_set_capture_exclude_returns_false_on_affinity_failure(self):
        """Test that set_capture_exclude returns False when final API call fails."""
        mock_user32 = mock.MagicMock()
        mock_user32.GetWindowLongPtrW.return_value = 0
        mock_user32.SetWindowLongPtrW.return_value = 1
        mock_user32.SetLayeredWindowAttributes.return_value = 1
        mock_user32.SetWindowDisplayAffinity.return_value = 0  # Failure

        with mock.patch('sys.platform', 'win32'):
            with mock.patch('platform.version', return_value='10.0.19041'):
                with mock.patch('ctypes.windll') as mock_windll:
                    mock_windll.user32 = mock_user32

                    result = set_capture_exclude(12345)

                    assert result is False

    def test_set_capture_exclude_unsupported_os(self):
        """Test that set_capture_exclude returns False on unsupported OS."""
        with mock.patch('sys.platform', 'linux'):
            result = set_capture_exclude(12345)
            assert result is False

    def test_get_windows_build_parses_version(self):
        """Test Windows build number parsing."""
        with mock.patch('sys.platform', 'win32'):
            with mock.patch('platform.version', return_value='10.0.19041'):
                assert get_windows_build() == 19041

            with mock.patch('platform.version', return_value='10.0.22621'):
                assert get_windows_build() == 22621

    def test_get_windows_build_non_windows(self):
        """Test get_windows_build returns 0 on non-Windows."""
        with mock.patch('sys.platform', 'linux'):
            assert get_windows_build() == 0

    def test_set_capture_exclude_simple_deprecated(self):
        """Test that simple version still works (for backwards compatibility)."""
        mock_user32 = mock.MagicMock()
        mock_user32.SetWindowDisplayAffinity.return_value = 1

        with mock.patch('sys.platform', 'win32'):
            with mock.patch('platform.version', return_value='10.0.19041'):
                with mock.patch('ctypes.windll') as mock_windll:
                    mock_windll.user32 = mock_user32

                    result = set_capture_exclude_simple(12345)

                    # Simple version only calls SetWindowDisplayAffinity
                    mock_user32.SetWindowDisplayAffinity.assert_called_once_with(
                        12345, WDA_EXCLUDEFROMCAPTURE
                    )
                    assert result is True


# =============================================================================
# SettingsPanel Implementation (embedded panel to avoid browser black box)
# =============================================================================

class SettingsPanel:
    """
    Embedded settings panel for ScreenPrompt.

    Unlike a separate Toplevel window, this panel embeds inside the main
    overlay window. This avoids the browser black box issue where
    getDisplayMedia (Chrome/Edge) doesn't respect SetWindowDisplayAffinity
    for separate windows.

    Key difference from SettingsDialog:
    - SettingsPanel is a Frame, not a Toplevel
    - No separate capture exclusion needed (inherits from parent window)
    - Uses show()/hide() instead of creating/destroying windows
    """

    def __init__(self, parent=None):
        """
        Initialize settings panel.

        Args:
            parent: Parent widget to embed in (Frame, not Toplevel)
        """
        self.parent = parent
        self._visible = False

    def show(self) -> None:
        """Show the settings panel."""
        self._visible = True

    def hide(self) -> None:
        """Hide the settings panel."""
        self._visible = False

    def is_visible(self) -> bool:
        """Check if panel is currently visible."""
        return self._visible

    def toggle(self) -> None:
        """Toggle panel visibility."""
        if self._visible:
            self.hide()
        else:
            self.show()


class SettingsDialog:
    """
    DEPRECATED: Use SettingsPanel instead.

    Settings dialog window with capture exclusion support.
    This creates a separate Toplevel window which causes black box
    issues in browser-based screen share (Google Meet, etc.).

    When created, the dialog applies WDA_EXCLUDEFROMCAPTURE to hide
    itself from screen captures (Zoom, Teams, OBS, etc.).
    """

    def __init__(self, parent=None, hwnd: int = None):
        """
        Initialize settings dialog.

        Args:
            parent: Parent window (Tkinter root or Toplevel)
            hwnd: Window handle (for testing, normally obtained from winfo_id)
        """
        self.parent = parent
        self._hwnd = hwnd
        self._capture_excluded = False

    def get_hwnd(self) -> int:
        """Get the window handle for this dialog."""
        if self._hwnd is not None:
            return self._hwnd
        if self.parent is not None:
            # In real implementation: return self.dialog.winfo_id()
            return getattr(self.parent, 'winfo_id', lambda: 0)()
        return 0

    def apply_capture_exclusion(self) -> bool:
        """
        Apply capture exclusion to hide settings dialog from screen capture.

        Returns:
            True if successfully applied, False otherwise
        """
        hwnd = self.get_hwnd()
        if hwnd == 0:
            return False

        result = set_capture_exclude(hwnd)
        self._capture_excluded = result
        return result

    def is_capture_excluded(self) -> bool:
        """Check if capture exclusion is currently applied."""
        return self._capture_excluded


def create_settings_dialog_with_exclusion(parent=None, hwnd: int = None) -> SettingsDialog:
    """
    DEPRECATED: Use SettingsPanel instead.

    Factory function to create a settings dialog with capture exclusion applied.

    This is the recommended way to create settings dialogs as it ensures
    capture exclusion is applied immediately after creation.

    Args:
        parent: Parent window
        hwnd: Window handle (for testing)

    Returns:
        SettingsDialog instance with capture exclusion applied
    """
    dialog = SettingsDialog(parent=parent, hwnd=hwnd)
    dialog.apply_capture_exclusion()
    return dialog


# =============================================================================
# SettingsPanel Tests (Embedded Panel - Browser Fix)
# =============================================================================

class TestSettingsPanel:
    """Tests for SettingsPanel embedded panel functionality."""

    def test_settings_panel_is_not_toplevel(self):
        """Verify SettingsPanel is a Frame concept, not a Toplevel window."""
        # SettingsPanel should not have hwnd management (inherits from parent)
        panel = SettingsPanel()
        assert not hasattr(panel, '_hwnd') or panel._hwnd is None if hasattr(panel, '_hwnd') else True
        assert not hasattr(panel, 'get_hwnd')

    def test_settings_panel_visibility_toggle(self):
        """Test SettingsPanel show/hide functionality."""
        panel = SettingsPanel()

        # Initially hidden
        assert panel.is_visible() is False

        # Show
        panel.show()
        assert panel.is_visible() is True

        # Hide
        panel.hide()
        assert panel.is_visible() is False

    def test_settings_panel_toggle_method(self):
        """Test SettingsPanel toggle method."""
        panel = SettingsPanel()

        # Toggle from hidden to visible
        panel.toggle()
        assert panel.is_visible() is True

        # Toggle from visible to hidden
        panel.toggle()
        assert panel.is_visible() is False

    def test_settings_panel_no_capture_exclusion_call(self):
        """Verify SettingsPanel doesn't call SetWindowDisplayAffinity directly."""
        # SettingsPanel inherits capture exclusion from parent window
        # It should NOT have apply_capture_exclusion method
        panel = SettingsPanel()
        assert not hasattr(panel, 'apply_capture_exclusion')

    def test_settings_panel_inherits_parent_exclusion(self):
        """Conceptual test: panel inherits capture exclusion from parent."""
        # When embedded in main overlay, the panel is part of the same HWND
        # Only one SetWindowDisplayAffinity call is needed (on parent)
        # This test verifies the design principle
        panel = SettingsPanel(parent="mock_parent_frame")
        assert panel.parent == "mock_parent_frame"
        # No separate exclusion tracking needed
        assert not hasattr(panel, '_capture_excluded')


# =============================================================================
# SettingsDialog Tests (Legacy - Separate Window)
# =============================================================================

def _create_mock_user32_success():
    """Helper to create a mock user32 with all 3-step calls succeeding."""
    mock_user32 = mock.MagicMock()
    mock_user32.GetWindowLongPtrW.return_value = 0
    mock_user32.SetWindowLongPtrW.return_value = 1
    mock_user32.SetLayeredWindowAttributes.return_value = 1
    mock_user32.SetWindowDisplayAffinity.return_value = 1
    return mock_user32


class TestSettingsDialogCaptureExclusion:
    """Tests for SettingsDialog capture exclusion functionality."""

    def test_settings_dialog_applies_capture_exclusion(self):
        """Test that SettingsDialog applies 3-step capture exclusion."""
        mock_user32 = _create_mock_user32_success()

        with mock.patch('sys.platform', 'win32'):
            with mock.patch('platform.version', return_value='10.0.19041'):
                with mock.patch('ctypes.windll') as mock_windll:
                    mock_windll.user32 = mock_user32

                    test_hwnd = 98765
                    dialog = SettingsDialog(hwnd=test_hwnd)
                    result = dialog.apply_capture_exclusion()

                    # Verify all 3 steps were called
                    mock_user32.GetWindowLongPtrW.assert_called_once()
                    mock_user32.SetWindowLongPtrW.assert_called_once()
                    mock_user32.SetLayeredWindowAttributes.assert_called_once()
                    mock_user32.SetWindowDisplayAffinity.assert_called_once_with(
                        test_hwnd, WDA_EXCLUDEFROMCAPTURE
                    )
                    assert result is True
                    assert dialog.is_capture_excluded() is True

    def test_settings_dialog_tracks_exclusion_state(self):
        """Test that SettingsDialog tracks whether exclusion was applied."""
        mock_user32 = _create_mock_user32_success()

        with mock.patch('sys.platform', 'win32'):
            with mock.patch('platform.version', return_value='10.0.19041'):
                with mock.patch('ctypes.windll') as mock_windll:
                    mock_windll.user32 = mock_user32

                    dialog = SettingsDialog(hwnd=12345)

                    # Before applying
                    assert dialog.is_capture_excluded() is False

                    # After applying
                    dialog.apply_capture_exclusion()
                    assert dialog.is_capture_excluded() is True

    def test_settings_dialog_handles_api_failure(self):
        """Test that SettingsDialog handles WinAPI failure gracefully."""
        mock_user32 = _create_mock_user32_success()
        mock_user32.SetWindowDisplayAffinity.return_value = 0  # Final step fails

        with mock.patch('sys.platform', 'win32'):
            with mock.patch('platform.version', return_value='10.0.19041'):
                with mock.patch('ctypes.windll') as mock_windll:
                    mock_windll.user32 = mock_user32

                    dialog = SettingsDialog(hwnd=12345)
                    result = dialog.apply_capture_exclusion()

                    assert result is False
                    assert dialog.is_capture_excluded() is False

    def test_settings_dialog_handles_unsupported_os(self):
        """Test that SettingsDialog handles unsupported OS gracefully."""
        with mock.patch('sys.platform', 'linux'):
            dialog = SettingsDialog(hwnd=12345)
            result = dialog.apply_capture_exclusion()

            assert result is False
            assert dialog.is_capture_excluded() is False

    def test_settings_dialog_handles_zero_hwnd(self):
        """Test that SettingsDialog handles zero/invalid hwnd."""
        dialog = SettingsDialog(hwnd=0)
        result = dialog.apply_capture_exclusion()

        assert result is False
        assert dialog.is_capture_excluded() is False

    def test_settings_dialog_handles_no_hwnd(self):
        """Test that SettingsDialog handles missing hwnd (no parent)."""
        dialog = SettingsDialog()  # No hwnd, no parent
        result = dialog.apply_capture_exclusion()

        assert result is False
        assert dialog.is_capture_excluded() is False

    def test_factory_function_applies_exclusion(self):
        """Test that create_settings_dialog_with_exclusion applies exclusion."""
        mock_user32 = _create_mock_user32_success()

        with mock.patch('sys.platform', 'win32'):
            with mock.patch('platform.version', return_value='10.0.19041'):
                with mock.patch('ctypes.windll') as mock_windll:
                    mock_windll.user32 = mock_user32

                    dialog = create_settings_dialog_with_exclusion(hwnd=55555)

                    mock_user32.SetWindowDisplayAffinity.assert_called_once_with(
                        55555, WDA_EXCLUDEFROMCAPTURE
                    )
                    assert dialog.is_capture_excluded() is True

    def test_multiple_dialogs_independent_exclusion(self):
        """Test that multiple dialogs have independent exclusion state."""
        mock_user32 = _create_mock_user32_success()
        # First call succeeds, second fails
        mock_user32.SetWindowDisplayAffinity.side_effect = [1, 0]

        with mock.patch('sys.platform', 'win32'):
            with mock.patch('platform.version', return_value='10.0.19041'):
                with mock.patch('ctypes.windll') as mock_windll:
                    mock_windll.user32 = mock_user32

                    dialog1 = SettingsDialog(hwnd=11111)
                    dialog2 = SettingsDialog(hwnd=22222)

                    result1 = dialog1.apply_capture_exclusion()
                    result2 = dialog2.apply_capture_exclusion()

                    assert result1 is True
                    assert result2 is False
                    assert dialog1.is_capture_excluded() is True
                    assert dialog2.is_capture_excluded() is False

    def test_settings_dialog_no_black_box_uses_layered_attrs(self):
        """Test that dialog uses SetLayeredWindowAttributes to avoid black box."""
        mock_user32 = _create_mock_user32_success()
        mock_user32.GetWindowLongPtrW.return_value = 0x200  # Some existing style

        with mock.patch('sys.platform', 'win32'):
            with mock.patch('platform.version', return_value='10.0.19041'):
                with mock.patch('ctypes.windll') as mock_windll:
                    mock_windll.user32 = mock_user32

                    test_hwnd = 77777
                    dialog = SettingsDialog(hwnd=test_hwnd)
                    dialog.apply_capture_exclusion()

                    # Verify SetLayeredWindowAttributes was called (key to black box fix)
                    mock_user32.SetLayeredWindowAttributes.assert_called_once_with(
                        test_hwnd, 0, 255, LWA_ALPHA
                    )

                    # Verify WS_EX_LAYERED was added to existing style
                    mock_user32.SetWindowLongPtrW.assert_called_once_with(
                        test_hwnd, GWL_EXSTYLE, 0x200 | WS_EX_LAYERED
                    )


# =============================================================================
# Main
# =============================================================================

if __name__ == '__main__':
    pytest.main([__file__, '-v'])
