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
Settings panel for ScreenPrompt overlay.
Embedded as Frame inside main window to avoid browser black box issue.
Provides opacity slider with real-time preview.
Font/color pickers stubbed for Phase 2.
"""

import ctypes
import sys
import tkinter as tk
from tkinter import ttk
from typing import Callable, Optional

from config_manager import load_config, save_config

# WinAPI constants
WDA_EXCLUDEFROMCAPTURE = 0x11
GWL_EXSTYLE = -20
WS_EX_LAYERED = 0x00080000
LWA_ALPHA = 0x02

# Load user32.dll once
user32 = ctypes.windll.user32

# Configure function signatures for 64-bit compatibility
user32.GetWindowLongPtrW.restype = ctypes.c_void_p
user32.GetWindowLongPtrW.argtypes = [ctypes.c_void_p, ctypes.c_int]
user32.SetWindowLongPtrW.restype = ctypes.c_void_p
user32.SetWindowLongPtrW.argtypes = [ctypes.c_void_p, ctypes.c_int, ctypes.c_void_p]
user32.SetLayeredWindowAttributes.argtypes = [
    ctypes.c_void_p, ctypes.c_uint32, ctypes.c_uint8, ctypes.c_uint32
]
user32.SetWindowDisplayAffinity.argtypes = [ctypes.c_void_p, ctypes.c_uint32]


def is_windows_compatible() -> bool:
    """Check if Windows version supports WDA_EXCLUDEFROMCAPTURE (Build 2004+)."""
    if sys.platform != "win32":
        return False
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
    hwnd = user32.GetParent(frame_id)
    if hwnd == 0:
        hwnd = frame_id
    return hwnd


def set_capture_exclude(hwnd: int) -> bool:
    """
    Apply WDA_EXCLUDEFROMCAPTURE to a window handle.

    For layered windows, we must use SetLayeredWindowAttributes (not
    UpdateLayeredWindow) for SetWindowDisplayAffinity to work properly.
    Otherwise OBS and other capture tools show a black box.

    Order matters:
    1. Add WS_EX_LAYERED extended style
    2. Call SetLayeredWindowAttributes (makes it compatible with affinity)
    3. Call SetWindowDisplayAffinity

    Returns True if successful, False otherwise.
    """
    if not is_windows_compatible():
        return False
    try:
        # Step 1: Get current extended style and add WS_EX_LAYERED
        ex_style = user32.GetWindowLongPtrW(hwnd, GWL_EXSTYLE)
        user32.SetWindowLongPtrW(hwnd, GWL_EXSTYLE, ex_style | WS_EX_LAYERED)

        # Step 2: Set layered attributes (255 = fully opaque, LWA_ALPHA mode)
        # This makes it a "SetLayeredWindowAttributes window" which is
        # compatible with SetWindowDisplayAffinity (unlike UpdateLayeredWindow)
        user32.SetLayeredWindowAttributes(hwnd, 0, 255, LWA_ALPHA)

        # Step 3: Now apply capture exclusion
        result = user32.SetWindowDisplayAffinity(hwnd, WDA_EXCLUDEFROMCAPTURE)
        return result != 0
    except Exception:
        return False


class SettingsPanel(tk.Frame):
    """
    Embedded settings panel for ScreenPrompt.

    Embeds inside the main overlay window instead of using a separate Toplevel.
    This avoids the browser black box issue where getDisplayMedia doesn't
    respect SetWindowDisplayAffinity for separate windows.

    Usage:
        def on_opacity_change(value):
            overlay.attributes('-alpha', value)

        panel = SettingsPanel(main_frame, on_opacity_change=on_opacity_change)
        panel.pack(fill=tk.BOTH, expand=True)  # or use show()/hide()
    """

    def __init__(
        self,
        parent: tk.Widget,
        on_opacity_change: Optional[Callable[[float], None]] = None,
        on_save: Optional[Callable[[], None]] = None,
        on_cancel: Optional[Callable[[], None]] = None,
    ):
        """
        Initialize settings panel.

        Args:
            parent: Parent widget to embed in
            on_opacity_change: Callback for real-time opacity preview
            on_save: Callback when settings are saved
            on_cancel: Callback when settings are cancelled
        """
        super().__init__(parent, bg="#2a2a2a")

        self.on_opacity_change = on_opacity_change
        self.on_save_callback = on_save
        self.on_cancel_callback = on_cancel
        self.config = load_config()
        self.original_opacity = self.config.get("opacity", 0.85)
        self.opacity_var: Optional[tk.DoubleVar] = None
        self.saved = False
        self._visible = False

        self._build_ui()

    def _build_ui(self) -> None:
        """Build the settings panel UI."""
        # Main container with padding
        main_frame = tk.Frame(self, bg="#2a2a2a", padx=15, pady=10)
        main_frame.pack(fill=tk.BOTH, expand=True)

        # Header with title and close button
        header_frame = tk.Frame(main_frame, bg="#2a2a2a")
        header_frame.pack(fill=tk.X, pady=(0, 10))

        title_label = tk.Label(
            header_frame,
            text="Settings",
            font=("Segoe UI", 12, "bold"),
            bg="#2a2a2a",
            fg="#ffffff"
        )
        title_label.pack(side=tk.LEFT)

        close_btn = tk.Label(
            header_frame,
            text=" × ",
            font=("Segoe UI", 14),
            bg="#2a2a2a",
            fg="#888888",
            cursor="hand2"
        )
        close_btn.pack(side=tk.RIGHT)
        close_btn.bind("<Button-1>", lambda e: self._on_cancel())
        close_btn.bind("<Enter>", lambda e: close_btn.configure(fg="#ffffff"))
        close_btn.bind("<Leave>", lambda e: close_btn.configure(fg="#888888"))

        # Browser limitation warning
        warning_frame = tk.Frame(main_frame, bg="#3a3a1a", padx=8, pady=5)
        warning_frame.pack(fill=tk.X, pady=(0, 10))

        warning_label = tk.Label(
            warning_frame,
            text="⚠ Note: Native apps (Zoom, OBS) hide this panel.\n"
                 "Browser apps (Meet) may show a black box.",
            font=("Segoe UI", 8),
            bg="#3a3a1a",
            fg="#cccc88",
            justify=tk.LEFT
        )
        warning_label.pack(anchor=tk.W)

        # Opacity section
        opacity_frame = tk.Frame(main_frame, bg="#333333", padx=10, pady=8)
        opacity_frame.pack(fill=tk.X, pady=(0, 8))

        opacity_header = tk.Label(
            opacity_frame,
            text="Opacity",
            font=("Segoe UI", 9, "bold"),
            bg="#333333",
            fg="#ffffff"
        )
        opacity_header.pack(anchor=tk.W)

        slider_frame = tk.Frame(opacity_frame, bg="#333333")
        slider_frame.pack(fill=tk.X, pady=(5, 0))

        self.opacity_var = tk.DoubleVar(value=self.config.get("opacity", 0.85))

        # Use ttk.Scale with custom style for better appearance
        style = ttk.Style()
        style.configure("Dark.Horizontal.TScale", background="#333333")

        opacity_slider = ttk.Scale(
            slider_frame,
            from_=0.5,
            to=1.0,
            orient=tk.HORIZONTAL,
            variable=self.opacity_var,
            command=self._on_opacity_slide,
            cursor="hand2",
            style="Dark.Horizontal.TScale"
        )
        opacity_slider.pack(fill=tk.X, side=tk.LEFT, expand=True)

        self.opacity_label = tk.Label(
            slider_frame,
            text=f"{self.opacity_var.get():.0%}",
            font=("Segoe UI", 9),
            bg="#333333",
            fg="#ffffff",
            width=5
        )
        self.opacity_label.pack(side=tk.RIGHT, padx=(10, 0))

        # Font section (stub)
        font_frame = tk.Frame(main_frame, bg="#333333", padx=10, pady=8)
        font_frame.pack(fill=tk.X, pady=(0, 8))

        font_header = tk.Label(
            font_frame,
            text="Font",
            font=("Segoe UI", 9, "bold"),
            bg="#333333",
            fg="#ffffff"
        )
        font_header.pack(anchor=tk.W)

        font_stub = tk.Label(
            font_frame,
            text="Font picker coming in Phase 2",
            font=("Segoe UI", 8),
            bg="#333333",
            fg="#888888"
        )
        font_stub.pack(anchor=tk.W, pady=(3, 0))

        # Colors section (stub)
        color_frame = tk.Frame(main_frame, bg="#333333", padx=10, pady=8)
        color_frame.pack(fill=tk.X, pady=(0, 8))

        color_header = tk.Label(
            color_frame,
            text="Colors",
            font=("Segoe UI", 9, "bold"),
            bg="#333333",
            fg="#ffffff"
        )
        color_header.pack(anchor=tk.W)

        color_stub = tk.Label(
            color_frame,
            text="Color picker coming in Phase 2",
            font=("Segoe UI", 8),
            bg="#333333",
            fg="#888888"
        )
        color_stub.pack(anchor=tk.W, pady=(3, 0))

        # Button row
        button_frame = tk.Frame(main_frame, bg="#2a2a2a")
        button_frame.pack(fill=tk.X, pady=(5, 0))

        cancel_btn = tk.Button(
            button_frame,
            text="Cancel",
            command=self._on_cancel,
            bg="#444444",
            fg="#ffffff",
            activebackground="#555555",
            activeforeground="#ffffff",
            relief=tk.FLAT,
            padx=15,
            pady=3,
            cursor="hand2"
        )
        cancel_btn.pack(side=tk.RIGHT, padx=(5, 0))

        save_btn = tk.Button(
            button_frame,
            text="Save",
            command=self._on_save,
            bg="#4a7a4a",
            fg="#ffffff",
            activebackground="#5a8a5a",
            activeforeground="#ffffff",
            relief=tk.FLAT,
            padx=15,
            pady=3,
            cursor="hand2"
        )
        save_btn.pack(side=tk.RIGHT)

    def show(self) -> None:
        """Show the settings panel."""
        # Refresh config and original opacity when showing
        self.config = load_config()
        self.original_opacity = self.config.get("opacity", 0.85)
        if self.opacity_var:
            self.opacity_var.set(self.original_opacity)
            self.opacity_label.config(text=f"{self.original_opacity:.0%}")
        self.saved = False
        self._visible = True
        self.pack(fill=tk.BOTH, expand=True)

    def hide(self) -> None:
        """Hide the settings panel."""
        self._visible = False
        self.pack_forget()

    def is_visible(self) -> bool:
        """Check if panel is currently visible."""
        return self._visible

    def toggle(self) -> None:
        """Toggle panel visibility."""
        if self._visible:
            self._on_cancel()
        else:
            self.show()

    def _on_opacity_slide(self, value: str) -> None:
        """Handle opacity slider movement."""
        opacity = float(value)
        self.opacity_label.config(text=f"{opacity:.0%}")

        # Real-time preview callback
        if self.on_opacity_change:
            self.on_opacity_change(opacity)

    def _on_save(self) -> None:
        """Save settings and hide panel."""
        if self.opacity_var:
            self.config["opacity"] = round(self.opacity_var.get(), 2)

        save_config(self.config)
        self.saved = True
        self.hide()

        if self.on_save_callback:
            self.on_save_callback()

    def _on_cancel(self) -> None:
        """Cancel and restore original opacity."""
        if self.on_opacity_change:
            self.on_opacity_change(self.original_opacity)

        self.saved = False
        self.hide()

        if self.on_cancel_callback:
            self.on_cancel_callback()


# Standalone test
if __name__ == "__main__":
    root = tk.Tk()
    root.title("ScreenPrompt Settings Panel Test")
    root.geometry("400x450")
    root.configure(bg="#1e1e1e")

    # Exclude test window from screen capture
    root.update_idletasks()
    hwnd = get_hwnd(root)
    if set_capture_exclude(hwnd):
        print("Capture exclusion enabled for test window")
    else:
        print("Warning: Capture exclusion not available (requires Win10 2004+)")

    # Content frame to simulate main overlay content
    content_frame = tk.Frame(root, bg="#1e1e1e")
    content_frame.pack(fill=tk.BOTH, expand=True)

    # Placeholder for main content
    main_content = tk.Label(
        content_frame,
        text="Main overlay content goes here.\n\nClick 'Open Settings' to show panel.",
        bg="#1e1e1e",
        fg="#ffffff",
        font=("Segoe UI", 11)
    )
    main_content.pack(fill=tk.BOTH, expand=True, pady=50)

    # Settings panel (hidden initially)
    settings_panel: Optional[SettingsPanel] = None

    def update_opacity(val: float) -> None:
        print(f"Opacity changed to: {val:.0%}")
        root.attributes("-alpha", val)

    def on_settings_save() -> None:
        print("Settings saved!")
        main_content.pack(fill=tk.BOTH, expand=True, pady=50)

    def on_settings_cancel() -> None:
        print("Settings cancelled.")
        main_content.pack(fill=tk.BOTH, expand=True, pady=50)

    def toggle_settings() -> None:
        global settings_panel
        if settings_panel is None:
            settings_panel = SettingsPanel(
                content_frame,
                on_opacity_change=update_opacity,
                on_save=on_settings_save,
                on_cancel=on_settings_cancel
            )

        if settings_panel.is_visible():
            settings_panel.toggle()
        else:
            main_content.pack_forget()
            settings_panel.show()

    # Button frame
    btn_frame = tk.Frame(root, bg="#333333", height=40)
    btn_frame.pack(fill=tk.X, side=tk.BOTTOM)
    btn_frame.pack_propagate(False)

    toggle_btn = tk.Button(
        btn_frame,
        text="Open Settings",
        command=toggle_settings,
        bg="#444444",
        fg="#ffffff",
        activebackground="#555555",
        activeforeground="#ffffff",
        relief=tk.FLAT,
        padx=15,
        cursor="hand2"
    )
    toggle_btn.pack(pady=5)

    # Apply saved opacity on start
    config = load_config()
    root.attributes("-alpha", config.get("opacity", 0.85))

    root.mainloop()
