// MIT License - Copyright (c) 2026 ScreenPrompt Contributors
// Low-level keyboard hook to capture bare Escape for emergency unlock

use std::sync::atomic::{AtomicIsize, AtomicU32, Ordering};
use std::sync::Mutex;
use std::sync::OnceLock;
use tauri::{AppHandle, Emitter};
use windows::Win32::Foundation::{LPARAM, LRESULT, WPARAM};
use windows::Win32::UI::WindowsAndMessaging::{
    CallNextHookEx, GetMessageW, SetWindowsHookExW, UnhookWindowsHookEx,
    PostThreadMessageW, MSG, KBDLLHOOKSTRUCT, WH_KEYBOARD_LL, WM_KEYDOWN, WM_QUIT,
};
use windows::Win32::UI::Input::KeyboardAndMouse::VK_ESCAPE;
use windows::Win32::System::Threading::GetCurrentThreadId;

static KB_HOOK_HANDLE: AtomicIsize = AtomicIsize::new(0);
static KB_HOOK_THREAD_ID: AtomicU32 = AtomicU32::new(0);
static KB_INSTALL_LOCK: OnceLock<Mutex<()>> = OnceLock::new();
static APP_HANDLE: OnceLock<Mutex<Option<AppHandle>>> = OnceLock::new();

fn get_install_lock() -> &'static Mutex<()> {
    KB_INSTALL_LOCK.get_or_init(|| Mutex::new(()))
}

fn get_app_handle_store() -> &'static Mutex<Option<AppHandle>> {
    APP_HANDLE.get_or_init(|| Mutex::new(None))
}

unsafe extern "system" fn keyboard_hook_proc(
    n_code: i32,
    w_param: WPARAM,
    l_param: LPARAM,
) -> LRESULT {
    if n_code >= 0 && w_param.0 == WM_KEYDOWN as usize {
        let kb_struct = &*(l_param.0 as *const KBDLLHOOKSTRUCT);
        if kb_struct.vkCode == VK_ESCAPE.0 as u32 {
            // Emit event to frontend
            if let Ok(guard) = get_app_handle_store().lock() {
                if let Some(ref handle) = *guard {
                    let _ = handle.emit("emergency-unlock", ());
                }
            }
            // Don't consume Escape - let it pass through to other apps
        }
    }

    CallNextHookEx(None, n_code, w_param, l_param)
}

pub fn install_hook(app_handle: AppHandle) -> Result<(), String> {
    let _guard = get_install_lock()
        .lock()
        .map_err(|e| format!("Lock error: {}", e))?;

    if KB_HOOK_HANDLE.load(Ordering::Relaxed) != 0 {
        return Ok(());
    }

    // Store the app handle for event emission
    {
        let mut handle_guard = get_app_handle_store()
            .lock()
            .map_err(|e| format!("Lock error: {}", e))?;
        *handle_guard = Some(app_handle);
    }

    let (tx, rx) = std::sync::mpsc::channel::<Result<(isize, u32), String>>();

    std::thread::spawn(move || unsafe {
        let hook = SetWindowsHookExW(WH_KEYBOARD_LL, Some(keyboard_hook_proc), None, 0);
        match hook {
            Ok(h) => {
                let tid = GetCurrentThreadId();
                let _ = tx.send(Ok((h.0 as isize, tid)));

                let mut msg = MSG::default();
                while GetMessageW(&mut msg, None, 0, 0).as_bool() {}
            }
            Err(e) => {
                let _ = tx.send(Err(format!("SetWindowsHookExW failed: {}", e)));
            }
        }
    });

    match rx.recv() {
        Ok(Ok((hook_ptr, thread_id))) => {
            KB_HOOK_HANDLE.store(hook_ptr, Ordering::Relaxed);
            KB_HOOK_THREAD_ID.store(thread_id, Ordering::Relaxed);
            Ok(())
        }
        Ok(Err(e)) => Err(e),
        Err(e) => Err(format!("Hook thread communication error: {}", e)),
    }
}

pub fn uninstall_hook() -> Result<(), String> {
    let _guard = get_install_lock()
        .lock()
        .map_err(|e| format!("Lock error: {}", e))?;

    let hook_ptr = KB_HOOK_HANDLE.swap(0, Ordering::Relaxed);
    let thread_id = KB_HOOK_THREAD_ID.swap(0, Ordering::Relaxed);

    // Clear the app handle
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
