//! Uygulama içi dApp tarayıcısı.
//!
//! Tauri'nin çoklu webview'ı yalnızca masaüstünde var; Android'de tek webview
//! activity'ye `setContentView` ile kuruluyor. Bu yüzden sekme havuzu Kotlin
//! tarafında (`android/`) yaşıyor: her sekme ana webview'ın kardeşi olarak
//! eklenen gerçek bir `android.webkit.WebView`. React tarafı sadece dikdörtgen
//! gönderir, site içeriği native katmanda çizilir.
//!
//! Rust tarafında komut yok — `plugin:vexwebview|<komut>` çağrıları doğrudan
//! Kotlin'e gider. Masaüstünde eklenti yüksüz kalır; arayüz aynı yolu denemez.

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