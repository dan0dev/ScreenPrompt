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

Run with: pytest tests/test_core.py -v
"""

import json
import os
import sys
import tempfile
from pathlib import Path
from unittest import mock

import pytest

# Add src to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from config_manager import (
    DEFAULT_CONFIG,
    CONFIG_DIR,
    CONFIG_FILE,
    load_config,
    save_config,
    is_first_run,
    mark_first_run_complete,
)


# =============================================================================
# WinAPI Constants and Functions
# =============================================================================

WDA_EXCLUDEFROMCAPTURE = 0x11  # Windows 10 Build 2004+


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
    return sys.platform == 'win32' and get_windows_build() >= 19041


def set_capture_exclude(hwnd: int) -> bool:
    """
    Set window to be excluded from screen capture.

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
    """Tests for config_manager module."""

    def test_default_config_structure(self):
        """Verify default config has all required keys."""
        required_keys = [
            'x', 'y', 'width', 'height',
            'opacity', 'font_family', 'font_size', 'font_color', 'bg_color',
            'text', 'first_run_shown',
        ]

        for key in required_keys:
            assert key in DEFAULT_CONFIG, f"Missing required key: {key}"

    def test_default_config_values(self):
        """Verify default config values are sensible."""
        # Opacity should be between 0.5 and 1.0 per CLAUDE.md
        assert 0.5 <= DEFAULT_CONFIG['opacity'] <= 1.0

        # Font size should be positive
        assert DEFAULT_CONFIG['font_size'] > 0

        # Colors should be valid hex
        assert DEFAULT_CONFIG['font_color'].startswith('#')
        assert DEFAULT_CONFIG['bg_color'].startswith('#')

        # Window dimensions should be positive
        assert DEFAULT_CONFIG['width'] > 0
        assert DEFAULT_CONFIG['height'] > 0

        # first_run_shown should be False by default
        assert DEFAULT_CONFIG['first_run_shown'] is False

    def test_save_and_load_config(self):
        """Roundtrip test: save config then load it back."""
        import config_manager

        with tempfile.TemporaryDirectory() as tmpdir:
            # Temporarily override config paths
            original_dir = config_manager.CONFIG_DIR
            original_file = config_manager.CONFIG_FILE

            try:
                config_manager.CONFIG_DIR = Path(tmpdir)
                config_manager.CONFIG_FILE = Path(tmpdir) / 'config.json'

                test_config = {
                    'x': 200,
                    'y': 150,
                    'width': 500,
                    'height': 300,
                    'opacity': 0.75,
                    'font_family': 'Arial',
                    'font_size': 14,
                    'font_color': '#00FF00',
                    'bg_color': '#333333',
                    'text': 'Test text',
                    'first_run_shown': True,
                }

                save_config(test_config)
                loaded = load_config()

                assert loaded == test_config
            finally:
                config_manager.CONFIG_DIR = original_dir
                config_manager.CONFIG_FILE = original_file

    def test_load_missing_config_returns_default(self):
        """Loading non-existent config should return defaults."""
        import config_manager

        with tempfile.TemporaryDirectory() as tmpdir:
            original_dir = config_manager.CONFIG_DIR
            original_file = config_manager.CONFIG_FILE

            try:
                config_manager.CONFIG_DIR = Path(tmpdir)
                config_manager.CONFIG_FILE = Path(tmpdir) / 'nonexistent.json'

                loaded = load_config()

                assert loaded == DEFAULT_CONFIG
            finally:
                config_manager.CONFIG_DIR = original_dir
                config_manager.CONFIG_FILE = original_file

    def test_load_corrupt_config_returns_default(self):
        """Loading corrupted JSON should return defaults."""
        import config_manager

        with tempfile.TemporaryDirectory() as tmpdir:
            original_dir = config_manager.CONFIG_DIR
            original_file = config_manager.CONFIG_FILE

            try:
                config_manager.CONFIG_DIR = Path(tmpdir)
                config_manager.CONFIG_FILE = Path(tmpdir) / 'config.json'

                # Write invalid JSON
                with open(config_manager.CONFIG_FILE, 'w') as f:
                    f.write('{ invalid json }')

                loaded = load_config()

                assert loaded == DEFAULT_CONFIG
            finally:
                config_manager.CONFIG_DIR = original_dir
                config_manager.CONFIG_FILE = original_file

    def test_load_partial_config_merges_with_defaults(self):
        """Partial config should be merged with defaults."""
        import config_manager

        with tempfile.TemporaryDirectory() as tmpdir:
            original_dir = config_manager.CONFIG_DIR
            original_file = config_manager.CONFIG_FILE

            try:
                config_manager.CONFIG_DIR = Path(tmpdir)
                config_manager.CONFIG_FILE = Path(tmpdir) / 'config.json'

                # Save only some keys
                partial_config = {'opacity': 0.6, 'font_size': 18}
                with open(config_manager.CONFIG_FILE, 'w') as f:
                    json.dump(partial_config, f)

                loaded = load_config()

                # Should have the partial values
                assert loaded['opacity'] == 0.6
                assert loaded['font_size'] == 18

                # Should have defaults for missing keys
                assert loaded['font_color'] == DEFAULT_CONFIG['font_color']
                assert loaded['first_run_shown'] == DEFAULT_CONFIG['first_run_shown']
            finally:
                config_manager.CONFIG_DIR = original_dir
                config_manager.CONFIG_FILE = original_file

    def test_config_path_uses_appdata(self):
        """Verify config directory uses %APPDATA%\\ScreenPrompt."""
        appdata = os.environ.get('APPDATA', '')
        assert 'ScreenPrompt' in str(CONFIG_DIR)
        if appdata:
            expected_dir = Path(appdata) / 'ScreenPrompt'
            assert str(CONFIG_DIR) == str(expected_dir)


# =============================================================================
# WinAPI Tests
# =============================================================================

class TestWinAPIConstants:
    """Tests for WinAPI constants and functions."""

    def test_wda_excludefromcapture_value(self):
        """Confirm WDA_EXCLUDEFROMCAPTURE is 0x11."""
        assert WDA_EXCLUDEFROMCAPTURE == 0x11
        assert WDA_EXCLUDEFROMCAPTURE == 17  # Decimal equivalent

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

    def test_set_capture_exclude_calls_winapi(self):
        """Test that set_capture_exclude calls SetWindowDisplayAffinity."""
        mock_user32 = mock.MagicMock()
        mock_user32.SetWindowDisplayAffinity.return_value = 1  # Success

        with mock.patch('sys.platform', 'win32'):
            with mock.patch('platform.version', return_value='10.0.19041'):
                with mock.patch('ctypes.windll') as mock_windll:
                    mock_windll.user32 = mock_user32

                    result = set_capture_exclude(12345)

                    mock_user32.SetWindowDisplayAffinity.assert_called_once_with(
                        12345, WDA_EXCLUDEFROMCAPTURE
                    )
                    assert result is True

    def test_set_capture_exclude_returns_false_on_failure(self):
        """Test that set_capture_exclude returns False when API fails."""
        mock_user32 = mock.MagicMock()
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


# =============================================================================
# Main
# =============================================================================

if __name__ == '__main__':
    pytest.main([__file__, '-v'])
