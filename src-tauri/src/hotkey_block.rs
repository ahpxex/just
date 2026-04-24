//! System-wide keyboard shortcut filter.
//!
//! Deny-by-default: any key event carrying Cmd / Ctrl / Option (macOS) or
//! Ctrl / Alt / Win (Windows) is swallowed by default. A small whitelist of
//! writing-essential combinations (text editing, navigation, the app's own
//! commands, the force-quit last resort, and the DEV escape) passes through.
//!
//! Focus-aware: when `just` is not the frontmost app, all events are allowed
//! to pass, so when the user is granting permission in System Settings or
//! responding to a system alert, their keystrokes there are unaffected.
//!
//! Platforms:
//! - macOS: CGEventTap @ kCGSessionEventTap. Needs Accessibility permission.
//! - Windows: SetWindowsHookExW(WH_KEYBOARD_LL). No permission needed.
//! - Linux: no-op. Wayland disallows user-space global grabs.

use std::sync::atomic::{AtomicBool, Ordering};

// Whether the block is currently active. Set by Tauri window focus events.
// Starts true so we lock immediately on launch, before the first Focused event.
static ACTIVE: AtomicBool = AtomicBool::new(true);

pub fn set_active(active: bool) {
    ACTIVE.store(active, Ordering::Relaxed);
}

fn is_active() -> bool {
    ACTIVE.load(Ordering::Relaxed)
}

pub fn install() -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        return mac::install();
    }
    #[cfg(target_os = "windows")]
    {
        return win::install();
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        Ok(())
    }
}

#[cfg(target_os = "macos")]
mod mac {
    use super::is_active;
    use core_foundation::base::TCFType;
    use core_foundation::boolean::CFBoolean;
    use core_foundation::dictionary::{CFDictionary, CFDictionaryRef};
    use core_foundation::runloop::{kCFRunLoopCommonModes, CFRunLoop};
    use core_foundation::string::CFString;
    use core_graphics::event::{
        CGEventFlags, CGEventTap, CGEventTapLocation, CGEventTapOptions, CGEventTapPlacement,
        CGEventType, CallbackResult, EventField,
    };
    use std::sync::OnceLock;

    static INSTALLED: OnceLock<()> = OnceLock::new();

    #[link(name = "ApplicationServices", kind = "framework")]
    extern "C" {
        fn AXIsProcessTrustedWithOptions(options: CFDictionaryRef) -> u8;
    }

    fn ensure_accessibility_permission() -> bool {
        let key = CFString::from_static_string("AXTrustedCheckOptionPrompt");
        let value = CFBoolean::true_value();
        let dict = CFDictionary::from_CFType_pairs(&[(key.as_CFType(), value.as_CFType())]);
        unsafe { AXIsProcessTrustedWithOptions(dict.as_concrete_TypeRef()) != 0 }
    }

    // macOS Virtual Keycodes (kVK_*).
    const KVK_A: i64 = 0;
    const KVK_C: i64 = 8;
    const KVK_F: i64 = 3;
    const KVK_K: i64 = 40;
    const KVK_N: i64 = 45;
    const KVK_Q: i64 = 12;
    const KVK_V: i64 = 9;
    const KVK_X: i64 = 7;
    const KVK_Y: i64 = 16;
    const KVK_Z: i64 = 6;
    const KVK_RETURN: i64 = 36;
    const KVK_TAB: i64 = 48;
    const KVK_SPACE: i64 = 49;
    const KVK_DELETE: i64 = 51; // Backspace
    const KVK_ESCAPE: i64 = 53;
    const KVK_FORWARD_DELETE: i64 = 117;
    const KVK_HOME: i64 = 115;
    const KVK_END: i64 = 119;
    const KVK_PAGE_UP: i64 = 116;
    const KVK_PAGE_DOWN: i64 = 121;
    const KVK_LEFT: i64 = 123;
    const KVK_RIGHT: i64 = 124;
    const KVK_DOWN: i64 = 125;
    const KVK_UP: i64 = 126;

    // Letters, digits and common punctuation are packed into keycodes 0..=50
    // on macOS, minus Return (36), Tab (48), Space (49).
    fn is_typing_key(keycode: i64) -> bool {
        match keycode {
            KVK_RETURN | KVK_TAB | KVK_SPACE => false,
            0..=50 => true,
            _ => false,
        }
    }

    fn is_nav_key(keycode: i64) -> bool {
        matches!(
            keycode,
            KVK_DELETE
                | KVK_FORWARD_DELETE
                | KVK_LEFT
                | KVK_RIGHT
                | KVK_UP
                | KVK_DOWN
                | KVK_HOME
                | KVK_END
                | KVK_PAGE_UP
                | KVK_PAGE_DOWN
        )
    }

    fn is_allowed(keycode: i64, flags: CGEventFlags) -> bool {
        let cmd = flags.contains(CGEventFlags::CGEventFlagCommand);
        let ctrl = flags.contains(CGEventFlags::CGEventFlagControl);
        let alt = flags.contains(CGEventFlags::CGEventFlagAlternate);
        let shift = flags.contains(CGEventFlags::CGEventFlagShift);

        // Plain key, Shift-only, or other non-launcher modifier → allow.
        if !cmd && !ctrl && !alt {
            return true;
        }

        // Cmd+Option+Esc: OS force-quit dialog, must remain available.
        if cmd && alt && keycode == KVK_ESCAPE {
            return true;
        }

        // DEV: Cmd+Option+Q exit hatch.
        if cfg!(debug_assertions) && cmd && alt && keycode == KVK_Q {
            return true;
        }

        // Any Ctrl combination: blocked. macOS apps rarely use Ctrl and the
        // common launcher (Raycast) lives here.
        if ctrl {
            return false;
        }

        // Cmd (with optional Shift, no Ctrl/Alt): allow the writing-essential
        // and app-command whitelist.
        if cmd && !alt {
            if matches!(
                keycode,
                KVK_A | KVK_C | KVK_V | KVK_X | KVK_Z | KVK_Y | KVK_F | KVK_N | KVK_K
            ) {
                return true;
            }
            // Cmd+Shift+Z is still just Z on the keycode side.
            if shift && keycode == KVK_Z {
                return true;
            }
            if is_nav_key(keycode) {
                return true;
            }
            // Cmd+Q / Cmd+W / Cmd+H / Cmd+M / Cmd+Space etc. all fall here.
            return false;
        }

        // Option only (no Cmd, no Ctrl): allow word nav, deletion, and
        // diacritic-producing typing keys. Option+Space (Alfred) / Option+Tab
        // / Option+Escape get caught by the default branch below.
        if alt && !cmd {
            if is_nav_key(keycode) {
                return true;
            }
            if is_typing_key(keycode) {
                return true;
            }
            return false;
        }

        // Cmd+Option combinations not whitelisted above.
        false
    }

    pub fn install() -> Result<(), String> {
        if INSTALLED.get().is_some() {
            return Ok(());
        }

        // Prompts the OS accessibility dialog on first run if not yet granted.
        let _ = ensure_accessibility_permission();

        let tap = CGEventTap::new(
            CGEventTapLocation::Session,
            CGEventTapPlacement::HeadInsertEventTap,
            CGEventTapOptions::Default,
            vec![CGEventType::KeyDown],
            |_proxy, _etype, event| {
                if !is_active() {
                    return CallbackResult::Keep;
                }
                let keycode =
                    event.get_integer_value_field(EventField::KEYBOARD_EVENT_KEYCODE);
                let flags = event.get_flags();
                if is_allowed(keycode, flags) {
                    CallbackResult::Keep
                } else {
                    CallbackResult::Drop
                }
            },
        )
        .map_err(|_| {
            "failed to create event tap — grant Accessibility to just in System Settings"
                .to_string()
        })?;

        let source = tap
            .mach_port()
            .create_runloop_source(0)
            .map_err(|_| "failed to create runloop source".to_string())?;
        CFRunLoop::get_current().add_source(&source, unsafe { kCFRunLoopCommonModes });
        tap.enable();

        // Tap is disabled on drop; leak it so the block stays alive.
        Box::leak(Box::new(tap));
        let _ = INSTALLED.set(());
        Ok(())
    }
}

#[cfg(target_os = "windows")]
mod win {
    use super::is_active;
    use std::sync::OnceLock;
    use windows::Win32::Foundation::{LPARAM, LRESULT, WPARAM};
    use windows::Win32::UI::Input::KeyboardAndMouse::{
        GetAsyncKeyState, VK_CONTROL, VK_LWIN, VK_MENU, VK_RWIN, VK_SHIFT,
    };
    use windows::Win32::UI::WindowsAndMessaging::{
        CallNextHookEx, SetWindowsHookExW, KBDLLHOOKSTRUCT, WH_KEYBOARD_LL,
    };

    static INSTALLED: OnceLock<()> = OnceLock::new();

    // Virtual Key codes.
    const VK_BACK: u32 = 0x08;
    const VK_TAB: u32 = 0x09;
    const VK_ESCAPE: u32 = 0x1B;
    const VK_SPACE: u32 = 0x20;
    const VK_PAGE_UP: u32 = 0x21;
    const VK_PAGE_DOWN: u32 = 0x22;
    const VK_END: u32 = 0x23;
    const VK_HOME: u32 = 0x24;
    const VK_LEFT: u32 = 0x25;
    const VK_UP: u32 = 0x26;
    const VK_RIGHT: u32 = 0x27;
    const VK_DOWN: u32 = 0x28;
    const VK_DELETE: u32 = 0x2E;
    const VK_A: u32 = 0x41;
    const VK_C: u32 = 0x43;
    const VK_F_KEY: u32 = 0x46;
    const VK_K_KEY: u32 = 0x4B;
    const VK_N_KEY: u32 = 0x4E;
    const VK_Q_KEY: u32 = 0x51;
    const VK_V_KEY: u32 = 0x56;
    const VK_X_KEY: u32 = 0x58;
    const VK_Y_KEY: u32 = 0x59;
    const VK_Z_KEY: u32 = 0x5A;

    fn is_pressed(vk: u32) -> bool {
        unsafe { (GetAsyncKeyState(vk as i32) as u16 & 0x8000) != 0 }
    }

    fn modifier_state() -> (bool, bool, bool, bool) {
        (
            is_pressed(VK_CONTROL.0 as u32),
            is_pressed(VK_MENU.0 as u32),
            is_pressed(VK_SHIFT.0 as u32),
            is_pressed(VK_LWIN.0 as u32) || is_pressed(VK_RWIN.0 as u32),
        )
    }

    fn is_typing_vk(vk: u32) -> bool {
        // Letters A-Z, digits 0-9, and OEM punctuation keys.
        (0x41..=0x5A).contains(&vk)
            || (0x30..=0x39).contains(&vk)
            || (0xBA..=0xDE).contains(&vk)
    }

    fn is_nav_vk(vk: u32) -> bool {
        matches!(
            vk,
            VK_BACK
                | VK_DELETE
                | VK_LEFT
                | VK_RIGHT
                | VK_UP
                | VK_DOWN
                | VK_HOME
                | VK_END
                | VK_PAGE_UP
                | VK_PAGE_DOWN
        )
    }

    fn should_block(vk: u32) -> bool {
        let (ctrl, alt, _shift, win) = modifier_state();

        // Windows key in any capacity → block (Start menu, Win+anything).
        if win || matches!(vk, x if x == VK_LWIN.0 as u32 || x == VK_RWIN.0 as u32) {
            return true;
        }

        // No Ctrl/Alt (Shift only or plain key) → allow.
        if !ctrl && !alt {
            return false;
        }

        // Alt+Tab / Alt+Esc / Alt+Space: system switchers / launchers.
        if alt && !ctrl && matches!(vk, VK_TAB | VK_ESCAPE | VK_SPACE) {
            return true;
        }

        // Ctrl-only combos: allow our whitelist.
        if ctrl && !alt {
            // Ctrl+Space (Raycast) is blocked by falling through the allow list.
            if matches!(
                vk,
                VK_A | VK_C | VK_V_KEY | VK_X_KEY | VK_Z_KEY | VK_Y_KEY | VK_F_KEY | VK_N_KEY | VK_K_KEY
            ) {
                return false;
            }
            if is_nav_vk(vk) {
                return false;
            }
            return true;
        }

        // Alt-only combos (no Ctrl, no Win): allow word nav/deletion, block rest.
        if alt && !ctrl {
            if is_nav_vk(vk) {
                return false;
            }
            return true;
        }

        // Ctrl+Alt: AltGr typing on many layouts, plus DEV escape (Ctrl+Alt+Q).
        if ctrl && alt {
            if cfg!(debug_assertions) && vk == VK_Q_KEY {
                return false;
            }
            // AltGr-produced typing characters pass through.
            if is_typing_vk(vk) {
                return false;
            }
            return true;
        }

        true
    }

    unsafe extern "system" fn kbd_proc(n_code: i32, w_param: WPARAM, l_param: LPARAM) -> LRESULT {
        if n_code >= 0 && is_active() {
            let kbd = &*(l_param.0 as *const KBDLLHOOKSTRUCT);
            if should_block(kbd.vkCode) {
                return LRESULT(1);
            }
        }
        CallNextHookEx(None, n_code, w_param, l_param)
    }

    pub fn install() -> Result<(), String> {
        if INSTALLED.get().is_some() {
            return Ok(());
        }
        unsafe {
            SetWindowsHookExW(WH_KEYBOARD_LL, Some(kbd_proc), None, 0)
                .map_err(|e| e.to_string())?;
        }
        let _ = INSTALLED.set(());
        Ok(())
    }
}
