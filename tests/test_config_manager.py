# MIT License
# Copyright (c) 2026 ScreenPrompt Contributors

"""
Unit tests for config_manager module.
"""

import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from config_manager import (
    DEFAULT_CONFIG,
    load_config,
    save_config,
    is_first_run,
    mark_first_run_complete,
)


class TestConfigManager(unittest.TestCase):
    """Test cases for config_manager."""

    def setUp(self):
        """Create a temporary directory for test config files."""
        self.temp_dir = tempfile.mkdtemp()
        self.config_file = Path(self.temp_dir) / "config.json"

    def tearDown(self):
        """Clean up temporary files."""
        if self.config_file.exists():
            self.config_file.unlink()
        os.rmdir(self.temp_dir)

    @patch('config_manager.CONFIG_FILE')
    @patch('config_manager.CONFIG_DIR')
    def test_load_config_returns_defaults_when_no_file(self, mock_dir, mock_file):
        """Load should return defaults when no config file exists."""
        mock_file.exists.return_value = False
        mock_dir.__truediv__ = lambda self, x: self.temp_dir / x

        # Patch to use non-existent file
        with patch('config_manager.CONFIG_FILE', Path(self.temp_dir) / "nonexistent.json"):
            config = load_config()

        self.assertEqual(config, DEFAULT_CONFIG)

    def test_default_config_has_required_keys(self):
        """Default config should have all required keys."""
        required_keys = [
            'x', 'y', 'width', 'height',
            'opacity', 'font_family', 'font_size',
            'font_color', 'bg_color', 'text',
            'first_run_shown', 'locked'
        ]

        for key in required_keys:
            self.assertIn(key, DEFAULT_CONFIG, f"Missing required key: {key}")

    def test_default_config_values_are_valid(self):
        """Default config values should be within valid ranges."""
        self.assertGreater(DEFAULT_CONFIG['width'], 0)
        self.assertGreater(DEFAULT_CONFIG['height'], 0)
        self.assertGreaterEqual(DEFAULT_CONFIG['opacity'], 0.0)
        self.assertLessEqual(DEFAULT_CONFIG['opacity'], 1.0)
        self.assertGreater(DEFAULT_CONFIG['font_size'], 0)
        self.assertTrue(DEFAULT_CONFIG['font_color'].startswith('#'))
        self.assertTrue(DEFAULT_CONFIG['bg_color'].startswith('#'))

    @patch('config_manager.CONFIG_FILE')
    @patch('config_manager.CONFIG_DIR')
    def test_save_and_load_config(self, mock_dir, mock_file):
        """Config should be saved and loaded correctly."""
        mock_dir.__truediv__ = lambda self, x: Path(self.temp_dir)
        mock_dir.mkdir = lambda **kwargs: None

        # Use actual temp file
        with patch('config_manager.CONFIG_FILE', self.config_file):
            with patch('config_manager.CONFIG_DIR', Path(self.temp_dir)):
                test_config = DEFAULT_CONFIG.copy()
                test_config['opacity'] = 0.75
                test_config['font_size'] = 14
                test_config['text'] = "Test prompt"

                save_config(test_config)
                loaded = load_config()

                self.assertEqual(loaded['opacity'], 0.75)
                self.assertEqual(loaded['font_size'], 14)
                self.assertEqual(loaded['text'], "Test prompt")

    @patch('config_manager.CONFIG_FILE')
    def test_load_config_merges_with_defaults(self, mock_file):
        """Loading partial config should merge with defaults."""
        # Create partial config file
        partial_config = {'opacity': 0.5}
        self.config_file.write_text(json.dumps(partial_config))

        with patch('config_manager.CONFIG_FILE', self.config_file):
            config = load_config()

        # Should have custom value
        self.assertEqual(config['opacity'], 0.5)
        # Should have default values for missing keys
        self.assertEqual(config['font_size'], DEFAULT_CONFIG['font_size'])
        self.assertEqual(config['font_family'], DEFAULT_CONFIG['font_family'])

    @patch('config_manager.CONFIG_FILE')
    def test_load_config_handles_invalid_json(self, mock_file):
        """Loading invalid JSON should return defaults."""
        self.config_file.write_text("{ invalid json }")

        with patch('config_manager.CONFIG_FILE', self.config_file):
            config = load_config()

        self.assertEqual(config, DEFAULT_CONFIG)

    @patch('config_manager.CONFIG_FILE')
    def test_is_first_run_true_when_no_file(self, mock_file):
        """is_first_run should return True when no config file."""
        mock_file.exists.return_value = False
        result = is_first_run()
        self.assertTrue(result)

    @patch('config_manager.CONFIG_FILE')
    def test_is_first_run_true_when_not_shown(self, mock_file):
        """is_first_run should return True when first_run_shown is False."""
        config = {'first_run_shown': False}
        self.config_file.write_text(json.dumps(config))

        with patch('config_manager.CONFIG_FILE', self.config_file):
            result = is_first_run()

        self.assertTrue(result)

    @patch('config_manager.CONFIG_FILE')
    def test_is_first_run_false_when_shown(self, mock_file):
        """is_first_run should return False when first_run_shown is True."""
        config = {'first_run_shown': True}
        self.config_file.write_text(json.dumps(config))

        with patch('config_manager.CONFIG_FILE', self.config_file):
            result = is_first_run()

        self.assertFalse(result)


class TestConfigSchema(unittest.TestCase):
    """Test config schema consistency."""

    def test_opacity_range(self):
        """Opacity should be between 0.5 and 1.0 for usability."""
        # Per CLAUDE.md, below 0.5 is too transparent to read
        self.assertGreaterEqual(DEFAULT_CONFIG['opacity'], 0.5)
        self.assertLessEqual(DEFAULT_CONFIG['opacity'], 1.0)

    def test_font_size_range(self):
        """Font size should be reasonable (8-48 per UI constraints)."""
        self.assertGreaterEqual(DEFAULT_CONFIG['font_size'], 8)
        self.assertLessEqual(DEFAULT_CONFIG['font_size'], 48)

    def test_window_dimensions(self):
        """Window dimensions should be reasonable minimums."""
        self.assertGreaterEqual(DEFAULT_CONFIG['width'], 200)
        self.assertGreaterEqual(DEFAULT_CONFIG['height'], 150)

    def test_color_format(self):
        """Colors should be valid hex format."""
        import re
        hex_pattern = r'^#[0-9A-Fa-f]{6}$'

        self.assertRegex(DEFAULT_CONFIG['font_color'], hex_pattern)
        self.assertRegex(DEFAULT_CONFIG['bg_color'], hex_pattern)


if __name__ == '__main__':
    unittest.main()
