
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State};
use zeroize::{Zeroize, Zeroizing};

use crate::crypto::{keys, mnemonic};
use crate::state::{AppState, Session};
use crate::storage::keystore::{self, Keystore};
use crate::storage::throttle;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WalletInfo {
    pub id: String,
    pub name: String,
    pub address: String,
    pub created_at: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WalletStatus {
    pub exists: bool,
    pub unlocked: bool,
    pub wallet: Option<WalletInfo>,
}

impl From<&Keystore> for WalletInfo {
    fn from(k: &Keystore) -> Self {
        Self {
            id: k.id.clone(),
            name: k.name.clone(),
            address: k.address.clone(),
            created_at: k.created_at,
        }
    }
}

#[tauri::command]
pub async fn create_wallet(
    app: AppHandle,
    name: String,
    password: String,
    pin: String,
) -> Result<WalletInfo, String> {
    blocking(move || {
        let state = app.state::<AppState>();
        ensure_no_wallet()?;
        validate_password(&password)?;
        validate_pin(&pin)?;

        let (phrase, seed) = mnemonic::generate()?;
        let seed = Zeroizing::new(seed);
        persist(&state, &name, &phrase, &seed[..], &password, &pin)
    })
    .await
}

#[tauri::command]
pub async fn import_wallet(
    app: AppHandle,
    name: String,
    mnemonic: String,
    password: String,
    pin: String,
) -> Result<WalletInfo, String> {
    blocking(move || {
        let state = app.state::<AppState>();
        ensure_no_wallet()?;
        validate_password(&password)?;
        validate_pin(&pin)?;

        let (phrase, seed) = crate::crypto::mnemonic::from_phrase(&mnemonic)?;
        let seed = Zeroizing::new(seed);
        persist(&state, &name, &phrase, &seed[..], &password, &pin)
    })
    .await
}

#[tauri::command]
pub async fn unlock_wallet(app: AppHandle, password: String) -> Result<bool, String> {
    blocking(move || unlock_impl(&app.state::<AppState>(), &password)).await
}

fn unlock_impl(state: &AppState, password: &str) -> Result<bool, String> {
    if password.is_empty() {
        return Ok(false);
    }
    throttle::check()?;
    let ks = match keystore::load() {
        Ok(k) => k,
        Err(_) => return Ok(false),
    };

    let pin_like = password.len() == 6 && password.chars().all(|c| c.is_ascii_digit());
    let (first, second) = if pin_like {
        (&ks.pin, &ks.password)
    } else {
        (&ks.password, &ks.pin)
    };

    let phrase = keystore::unwrap(first, password, &ks.kdf)
        .or_else(|_| keystore::unwrap(second, password, &ks.kdf));

    let phrase = match phrase {
        Ok(p) => p,
        Err(_) => {
            throttle::record_failure();
            return Ok(false);
        }
    };

    let address = derive_address(&phrase)?;
    if !address.eq_ignore_ascii_case(&ks.address) {
        return Err("Keystore bütünlük hatası: adres eşleşmiyor.".into());
    }

    throttle::record_success();
    let info = WalletInfo::from(&ks);
    let mut session = state.session.lock().map_err(|_| "Oturum kilidi alınamadı")?;
    *session = Some(Session {
        wallet: info,
        mnemonic: phrase,
    });
    Ok(true)
}

#[tauri::command]
pub fn lock_wallet(state: State<'_, AppState>) -> Result<(), String> {
    let mut session = state.session.lock().map_err(|_| "Oturum kilidi alınamadı")?;
    *session = None;
    Ok(())
}

#[tauri::command]
pub fn wallet_status(state: State<'_, AppState>) -> Result<WalletStatus, String> {
    let unlocked = state
        .session
        .lock()
        .map_err(|_| "Oturum kilidi alınamadı")?
        .as_ref()
        .map(|s| s.wallet.clone());

    let keystore = if keystore::exists() {
        keystore::load().ok()
    } else {
        None
    };

    let wallet = unlocked.or_else(|| keystore.as_ref().map(WalletInfo::from));
    Ok(WalletStatus {
        exists: keystore.is_some(),
        unlocked: wallet.is_some() && state.session.lock().map(|g| g.is_some()).unwrap_or(false),
        wallet,
    })
}

#[tauri::command]
pub fn rename_wallet(state: State<'_, AppState>, name: String) -> Result<WalletInfo, String> {
    let mut ks = keystore::load()?;
    ks.name = sanitize_name(&name);
    keystore::save(&ks)?;

    let info = WalletInfo::from(&ks);
    if let Some(session) = state
        .session
        .lock()
        .map_err(|_| "Oturum kilidi alınamadı")?
        .as_mut()
    {
        session.wallet.name = info.name.clone();
    }
    Ok(info)
}

#[tauri::command]
pub async fn reveal_mnemonic(password: String) -> Result<String, String> {
    blocking(move || {
        throttle::check()?;
        let ks = keystore::load()?;
        let phrase = match keystore::unwrap(&ks.password, &password, &ks.kdf) {
            Ok(p) => p,
            Err(_) => {
                throttle::record_failure();
                return Err("Parola hatalı.".into());
            }
        };
        throttle::record_success();
        Ok(phrase.to_string())
    })
    .await
}

#[tauri::command]
pub async fn reset_wallet(app: AppHandle, password: String) -> Result<(), String> {
    blocking(move || {
        let state = app.state::<AppState>();
        throttle::check()?;
        let ks = keystore::load()?;
        if !keystore::verify(&ks.password, &password, &ks.kdf) {
            throttle::record_failure();
            return Err("Parola hatalı.".into());
        }
        keystore::delete()?;
        let _ = std::fs::remove_file(throttle::path());
        let mut session = state.session.lock().map_err(|_| "Oturum kilidi alınamadı")?;
        *session = None;
        Ok(())
    })
    .await
}


async fn blocking<T, F>(f: F) -> Result<T, String>
where
    T: Send + 'static,
    F: FnOnce() -> Result<T, String> + Send + 'static,
{
    tauri::async_runtime::spawn_blocking(f)
        .await
        .map_err(|e| format!("Arka plan görevi başarısız: {e}"))?
}

fn ensure_no_wallet() -> Result<(), String> {
    if keystore::exists() {
        return Err(
            "Bu cihazda zaten bir cüzdan var. Yeni cüzdan için önce mevcut olanı sil."
                .to_string(),
        );
    }
    Ok(())
}

fn validate_password(password: &str) -> Result<(), String> {
    if password.chars().count() < 8 {
        return Err("Parola en az 8 karakter olmalı.".into());
    }
    Ok(())
}

fn validate_pin(pin: &str) -> Result<(), String> {
    if pin.len() != 6 || !pin.chars().all(|c| c.is_ascii_digit()) {
        return Err("PIN 6 haneli olmalı.".into());
    }
    Ok(())
}

fn sanitize_name(name: &str) -> String {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        "Ana Cüzdan".to_string()
    } else {
        trimmed.chars().take(48).collect()
    }
}

fn derive_address(phrase: &str) -> Result<String, String> {
    let (_, mut seed) = mnemonic::from_phrase(phrase)?;
    let key = keys::derive_evm_key(&seed);
    seed.zeroize();
    let mut key = Zeroizing::new(key?);
    let address = keys::address_from_key(&key);
    key.zeroize();
    address
}

fn persist(
    state: &AppState,
    name: &str,
    phrase: &str,
    seed: &[u8],
    password: &str,
    pin: &str,
) -> Result<WalletInfo, String> {
    let mut key = Zeroizing::new(keys::derive_evm_key(seed)?);
    let address = keys::address_from_key(&key)?;
    key.zeroize();

    let keystore = Keystore {
        version: keystore::VERSION,
        id: keystore::new_id(),
        name: sanitize_name(name),
        address,
        created_at: keystore::now_ms(),
        kdf: keystore::default_kdf(),
        password: keystore::wrap(password, phrase, &keystore::password_kdf())?,
        pin: keystore::wrap(pin, phrase, &keystore::pin_kdf())?,
    };

    keystore::save(&keystore)?;

    let info = WalletInfo::from(&keystore);
    let mut session = state.session.lock().map_err(|_| "Oturum kilidi alınamadı")?;
    *session = Some(Session {
        wallet: info.clone(),
        mnemonic: Zeroizing::new(phrase.to_string()),
    });
    Ok(info)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn password_and_pin_rules() {
        assert!(validate_password("kisa").is_err());
        assert!(validate_password("uzunparola").is_ok());
        assert!(validate_pin("12345").is_err());
        assert!(validate_pin("12345a").is_err());
        assert!(validate_pin("123456").is_ok());
    }

    #[test]
    fn address_derivation_matches_known_vector() {
        let addr = derive_address(
            "test test test test test test test test test test test junk",
        )
        .unwrap();
        assert_eq!(addr, "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");
    }

    #[test]
    fn keystore_round_trip_leaks_no_plaintext() {
        let _guard = crate::storage::env_guard();
        let dir = std::env::temp_dir().join(format!("vexaris-ks-{}", keystore::new_id()));
        std::env::set_var("VEXARIS_KEYSTORE_DIR", &dir);

        let cheap = keystore::KdfParams {
            log_n: 12,
            r: 8,
            p: 1,
        };
        let pin_kdf = keystore::KdfParams {
            log_n: 11,
            r: 8,
            p: 1,
        };

        let (phrase, seed) = mnemonic::generate().unwrap();
        let address = derive_address(&phrase).unwrap();
        let ks = Keystore {
            version: keystore::VERSION,
            id: keystore::new_id(),
            name: "Test Cüzdan".into(),
            address: address.clone(),
            created_at: keystore::now_ms(),
            kdf: cheap.clone(),
            password: keystore::wrap("parola1234", &phrase, &cheap).unwrap(),
            pin: keystore::wrap("123456", &phrase, &pin_kdf).unwrap(),
        };
        keystore::save(&ks).unwrap();
        assert!(keystore::exists());

        let raw = std::fs::read_to_string(keystore::path()).unwrap();
        let lower = raw.to_lowercase();
        assert!(!raw.contains(&phrase), "mnemonic düz metin olarak yazılmış");
        let tokens: Vec<&str> = lower
            .split(|c: char| !c.is_ascii_alphanumeric())
            .collect();
        for word in phrase.split(' ') {
            assert!(!tokens.contains(&word), "kelime düz metin: {word}");
        }

        let loaded = keystore::load().unwrap();
        assert_eq!(loaded.version, keystore::VERSION);
        assert_eq!(loaded.password.kdf.as_ref(), Some(&cheap));
        assert_eq!(loaded.pin.kdf.as_ref(), Some(&pin_kdf));
        assert_eq!(
            &*keystore::unwrap(&loaded.pin, "123456", &loaded.kdf).unwrap(),
            phrase.as_str()
        );
        assert_eq!(
            &*keystore::unwrap(&loaded.password, "parola1234", &loaded.kdf).unwrap(),
            phrase.as_str()
        );
        assert!(keystore::unwrap(&loaded.pin, "000000", &loaded.kdf).is_err());

        let phrase_from_pin = keystore::unwrap(&loaded.pin, "123456", &loaded.kdf).unwrap();
        assert_eq!(derive_address(&phrase_from_pin).unwrap(), address);

        let key = keys::derive_evm_key(&seed).unwrap();
        assert_eq!(keys::address_from_key(&key).unwrap(), address);

        keystore::delete().unwrap();
        assert!(!keystore::exists());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn production_wrappers_use_distinct_kdf() {
        assert_eq!(keystore::password_kdf().log_n, 17);
        assert_eq!(keystore::pin_kdf().log_n, 16);
        assert!(keystore::pin_kdf().log_n > keystore::default_kdf().log_n);
    }
}
