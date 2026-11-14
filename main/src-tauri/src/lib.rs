
mod commands;
mod crypto;
mod state;
mod storage;

use state::AppState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState::default())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_vexwebview::init())
        .setup(|app| {
            let dir = app.path().app_data_dir().expect("veri dizini çözülemedi");
            std::fs::create_dir_all(&dir).ok();
            storage::keystore::set_data_dir(dir);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::wallet::create_wallet,
            commands::wallet::import_wallet,
            commands::wallet::unlock_wallet,
            commands::wallet::lock_wallet,
            commands::wallet::wallet_status,
            commands::wallet::rename_wallet,
            commands::wallet::reveal_mnemonic,
            commands::wallet::reset_wallet,
            commands::transaction::sign_transaction,
            commands::dapp::personal_sign,
            commands::dapp::sign_typed_data,
        ])
        .run(tauri::generate_context!())
        .expect("Vexaris Wallet başlatılamadı");
}
