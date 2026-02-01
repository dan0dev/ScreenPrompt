# settings_ui.py - ScreenPrompt Settings Dialog
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
#
# NOTICE: ScreenPrompt is for legitimate use (presentations, meetings, content
# creation). DO NOT use for cheating on exams or violating policies/laws/ToS.
# You are solely responsible for your use of this software.

"""
Settings dialog for ScreenPrompt overlay.
Provides opacity slider with real-time preview.
Font/color pickers stubbed for Phase 2.
"""

import tkinter as tk
from tkinter import ttk
import ctypes
import json
import os
import sys
from pathlib import Path
from typing import Callable, Optional

# WinAPI constants
WDA_EXCLUDEFROMCAPTURE = 0x11


def is_windows_compatible() -> bool:
    """Check if Windows version supports WDA_EXCLUDEFROMCAPTURE (Build 2004+)."""
    if sys.platform != "win32":
        return False
    # Build 2004 = 10.0.19041
    version = sys.getwindowsversion()
    return version.major >= 10 and version.build >= 19041


def get_hwnd(widget: tk.Tk | tk.Toplevel) -> int:
    """
    Get the real Windows HWND for a Tkinter window.

    Tkinter's winfo_id() returns an internal frame ID, not the top-level
    window handle. Use GetParent() to get the actual HWND that Windows
    manages for screen capture exclusion.
    """
    frame_id = widget.winfo_id()
    hwnd = ctypes.windll.user32.GetParent(frame_id)
    if hwnd == 0:
        hwnd = frame_id
    return hwnd


def set_capture_exclude(hwnd: int) -> bool:
    """
    Apply WDA_EXCLUDEFROMCAPTURE to a window handle.
    Returns True if successful, False otherwise.
    """
    if not is_windows_compatible():
        return False
    try:
        user32 = ctypes.windll.user32
        result = user32.SetWindowDisplayAffinity(hwnd, WDA_EXCLUDEFROMCAPTURE)
        return result != 0
    except Exception:
        return False


def get_config_path() -> Path:
    """Return path to config.json in %APPDATA%\\ScreenPrompt\\"""
    appdata = os.environ.get("APPDATA", "")
    config_dir = Path(appdata) / "ScreenPrompt"
    config_dir.mkdir(parents=True, exist_ok=True)
    return config_dir / "config.json"


def load_config() -> dict:
    """Load configuration from JSON file, return defaults if not found."""
    config_path = get_config_path()
    default_config = {
        "opacity": 0.85,
        "font_family": "Arial",
        "font_size": 24,
        "font_color": "#FFFFFF",
        "bg_color": "#000000",
        "position_x": 100,
        "position_y": 100,
        "width": 400,
        "height": 200,
    }

    if config_path.exists():
        try:
            with open(config_path, "r", encoding="utf-8") as f:
                saved = json.load(f)
                # Merge with defaults to handle missing keys
                return {**default_config, **saved}
        except (json.JSONDecodeError, IOError):
            pass

    return default_config


def save_config(config: dict) -> None:
    """Save configuration to JSON file."""
    config_path = get_config_path()
    with open(config_path, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2)


class SettingsDialog:
    """
    Modal settings dialog for ScreenPrompt.

    Usage:
        def on_opacity_change(value):
            overlay.attributes('-alpha', value)

        dialog = SettingsDialog(root, on_opacity_change=on_opacity_change)
        dialog.show()
    """

    def __init__(
        self,
        parent: tk.Tk,
        on_opacity_change: Optional[Callable[[float], None]] = None
    ):
        """
        Initialize settings dialog.

        Args:
            parent: Parent Tkinter window
            on_opacity_change: Callback for real-time opacity preview
        """
        self.parent = parent
        self.on_opacity_change = on_opacity_change
        self.config = load_config()
        self.dialog: Optional[tk.Toplevel] = None
        self.opacity_var: Optional[tk.DoubleVar] = None
        self.saved = False

    def show(self) -> bool:
        """
        Display the settings dialog (modal).

        Returns:
            True if settings were saved, False if cancelled.
        """
        self.dialog = tk.Toplevel(self.parent)
        self.dialog.title("ScreenPrompt Settings")
        self.dialog.geometry("350x300")
        self.dialog.resizable(False, False)
        self.dialog.transient(self.parent)
        self.dialog.grab_set()

        # Center on parent
        self.dialog.update_idletasks()
        x = self.parent.winfo_x() + (self.parent.winfo_width() // 2) - 175
        y = self.parent.winfo_y() + (self.parent.winfo_height() // 2) - 150
        self.dialog.geometry(f"+{x}+{y}")

        # Exclude from screen capture (Zoom, Teams, OBS, etc.)
        hwnd = get_hwnd(self.dialog)
        set_capture_exclude(hwnd)

        self._build_ui()

        self.dialog.protocol("WM_DELETE_WINDOW", self._on_cancel)
        self.parent.wait_window(self.dialog)

        return self.saved

    def _build_ui(self) -> None:
        """Build the settings dialog UI."""
        if self.dialog is None:
            return

        main_frame = ttk.Frame(self.dialog, padding=20)
        main_frame.pack(fill=tk.BOTH, expand=True)

        # Title
        title_label = ttk.Label(
            main_frame,
            text="Overlay Settings",
            font=("Segoe UI", 14, "bold")
        )
        title_label.pack(anchor=tk.W, pady=(0, 15))

        # Opacity section
        opacity_frame = ttk.LabelFrame(main_frame, text="Opacity", padding=10)
        opacity_frame.pack(fill=tk.X, pady=(0, 10))

        self.opacity_var = tk.DoubleVar(value=self.config.get("opacity", 0.85))

        opacity_slider = ttk.Scale(
            opacity_frame,
            from_=0.5,
            to=1.0,
            orient=tk.HORIZONTAL,
            variable=self.opacity_var,
            command=self._on_opacity_slide
        )
        opacity_slider.pack(fill=tk.X, side=tk.LEFT, expand=True)

        self.opacity_label = ttk.Label(
            opacity_frame,
            text=f"{self.opacity_var.get():.0%}",
            width=5
        )
        self.opacity_label.pack(side=tk.RIGHT, padx=(10, 0))

        # Font section (stub)
        font_frame = ttk.LabelFrame(main_frame, text="Font", padding=10)
        font_frame.pack(fill=tk.X, pady=(0, 10))

        font_stub = ttk.Label(
            font_frame,
            text="Font picker coming in Phase 2",
            foreground="gray"
        )
        font_stub.pack(anchor=tk.W)

        # Color section (stub)
        color_frame = ttk.LabelFrame(main_frame, text="Colors", padding=10)
        color_frame.pack(fill=tk.X, pady=(0, 10))

        color_stub = ttk.Label(
            color_frame,
            text="Color picker coming in Phase 2",
            foreground="gray"
        )
        color_stub.pack(anchor=tk.W)

        # Button row
        button_frame = ttk.Frame(main_frame)
        button_frame.pack(fill=tk.X, pady=(15, 0))

        cancel_btn = ttk.Button(
            button_frame,
            text="Cancel",
            command=self._on_cancel
        )
        cancel_btn.pack(side=tk.RIGHT, padx=(5, 0))

        save_btn = ttk.Button(
            button_frame,
            text="Save",
            command=self._on_save
        )
        save_btn.pack(side=tk.RIGHT)

    def _on_opacity_slide(self, value: str) -> None:
        """Handle opacity slider movement."""
        opacity = float(value)
        self.opacity_label.config(text=f"{opacity:.0%}")

        # Real-time preview callback
        if self.on_opacity_change:
            self.on_opacity_change(opacity)

    def _on_save(self) -> None:
        """Save settings and close dialog."""
        if self.opacity_var:
            self.config["opacity"] = round(self.opacity_var.get(), 2)

        save_config(self.config)
        self.saved = True

        if self.dialog:
            self.dialog.destroy()

    def _on_cancel(self) -> None:
        """Cancel and restore original opacity."""
        original_opacity = load_config().get("opacity", 0.85)

        if self.on_opacity_change:
            self.on_opacity_change(original_opacity)

        self.saved = False

        if self.dialog:
            self.dialog.destroy()


# Standalone test
if __name__ == "__main__":
    root = tk.Tk()
    root.title("ScreenPrompt (Test)")
    root.geometry("400x200")

    # Exclude main test window from capture
    root.update_idletasks()
    hwnd = get_hwnd(root)
    if set_capture_exclude(hwnd):
        print("Capture exclusion enabled for test window")
    else:
        print("Warning: Capture exclusion not available (requires Win10 2004+)")

    def update_opacity(val: float) -> None:
        print(f"Opacity changed to: {val:.0%}")
        root.attributes("-alpha", val)

    def open_settings() -> None:
        dialog = SettingsDialog(root, on_opacity_change=update_opacity)
        if dialog.show():
            print("Settings saved!")
        else:
            print("Settings cancelled.")

    ttk.Button(root, text="Open Settings", command=open_settings).pack(pady=50)

    # Apply saved opacity on start
    config = load_config()
    root.attributes("-alpha", config.get("opacity", 0.85))

    root.mainloop()
