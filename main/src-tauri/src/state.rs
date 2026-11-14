//! Paylaşılan uygulama durumu (oturum).

use std::sync::Mutex;

use zeroize::Zeroizing;

use crate::commands::wallet::WalletInfo;

/// Açık oturum. `mnemonic` kilitlendiğinde `zeroize` ile temizlenir ve
/// imzalama için yalnızca bu modül içinde, yerinde türetilir.
pub struct Session {
    pub wallet: WalletInfo,
    pub mnemonic: Zeroizing<String>,
}

#[derive(Default)]
pub struct AppState {
    pub session: Mutex<Option<Session>>,
}
