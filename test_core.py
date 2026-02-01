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
    # Windows 10 version 2004 = Build 19041
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
