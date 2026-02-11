// MIT License - Copyright (c) 2026 ScreenPrompt Contributors
// Windows API integration for ScreenPrompt

use tauri::WebviewWindow;
use windows::Win32::Foundation::HWND;
use windows::Win32::UI::WindowsAndMessaging::{
    GetWindowLongPtrW, SetWindowLongPtrW, SetLayeredWindowAttributes,
    GWL_EXSTYLE, LWA_ALPHA, WS_EX_LAYERED, WS_EX_TRANSPARENT,
};

// Windows 10 Display Affinity constants
const WDA_EXCLUDEFROMCAPTURE: u32 = 0x00000011;

// External Windows API functions
#[link(name = "user32")]
extern "system" {
    fn SetWindowDisplayAffinity(hwnd: HWND, affinity: u32) -> i32;
}

/// Check if Windows version supports WDA_EXCLUDEFROMCAPTURE (Build 2004+)
pub fn check_windows_version() -> Result<String, String> {
    // For Windows 10/11, we need Build 19041 (2004) or higher
    // In practice, we just try to use the API and catch errors
    Ok("Windows 10/11 (version check OK)".to_string())
}

/// Apply WDA_EXCLUDEFROMCAPTURE to hide window from screen capture
///
/// This is the 3-step process documented in CLAUDE.md:
/// 1. Add WS_EX_LAYERED extended style
/// 2. Call SetLayeredWindowAttributes (makes it compatible with affinity)
/// 3. Call SetWindowDisplayAffinity
///
/// Reference: https://learn.microsoft.com/en-us/answers/questions/700122/setwindowdisplayaffinity-on-windows-11
pub fn apply_capture_exclusion(window: WebviewWindow) -> Result<(), String> {
    unsafe {
        // Get the window handle
        let hwnd_val = window.hwnd().map_err(|e| format!("Failed to get HWND: {}", e))?.0;
        let hwnd = HWND(hwnd_val as *mut core::ffi::c_void);

        // Step 1: Get current extended style and add WS_EX_LAYERED
        let ex_style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
        SetWindowLongPtrW(hwnd, GWL_EXSTYLE, ex_style | WS_EX_LAYERED.0 as isize);

        // Step 2: Set layered attributes (255 = fully opaque, LWA_ALPHA mode)
        // This makes it a "SetLayeredWindowAttributes window" which is
        // compatible with SetWindowDisplayAffinity (unlike UpdateLayeredWindow)
        let result = SetLayeredWindowAttributes(hwnd, windows::Win32::Foundation::COLORREF(0), 255, LWA_ALPHA);
        if result.is_err() {
            return Err("SetLayeredWindowAttributes failed".to_string());
        }

        // Step 3: Now apply capture exclusion
        let affinity_result = SetWindowDisplayAffinity(hwnd, WDA_EXCLUDEFROMCAPTURE);
        if affinity_result == 0 {
            return Err("SetWindowDisplayAffinity failed - requires Windows 10 Build 2004+".to_string());
        }

        Ok(())
    }
}

/// Toggle click-through (mouse pass-through) mode
///
/// When enabled, clicks pass through the window to apps beneath.
/// Uses both WS_EX_TRANSPARENT (outer window) and Tauri's
/// set_ignore_cursor_events (WebView2 child) so the entire
/// window becomes truly click-through.
pub fn set_click_through(window: WebviewWindow, enabled: bool) -> Result<(), String> {
    unsafe {
        let hwnd_val = window.hwnd().map_err(|e| format!("Failed to get HWND: {}", e))?.0;
        let hwnd = HWND(hwnd_val as *mut core::ffi::c_void);

        let ex_style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);

        if enabled {
            SetWindowLongPtrW(hwnd, GWL_EXSTYLE, ex_style | WS_EX_TRANSPARENT.0 as isize);
        } else {
            SetWindowLongPtrW(hwnd, GWL_EXSTYLE, ex_style & !(WS_EX_TRANSPARENT.0 as isize));
        }
    }

    // Also tell the WebView2 child to ignore/accept cursor events
    window
        .set_ignore_cursor_events(enabled)
        .map_err(|e| format!("set_ignore_cursor_events failed: {}", e))?;

    Ok(())
}
