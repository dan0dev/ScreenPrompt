// MIT License - Copyright (c) 2026 ScreenPrompt Contributors
// Low-level mouse hook for locked (click-through) mode: forwards scroll to the
// overlay and turns a click on the lock button into an unlock.

use std::sync::atomic::{AtomicBool, AtomicI32, AtomicIsize, AtomicU32, Ordering};
use std::sync::Mutex;
use std::sync::OnceLock;
use tauri::{AppHandle, Emitter, Manager, WebviewWindow};
use windows::Win32::Foundation::{HWND, LPARAM, LRESULT, POINT, RECT, WPARAM};
use windows::Win32::Graphics::Gdi::ClientToScreen;
use windows::Win32::UI::WindowsAndMessaging::{
    CallNextHookEx, GetMessageW, PostMessageW, SetWindowsHookExW, UnhookWindowsHookEx,
    GetWindowRect, IsWindowVisible, MSG, MSLLHOOKSTRUCT, WH_MOUSE_LL, WM_LBUTTONDOWN,
    WM_LBUTTONUP, WM_MOUSEWHEEL, PostThreadMessageW, WM_QUIT,
};
use windows::Win32::System::Threading::GetCurrentThreadId;

// Store raw pointer values as atomics to avoid Send issues
static HOOK_HANDLE: AtomicIsize = AtomicIsize::new(0);
static WINDOW_HANDLE: AtomicIsize = AtomicIsize::new(0);
static HOOK_THREAD_ID: AtomicU32 = AtomicU32::new(0);
static INSTALL_LOCK: OnceLock<Mutex<()>> = OnceLock::new();
static APP_HANDLE: OnceLock<Mutex<Option<AppHandle>>> = OnceLock::new();

// Lock button bounds in physical pixels, relative to the window's client area.
// Set from the frontend; width 0 means "no zone".
static UNLOCK_X: AtomicI32 = AtomicI32::new(0);
static UNLOCK_Y: AtomicI32 = AtomicI32::new(0);
static UNLOCK_W: AtomicI32 = AtomicI32::new(0);
static UNLOCK_H: AtomicI32 = AtomicI32::new(0);
// Set when we swallow a button-down, so the matching button-up is swallowed too
static SWALLOW_UP: AtomicBool = AtomicBool::new(false);

fn get_install_lock() -> &'static Mutex<()> {
    INSTALL_LOCK.get_or_init(|| Mutex::new(()))
}

fn get_app_handle_store() -> &'static Mutex<Option<AppHandle>> {
    APP_HANDLE.get_or_init(|| Mutex::new(None))
}

/// Record where the lock button is, so clicks on it unlock while click-through is on
pub fn set_unlock_zone(x: i32, y: i32, width: i32, height: i32) {
    UNLOCK_X.store(x, Ordering::Relaxed);
    UNLOCK_Y.store(y, Ordering::Relaxed);
    UNLOCK_W.store(width, Ordering::Relaxed);
    UNLOCK_H.store(height, Ordering::Relaxed);
}

unsafe fn cursor_in_unlock_zone(hwnd: HWND, cursor: &POINT) -> bool {
    let w = UNLOCK_W.load(Ordering::Relaxed);
    let h = UNLOCK_H.load(Ordering::Relaxed);
    if w <= 0 || h <= 0 {
        return false;
    }
    let mut origin = POINT { x: 0, y: 0 };
    if !ClientToScreen(hwnd, &mut origin).as_bool() {
        return false;
    }
    let left = origin.x + UNLOCK_X.load(Ordering::Relaxed);
    let top = origin.y + UNLOCK_Y.load(Ordering::Relaxed);
    let zone = RECT { left, top, right: left + w, bottom: top + h };
    cursor_in_rect(cursor, &zone)
}

unsafe extern "system" fn mouse_hook_proc(
    n_code: i32,
    w_param: WPARAM,
    l_param: LPARAM,
) -> LRESULT {
    if n_code >= 0 && w_param.0 == WM_LBUTTONUP as usize && SWALLOW_UP.swap(false, Ordering::Relaxed) {
        return LRESULT(1);
    }

    if n_code >= 0 && w_param.0 == WM_LBUTTONDOWN as usize {
        let hwnd_val = WINDOW_HANDLE.load(Ordering::Relaxed);
        if hwnd_val != 0 {
            let hwnd = HWND(hwnd_val as *mut core::ffi::c_void);
            let mouse_struct = &*(l_param.0 as *const MSLLHOOKSTRUCT);
            if IsWindowVisible(hwnd).as_bool() && cursor_in_unlock_zone(hwnd, &mouse_struct.pt) {
                if let Ok(guard) = get_app_handle_store().lock() {
                    if let Some(ref handle) = *guard {
                        let _ = handle.emit("emergency-unlock", ());
                    }
                }
                SWALLOW_UP.store(true, Ordering::Relaxed);
                return LRESULT(1); // Consume so the app beneath doesn't get the click
            }
        }
    }

    if n_code >= 0 && w_param.0 == WM_MOUSEWHEEL as usize {
        let hwnd_val = WINDOW_HANDLE.load(Ordering::Relaxed);
        // Skip while hidden, or scrolling over the overlay's old spot would be eaten
        if hwnd_val != 0 && IsWindowVisible(HWND(hwnd_val as *mut core::ffi::c_void)).as_bool() {
            let hwnd = HWND(hwnd_val as *mut core::ffi::c_void);
            let mouse_struct = &*(l_param.0 as *const MSLLHOOKSTRUCT);
            let cursor = mouse_struct.pt;

            let mut rect = RECT::default();
            if GetWindowRect(hwnd, &mut rect).is_ok() && cursor_in_rect(&cursor, &rect) {
                // Forward the scroll event to the webview
                let hi_word = (mouse_struct.mouseData >> 16) as i16;
                let w = WPARAM((hi_word as u16 as usize) << 16);
                let l = LPARAM(
                    ((cursor.y & 0xFFFF) << 16 | (cursor.x & 0xFFFF)) as isize,
                );
                let _ = PostMessageW(hwnd, WM_MOUSEWHEEL, w, l);
                return LRESULT(1); // Consume the event
            }
        }
    }

    CallNextHookEx(None, n_code, w_param, l_param)
}

fn cursor_in_rect(pt: &POINT, rect: &RECT) -> bool {
    pt.x >= rect.left && pt.x <= rect.right && pt.y >= rect.top && pt.y <= rect.bottom
}

pub fn install_hook(window: WebviewWindow) -> Result<(), String> {
    let _guard = get_install_lock()
        .lock()
        .map_err(|e| format!("Lock error: {}", e))?;

    // Already installed
    if HOOK_HANDLE.load(Ordering::Relaxed) != 0 {
        return Ok(());
    }

    let hwnd_val = window
        .hwnd()
        .map_err(|e| format!("Failed to get HWND: {}", e))?
        .0;

    // Store HWND for the hook callback
    WINDOW_HANDLE.store(hwnd_val as isize, Ordering::Relaxed);

    // Store the app handle so a lock-button click can emit the unlock event
    {
        let mut handle_guard = get_app_handle_store()
            .lock()
            .map_err(|e| format!("Lock error: {}", e))?;
        *handle_guard = Some(window.app_handle().clone());
    }

    // Use a channel that sends raw values (isize + u32) instead of HHOOK
    let (tx, rx) = std::sync::mpsc::channel::<Result<(isize, u32), String>>();

    std::thread::spawn(move || unsafe {
        let hook = SetWindowsHookExW(WH_MOUSE_LL, Some(mouse_hook_proc), None, 0);
        match hook {
            Ok(h) => {
                let tid = GetCurrentThreadId();
                let _ = tx.send(Ok((h.0 as isize, tid)));

                // Message loop to keep the hook alive
                let mut msg = MSG::default();
                while GetMessageW(&mut msg, None, 0, 0).as_bool() {
                    // WM_QUIT will break the loop
                }
            }
            Err(e) => {
                let _ = tx.send(Err(format!("SetWindowsHookExW failed: {}", e)));
            }
        }
    });

    match rx.recv() {
        Ok(Ok((hook_ptr, thread_id))) => {
            HOOK_HANDLE.store(hook_ptr, Ordering::Relaxed);
            HOOK_THREAD_ID.store(thread_id, Ordering::Relaxed);
            Ok(())
        }
        Ok(Err(e)) => {
            WINDOW_HANDLE.store(0, Ordering::Relaxed);
            Err(e)
        }
        Err(e) => {
            WINDOW_HANDLE.store(0, Ordering::Relaxed);
            Err(format!("Hook thread communication error: {}", e))
        }
    }
}

pub fn uninstall_hook() -> Result<(), String> {
    let _guard = get_install_lock()
        .lock()
        .map_err(|e| format!("Lock error: {}", e))?;

    let hook_ptr = HOOK_HANDLE.swap(0, Ordering::Relaxed);
    let thread_id = HOOK_THREAD_ID.swap(0, Ordering::Relaxed);
    WINDOW_HANDLE.store(0, Ordering::Relaxed);
    SWALLOW_UP.store(false, Ordering::Relaxed);

    if let Ok(mut guard) = get_app_handle_store().lock() {
        *guard = None;
    }

    if hook_ptr != 0 {
        unsafe {
            use windows::Win32::UI::WindowsAndMessaging::HHOOK;
            let hook = HHOOK(hook_ptr as *mut core::ffi::c_void);
            let _ = UnhookWindowsHookEx(hook);

            if thread_id != 0 {
                let _ = PostThreadMessageW(thread_id, WM_QUIT, WPARAM(0), LPARAM(0));
            }
        }
    }

    Ok(())
}
