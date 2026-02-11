// MIT License - Copyright (c) 2026 ScreenPrompt Contributors

#[cfg(windows)]
mod windows_api;
#[cfg(windows)]
mod mouse_hook;
#[cfg(windows)]
mod keyboard_hook;

use tauri::{Manager, WebviewWindow};

#[tauri::command]
fn show_ethical_notice() -> String {
    "ScreenPrompt is intended for legitimate use only, such as:\n\
     - Presentations and meetings\n\
     - Content creation\n\
     - Personal productivity\n\n\
     DO NOT use this software for:\n\
     - Cheating on exams or assessments\n\
     - Violating academic integrity policies\n\
     - Breaking terms of service of any platform\n\
     - Any illegal activities\n\n\
     You are solely responsible for how you use this software.\n\n\
     This software runs 100% locally. No data collection, no telemetry.\n\n\
     By clicking OK, you acknowledge that you understand and agree to use\n\
     this software responsibly and ethically."
        .to_string()
}

#[tauri::command]
#[cfg(windows)]
fn apply_capture_exclusion(window: WebviewWindow) -> Result<(), String> {
    windows_api::apply_capture_exclusion(window)
}

#[tauri::command]
#[cfg(windows)]
fn set_click_through(window: WebviewWindow, enabled: bool) -> Result<(), String> {
    windows_api::set_click_through(window, enabled)
}

#[tauri::command]
fn get_screen_size(window: WebviewWindow) -> Result<(u32, u32), String> {
    if let Some(monitor) = window.current_monitor().map_err(|e| e.to_string())? {
        let size = monitor.size();
        Ok((size.width, size.height))
    } else {
        Err("No monitor found".to_string())
    }
}

#[tauri::command]
#[cfg(windows)]
fn install_scroll_hook(window: WebviewWindow) -> Result<(), String> {
    mouse_hook::install_hook(window)
}

#[tauri::command]
#[cfg(windows)]
fn uninstall_scroll_hook() -> Result<(), String> {
    mouse_hook::uninstall_hook()
}

#[tauri::command]
#[cfg(windows)]
fn install_keyboard_hook(app_handle: tauri::AppHandle) -> Result<(), String> {
    keyboard_hook::install_hook(app_handle)
}

#[tauri::command]
#[cfg(windows)]
fn uninstall_keyboard_hook() -> Result<(), String> {
    keyboard_hook::uninstall_hook()
}

#[tauri::command]
fn detect_keyboard_layout() -> String {
    #[cfg(windows)]
    {
        // GetKeyboardLayout returns the active input locale for the current thread.
        // The low word is the language identifier.
        // Hungarian: 0x040E, English-US: 0x0409, English-UK: 0x0809
        use windows::Win32::UI::Input::KeyboardAndMouse::GetKeyboardLayout;
        let hkl = unsafe { GetKeyboardLayout(0) };
        let lang_id = (hkl.0 as u32) & 0xFFFF;
        if lang_id == 0x040E {
            "hu".to_string()
        } else {
            "en".to_string()
        }
    }
    #[cfg(not(windows))]
    {
        "en".to_string()
    }
}

#[tauri::command]
fn launch_update_installer(path: String) -> Result<(), String> {
    std::process::Command::new(&path)
        .spawn()
        .map_err(|e| format!("Failed to launch installer: {}", e))?;
    Ok(())
}

#[tauri::command]
fn check_windows_version() -> Result<String, String> {
    #[cfg(windows)]
    {
        windows_api::check_windows_version()
    }
    #[cfg(not(windows))]
    {
        Err("ScreenPrompt only supports Windows 10 Build 2004+ or Windows 11".to_string())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(
            tauri_plugin_store::Builder::default()
                .build()
        )
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Get the main window
            let window = app.get_webview_window("main").unwrap();

            // Apply Windows-specific settings
            #[cfg(windows)]
            {
                // Apply capture exclusion after window is ready
                if let Err(e) = windows_api::apply_capture_exclusion(window.clone()) {
                    log::error!("Failed to apply capture exclusion: {}", e);
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            show_ethical_notice,
            check_windows_version,
            apply_capture_exclusion,
            set_click_through,
            get_screen_size,
            install_scroll_hook,
            uninstall_scroll_hook,
            install_keyboard_hook,
            uninstall_keyboard_hook,
            launch_update_installer,
            detect_keyboard_layout,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
