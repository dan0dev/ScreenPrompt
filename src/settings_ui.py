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
Provides opacity slider, font selection, and color pickers with real-time preview.
"""

import ctypes
import sys
import tkinter as tk
from tkinter import ttk
from tkinter import font as tkfont
from typing import Callable, Optional

from config_manager import load_config, save_config

# Color palettes for swatches
TEXT_COLORS = [
    "#FFFFFF",  # white
    "#E0E0E0",  # light gray
    "#FFFF00",  # yellow
    "#00FF00",  # green
    "#00FFFF",  # cyan
    "#87CEEB",  # sky blue
    "#FFA500",  # orange
    "#FF69B4",  # pink
]

BG_COLORS = [
    "#1E1E1E",  # near black
    "#2D2D2D",  # dark gray
    "#1A1A2E",  # dark blue
    "#1E3A2E",  # dark green
    "#2E1A1A",  # dark red
    "#2E1A2E",  # dark purple
    "#2D2D1A",  # dark olive
    "#1A2D2D",  # dark teal
]

# Priority fonts (shown first in dropdown)
PRIORITY_FONTS = [
    "Consolas",
    "Segoe UI",
    "Arial",
    "Courier New",
    "Calibri",
    "Tahoma",
    "Verdana",
    "Times New Roman",
]

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
        on_font_change: Optional[Callable[[str, int], None]] = None,
        on_text_color_change: Optional[Callable[[str], None]] = None,
        on_bg_color_change: Optional[Callable[[str], None]] = None,
        on_save: Optional[Callable[[], None]] = None,
        on_cancel: Optional[Callable[[], None]] = None,
    ):
        """
        Initialize settings panel.

        Args:
            parent: Parent widget to embed in
            on_opacity_change: Callback for real-time opacity preview
            on_font_change: Callback for font family/size changes (family, size)
            on_text_color_change: Callback for text color changes (hex)
            on_bg_color_change: Callback for background color changes (hex)
            on_save: Callback when settings are saved
            on_cancel: Callback when settings are cancelled
        """
        super().__init__(parent, bg="#2a2a2a")

        self.on_opacity_change = on_opacity_change
        self.on_font_change = on_font_change
        self.on_text_color_change = on_text_color_change
        self.on_bg_color_change = on_bg_color_change
        self.on_save_callback = on_save
        self.on_cancel_callback = on_cancel
        self.config = load_config()

        # Original values for cancel restore
        self.original_opacity = self.config.get("opacity", 0.85)
        self.original_font_family = self.config.get("font_family", "Consolas")
        self.original_font_size = self.config.get("font_size", 11)
        self.original_text_color = self.config.get("font_color", "#FFFFFF")
        self.original_bg_color = self.config.get("bg_color", "#2d2d2d")

        # Tkinter variables
        self.opacity_var: Optional[tk.DoubleVar] = None
        self.font_family_var: Optional[tk.StringVar] = None
        self.font_size_var: Optional[tk.StringVar] = None
        self.text_color_var: Optional[tk.StringVar] = None
        self.bg_color_var: Optional[tk.StringVar] = None

        self.saved = False
        self._visible = False

        self._build_ui()

    def _get_prioritized_fonts(self) -> list[str]:
        """Get font list with common fonts first, then all system fonts."""
        available = set(tkfont.families())
        prioritized = [f for f in PRIORITY_FONTS if f in available]
        remaining = sorted([f for f in available if f not in prioritized])
        if prioritized and remaining:
            return prioritized + ["─" * 20] + remaining
        return prioritized + remaining

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
            fg="#888888"
        )
        close_btn.pack(side=tk.RIGHT)
        close_btn.bind("<Button-1>", lambda e: self._on_cancel())
        close_btn.bind("<Enter>", lambda e: close_btn.configure(fg="#ffffff"))
        close_btn.bind("<Leave>", lambda e: close_btn.configure(fg="#888888"))

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

        # Font section
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

        # Font family row
        family_row = tk.Frame(font_frame, bg="#333333")
        family_row.pack(fill=tk.X, pady=(5, 3))

        family_label = tk.Label(
            family_row,
            text="Family:",
            font=("Segoe UI", 9),
            bg="#333333",
            fg="#cccccc",
            width=8,
            anchor=tk.W
        )
        family_label.pack(side=tk.LEFT)

        self.font_family_var = tk.StringVar(value=self.config.get("font_family", "Consolas"))
        font_families = self._get_prioritized_fonts()

        self.font_combo = ttk.Combobox(
            family_row,
            textvariable=self.font_family_var,
            values=font_families,
            state="readonly",
            width=20
        )
        self.font_combo.pack(side=tk.LEFT, fill=tk.X, expand=True)
        self.font_combo.bind("<<ComboboxSelected>>", self._on_font_family_change)

        # Font size row
        size_row = tk.Frame(font_frame, bg="#333333")
        size_row.pack(fill=tk.X, pady=(0, 0))

        size_label = tk.Label(
            size_row,
            text="Size:",
            font=("Segoe UI", 9),
            bg="#333333",
            fg="#cccccc",
            width=8,
            anchor=tk.W
        )
        size_label.pack(side=tk.LEFT)

        self.font_size_var = tk.StringVar(value=str(self.config.get("font_size", 11)))

        self.font_spinbox = ttk.Spinbox(
            size_row,
            from_=8,
            to=48,
            textvariable=self.font_size_var,
            width=5
        )
        self.font_spinbox.pack(side=tk.LEFT)
        self.font_spinbox.bind("<FocusOut>", self._on_font_size_change)
        self.font_spinbox.bind("<Return>", self._on_font_size_change)

        pt_label = tk.Label(
            size_row,
            text="pt",
            font=("Segoe UI", 9),
            bg="#333333",
            fg="#cccccc"
        )
        pt_label.pack(side=tk.LEFT, padx=(3, 0))

        # Colors section
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

        # Text color row
        text_color_row = tk.Frame(color_frame, bg="#333333")
        text_color_row.pack(fill=tk.X, pady=(5, 3))

        text_color_label = tk.Label(
            text_color_row,
            text="Text:",
            font=("Segoe UI", 9),
            bg="#333333",
            fg="#cccccc",
            width=8,
            anchor=tk.W
        )
        text_color_label.pack(side=tk.LEFT)

        self.text_color_var = tk.StringVar(value=self.config.get("font_color", "#FFFFFF"))

        # Current text color swatch
        self.text_color_swatch = tk.Label(
            text_color_row,
            text="",
            bg=self.text_color_var.get(),
            width=3,
            height=1,
            relief=tk.SUNKEN
        )
        self.text_color_swatch.pack(side=tk.LEFT, padx=(0, 5))

        # Text color palette
        text_palette = tk.Frame(text_color_row, bg="#333333")
        text_palette.pack(side=tk.LEFT)

        for i, color in enumerate(TEXT_COLORS):
            swatch = tk.Label(
                text_palette,
                text="",
                bg=color,
                width=2,
                height=1,
                relief=tk.RAISED
            )
            swatch.grid(row=0, column=i, padx=1)
            swatch.bind("<Button-1>", lambda e, c=color: self._on_text_color_select(c))
            swatch.bind("<Enter>", lambda e, s=swatch: s.configure(relief=tk.GROOVE))
            swatch.bind("<Leave>", lambda e, s=swatch: s.configure(relief=tk.RAISED))

        # Background color row
        bg_color_row = tk.Frame(color_frame, bg="#333333")
        bg_color_row.pack(fill=tk.X, pady=(3, 0))

        bg_color_label = tk.Label(
            bg_color_row,
            text="Background:",
            font=("Segoe UI", 9),
            bg="#333333",
            fg="#cccccc",
            width=8,
            anchor=tk.W
        )
        bg_color_label.pack(side=tk.LEFT)

        self.bg_color_var = tk.StringVar(value=self.config.get("bg_color", "#2d2d2d"))

        # Current background color swatch
        self.bg_color_swatch = tk.Label(
            bg_color_row,
            text="",
            bg=self.bg_color_var.get(),
            width=3,
            height=1,
            relief=tk.SUNKEN
        )
        self.bg_color_swatch.pack(side=tk.LEFT, padx=(0, 5))

        # Background color palette
        bg_palette = tk.Frame(bg_color_row, bg="#333333")
        bg_palette.pack(side=tk.LEFT)

        for i, color in enumerate(BG_COLORS):
            swatch = tk.Label(
                bg_palette,
                text="",
                bg=color,
                width=2,
                height=1,
                relief=tk.RAISED
            )
            swatch.grid(row=0, column=i, padx=1)
            swatch.bind("<Button-1>", lambda e, c=color: self._on_bg_color_select(c))
            swatch.bind("<Enter>", lambda e, s=swatch: s.configure(relief=tk.GROOVE))
            swatch.bind("<Leave>", lambda e, s=swatch: s.configure(relief=tk.RAISED))

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
            pady=3
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
            pady=3
        )
        save_btn.pack(side=tk.RIGHT)

    def show(self) -> None:
        """Show the settings panel."""
        # Refresh config and all original values when showing
        self.config = load_config()

        # Store original values for cancel restore
        self.original_opacity = self.config.get("opacity", 0.85)
        self.original_font_family = self.config.get("font_family", "Consolas")
        self.original_font_size = self.config.get("font_size", 11)
        self.original_text_color = self.config.get("font_color", "#FFFFFF")
        self.original_bg_color = self.config.get("bg_color", "#2d2d2d")

        # Update UI to match config
        if self.opacity_var:
            self.opacity_var.set(self.original_opacity)
            self.opacity_label.config(text=f"{self.original_opacity:.0%}")

        if self.font_family_var:
            self.font_family_var.set(self.original_font_family)

        if self.font_size_var:
            self.font_size_var.set(str(self.original_font_size))

        if self.text_color_var:
            self.text_color_var.set(self.original_text_color)
            self.text_color_swatch.configure(bg=self.original_text_color)

        if self.bg_color_var:
            self.bg_color_var.set(self.original_bg_color)
            self.bg_color_swatch.configure(bg=self.original_bg_color)

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

    def _on_font_family_change(self, event=None) -> None:
        """Handle font family selection change."""
        family = self.font_family_var.get()
        # Skip separator line
        if family.startswith("─"):
            return
        if self.on_font_change:
            try:
                size = int(self.font_size_var.get())
            except ValueError:
                size = 11
            self.on_font_change(family, size)

    def _on_font_size_change(self, event=None) -> None:
        """Handle font size change."""
        try:
            size = int(self.font_size_var.get())
            # Clamp to valid range
            size = max(8, min(48, size))
            self.font_size_var.set(str(size))
        except ValueError:
            size = 11
            self.font_size_var.set("11")

        if self.on_font_change:
            family = self.font_family_var.get()
            self.on_font_change(family, size)

    def _on_text_color_select(self, color: str) -> None:
        """Handle text color swatch click."""
        self.text_color_var.set(color)
        self.text_color_swatch.configure(bg=color)
        if self.on_text_color_change:
            self.on_text_color_change(color)

    def _on_bg_color_select(self, color: str) -> None:
        """Handle background color swatch click."""
        self.bg_color_var.set(color)
        self.bg_color_swatch.configure(bg=color)
        if self.on_bg_color_change:
            self.on_bg_color_change(color)

    def _on_save(self) -> None:
        """Save settings and hide panel."""
        if self.opacity_var:
            self.config["opacity"] = round(self.opacity_var.get(), 2)

        if self.font_family_var:
            family = self.font_family_var.get()
            if not family.startswith("─"):  # Skip separator
                self.config["font_family"] = family

        if self.font_size_var:
            try:
                self.config["font_size"] = int(self.font_size_var.get())
            except ValueError:
                pass

        if self.text_color_var:
            self.config["font_color"] = self.text_color_var.get()

        if self.bg_color_var:
            self.config["bg_color"] = self.bg_color_var.get()

        save_config(self.config)
        self.saved = True
        self.hide()

        if self.on_save_callback:
            self.on_save_callback()

    def _on_cancel(self) -> None:
        """Cancel and restore all original values."""
        # Restore opacity
        if self.on_opacity_change:
            self.on_opacity_change(self.original_opacity)

        # Restore font
        if self.on_font_change:
            self.on_font_change(self.original_font_family, self.original_font_size)

        # Restore text color
        if self.on_text_color_change:
            self.on_text_color_change(self.original_text_color)

        # Restore background color
        if self.on_bg_color_change:
            self.on_bg_color_change(self.original_bg_color)

        self.saved = False
        self.hide()

        if self.on_cancel_callback:
            self.on_cancel_callback()


# Standalone test
if __name__ == "__main__":
    root = tk.Tk()
    root.title("ScreenPrompt Settings Panel Test")
    root.geometry("450x500")
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

    # Load config for test text widget
    config = load_config()

    # Test text widget to show font/color changes
    test_text = tk.Text(
        content_frame,
        bg=config.get("bg_color", "#2d2d2d"),
        fg=config.get("font_color", "#FFFFFF"),
        font=(config.get("font_family", "Consolas"), config.get("font_size", 11)),
        wrap=tk.WORD,
        height=6,
        padx=10,
        pady=10
    )
    test_text.insert("1.0", "Sample text to preview font and color changes.\n\n"
                            "Open settings to modify appearance.")
    test_text.pack(fill=tk.BOTH, expand=True, pady=20, padx=20)

    # Settings panel (hidden initially)
    settings_panel: Optional[SettingsPanel] = None

    def update_opacity(val: float) -> None:
        print(f"Opacity changed to: {val:.0%}")
        root.attributes("-alpha", val)

    def update_font(family: str, size: int) -> None:
        print(f"Font changed to: {family} {size}pt")
        test_text.configure(font=(family, size))

    def update_text_color(color: str) -> None:
        print(f"Text color changed to: {color}")
        test_text.configure(fg=color)

    def update_bg_color(color: str) -> None:
        print(f"Background color changed to: {color}")
        test_text.configure(bg=color)

    def on_settings_save() -> None:
        print("Settings saved!")
        test_text.pack(fill=tk.BOTH, expand=True, pady=20, padx=20)

    def on_settings_cancel() -> None:
        print("Settings cancelled.")
        test_text.pack(fill=tk.BOTH, expand=True, pady=20, padx=20)

    def toggle_settings() -> None:
        global settings_panel
        if settings_panel is None:
            settings_panel = SettingsPanel(
                content_frame,
                on_opacity_change=update_opacity,
                on_font_change=update_font,
                on_text_color_change=update_text_color,
                on_bg_color_change=update_bg_color,
                on_save=on_settings_save,
                on_cancel=on_settings_cancel
            )

        if settings_panel.is_visible():
            settings_panel.toggle()
        else:
            test_text.pack_forget()
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
        padx=15
    )
    toggle_btn.pack(pady=5)

    # Apply saved opacity on start
    root.attributes("-alpha", config.get("opacity", 0.85))

    root.mainloop()
