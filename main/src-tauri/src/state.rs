
use std::sync::Mutex;

use zeroize::Zeroizing;

use crate::commands::wallet::WalletInfo;

pub struct Session {
    pub wallet: WalletInfo,
    pub mnemonic: Zeroizing<String>,
}

#[derive(Default)]
pub struct AppState {
    pub session: Mutex<Option<Session>>,
}
