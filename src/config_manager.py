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
Configuration manager for ScreenPrompt.
Handles JSON config at %APPDATA%\\ScreenPrompt\\config.json
"""

import json
import os
from pathlib import Path
from typing import Any


# Config paths
CONFIG_DIR = Path(os.environ.get("APPDATA", "")) / "ScreenPrompt"
CONFIG_FILE = CONFIG_DIR / "config.json"

# Default configuration - CANONICAL SCHEMA
# All modules MUST use these exact key names
DEFAULT_CONFIG = {
    # Window position and size
    "x": 100,
    "y": 100,
    "width": 400,
    "height": 200,
    # Appearance
    "opacity": 0.85,
    "font_family": "Consolas",
    "font_size": 11,
    "font_color": "#FFFFFF",
    "bg_color": "#2d2d2d",
    # State
    "text": "",  # Empty default - placeholder shown in UI
    "first_run_shown": False,
    "locked": False,  # Mouse pass-through mode
}


def get_config_path() -> Path:
    """Return path to config.json."""
    return CONFIG_FILE


def load_config() -> dict[str, Any]:
    """
    Load configuration from JSON file.
    Returns defaults merged with saved config to handle missing keys.
    """
    if CONFIG_FILE.exists():
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                saved = json.load(f)
                # Merge with defaults for any missing keys
                return {**DEFAULT_CONFIG, **saved}
        except (json.JSONDecodeError, IOError):
            pass
    return DEFAULT_CONFIG.copy()


def save_config(config: dict[str, Any]) -> None:
    """Save configuration to JSON file."""
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2)


def is_first_run() -> bool:
    """Check if this is the first run (no config file or first_run_shown=False)."""
    if not CONFIG_FILE.exists():
        return True
    config = load_config()
    return not config.get("first_run_shown", False)


def mark_first_run_complete() -> None:
    """Mark first run as complete."""
    config = load_config()
    config["first_run_shown"] = True
    save_config(config)
