"""
ScreenPrompt - Transparent overlay window excluded from screen capture.

MIT License

Copyright (c) 2026 ScreenPrompt Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

DISCLAIMER: This software is provided "AS IS" without warranty of any kind.
The authors are not responsible for any misuse of this software.
"""

import ctypes
import sys
import tkinter as tk
from tkinter import messagebox

from config_manager import (
    load_config,
    save_config,
    is_first_run,
    mark_first_run_complete,
)
from settings_ui import SettingsDialog


# Constants
WDA_EXCLUDEFROMCAPTURE = 0x00000011

ETHICAL_NOTICE = """ScreenPrompt is intended for legitimate use only, such as:
- Presentations and meetings
- Content creation
- Personal productivity

DO NOT use this software for:
- Cheating on exams or assessments
- Violating academic integrity policies
- Breaking terms of service of any platform
- Any illegal activities

You are solely responsible for how you use this software.

This software runs 100% locally. No data collection, no telemetry.

By clicking OK, you acknowledge that you understand and agree to use
this software responsibly and ethically."""


def check_windows_version() -> tuple[bool, str | None]:
    """Check if Windows version supports WDA_EXCLUDEFROMCAPTURE (Build 2004+)."""
    try:
        version = sys.getwindowsversion()
        # Windows 10 Build 2004 is version 10.0.19041
        if version.major < 10:
            return False, "Windows 10 or higher required"
        if version.major == 10 and version.build < 19041:
            return False, f"Windows 10 Build 2004+ required (current: {version.build})"
        return True, None
    except Exception as e:
        return False, str(e)


class ScreenPromptWindow:
    """Main overlay window class."""

    def __init__(self):
        self.config = load_config()
        self.drag_data = {"x": 0, "y": 0}

        # Create main window
        self.root = tk.Tk()
        self.root.title("ScreenPrompt")
        self.root.withdraw()  # Hide initially

        # Show ethical notice on first run
        if is_first_run():
            self.show_ethical_notice()
            mark_first_run_complete()

        self.setup_window()
        self.setup_widgets()
        self.apply_capture_exclusion()

        # Show window
        self.root.deiconify()

    def show_ethical_notice(self):
        """Display ethical use notice on first run."""
        messagebox.showwarning(
            "ScreenPrompt - Important Notice",
            ETHICAL_NOTICE
        )

    def setup_window(self):
        """Configure the main window properties."""
        root = self.root

        # Remove window decorations
        root.overrideredirect(True)

        # Set position and size from config
        root.geometry(
            f"{self.config['width']}x{self.config['height']}"
            f"+{self.config['x']}+{self.config['y']}"
        )

        # Set transparency
        root.attributes("-alpha", self.config["opacity"])

        # Always on top
        root.attributes("-topmost", True)

        # Dark background
        root.configure(bg="#1e1e1e")

        # Bind close event
        root.protocol("WM_DELETE_WINDOW", self.on_close)

    def setup_widgets(self):
        """Create and configure UI widgets."""
        root = self.root

        # Title bar frame for dragging and close button
        title_frame = tk.Frame(root, bg="#333333", height=25)
        title_frame.pack(fill=tk.X, side=tk.TOP)
        title_frame.pack_propagate(False)

        # Title label
        title_label = tk.Label(
            title_frame,
            text="ScreenPrompt",
            bg="#333333",
            fg="#ffffff",
            font=("Segoe UI", 9)
        )
        title_label.pack(side=tk.LEFT, padx=5)

        # Close button
        close_btn = tk.Label(
            title_frame,
            text=" X ",
            bg="#333333",
            fg="#ffffff",
            font=("Segoe UI", 9, "bold"),
            cursor="hand2"
        )
        close_btn.pack(side=tk.RIGHT, padx=2)
        close_btn.bind("<Button-1>", lambda e: self.on_close())
        close_btn.bind("<Enter>", lambda e: close_btn.configure(bg="#ff4444"))
        close_btn.bind("<Leave>", lambda e: close_btn.configure(bg="#333333"))

        # Settings button (gear icon)
        settings_btn = tk.Label(
            title_frame,
            text=" \u2699 ",  # Unicode gear
            bg="#333333",
            fg="#ffffff",
            font=("Segoe UI", 10),
            cursor="hand2"
        )
        settings_btn.pack(side=tk.RIGHT, padx=2)
        settings_btn.bind("<Button-1>", lambda e: self.open_settings())
        settings_btn.bind("<Enter>", lambda e: settings_btn.configure(bg="#555555"))
        settings_btn.bind("<Leave>", lambda e: settings_btn.configure(bg="#333333"))

        # Bind drag events to title bar
        title_frame.bind("<Button-1>", self.start_drag)
        title_frame.bind("<B1-Motion>", self.do_drag)
        title_label.bind("<Button-1>", self.start_drag)
        title_label.bind("<B1-Motion>", self.do_drag)

        # Text widget for prompt content
        self.text_widget = tk.Text(
            root,
            bg=self.config.get("bg_color", "#2d2d2d"),
            fg=self.config.get("font_color", "#ffffff"),
            insertbackground="#ffffff",
            font=(
                self.config.get("font_family", "Consolas"),
                self.config.get("font_size", 11)
            ),
            wrap=tk.WORD,
            borderwidth=0,
            highlightthickness=0,
            padx=10,
            pady=10
        )
        self.text_widget.pack(fill=tk.BOTH, expand=True, padx=2, pady=(0, 2))

        # Load saved text
        self.text_widget.insert("1.0", self.config.get("text", ""))

        # Resize handle frame
        resize_frame = tk.Frame(root, bg="#333333", height=10, cursor="size_nw_se")
        resize_frame.pack(fill=tk.X, side=tk.BOTTOM)

        # Resize grip
        resize_grip = tk.Label(
            resize_frame,
            text="...",
            bg="#333333",
            fg="#666666",
            font=("Segoe UI", 8)
        )
        resize_grip.pack(side=tk.RIGHT, padx=5)

        # Bind resize events
        resize_frame.bind("<Button-1>", self.start_resize)
        resize_frame.bind("<B1-Motion>", self.do_resize)
        resize_grip.bind("<Button-1>", self.start_resize)
        resize_grip.bind("<B1-Motion>", self.do_resize)

    def open_settings(self):
        """Open the settings dialog."""
        dialog = SettingsDialog(
            self.root,
            on_opacity_change=lambda v: self.root.attributes("-alpha", v)
        )
        if dialog.show():
            # Reload config after save
            self.config = load_config()

    def apply_capture_exclusion(self):
        """Apply WDA_EXCLUDEFROMCAPTURE to hide window from screen capture."""
        # Check Windows version first
        supported, error_msg = check_windows_version()
        if not supported:
            messagebox.showerror(
                "Unsupported Windows Version",
                f"Screen capture exclusion is not supported.\n{error_msg}\n\n"
                "The overlay will still work but will be visible in screen captures."
            )
            return

        # Need to update window to get valid HWND
        self.root.update_idletasks()

        # Get the window handle
        hwnd = ctypes.windll.user32.GetParent(self.root.winfo_id())
        if hwnd == 0:
            hwnd = self.root.winfo_id()

        # Apply capture exclusion
        result = ctypes.windll.user32.SetWindowDisplayAffinity(hwnd, WDA_EXCLUDEFROMCAPTURE)

        if result == 0:
            error_code = ctypes.windll.kernel32.GetLastError()
            print(f"Warning: SetWindowDisplayAffinity failed with error code {error_code}")

    def start_drag(self, event):
        """Initialize window drag operation."""
        self.drag_data["x"] = event.x
        self.drag_data["y"] = event.y

    def do_drag(self, event):
        """Handle window dragging."""
        x = self.root.winfo_x() + (event.x - self.drag_data["x"])
        y = self.root.winfo_y() + (event.y - self.drag_data["y"])
        self.root.geometry(f"+{x}+{y}")

    def start_resize(self, event):
        """Initialize window resize operation."""
        self.drag_data["x"] = event.x_root
        self.drag_data["y"] = event.y_root
        self.drag_data["width"] = self.root.winfo_width()
        self.drag_data["height"] = self.root.winfo_height()

    def do_resize(self, event):
        """Handle window resizing."""
        dx = event.x_root - self.drag_data["x"]
        dy = event.y_root - self.drag_data["y"]

        new_width = max(200, self.drag_data["width"] + dx)
        new_height = max(150, self.drag_data["height"] + dy)

        self.root.geometry(f"{new_width}x{new_height}")

    def on_close(self):
        """Save state and close the application."""
        # Update config with current state
        self.config["x"] = self.root.winfo_x()
        self.config["y"] = self.root.winfo_y()
        self.config["width"] = self.root.winfo_width()
        self.config["height"] = self.root.winfo_height()
        self.config["text"] = self.text_widget.get("1.0", tk.END).rstrip("\n")

        # Save config
        save_config(self.config)

        # Close window
        self.root.destroy()

    def run(self):
        """Start the application main loop."""
        self.root.mainloop()


def main():
    """Application entry point."""
    # Check if running on Windows
    if sys.platform != "win32":
        print("Error: ScreenPrompt is only supported on Windows.")
        sys.exit(1)

    app = ScreenPromptWindow()
    app.run()


if __name__ == "__main__":
    main()
