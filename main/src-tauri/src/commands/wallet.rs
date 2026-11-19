use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State};
use zeroize::{Zeroize, Zeroizing};

use crate::crypto::{keys, mnemonic};
use crate::state::{AppState, Session};
use crate::storage::keystore::{self, Keystore};
use crate::storage::throttle;
use crate::storage::vault::{self, Vault, VaultWallet};

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
    pub wallets: Vec<WalletInfo>,
    pub missing_credential: Option<String>,
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

impl From<&VaultWallet> for WalletInfo {
    fn from(k: &VaultWallet) -> Self {
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
    password: Option<String>,
    pin: Option<String>,
) -> Result<WalletInfo, String> {
    blocking(move || {
        let state = app.state::<AppState>();
        if vault::exists() {
            let dek = active_dek(&state)?;
            let mut store = vault::load()?;
            let (phrase, seed) = mnemonic::generate()?;
            let phrase = Zeroizing::new(phrase);
            let _seed = Zeroizing::new(seed);
            let info = add_to_vault(&mut store, &dek, &name, phrase.as_str())?;
            vault::save(&store)?;
            set_session(&state, info.clone(), phrase.as_str(), dek)?;
            return Ok(info);
        }

        let password = password.ok_or("Parola gerekli.")?;
        let pin = pin.ok_or("PIN gerekli.")?;
        validate_password(&password)?;
        validate_pin(&pin)?;
        if keystore::exists() {
            return Err(
                "Bu cihazda mevcut bir cüzdan var. Önce onu açarak kasayı yükselt veya cüzdanı sıfırla."
                    .into(),
            );
        }
        let (phrase, seed) = mnemonic::generate()?;
        let phrase = Zeroizing::new(phrase);
        let seed = Zeroizing::new(seed);
        persist_first(&state, &name, phrase.as_str(), &seed[..], &password, &pin)
    })
    .await
}

#[tauri::command]
pub async fn import_wallet(
    app: AppHandle,
    name: String,
    mnemonic: String,
    password: Option<String>,
    pin: Option<String>,
) -> Result<WalletInfo, String> {
    blocking(move || {
        let state = app.state::<AppState>();
        let (phrase, seed) = crate::crypto::mnemonic::from_phrase(&mnemonic)?;
        let phrase = Zeroizing::new(phrase);
        let seed = Zeroizing::new(seed);

        if vault::exists() {
            let dek = active_dek(&state)?;
            let mut store = vault::load()?;
            let info = add_to_vault(&mut store, &dek, &name, phrase.as_str())?;
            vault::save(&store)?;
            set_session(&state, info.clone(), phrase.as_str(), dek)?;
            return Ok(info);
        }

        let password = password.ok_or("Parola gerekli.")?;
        let pin = pin.ok_or("PIN gerekli.")?;
        validate_password(&password)?;
        validate_pin(&pin)?;
        if keystore::exists() {
            return Err(
                "Bu cihazda mevcut bir cüzdan var. Önce onu açarak kasayı yükselt veya cüzdanı sıfırla."
                    .into(),
            );
        }
        persist_first(&state, &name, phrase.as_str(), &seed[..], &password, &pin)
    })
    .await
}

#[tauri::command]
pub async fn unlock_wallet(
    app: AppHandle,
    wallet_id: Option<String>,
    password: String,
) -> Result<bool, String> {
    blocking(move || {
        let state = app.state::<AppState>();
        unlock_impl(&state, wallet_id.as_deref(), &password)
    })
    .await
}

fn unlock_impl(state: &AppState, wallet_id: Option<&str>, password: &str) -> Result<bool, String> {
    if password.is_empty() {
        return Ok(false);
    }
    throttle::check()?;

    if vault::exists() {
        let mut store = match vault::load() {
            Ok(value) => value,
            Err(_) => return Ok(false),
        };
        let dek = match vault::unlock(&store, password) {
            Ok(value) => value,
            Err(_) => {
                throttle::record_failure();
                return Ok(false);
            }
        };
        let id = wallet_id
            .map(|value| value.to_string())
            .or_else(|| store.active_id.clone())
            .or_else(|| store.wallets.first().map(|item| item.id.clone()));
        let Some(id) = id else {
            return Ok(false);
        };
        let phrase = match vault::open_wallet(&store, &dek, &id) {
            Ok(value) => value,
            Err(_) => {
                throttle::record_failure();
                return Ok(false);
            }
        };
        let address = derive_address(phrase.as_str())?;
        let Some(info) = store
            .wallets
            .iter()
            .find(|item| item.id == id)
            .map(WalletInfo::from)
        else {
            return Ok(false);
        };
        if !address.eq_ignore_ascii_case(&info.address) {
            return Err("Kasa bütünlük hatası: adres eşleşmiyor.".into());
        }
        throttle::record_success();
        store.active_id = Some(id);
        vault::save(&store)?;
        set_session(state, info, phrase.as_str(), dek)?;
        return Ok(true);
    }

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

    let address = derive_address(phrase.as_str())?;
    if !address.eq_ignore_ascii_case(&ks.address) {
        return Err("Keystore bütünlük hatası: adres eşleşmiyor.".into());
    }

    let dek = vault::generate_dek();
    let mut store = vault::create(
        &dek,
        if pin_like { None } else { Some(password) },
        if pin_like { Some(password) } else { None },
    )?;
    let entry = vault::seal_wallet(
        &dek,
        &ks.id,
        &ks.name,
        &ks.address,
        ks.created_at,
        phrase.as_str(),
    )?;
    store.active_id = Some(entry.id.clone());
    store.wallets.push(entry);
    vault::save(&store)?;

    let legacy = keystore::path();
    if legacy.exists() {
        let _ = std::fs::rename(&legacy, legacy.with_file_name("keystore.v2.bak"));
    }

    throttle::record_success();
    set_session(
        state,
        WalletInfo::from(&ks),
        phrase.as_str(),
        dek,
    )?;
    Ok(true)
}

#[tauri::command]
pub fn lock_wallet(state: State<'_, AppState>) -> Result<(), String> {
    let mut session = state.session.lock().map_err(|_| "Oturum kilidi alınamadı")?;
    *session = None;
    let mut dek = state.dek.lock().map_err(|_| "Kasa kilidi alınamadı")?;
    *dek = None;
    Ok(())
}

#[tauri::command]
pub fn wallet_status(state: State<'_, AppState>) -> Result<WalletStatus, String> {
    let unlocked_wallet = state
        .session
        .lock()
        .map_err(|_| "Oturum kilidi alınamadı")?
        .as_ref()
        .map(|s| s.wallet.clone());
    let unlocked = unlocked_wallet.is_some();

    if vault::exists() {
        let store = vault::load()?;
        let wallets: Vec<WalletInfo> = store.wallets.iter().map(WalletInfo::from).collect();
        let active = unlocked_wallet
            .or_else(|| {
                store
                    .active_id
                    .as_deref()
                    .and_then(|id| store.wallets.iter().find(|item| item.id == id))
                    .map(WalletInfo::from)
            })
            .or_else(|| store.wallets.first().map(WalletInfo::from));
        return Ok(WalletStatus {
            exists: true,
            unlocked,
            wallet: active,
            wallets,
            missing_credential: vault::missing_credential(&store).map(str::to_string),
        });
    }

    let keystore = if keystore::exists() {
        keystore::load().ok()
    } else {
        None
    };
    let wallet = unlocked_wallet.or_else(|| keystore.as_ref().map(WalletInfo::from));
    Ok(WalletStatus {
        exists: keystore.is_some(),
        unlocked,
        wallet: wallet.clone(),
        wallets: wallet.into_iter().collect(),
        missing_credential: None,
    })
}

#[tauri::command]
pub fn switch_wallet(state: State<'_, AppState>, wallet_id: String) -> Result<WalletInfo, String> {
    let dek = active_dek(&state)?;
    let mut store = vault::load()?;
    let phrase = vault::open_wallet(&store, &dek, &wallet_id)?;
    let address = derive_address(phrase.as_str())?;
    let Some(info) = store
        .wallets
        .iter()
        .find(|item| item.id == wallet_id)
        .map(WalletInfo::from)
    else {
        return Err("Cüzdan bulunamadı".into());
    };
    if !address.eq_ignore_ascii_case(&info.address) {
        return Err("Kasa bütünlük hatası: adres eşleşmiyor.".into());
    }
    store.active_id = Some(wallet_id);
    vault::save(&store)?;
    set_session(&state, info.clone(), phrase.as_str(), dek)?;
    Ok(info)
}

#[tauri::command]
pub fn rename_wallet(
    state: State<'_, AppState>,
    wallet_id: Option<String>,
    name: String,
) -> Result<WalletInfo, String> {
    if vault::exists() {
        let mut store = vault::load()?;
        let id = wallet_id
            .or_else(|| {
                state
                    .session
                    .lock()
                    .ok()
                    .and_then(|guard| guard.as_ref().map(|s| s.wallet.id.clone()))
            })
            .or_else(|| store.active_id.clone())
            .or_else(|| store.wallets.first().map(|item| item.id.clone()))
            .ok_or("Cüzdan bulunamadı")?;
        let info = {
            let entry = store
                .wallets
                .iter_mut()
                .find(|item| item.id == id)
                .ok_or("Cüzdan bulunamadı")?;
            entry.name = sanitize_name(&name);
            WalletInfo::from(&*entry)
        };
        vault::save(&store)?;
        if let Some(session) = state
            .session
            .lock()
            .map_err(|_| "Oturum kilidi alınamadı")?
            .as_mut()
        {
            if session.wallet.id == info.id {
                session.wallet.name = info.name.clone();
            }
        }
        return Ok(info);
    }

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
pub async fn reveal_mnemonic(
    wallet_id: Option<String>,
    password: String,
) -> Result<String, String> {
    blocking(move || {
        throttle::check()?;
        if vault::exists() {
            let store = vault::load()?;
            let dek = match verify_strong(&store, &password) {
                Ok(value) => value,
                Err(message) => {
                    throttle::record_failure();
                    return Err(message);
                }
            };
            let id = wallet_id
                .or_else(|| store.active_id.clone())
                .or_else(|| store.wallets.first().map(|item| item.id.clone()))
                .ok_or("Cüzdan bulunamadı")?;
            let phrase = vault::open_wallet(&store, &dek, &id)?;
            let address = derive_address(phrase.as_str())?;
            if let Some(entry) = store.wallets.iter().find(|item| item.id == id) {
                if !address.eq_ignore_ascii_case(&entry.address) {
                    return Err("Kasa bütünlük hatası: adres eşleşmiyor.".into());
                }
            }
            throttle::record_success();
            return Ok(phrase.to_string());
        }

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
pub async fn delete_wallet(
    app: AppHandle,
    wallet_id: String,
    password: String,
) -> Result<(), String> {
    blocking(move || {
        let state = app.state::<AppState>();
        throttle::check()?;
        let mut store = vault::load()?;
        let dek = match verify_strong(&store, &password) {
            Ok(value) => value,
            Err(message) => {
                throttle::record_failure();
                return Err(message);
            }
        };
        let _ = vault::open_wallet(&store, &dek, &wallet_id)?;
        let index = store
            .wallets
            .iter()
            .position(|item| item.id == wallet_id)
            .ok_or("Cüzdan bulunamadı")?;
        if store.wallets.len() <= 1 {
            return Err("Son cüzdanı silmek için cüzdanı sıfırla.".into());
        }
        store.wallets.remove(index);
        if store.active_id.as_deref() == Some(wallet_id.as_str()) {
            store.active_id = store.wallets.first().map(|item| item.id.clone());
        }
        vault::save(&store)?;
        throttle::record_success();
        let active = state
            .session
            .lock()
            .map_err(|_| "Oturum kilidi alınamadı")?
            .as_ref()
            .map(|session| session.wallet.id.clone());
        if active.as_deref() == Some(wallet_id.as_str()) {
            let mut session = state.session.lock().map_err(|_| "Oturum kilidi alınamadı")?;
            *session = None;
            let mut dek = state.dek.lock().map_err(|_| "Kasa kilidi alınamadı")?;
            *dek = None;
        }
        Ok(())
    })
    .await
}

#[tauri::command]
pub async fn add_vault_credential(
    app: AppHandle,
    secret: String,
    kind: String,
) -> Result<Option<String>, String> {
    blocking(move || {
        let state = app.state::<AppState>();
        let dek = active_dek(&state)?;
        if kind == "password" {
            validate_password(&secret)?;
        } else if kind == "pin" {
            validate_pin(&secret)?;
        } else {
            return Err("Bilinmeyen kimlik türü".into());
        }
        let mut store = vault::load()?;
        vault::add_credential(&mut store, &dek, &secret, &kind)?;
        vault::save(&store)?;
        Ok(vault::missing_credential(&store).map(str::to_string))
    })
    .await
}

#[tauri::command]
pub async fn reset_wallet(app: AppHandle, password: String) -> Result<(), String> {
    blocking(move || {
        let state = app.state::<AppState>();
        throttle::check()?;

        if vault::exists() {
            let store = vault::load()?;
            if verify_strong(&store, &password).is_err() {
                throttle::record_failure();
                return Err("Parola veya PIN hatalı.".into());
            }
            vault::delete()?;
            keystore::delete()?;
        } else {
            let ks = keystore::load()?;
            if !keystore::verify(&ks.password, &password, &ks.kdf) {
                throttle::record_failure();
                return Err("Parola hatalı.".into());
            }
            keystore::delete()?;
        }

        let _ = std::fs::remove_file(throttle::path());
        let _ = std::fs::remove_file(keystore::path().with_file_name("keystore.v2.bak"));
        let mut session = state.session.lock().map_err(|_| "Oturum kilidi alınamadı")?;
        *session = None;
        let mut dek = state.dek.lock().map_err(|_| "Kasa kilidi alınamadı")?;
        *dek = None;
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

fn verify_strong(store: &Vault, secret: &str) -> Result<Zeroizing<[u8; 32]>, String> {
    if store.password.is_some() {
        vault::unlock_password(store, secret).map_err(|_| "Parola hatalı.".to_string())
    } else {
        vault::unlock(store, secret).map_err(|_| "PIN hatalı.".to_string())
    }
}

fn active_dek(state: &AppState) -> Result<Zeroizing<[u8; 32]>, String> {
    state
        .dek
        .lock()
        .map_err(|_| "Kasa kilidi alınamadı")?
        .clone()
        .ok_or_else(|| "Cüzdan kilitli — önce parolanla aç.".to_string())
}

fn set_session(
    state: &AppState,
    wallet: WalletInfo,
    phrase: &str,
    dek: Zeroizing<[u8; 32]>,
) -> Result<(), String> {
    let mut session = state.session.lock().map_err(|_| "Oturum kilidi alınamadı")?;
    *session = Some(Session {
        wallet,
        mnemonic: Zeroizing::new(phrase.to_string()),
    });
    let mut current = state.dek.lock().map_err(|_| "Kasa kilidi alınamadı")?;
    *current = Some(dek);
    Ok(())
}

fn add_to_vault(
    store: &mut Vault,
    dek: &[u8; 32],
    name: &str,
    phrase: &str,
) -> Result<WalletInfo, String> {
    let id = keystore::new_id();
    let address = derive_address(phrase)?;
    let entry = vault::seal_wallet(
        dek,
        &id,
        &sanitize_name(name),
        &address,
        keystore::now_ms(),
        phrase,
    )?;
    let info = WalletInfo::from(&entry);
    store.wallets.push(entry);
    store.active_id = Some(id);
    Ok(info)
}

fn persist_first(
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
    let dek = vault::generate_dek();
    let mut store = vault::create(&dek, Some(password), Some(pin))?;
    let entry = vault::seal_wallet(
        &dek,
        &keystore::new_id(),
        &sanitize_name(name),
        &address,
        keystore::now_ms(),
        phrase,
    )?;
    store.active_id = Some(entry.id.clone());
    store.wallets.push(entry);
    vault::save(&store)?;
    let info = WalletInfo::from(&store.wallets[0]);
    set_session(state, info.clone(), phrase, dek)?;
    Ok(info)
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
    let (normalized, mut seed) = mnemonic::from_phrase(phrase)?;
    let _normalized = Zeroizing::new(normalized);
    let key = keys::derive_evm_key(&seed);
    seed.zeroize();
    let mut key = Zeroizing::new(key?);
    let address = keys::address_from_key(&key);
    key.zeroize();
    address
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
