
use tauri::{
    plugin::{Builder, TauriPlugin},
    Runtime,
};

#[cfg(target_os = "android")]
const PLUGIN_IDENTIFIER: &str = "com.vexaris.webview";

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::<R>::new("vexwebview")
        .setup(|_app, _api| {
            #[cfg(target_os = "android")]
            {
                let _handle = _api.register_android_plugin(PLUGIN_IDENTIFIER, "VexWebviewPlugin")?;
            }
            Ok(())
        })
        .build()
}