use std::fs;
use std::path::PathBuf;

use aes_gcm::aead::{Aead, KeyInit, Payload};
use aes_gcm::{Aes256Gcm, Nonce};
use rand::rngs::OsRng;
use rand::RngCore;
use serde::{Deserialize, Serialize};
use zeroize::Zeroizing;

use super::keystore::{self, KdfParams, Wrapper};

pub const VERSION: u32 = 3;
const NONCE_LEN: usize = 12;
const KEY_LEN: usize = 32;
const AAD_PREFIX: &str = "vexaris-wallet-v3";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultWallet {
    pub id: String,
    pub name: String,
    pub address: String,
    pub created_at: u64,
    pub sealed: Wrapper,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Vault {
    pub version: u32,
    pub kdf: KdfParams,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub password: Option<Wrapper>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pin: Option<Wrapper>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub active_id: Option<String>,
    pub wallets: Vec<VaultWallet>,
}

pub fn path() -> PathBuf {
    keystore::dir().join("vault.json")
}

pub fn exists() -> bool {
    path().exists()
}

pub fn delete() -> Result<(), String> {
    if !exists() {
        return Ok(());
    }
    fs::remove_file(path()).map_err(|e| format!("Kasa silinemedi: {e}"))
}

pub fn load() -> Result<Vault, String> {
    let raw = fs::read(path()).map_err(|e| format!("Kasa okunamadı: {e}"))?;
    let vault: Vault = serde_json::from_slice(&raw).map_err(|e| format!("Kasa bozuk: {e}"))?;
    if vault.version == 0 || vault.version > VERSION {
        return Err(format!("Desteklenmeyen kasa sürümü: {}", vault.version));
    }
    Ok(vault)
}

pub fn save(vault: &Vault) -> Result<(), String> {
    let dir = keystore::dir();
    fs::create_dir_all(&dir).map_err(|e| format!("Kasa dizini oluşturulamadı: {e}"))?;
    let json = serde_json::to_vec_pretty(vault).map_err(|e| format!("Kasa serileştirilemedi: {e}"))?;
    let tmp = dir.join("vault.json.tmp");
    keystore::private_file(&tmp)?;
    fs::write(&tmp, &json).map_err(|e| format!("Kasa yazılamadı: {e}"))?;
    keystore::private_file(&tmp)?;
    fs::rename(&tmp, path()).map_err(|e| {
        let _ = fs::remove_file(&tmp);
        format!("Kasa kaydedilemedi: {e}")
    })
}

pub fn generate_dek() -> Zeroizing<[u8; KEY_LEN]> {
    let mut dek = Zeroizing::new([0u8; KEY_LEN]);
    OsRng.fill_bytes(&mut *dek);
    dek
}

fn aad(wallet_id: &str) -> String {
    format!("{AAD_PREFIX}:{wallet_id}")
}

pub fn seal(dek: &[u8; KEY_LEN], plaintext: &str, wallet_id: &str) -> Result<Wrapper, String> {
    let mut nonce = [0u8; NONCE_LEN];
    OsRng.fill_bytes(&mut nonce);
    let cipher = Aes256Gcm::new_from_slice(dek).map_err(|_| "Kasa şifrelemesi başlatılamadı")?;
    let ciphertext = cipher
        .encrypt(
            Nonce::from_slice(&nonce),
            Payload {
                msg: plaintext.as_bytes(),
                aad: aad(wallet_id).as_bytes(),
            },
        )
        .map_err(|_| "Cüzdan şifrelenemedi")?;
    Ok(Wrapper {
        salt: String::new(),
        nonce: hex::encode(nonce),
        ciphertext: hex::encode(ciphertext),
        kdf: None,
    })
}

pub fn open(dek: &[u8; KEY_LEN], sealed: &Wrapper, wallet_id: &str) -> Result<Zeroizing<String>, String> {
    let nonce = hex::decode(&sealed.nonce).map_err(|_| "Bozuk kasa (nonce)")?;
    let ciphertext = hex::decode(&sealed.ciphertext).map_err(|_| "Bozuk kasa (veri)")?;
    if nonce.len() != NONCE_LEN {
        return Err("Bozuk kasa (nonce uzunluğu)".into());
    }
    let cipher = Aes256Gcm::new_from_slice(dek).map_err(|_| "Kasa şifrelemesi başlatılamadı")?;
    let plaintext = cipher
        .decrypt(
            Nonce::from_slice(&nonce),
            Payload {
                msg: &ciphertext,
                aad: aad(wallet_id).as_bytes(),
            },
        )
        .map_err(|_| "Cüzdan açılamadı")?;
    let text = String::from_utf8(plaintext).map_err(|_| "Cüzdan içeriği okunamadı")?;
    Ok(Zeroizing::new(text))
}

fn wrap_secret(secret: &str, dek: &[u8; KEY_LEN], kdf: KdfParams) -> Result<Wrapper, String> {
    let encoded = Zeroizing::new(hex::encode(&*dek));
    keystore::wrap(secret, &encoded, &kdf)
}

fn unwrap_secret(wrapper: &Wrapper, secret: &str, global: &KdfParams) -> Result<Zeroizing<[u8; KEY_LEN]>, String> {
    let encoded = keystore::unwrap(wrapper, secret, global)?;
    let bytes = Zeroizing::new(hex::decode(encoded.as_str()).map_err(|_| "Kasa anahtarı okunamadı")?);
    if bytes.len() != KEY_LEN {
        return Err("Kasa anahtarı bozuk".into());
    }
    let mut dek = Zeroizing::new([0u8; KEY_LEN]);
    dek.copy_from_slice(&bytes);
    Ok(dek)
}

pub fn create(
    dek: &[u8; KEY_LEN],
    password: Option<&str>,
    pin: Option<&str>,
) -> Result<Vault, String> {
    Ok(Vault {
        version: VERSION,
        kdf: keystore::default_kdf(),
        password: password
            .map(|secret| wrap_secret(secret, dek, keystore::password_kdf()))
            .transpose()?,
        pin: pin
            .map(|secret| wrap_secret(secret, dek, keystore::pin_kdf()))
            .transpose()?,
        active_id: None,
        wallets: Vec::new(),
    })
}

pub fn unlock(vault: &Vault, secret: &str) -> Result<Zeroizing<[u8; KEY_LEN]>, String> {
    let pin_like = secret.len() == 6 && secret.chars().all(|c| c.is_ascii_digit());
    let order = if pin_like {
        [vault.pin.as_ref(), vault.password.as_ref()]
    } else {
        [vault.password.as_ref(), vault.pin.as_ref()]
    };
    for wrapper in order.into_iter().flatten() {
        if let Ok(dek) = unwrap_secret(wrapper, secret, &vault.kdf) {
            return Ok(dek);
        }
    }
    Err("Parola veya PIN hatalı.".into())
}

pub fn unlock_password(vault: &Vault, secret: &str) -> Result<Zeroizing<[u8; KEY_LEN]>, String> {
    let wrapper = vault
        .password
        .as_ref()
        .ok_or("Bu kasada parola tanımlı değil.")?;
    unwrap_secret(wrapper, secret, &vault.kdf)
}

pub fn seal_wallet(
    dek: &[u8; KEY_LEN],
    id: &str,
    name: &str,
    address: &str,
    created_at: u64,
    phrase: &str,
) -> Result<VaultWallet, String> {
    Ok(VaultWallet {
        id: id.to_string(),
        name: name.to_string(),
        address: address.to_string(),
        created_at,
        sealed: seal(dek, phrase, id)?,
    })
}

pub fn open_wallet(
    vault: &Vault,
    dek: &[u8; KEY_LEN],
    id: &str,
) -> Result<Zeroizing<String>, String> {
    let wallet = vault
        .wallets
        .iter()
        .find(|item| item.id == id)
        .ok_or("Cüzdan bulunamadı")?;
    open(dek, &wallet.sealed, &wallet.id)
}

pub fn missing_credential(vault: &Vault) -> Option<&'static str> {
    match (vault.password.is_some(), vault.pin.is_some()) {
        (false, true) => Some("password"),
        (true, false) => Some("pin"),
        _ => None,
    }
}

pub fn add_credential(
    vault: &mut Vault,
    dek: &[u8; KEY_LEN],
    secret: &str,
    kind: &str,
) -> Result<(), String> {
    match kind {
        "password" => vault.password = Some(wrap_secret(secret, dek, keystore::password_kdf())?),
        "pin" => vault.pin = Some(wrap_secret(secret, dek, keystore::pin_kdf())?),
        _ => return Err("Bilinmeyen kimlik türü".into()),
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn cheap() -> KdfParams {
        KdfParams {
            log_n: 12,
            r: 8,
            p: 1,
        }
    }

    #[test]
    fn sealed_wallet_round_trip_and_binding() {
        let dek = generate_dek();
        let phrase = "test test test test test test test test test test test junk";
        let sealed = seal(&dek, phrase, "wallet-a").unwrap();
        assert_eq!(&*open(&dek, &sealed, "wallet-a").unwrap(), phrase);
        assert!(open(&dek, &sealed, "wallet-b").is_err());
        assert!(open(&generate_dek(), &sealed, "wallet-a").is_err());
    }

    #[test]
    fn secret_wrappers_accept_both_credentials() {
        let dek = generate_dek();
        let vault = Vault {
            version: VERSION,
            kdf: cheap(),
            password: Some(wrap_secret("parola1234", &dek, cheap()).unwrap()),
            pin: Some(wrap_secret("123456", &dek, cheap()).unwrap()),
            active_id: None,
            wallets: Vec::new(),
        };
        assert_eq!(&*unlock(&vault, "parola1234").unwrap(), &*dek);
        assert_eq!(&*unlock(&vault, "123456").unwrap(), &*dek);
        assert!(unlock(&vault, "yanlis").is_err());
    }

    #[test]
    fn password_unwrap_rejects_pin_when_password_exists() {
        let dek = generate_dek();
        let vault = Vault {
            version: VERSION,
            kdf: cheap(),
            password: Some(wrap_secret("parola1234", &dek, cheap()).unwrap()),
            pin: Some(wrap_secret("123456", &dek, cheap()).unwrap()),
            active_id: None,
            wallets: Vec::new(),
        };
        assert!(unlock_password(&vault, "parola1234").is_ok());
        assert!(unlock_password(&vault, "123456").is_err());
    }

    #[test]
    fn missing_credential_is_reported() {        let dek = generate_dek();
        let mut vault = Vault {
            version: VERSION,
            kdf: cheap(),
            password: None,
            pin: Some(wrap_secret("123456", &dek, cheap()).unwrap()),
            active_id: None,
            wallets: Vec::new(),
        };
        assert_eq!(missing_credential(&vault), Some("password"));
        add_credential(&mut vault, &dek, "parola1234", "password").unwrap();
        assert_eq!(missing_credential(&vault), None);
    }
}
