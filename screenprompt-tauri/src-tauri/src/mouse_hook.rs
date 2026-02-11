// MIT License - Copyright (c) 2026 ScreenPrompt Contributors
// Low-level mouse hook for scroll-through in locked (click-through) mode

use std::sync::atomic::{AtomicIsize, AtomicU32, Ordering};
use std::sync::Mutex;
use std::sync::OnceLock;
use tauri::WebviewWindow;
use windows::Win32::Foundation::{HWND, LPARAM, LRESULT, POINT, RECT, WPARAM};
use windows::Win32::UI::WindowsAndMessaging::{
    CallNextHookEx, GetMessageW, PostMessageW, SetWindowsHookExW, UnhookWindowsHookEx,
    GetWindowRect, MSG, MSLLHOOKSTRUCT, WH_MOUSE_LL, WM_MOUSEWHEEL,
    PostThreadMessageW, WM_QUIT,
};
use windows::Win32::System::Threading::GetCurrentThreadId;

// Store raw pointer values as atomics to avoid Send issues
static HOOK_HANDLE: AtomicIsize = AtomicIsize::new(0);
static WINDOW_HANDLE: AtomicIsize = AtomicIsize::new(0);
static HOOK_THREAD_ID: AtomicU32 = AtomicU32::new(0);
static INSTALL_LOCK: OnceLock<Mutex<()>> = OnceLock::new();

fn get_install_lock() -> &'static Mutex<()> {
    INSTALL_LOCK.get_or_init(|| Mutex::new(()))
}

unsafe extern "system" fn mouse_hook_proc(
    n_code: i32,
    w_param: WPARAM,
    l_param: LPARAM,
) -> LRESULT {
    if n_code >= 0 && w_param.0 == WM_MOUSEWHEEL as usize {
        let hwnd_val = WINDOW_HANDLE.load(Ordering::Relaxed);
        if hwnd_val != 0 {
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
