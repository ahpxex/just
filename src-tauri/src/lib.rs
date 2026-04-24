mod hotkey_block;
mod lock;
mod stats;
mod workspace;

use tauri::{Manager, PhysicalPosition, PhysicalSize};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            #[cfg(target_os = "macos")]
            {
                use tauri::menu::{MenuBuilder, PredefinedMenuItem, SubmenuBuilder};

                let app_submenu = SubmenuBuilder::new(app, "just")
                    .item(&PredefinedMenuItem::about(app, Some("About just"), None)?)
                    .separator()
                    .item(&PredefinedMenuItem::services(app, None)?)
                    .separator()
                    .item(&PredefinedMenuItem::hide(app, None)?)
                    .item(&PredefinedMenuItem::hide_others(app, None)?)
                    .item(&PredefinedMenuItem::show_all(app, None)?)
                    // No Quit item: Cmd+Q has no menu binding.
                    .build()?;

                let edit_submenu = SubmenuBuilder::new(app, "Edit")
                    .item(&PredefinedMenuItem::undo(app, None)?)
                    .item(&PredefinedMenuItem::redo(app, None)?)
                    .separator()
                    .item(&PredefinedMenuItem::cut(app, None)?)
                    .item(&PredefinedMenuItem::copy(app, None)?)
                    .item(&PredefinedMenuItem::paste(app, None)?)
                    .item(&PredefinedMenuItem::select_all(app, None)?)
                    .build()?;

                let menu = MenuBuilder::new(app)
                    .items(&[&app_submenu, &edit_submenu])
                    .build()?;

                let _ = app.set_menu(menu)?;

                lock::lock_presentation();
            }

            if let Err(err) = hotkey_block::install() {
                eprintln!("[just] hotkey block unavailable: {err}");
            }

            if let Some(window) = app.get_webview_window("main") {
                if let Ok(Some(monitor)) = window.primary_monitor() {
                    let size = monitor.size();
                    let _ = window.set_size(PhysicalSize::new(size.width, size.height));
                    let _ = window.set_position(PhysicalPosition::new(0i32, 0i32));
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            workspace::workspace_init,
            workspace::list_docs,
            workspace::read_doc,
            workspace::write_doc,
            workspace::create_doc,
            workspace::delete_doc,
            workspace::restore_doc,
            workspace::read_state,
            workspace::write_state,
            stats::read_stats,
            stats::read_doc_stats,
            stats::record_session,
            stats::request_exit,
        ])
        .on_window_event(|_window, event| match event {
            tauri::WindowEvent::CloseRequested { api, .. } => {
                api.prevent_close();
            }
            tauri::WindowEvent::Focused(focused) => {
                hotkey_block::set_active(*focused);
            }
            _ => {}
        })
        .build(tauri::generate_context!())
        .expect("error while building just")
        .run(|_app, event| {
            if let tauri::RunEvent::ExitRequested { api, .. } = event {
                api.prevent_exit();
            }
        });
}
