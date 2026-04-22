#[cfg(target_os = "macos")]
pub fn lock_presentation() {
    use objc2_app_kit::{NSApplication, NSApplicationPresentationOptions};
    use objc2_foundation::MainThreadMarker;

    let Some(mtm) = MainThreadMarker::new() else {
        return;
    };

    let app = NSApplication::sharedApplication(mtm);
    // Hide Dock and menu bar, disable Cmd+Tab app switching and Cmd+H hide.
    // NSApplicationPresentationDisableForceQuit is intentionally NOT set:
    // Cmd+Option+Esc remains the OS-level last resort per AGENTS.md.
    let options = NSApplicationPresentationOptions::HideDock
        | NSApplicationPresentationOptions::HideMenuBar
        | NSApplicationPresentationOptions::DisableProcessSwitching
        | NSApplicationPresentationOptions::DisableHideApplication;
    app.setPresentationOptions(options);
}
