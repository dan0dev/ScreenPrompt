# MIT License
# Copyright (c) 2026 ScreenPrompt Contributors

"""
Unit tests for Windows API functionality.
Tests are designed to run on non-Windows platforms too (with mocks).
"""

import os
import sys
import unittest
from unittest.mock import MagicMock, patch

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))


class TestWindowsVersionCheck(unittest.TestCase):
    """Test Windows version compatibility checks."""

    def test_is_windows_compatible_on_supported_build(self):
        """Should return True for Windows 10 Build 2004+."""
        from settings_ui import is_windows_compatible

        if sys.platform != 'win32':
            self.skipTest("Windows-only test")

        # On actual Windows, just verify it returns a boolean
        result = is_windows_compatible()
        self.assertIsInstance(result, bool)

    @patch('sys.platform', 'linux')
    def test_is_windows_compatible_returns_false_on_non_windows(self):
        """Should return False on non-Windows platforms."""
        # Need to reimport after patching
        import importlib
        import settings_ui
        importlib.reload(settings_ui)

        result = settings_ui.is_windows_compatible()
        self.assertFalse(result)


class TestCaptureExclusion(unittest.TestCase):
    """Test capture exclusion functionality."""

    def test_set_capture_exclude_returns_false_on_incompatible(self):
        """set_capture_exclude should return False on incompatible systems."""
        from settings_ui import set_capture_exclude

        with patch('settings_ui.is_windows_compatible', return_value=False):
            result = set_capture_exclude(12345)
            self.assertFalse(result)

    @patch('settings_ui.is_windows_compatible', return_value=True)
    def test_set_capture_exclude_calls_winapi(self, mock_compat):
        """set_capture_exclude should call Windows API functions."""
        if sys.platform != 'win32':
            self.skipTest("Windows-only test")

        from settings_ui import set_capture_exclude, user32

        # Create mock HWND (can't use real one without window)
        mock_hwnd = 0x12345

        # Mock the API calls
        with patch.object(user32, 'GetWindowLongPtrW', return_value=0x80000):
            with patch.object(user32, 'SetWindowLongPtrW', return_value=1):
                with patch.object(user32, 'SetLayeredWindowAttributes', return_value=1):
                    with patch.object(user32, 'SetWindowDisplayAffinity', return_value=1):
                        result = set_capture_exclude(mock_hwnd)

        self.assertTrue(result)

    def test_set_capture_exclude_handles_exceptions(self):
        """set_capture_exclude should handle exceptions gracefully."""
        from settings_ui import set_capture_exclude

        with patch('settings_ui.is_windows_compatible', return_value=True):
            with patch('settings_ui.user32.GetWindowLongPtrW', side_effect=Exception("Test")):
                result = set_capture_exclude(12345)

        self.assertFalse(result)


class TestGetHwnd(unittest.TestCase):
    """Test HWND retrieval from Tkinter widgets."""

    def test_get_hwnd_uses_getparent(self):
        """get_hwnd should use GetParent to get real HWND."""
        if sys.platform != 'win32':
            self.skipTest("Windows-only test")

        from settings_ui import get_hwnd, user32

        # Create mock widget
        mock_widget = MagicMock()
        mock_widget.winfo_id.return_value = 0x1000

        # Mock GetParent to return different HWND
        with patch.object(user32, 'GetParent', return_value=0x2000):
            hwnd = get_hwnd(mock_widget)

        self.assertEqual(hwnd, 0x2000)

    def test_get_hwnd_falls_back_to_winfo_id(self):
        """get_hwnd should fall back to winfo_id if GetParent returns 0."""
        if sys.platform != 'win32':
            self.skipTest("Windows-only test")

        from settings_ui import get_hwnd, user32

        mock_widget = MagicMock()
        mock_widget.winfo_id.return_value = 0x1000

        # GetParent returns 0 (no parent)
        with patch.object(user32, 'GetParent', return_value=0):
            hwnd = get_hwnd(mock_widget)

        self.assertEqual(hwnd, 0x1000)


class TestWinAPIConstants(unittest.TestCase):
    """Test that WinAPI constants are correctly defined."""

    def test_wda_excludefromcapture_value(self):
        """WDA_EXCLUDEFROMCAPTURE should be 0x11."""
        from settings_ui import WDA_EXCLUDEFROMCAPTURE
        self.assertEqual(WDA_EXCLUDEFROMCAPTURE, 0x11)

    def test_gw_exstyle_value(self):
        """GWL_EXSTYLE should be -20."""
        from settings_ui import GWL_EXSTYLE
        self.assertEqual(GWL_EXSTYLE, -20)

    def test_ws_ex_layered_value(self):
        """WS_EX_LAYERED should be 0x00080000."""
        from settings_ui import WS_EX_LAYERED
        self.assertEqual(WS_EX_LAYERED, 0x00080000)

    def test_lwa_alpha_value(self):
        """LWA_ALPHA should be 0x02."""
        from settings_ui import LWA_ALPHA
        self.assertEqual(LWA_ALPHA, 0x02)


class TestClickThroughMode(unittest.TestCase):
    """Test click-through (WS_EX_TRANSPARENT) functionality."""

    def test_ws_ex_transparent_constant(self):
        """WS_EX_TRANSPARENT should be defined in main.py."""
        from main import WS_EX_TRANSPARENT
        self.assertEqual(WS_EX_TRANSPARENT, 0x00000020)


if __name__ == '__main__':
    unittest.main()
