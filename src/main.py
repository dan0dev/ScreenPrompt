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
import os
import sys
import tkinter as tk
from tkinter import messagebox
from typing import Optional

try:
    import keyboard
    HOTKEYS_AVAILABLE = True
except ImportError:
    HOTKEYS_AVAILABLE = False
    print("Warning: 'keyboard' module not found. Global hotkeys disabled.")
    print("Install with: pip install keyboard")

from config_manager import (
    load_config,
    save_config,
    is_first_run,
    mark_first_run_complete,
    DEFAULT_CONFIG,
)
from settings_ui import SettingsPanel, get_hwnd, set_capture_exclude

# WinAPI constants for click-through and hiding from taskbar/alt-tab
GWL_EXSTYLE = -20
WS_EX_TRANSPARENT = 0x00000020
WS_EX_LAYERED = 0x00080000
WS_EX_TOOLWINDOW = 0x00000080  # Hides from taskbar and Alt+Tab

# Load user32.dll
user32 = ctypes.windll.user32
user32.GetWindowLongPtrW.restype = ctypes.c_void_p
user32.GetWindowLongPtrW.argtypes = [ctypes.c_void_p, ctypes.c_int]
user32.SetWindowLongPtrW.restype = ctypes.c_void_p
user32.SetWindowLongPtrW.argtypes = [ctypes.c_void_p, ctypes.c_int, ctypes.c_void_p]

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

    # Opacity levels for cycling
    OPACITY_LEVELS = [1.0, 0.85, 0.70, 0.50]

    # Edge detection threshold in pixels
    EDGE_SIZE = 6

    # Window constraints
    MIN_WIDTH = 200
    MIN_HEIGHT = 150

    # Position margins
    SCREEN_MARGIN = 20
    TASKBAR_HEIGHT = 60

    # Nudge distance in pixels
    NUDGE_DISTANCE = 20

    # Placeholder text
    PLACEHOLDER_TEXT = "Enter your prompt here..."
    PLACEHOLDER_COLOR = "#888888"

    def __init__(self):
        self.config = load_config()
        self.drag_data = {"x": 0, "y": 0}
        self.settings_panel: Optional[SettingsPanel] = None

        # State tracking
        self.visible = True
        self.quick_edit_mode = False
        self.opacity_index = 0  # Index into OPACITY_LEVELS
        self.placeholder_active = False  # Track if placeholder is showing

        # Resize state: which edges are being resized
        # Can be combination of: "n", "s", "e", "w"
        self.resize_edges = ""

        # Create main window
        self.root = tk.Tk()
        self.root.title("ScreenPrompt")
        self.root.withdraw()  # Hide initially

        # Set window icon
        self._set_window_icon()

        # Show ethical notice on first run
        if is_first_run():
            self.show_ethical_notice()
            mark_first_run_complete()

        self.setup_window()
        self.setup_widgets()
        self.apply_capture_exclusion()

        # Re-apply opacity after capture exclusion (SetLayeredWindowAttributes resets it)
        self.root.attributes("-alpha", self.config["opacity"])

        # Apply saved lock state if enabled
        if self.locked:
            self._apply_lock_state()

        # Setup global hotkeys
        self.setup_hotkeys()

        # Show window
        self.root.deiconify()

    def show_ethical_notice(self):
        """Display ethical use notice on first run."""
        messagebox.showwarning(
            "ScreenPrompt - Important Notice",
            ETHICAL_NOTICE
        )

    def _set_window_icon(self):
        """Set the window icon from PNG file."""
        try:
            # Try to find the icon in common locations
            icon_paths = [
                os.path.join(os.path.dirname(__file__), '..', 'assets', 'icon-128.png'),
                os.path.join(os.path.dirname(__file__), 'assets', 'icon-128.png'),
                os.path.join(sys._MEIPASS, 'assets', 'icon-128.png') if hasattr(sys, '_MEIPASS') else None,
            ]

            for icon_path in icon_paths:
                if icon_path and os.path.exists(icon_path):
                    icon = tk.PhotoImage(file=icon_path)
                    self.root.iconphoto(True, icon)
                    # Keep a reference to prevent garbage collection
                    self._icon_image = icon
                    return

        except Exception as e:
            # Silently ignore icon errors - not critical
            pass

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

        # Main container with edge frames for resizing
        self.main_container = tk.Frame(root, bg="#1e1e1e")
        self.main_container.pack(fill=tk.BOTH, expand=True)

        # Left edge frame for west resize
        self.left_edge = tk.Frame(self.main_container, width=self.EDGE_SIZE, bg="#1e1e1e")
        self.left_edge.pack(side=tk.LEFT, fill=tk.Y)
        self._bind_resize_edge(self.left_edge, "w")

        # Right edge frame for east resize
        self.right_edge = tk.Frame(self.main_container, width=self.EDGE_SIZE, bg="#1e1e1e")
        self.right_edge.pack(side=tk.RIGHT, fill=tk.Y)
        self._bind_resize_edge(self.right_edge, "e")

        # Inner container for actual content
        self.inner_container = tk.Frame(self.main_container, bg="#1e1e1e")
        self.inner_container.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        # Top edge frame for north resize
        self.top_edge = tk.Frame(self.inner_container, height=self.EDGE_SIZE, bg="#1e1e1e")
        self.top_edge.pack(fill=tk.X, side=tk.TOP)
        self._bind_resize_edge(self.top_edge, "n")

        # Title bar frame for dragging and close button
        self.title_frame = tk.Frame(self.inner_container, bg="#333333", height=25)
        self.title_frame.pack(fill=tk.X, side=tk.TOP)
        self.title_frame.pack_propagate(False)

        # Title label
        title_label = tk.Label(
            self.title_frame,
            text="ScreenPrompt",
            bg="#333333",
            fg="#ffffff",
            font=("Segoe UI", 9)
        )
        title_label.pack(side=tk.LEFT, padx=5)

        # Close button
        close_btn = tk.Label(
            self.title_frame,
            text=" X ",
            bg="#333333",
            fg="#ffffff",
            font=("Segoe UI", 9, "bold")
        )
        close_btn.pack(side=tk.RIGHT, padx=2)
        close_btn.bind("<Button-1>", lambda e: self.on_close())
        close_btn.bind("<Enter>", lambda e: close_btn.configure(bg="#ff4444"))
        close_btn.bind("<Leave>", lambda e: close_btn.configure(bg="#333333"))

        # Settings button (gear icon)
        self.settings_btn = tk.Label(
            self.title_frame,
            text=" \u2699 ",  # Unicode gear
            bg="#333333",
            fg="#ffffff",
            font=("Segoe UI", 10)
        )
        self.settings_btn.pack(side=tk.RIGHT, padx=2)
        self.settings_btn.bind("<Button-1>", lambda e: self.toggle_settings())
        self.settings_btn.bind("<Enter>", lambda e: self.settings_btn.configure(bg="#555555"))
        self.settings_btn.bind("<Leave>", lambda e: self.settings_btn.configure(bg="#333333"))

        # Bind drag events to title bar
        self.title_frame.bind("<Button-1>", self.start_drag)
        self.title_frame.bind("<B1-Motion>", self.do_drag)
        title_label.bind("<Button-1>", self.start_drag)
        title_label.bind("<B1-Motion>", self.do_drag)

        # === PACK BOTTOM ELEMENTS FIRST (before expanding content) ===

        # Resize handle frame (bottom edge)
        self.resize_frame = tk.Frame(self.inner_container, bg="#333333", height=10)
        self.resize_frame.pack(fill=tk.X, side=tk.BOTTOM)

        # Resize grip
        resize_grip = tk.Label(
            self.resize_frame,
            text="...",
            bg="#333333",
            fg="#666666",
            font=("Segoe UI", 8)
        )
        resize_grip.pack(side=tk.RIGHT, padx=5)

        # Bind resize events (bottom/southeast)
        self.resize_frame.bind("<Button-1>", self.start_resize)
        self.resize_frame.bind("<B1-Motion>", self.do_resize)
        resize_grip.bind("<Button-1>", self.start_resize)
        resize_grip.bind("<B1-Motion>", self.do_resize)

        # Bottom bar with font size controls
        self.bottom_bar = tk.Frame(self.inner_container, bg="#333333", height=22)
        self.bottom_bar.pack(fill=tk.X, side=tk.BOTTOM)
        self.bottom_bar.pack_propagate(False)

        # Font size controls container (centered)
        font_controls = tk.Frame(self.bottom_bar, bg="#333333")
        font_controls.pack(side=tk.LEFT, padx=8)

        # Minus button
        minus_btn = tk.Label(
            font_controls,
            text=" - ",
            bg="#333333",
            fg="#aaaaaa",
            font=("Segoe UI", 10, "bold")
        )
        minus_btn.pack(side=tk.LEFT)
        minus_btn.bind("<Button-1>", lambda e: self._decrease_font_size())
        minus_btn.bind("<Enter>", lambda e: minus_btn.configure(bg="#555555", fg="#ffffff"))
        minus_btn.bind("<Leave>", lambda e: minus_btn.configure(bg="#333333", fg="#aaaaaa"))

        # Aa icon
        aa_label = tk.Label(
            font_controls,
            text="Aa",
            bg="#333333",
            fg="#888888",
            font=("Segoe UI", 9)
        )
        aa_label.pack(side=tk.LEFT, padx=2)

        # Plus button
        plus_btn = tk.Label(
            font_controls,
            text=" + ",
            bg="#333333",
            fg="#aaaaaa",
            font=("Segoe UI", 10, "bold")
        )
        plus_btn.pack(side=tk.LEFT)
        plus_btn.bind("<Button-1>", lambda e: self._increase_font_size())
        plus_btn.bind("<Enter>", lambda e: plus_btn.configure(bg="#555555", fg="#ffffff"))
        plus_btn.bind("<Leave>", lambda e: plus_btn.configure(bg="#333333", fg="#aaaaaa"))

        # Clear/reset button
        clear_btn = tk.Label(
            self.bottom_bar,
            text=" reset ",
            bg="#333333",
            fg="#aaaaaa",
            font=("Segoe UI", 8)
        )
        clear_btn.pack(side=tk.LEFT, padx=(8, 0))
        clear_btn.bind("<Button-1>", lambda e: self._clear_text())
        clear_btn.bind("<Enter>", lambda e: clear_btn.configure(bg="#555555", fg="#ff6666"))
        clear_btn.bind("<Leave>", lambda e: clear_btn.configure(bg="#333333", fg="#aaaaaa"))

        # Lock button (mouse pass-through toggle)
        self.locked = self.config.get("locked", False)
        self.lock_btn = tk.Label(
            self.bottom_bar,
            text=" \U0001F512 " if self.locked else " \U0001F513 ",  # Locked/Unlocked icons
            bg="#333333",
            fg="#ffaa00" if self.locked else "#aaaaaa",
            font=("Segoe UI", 10)
        )
        self.lock_btn.pack(side=tk.RIGHT, padx=8)
        self.lock_btn.bind("<Button-1>", lambda e: self._toggle_lock())
        self.lock_btn.bind("<Enter>", lambda e: self.lock_btn.configure(bg="#555555"))
        self.lock_btn.bind("<Leave>", lambda e: self.lock_btn.configure(bg="#333333"))

        # === NOW PACK EXPANDING CONTENT (after bottom elements) ===

        # Content frame (holds either text widget or settings panel)
        self.content_frame = tk.Frame(self.inner_container, bg="#1e1e1e")
        self.content_frame.pack(fill=tk.BOTH, expand=True)

        # Store original text color for placeholder toggling
        self.text_color = self.config.get("font_color", "#ffffff")

        # Text widget for prompt content
        self.text_widget = tk.Text(
            self.content_frame,
            bg=self.config.get("bg_color", "#2d2d2d"),
            fg=self.text_color,
            insertbackground="#ffffff",
            font=(
                self.config.get("font_family", "Consolas"),
                self.config.get("font_size", 11)
            ),
            wrap=tk.WORD,
            borderwidth=0,
            highlightthickness=0,
            cursor="arrow",
            padx=10,
            pady=10
        )
        self.text_widget.pack(fill=tk.BOTH, expand=True, padx=2, pady=(0, 2))

        # Load saved text or show placeholder
        saved_text = self.config.get("text", "")
        if saved_text:
            self.text_widget.insert("1.0", saved_text)
        else:
            self._show_placeholder()

        # Bind focus events for placeholder behavior
        self.text_widget.bind("<FocusIn>", self._on_text_focus_in)
        self.text_widget.bind("<FocusOut>", self._on_text_focus_out)

        # Create settings panel (hidden initially)
        self.settings_panel = SettingsPanel(
            self.content_frame,
            on_opacity_change=lambda v: self.root.attributes("-alpha", v),
            on_font_change=self._apply_font,
            on_text_color_change=self._apply_text_color,
            on_bg_color_change=self._apply_bg_color,
            on_save=self.on_settings_save,
            on_cancel=self.on_settings_cancel
        )

    def _bind_resize_edge(self, frame: tk.Frame, edge: str) -> None:
        """Bind resize events to an edge frame."""
        def start(event):
            self.resize_edges = edge
            self._start_edge_resize(event)

        def drag(event):
            if self.resize_edges:
                self._do_edge_resize(event)

        def release(event):
            self.resize_edges = ""

        frame.bind("<Button-1>", start)
        frame.bind("<B1-Motion>", drag)
        frame.bind("<ButtonRelease-1>", release)

    def toggle_settings(self):
        """Toggle between text view and settings panel."""
        if self.settings_panel and self.settings_panel.is_visible():
            # Settings is visible, this will be handled by cancel callback
            self.settings_panel.toggle()
        else:
            # Show settings, hide text
            self.text_widget.pack_forget()
            if self.settings_panel:
                self.settings_panel.show()

    def _apply_font(self, family: str, size: int) -> None:
        """Apply font changes to text widget for real-time preview."""
        self.text_widget.configure(font=(family, size))

    def _apply_text_color(self, hex_color: str) -> None:
        """Apply text color change to text widget for real-time preview."""
        self.text_color = hex_color
        if not self.placeholder_active:
            self.text_widget.configure(fg=hex_color)

    def _apply_bg_color(self, hex_color: str) -> None:
        """Apply background color change to text widget for real-time preview."""
        self.text_widget.configure(bg=hex_color)

    def _show_placeholder(self) -> None:
        """Show placeholder text in the text widget."""
        self.text_widget.delete("1.0", tk.END)
        self.text_widget.insert("1.0", self.PLACEHOLDER_TEXT)
        self.text_widget.configure(fg=self.PLACEHOLDER_COLOR)
        self.placeholder_active = True

    def _hide_placeholder(self) -> None:
        """Hide placeholder and restore normal text color."""
        if self.placeholder_active:
            self.text_widget.delete("1.0", tk.END)
            self.text_widget.configure(fg=self.text_color)
            self.placeholder_active = False

    def _on_text_focus_in(self, event=None) -> None:
        """Handle text widget gaining focus - hide placeholder."""
        if self.placeholder_active:
            self._hide_placeholder()

    def _on_text_focus_out(self, event=None) -> None:
        """Handle text widget losing focus - show placeholder if empty."""
        content = self.text_widget.get("1.0", tk.END).strip()
        if not content:
            self._show_placeholder()

    def _get_text_content(self) -> str:
        """Get text content, returning empty string if placeholder is active."""
        if self.placeholder_active:
            return ""
        return self.text_widget.get("1.0", tk.END).rstrip("\n")

    def _clear_text(self) -> None:
        """Clear all text and show placeholder."""
        self._show_placeholder()

    def _decrease_font_size(self) -> None:
        """Decrease font size by 1 (minimum 8)."""
        current_size = self.config.get("font_size", 11)
        new_size = max(8, current_size - 1)
        if new_size != current_size:
            self._set_font_size(new_size)

    def _increase_font_size(self) -> None:
        """Increase font size by 1 (maximum 48)."""
        current_size = self.config.get("font_size", 11)
        new_size = min(48, current_size + 1)
        if new_size != current_size:
            self._set_font_size(new_size)

    def _set_font_size(self, size: int) -> None:
        """Set font size and save to config."""
        self.config["font_size"] = size
        family = self.config.get("font_family", "Consolas")
        self.text_widget.configure(font=(family, size))
        save_config(self.config)

    def _toggle_lock(self) -> None:
        """Toggle mouse pass-through (click-through) mode."""
        self.locked = not self.locked
        self._apply_lock_state()
        self.config["locked"] = self.locked
        save_config(self.config)

    def _apply_lock_state(self) -> None:
        """Apply the current lock state to the window."""
        hwnd = get_hwnd(self.root)
        ex_style = user32.GetWindowLongPtrW(hwnd, GWL_EXSTYLE)

        if self.locked:
            # Enable click-through: add WS_EX_TRANSPARENT
            user32.SetWindowLongPtrW(hwnd, GWL_EXSTYLE, ex_style | WS_EX_TRANSPARENT)
            self.lock_btn.configure(
                text=" \U0001F512 ",  # Locked icon
                fg="#ffaa00"
            )
        else:
            # Disable click-through: remove WS_EX_TRANSPARENT
            user32.SetWindowLongPtrW(hwnd, GWL_EXSTYLE, ex_style & ~WS_EX_TRANSPARENT)
            self.lock_btn.configure(
                text=" \U0001F513 ",  # Unlocked icon
                fg="#aaaaaa"
            )

    # ========== HOTKEY SYSTEM ==========

    def setup_hotkeys(self) -> None:
        """Register all global hotkeys."""
        if not HOTKEYS_AVAILABLE:
            return

        def safe_add_hotkey(hotkey: str, callback, description: str = "") -> bool:
            """Safely register a hotkey, returning False on failure."""
            try:
                keyboard.add_hotkey(hotkey, callback)
                return True
            except Exception as e:
                print(f"Warning: Failed to register hotkey '{hotkey}' ({description}): {e}")
                return False

        # Phase 1: Essential shortcuts
        safe_add_hotkey("ctrl+shift+h", self._hotkey_toggle_visibility, "toggle visibility")
        safe_add_hotkey("ctrl+shift+l", self._hotkey_toggle_lock, "toggle lock")
        safe_add_hotkey("ctrl+shift+e", self._hotkey_quick_edit, "quick edit")
        safe_add_hotkey("escape", self._hotkey_emergency_unlock, "emergency unlock")

        # Phase 2: Font size (Hungarian keyboard friendly - use Page keys)
        safe_add_hotkey("ctrl+shift+page up", self._hotkey_increase_font, "increase font")
        safe_add_hotkey("ctrl+shift+page down", self._hotkey_decrease_font, "decrease font")
        safe_add_hotkey("ctrl+shift+home", self._hotkey_reset_font, "reset font")

        # Phase 2: Opacity
        safe_add_hotkey("ctrl+shift+o", self._hotkey_cycle_opacity, "cycle opacity")

        # Phase 2: Position presets (use numpad - works on all keyboard layouts)
        safe_add_hotkey("ctrl+alt+num 1", lambda: self._hotkey_position_preset(0, 2), "bottom-left")
        safe_add_hotkey("ctrl+alt+num 2", lambda: self._hotkey_position_preset(1, 2), "bottom-center")
        safe_add_hotkey("ctrl+alt+num 3", lambda: self._hotkey_position_preset(2, 2), "bottom-right")
        safe_add_hotkey("ctrl+alt+num 4", lambda: self._hotkey_position_preset(0, 1), "center-left")
        safe_add_hotkey("ctrl+alt+num 5", lambda: self._hotkey_position_preset(1, 1), "center")
        safe_add_hotkey("ctrl+alt+num 6", lambda: self._hotkey_position_preset(2, 1), "center-right")
        safe_add_hotkey("ctrl+alt+num 7", lambda: self._hotkey_position_preset(0, 0), "top-left")
        safe_add_hotkey("ctrl+alt+num 8", lambda: self._hotkey_position_preset(1, 0), "top-center")
        safe_add_hotkey("ctrl+alt+num 9", lambda: self._hotkey_position_preset(2, 0), "top-right")

        # Phase 2: Nudge window
        nd = self.NUDGE_DISTANCE
        safe_add_hotkey("ctrl+shift+up", lambda: self._hotkey_nudge(0, -nd), "nudge up")
        safe_add_hotkey("ctrl+shift+down", lambda: self._hotkey_nudge(0, nd), "nudge down")
        safe_add_hotkey("ctrl+shift+left", lambda: self._hotkey_nudge(-nd, 0), "nudge left")
        safe_add_hotkey("ctrl+shift+right", lambda: self._hotkey_nudge(nd, 0), "nudge right")

        # Application shortcuts
        safe_add_hotkey("ctrl+shift+s", self._hotkey_toggle_settings, "toggle settings")
        safe_add_hotkey("ctrl+shift+r", self._hotkey_reset_geometry, "reset geometry")
        safe_add_hotkey("ctrl+shift+q", self._hotkey_quit, "quit")
        safe_add_hotkey("ctrl+shift+f1", self._hotkey_panic, "PANIC - instant close")

        # Text shortcuts
        safe_add_hotkey("ctrl+shift+c", self._hotkey_copy_all, "copy all")
        safe_add_hotkey("ctrl+shift+v", self._hotkey_paste_replace, "paste replace")
        safe_add_hotkey("ctrl+shift+delete", self._hotkey_clear_text, "clear text")

    def cleanup_hotkeys(self) -> None:
        """Unregister all global hotkeys."""
        if HOTKEYS_AVAILABLE:
            keyboard.unhook_all_hotkeys()

    def _run_in_main_thread(self, func) -> None:
        """Schedule a function to run in the Tkinter main thread."""
        self.root.after(0, func)

    # --- Phase 1: Essential shortcuts ---

    def _hotkey_toggle_visibility(self) -> None:
        """Toggle window visibility (Ctrl+Shift+H)."""
        def toggle():
            if self.visible:
                self.root.withdraw()
                self.visible = False
            else:
                self.root.deiconify()
                self.root.lift()
                self.visible = True
        self._run_in_main_thread(toggle)

    def _hotkey_toggle_lock(self) -> None:
        """Toggle lock/click-through mode (Ctrl+Shift+L)."""
        self._run_in_main_thread(self._toggle_lock)

    def _hotkey_quick_edit(self) -> None:
        """Quick edit mode - unlock, focus, auto-relock on blur (Ctrl+Shift+E)."""
        def start_quick_edit():
            # Remember if we were locked
            was_locked = self.locked

            # Unlock if needed
            if self.locked:
                self._toggle_lock()

            # Show and focus
            if not self.visible:
                self.root.deiconify()
                self.visible = True

            self.root.lift()
            self.text_widget.focus_set()

            # Setup auto-relock on focus loss
            if was_locked:
                # Clear any previous binding first to prevent accumulation
                self.text_widget.unbind("<FocusOut>")
                self.quick_edit_mode = True

                def on_focus_out(event):
                    if self.quick_edit_mode:
                        self.quick_edit_mode = False
                        self._toggle_lock()
                        self.text_widget.unbind("<FocusOut>")

                self.text_widget.bind("<FocusOut>", on_focus_out)

        self._run_in_main_thread(start_quick_edit)

    def _hotkey_emergency_unlock(self) -> None:
        """Emergency unlock - always unlocks (Escape)."""
        def unlock():
            if self.locked:
                self._toggle_lock()
            self.quick_edit_mode = False
        self._run_in_main_thread(unlock)

    # --- Phase 2: Font size shortcuts ---

    def _hotkey_increase_font(self) -> None:
        """Increase font size (Ctrl+Shift+=)."""
        self._run_in_main_thread(self._increase_font_size)

    def _hotkey_decrease_font(self) -> None:
        """Decrease font size (Ctrl+Shift+-)."""
        self._run_in_main_thread(self._decrease_font_size)

    def _hotkey_reset_font(self) -> None:
        """Reset font size to default (Ctrl+Shift+0)."""
        def reset():
            self._set_font_size(DEFAULT_CONFIG["font_size"])
        self._run_in_main_thread(reset)

    # --- Phase 2: Opacity shortcut ---

    def _hotkey_cycle_opacity(self) -> None:
        """Cycle through opacity levels (Ctrl+Shift+O)."""
        def cycle():
            self.opacity_index = (self.opacity_index + 1) % len(self.OPACITY_LEVELS)
            opacity = self.OPACITY_LEVELS[self.opacity_index]
            self.root.attributes("-alpha", opacity)
            self.config["opacity"] = opacity
            save_config(self.config)
        self._run_in_main_thread(cycle)

    # --- Phase 2: Position presets ---

    def _hotkey_position_preset(self, x_pos: int, y_pos: int) -> None:
        """
        Move window to position preset.
        x_pos: 0=left, 1=center, 2=right
        y_pos: 0=top, 1=center, 2=bottom
        """
        def move():
            screen_width = self.root.winfo_screenwidth()
            screen_height = self.root.winfo_screenheight()
            win_width = self.root.winfo_width()
            win_height = self.root.winfo_height()
            margin = self.SCREEN_MARGIN

            # Calculate x position
            if x_pos == 0:  # Left
                x = margin
            elif x_pos == 1:  # Center
                x = (screen_width - win_width) // 2
            else:  # Right
                x = screen_width - win_width - margin

            # Calculate y position
            if y_pos == 0:  # Top
                y = margin
            elif y_pos == 1:  # Center
                y = (screen_height - win_height) // 2
            else:  # Bottom
                y = screen_height - win_height - self.TASKBAR_HEIGHT

            self.root.geometry(f"+{x}+{y}")
            self.config["x"] = x
            self.config["y"] = y
            save_config(self.config)
        self._run_in_main_thread(move)

    def _hotkey_nudge(self, dx: int, dy: int) -> None:
        """Nudge window by delta pixels and save position."""
        def nudge():
            x = self.root.winfo_x() + dx
            y = self.root.winfo_y() + dy
            self.root.geometry(f"+{x}+{y}")
            # Save position to config
            self.config["x"] = x
            self.config["y"] = y
            save_config(self.config)
        self._run_in_main_thread(nudge)

    # --- Application shortcuts ---

    def _hotkey_toggle_settings(self) -> None:
        """Toggle settings panel (Ctrl+Shift+,)."""
        def toggle():
            # Make sure window is visible first
            if not self.visible:
                self.root.deiconify()
                self.visible = True
            self.root.lift()
            self.toggle_settings()
        self._run_in_main_thread(toggle)

    def _hotkey_reset_geometry(self) -> None:
        """Reset window position and size to defaults (Ctrl+Shift+R)."""
        def reset():
            x = DEFAULT_CONFIG["x"]
            y = DEFAULT_CONFIG["y"]
            w = DEFAULT_CONFIG["width"]
            h = DEFAULT_CONFIG["height"]
            self.root.geometry(f"{w}x{h}+{x}+{y}")
            self.config["x"] = x
            self.config["y"] = y
            self.config["width"] = w
            self.config["height"] = h
            save_config(self.config)
        self._run_in_main_thread(reset)

    def _hotkey_quit(self) -> None:
        """Quit application (Ctrl+Shift+Q)."""
        self._run_in_main_thread(self.on_close)

    def _hotkey_panic(self) -> None:
        """PANIC button - instantly close app without confirmation (Ctrl+Shift+F1)."""
        def panic_close():
            try:
                # Save config first
                save_config(self._get_current_config())
                # Cleanup hotkeys
                self.cleanup_hotkeys()
                # Force immediate exit
                self.root.quit()
                self.root.destroy()
                sys.exit(0)
            except Exception:
                # Even if something fails, force exit
                sys.exit(0)
        self._run_in_main_thread(panic_close)

    # --- Text shortcuts ---

    def _hotkey_copy_all(self) -> None:
        """Copy all text to clipboard (Ctrl+Shift+C)."""
        def copy():
            text = self._get_text_content()  # Don't copy placeholder
            if text:
                self.root.clipboard_clear()
                self.root.clipboard_append(text)
        self._run_in_main_thread(copy)

    def _hotkey_paste_replace(self) -> None:
        """Paste and replace all text (Ctrl+Shift+V)."""
        def paste():
            try:
                text = self.root.clipboard_get()
                self._hide_placeholder()  # Clear placeholder first
                self.text_widget.delete("1.0", tk.END)
                self.text_widget.insert("1.0", text)
            except tk.TclError:
                pass  # Clipboard empty or unavailable
        self._run_in_main_thread(paste)

    def _hotkey_clear_text(self) -> None:
        """Clear all text (Ctrl+Shift+Delete)."""
        def clear():
            self._show_placeholder()  # Clear and show placeholder
        self._run_in_main_thread(clear)

    def on_settings_save(self):
        """Handle settings save - reload config and show text."""
        self.config = load_config()
        self.text_widget.pack(fill=tk.BOTH, expand=True, padx=2, pady=(0, 2))

    def on_settings_cancel(self):
        """Handle settings cancel - show text."""
        self.text_widget.pack(fill=tk.BOTH, expand=True, padx=2, pady=(0, 2))

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

        # Get the window handle and apply 3-step capture exclusion
        hwnd = get_hwnd(self.root)
        if not set_capture_exclude(hwnd):
            print("Warning: SetWindowDisplayAffinity failed")

        # Hide from taskbar and Alt+Tab
        ex_style = user32.GetWindowLongPtrW(hwnd, GWL_EXSTYLE)
        user32.SetWindowLongPtrW(hwnd, GWL_EXSTYLE, ex_style | WS_EX_TOOLWINDOW)

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
        """Initialize window resize operation (for bottom resize bar)."""
        self.resize_edges = "se"  # Bottom bar = southeast resize
        self._start_edge_resize(event)

    def do_resize(self, event):
        """Handle window resizing (for bottom resize bar)."""
        self._do_edge_resize(event)

    def _start_edge_resize(self, event):
        """Initialize edge resize operation."""
        self.drag_data["x"] = event.x_root
        self.drag_data["y"] = event.y_root
        self.drag_data["width"] = self.root.winfo_width()
        self.drag_data["height"] = self.root.winfo_height()
        self.drag_data["win_x"] = self.root.winfo_x()
        self.drag_data["win_y"] = self.root.winfo_y()

    def _do_edge_resize(self, event):
        """Handle edge resize based on which edges are active."""
        if not self.resize_edges:
            return

        dx = event.x_root - self.drag_data["x"]
        dy = event.y_root - self.drag_data["y"]

        new_x = self.drag_data["win_x"]
        new_y = self.drag_data["win_y"]
        new_w = self.drag_data["width"]
        new_h = self.drag_data["height"]

        min_w, min_h = self.MIN_WIDTH, self.MIN_HEIGHT

        # Handle west (left) edge
        if "w" in self.resize_edges:
            potential_w = self.drag_data["width"] - dx
            if potential_w >= min_w:
                new_w = potential_w
                new_x = self.drag_data["win_x"] + dx

        # Handle east (right) edge
        if "e" in self.resize_edges:
            new_w = max(min_w, self.drag_data["width"] + dx)

        # Handle north (top) edge
        if "n" in self.resize_edges:
            potential_h = self.drag_data["height"] - dy
            if potential_h >= min_h:
                new_h = potential_h
                new_y = self.drag_data["win_y"] + dy

        # Handle south (bottom) edge
        if "s" in self.resize_edges:
            new_h = max(min_h, self.drag_data["height"] + dy)

        self.root.geometry(f"{new_w}x{new_h}+{new_x}+{new_y}")

    def _get_current_config(self) -> dict:
        """Get current window state as config dict."""
        config = self.config.copy()
        config["x"] = self.root.winfo_x()
        config["y"] = self.root.winfo_y()
        config["width"] = self.root.winfo_width()
        config["height"] = self.root.winfo_height()
        config["text"] = self._get_text_content()
        config["opacity"] = self.root.attributes("-alpha")
        config["locked"] = self.locked
        config["font_color"] = self.text_color
        return config

    def on_close(self):
        """Save state and close the application."""
        # Cleanup hotkeys
        self.cleanup_hotkeys()

        # Update config with current state
        self.config["x"] = self.root.winfo_x()
        self.config["y"] = self.root.winfo_y()
        self.config["width"] = self.root.winfo_width()
        self.config["height"] = self.root.winfo_height()
        self.config["text"] = self._get_text_content()  # Don't save placeholder
        self.config["opacity"] = self.root.attributes("-alpha")
        self.config["locked"] = self.locked
        self.config["font_color"] = self.text_color

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

    try:
        app = ScreenPromptWindow()
        app.run()
    except KeyboardInterrupt:
        print("\nScreenPrompt closed by user.")
    except Exception as e:
        # Log unexpected errors (safely handle Unicode)
        error_msg = str(e).encode('ascii', 'replace').decode('ascii')
        print(f"Error: An unexpected error occurred: {error_msg}")
        # Show error dialog if Tk is available
        try:
            root = tk.Tk()
            root.withdraw()
            messagebox.showerror(
                "ScreenPrompt Error",
                f"An unexpected error occurred:\n\n{e}\n\n"
                "Please report this issue at:\n"
                "https://github.com/dan0dev/ScreenPrompt/issues"
            )
        except Exception:
            pass
        sys.exit(1)


if __name__ == "__main__":
    main()
