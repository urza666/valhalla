use tauri::Manager;

#[tauri::command]
fn get_platform() -> String {
    std::env::consts::OS.to_string()
}

#[tauri::command]
fn get_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .invoke_handler(tauri::generate_handler![get_platform, get_version])
        .setup(|app| {
            // System tray setup
            if let Some(tray) = app.tray_by_id("main") {
                tray.on_tray_icon_event(|tray, event| {
                    match event {
                        tauri::tray::TrayIconEvent::Click { .. } => {
                            let window = tray.app_handle().get_webview_window("main").unwrap();
                            window.show().unwrap();
                            window.set_focus().unwrap();
                        }
                        _ => {}
                    }
                });
            }

            // Deep link handler
            #[cfg(desktop)]
            {
                let handle = app.handle().clone();
                app.listen("deep-link://new-url", move |event| {
                    let url = event.payload();
                    // Handle valhalla:// deep links (e.g., invite links)
                    if let Some(window) = handle.get_webview_window("main") {
                        let _ = window.eval(&format!(
                            "window.__DEEP_LINK__ = '{}'; window.dispatchEvent(new Event('deep-link'))",
                            url
                        ));
                    }
                });
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
