// MIT License - Copyright (c) 2026 ScreenPrompt Contributors
// Native Windows task dialog that, like the overlay, stays out of screen capture

use windows::core::{HRESULT, HSTRING, PCWSTR};
use windows::Win32::Foundation::{HWND, LPARAM, S_OK, WPARAM};
use windows::Win32::UI::Controls::{
    TaskDialogIndirect, TASKDIALOGCONFIG, TASKDIALOG_BUTTON, TASKDIALOG_NOTIFICATIONS,
    TDF_ALLOW_DIALOG_CANCELLATION, TDF_ENABLE_HYPERLINKS, TDN_CREATED, TDN_HYPERLINK_CLICKED,
    TD_INFORMATION_ICON,
};
use windows::Win32::UI::Shell::ShellExecuteW;
use windows::Win32::UI::WindowsAndMessaging::{
    SetWindowDisplayAffinity, SW_SHOWNORMAL, WDA_EXCLUDEFROMCAPTURE,
};

const OK_BUTTON_ID: i32 = 100;

unsafe extern "system" fn dialog_callback(
    hwnd: HWND,
    msg: TASKDIALOG_NOTIFICATIONS,
    _w_param: WPARAM,
    l_param: LPARAM,
    _ref_data: isize,
) -> HRESULT {
    if msg == TDN_CREATED {
        // Before the first paint, so the dialog never shows up in a screen share
        if let Err(e) = SetWindowDisplayAffinity(hwnd, WDA_EXCLUDEFROMCAPTURE) {
            log::error!("Failed to exclude dialog from capture: {}", e);
        }
    } else if msg == TDN_HYPERLINK_CLICKED {
        let href = PCWSTR(l_param.0 as *const u16);
        // Only web links; the content is ours, but never hand anything else to the shell
        if href.to_string().is_ok_and(|url| url.starts_with("https://")) {
            ShellExecuteW(hwnd, PCWSTR::null(), href, PCWSTR::null(), PCWSTR::null(), SW_SHOWNORMAL);
        }
    }
    S_OK
}

/// Show a modal information dialog, centered on the screen and owned by `owner`, and
/// block until it's dismissed ("OK" button or Esc). `content` and `footer` may contain
/// `<a href="https://…">` links, which open in the default browser.
pub fn show_info(
    owner: isize,
    title: &str,
    heading: &str,
    content: &str,
    footer: &str,
    button: &str,
) -> Result<(), String> {
    let title = HSTRING::from(title);
    let heading = HSTRING::from(heading);
    let content = HSTRING::from(content);
    let footer = HSTRING::from(footer);
    let button_text = HSTRING::from(button);

    let buttons = [TASKDIALOG_BUTTON {
        nButtonID: OK_BUTTON_ID,
        pszButtonText: PCWSTR(button_text.as_ptr()),
    }];

    let mut config = TASKDIALOGCONFIG {
        cbSize: std::mem::size_of::<TASKDIALOGCONFIG>() as u32,
        hwndParent: HWND(owner as *mut core::ffi::c_void),
        // No TDF_POSITION_RELATIVE_TO_WINDOW: center on the screen, not on the overlay,
        // which may sit in a corner
        dwFlags: TDF_ENABLE_HYPERLINKS | TDF_ALLOW_DIALOG_CANCELLATION,
        pszWindowTitle: PCWSTR(title.as_ptr()),
        pszMainInstruction: PCWSTR(heading.as_ptr()),
        pszContent: PCWSTR(content.as_ptr()),
        cButtons: buttons.len() as u32,
        pButtons: buttons.as_ptr(),
        nDefaultButton: OK_BUTTON_ID,
        pfCallback: Some(dialog_callback),
        ..Default::default()
    };
    config.Anonymous1.pszMainIcon = TD_INFORMATION_ICON;
    if !footer.is_empty() {
        config.pszFooter = PCWSTR(footer.as_ptr());
    }

    unsafe { TaskDialogIndirect(&config, None, None, None) }
        .map_err(|e| format!("TaskDialogIndirect failed: {}", e))
}
