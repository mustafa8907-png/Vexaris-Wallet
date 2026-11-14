//! Şifreli keystore.
//!
//! Dosya: uygulama veri dizininde `keystore.json`
//! (Windows `%APPDATA%\com.vexaris.wallet`, Android uygulama özel dizini).
//!
//! Kurtarma ifadesi (mnemonic) iki ayrı sarmalayıcı ile şifrelenir:
//!  - `password`: uzun parola (ana kimlik doğrulama, kurtarma ifadesi gösterimi)
//!  - `pin`: 6 haneli hızlı kilit
//!
//! Her sarmalayıcı kendi scrypt tuzunu ve AES-256-GCM nonce'unu taşır.
//! İkisi de aynı plaintext'i (mnemonic) çözer; böylece hem PIN hem parola
//! ile kilit açılabilir, plaintext ise tek kopya olarak tutulur.
//!
//! PIN yalnızca ~20 bit entropi taşıdığı için sarmalayıcısı paroladan ayrı,
//! yüksek maliyetli bir KDF kullanır; çevrimdışı deneme maliyetini yükseltmek
//! amaçlıdır (cihaz içi tam koruma için `storage::throttle` katmanı devrededir).

use std::fs;
use std::path::PathBuf;
use std::sync::OnceLock;
use std::time::{SystemTime, UNIX_EPOCH};

use aes_gcm::aead::{Aead, KeyInit, Payload};
use aes_gcm::{Aes256Gcm, Nonce};
use rand::rngs::OsRng;
use rand::RngCore;
use scrypt::{scrypt, Params};
use serde::{Deserialize, Serialize};
use zeroize::Zeroizing;

/// v1: KDF parametreleri dosya geneliydi. v2: sarmalayıcı başına parametre.
pub const VERSION: u32 = 2;
/// Parola sarmalayıcısı: 2^17 × r8 ≈ 128 MB (OWASP'ın scrypt önerisi).
const PASSWORD_LOG_N: u8 = 17;
/// PIN sarmalayıcısı: 2^16 × r8 ≈ 64 MB. Düşük entropiyi maliyetle dengeler,
/// gündelik kilit açmayı saniyenin altında tutar.
const PIN_LOG_N: u8 = 16;
/// v1 dosyaların sabiti (2^15 ≈ 32 MB); yalnızca okuma uyumluluğu için duruyor.
const LEGACY_LOG_N: u8 = 15;
const R: u32 = 8;
const P: u32 = 1;
const SALT_LEN: usize = 32;
const NONCE_LEN: usize = 12;
const KEY_LEN: usize = 32;
const AAD: &[u8] = b"vexaris-keystore-v1";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Keystore {
    pub version: u32,
    pub id: String,
    pub name: String,
    pub address: String,
    pub created_at: u64,
    pub kdf: KdfParams,
    pub password: Wrapper,
    pub pin: Wrapper,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct KdfParams {
    pub log_n: u8,
    pub r: u32,
    pub p: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Wrapper {
    pub salt: String,
    pub nonce: String,
    pub ciphertext: String,
    /// Sarmalayıcıya özel KDF. v1 dosyalarda alan yoktur → dosya geneli parametre.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub kdf: Option<KdfParams>,
}

impl Wrapper {
    fn params<'a>(&'a self, global: &'a KdfParams) -> &'a KdfParams {
        self.kdf.as_ref().unwrap_or(global)
    }
}

/// Tauri'nin çözdüğü yazılabilir veri dizini. Android'de `APPDATA` yoktur,
/// bu yüzden kök dizin uygulama kurulurken bir kez kaydedilir.
static DATA_DIR: OnceLock<PathBuf> = OnceLock::new();

pub fn set_data_dir(dir: PathBuf) {
    let _ = DATA_DIR.set(dir);
}

pub fn dir() -> PathBuf {
    // Testler ve taşınabilir kurulum için dizin geçersiz kılınabilir.
    if let Ok(custom) = std::env::var("VEXARIS_KEYSTORE_DIR") {
        if !custom.trim().is_empty() {
            return PathBuf::from(custom);
        }
    }
    if let Some(dir) = DATA_DIR.get() {
        return dir.clone();
    }
    if let Ok(appdata) = std::env::var("APPDATA") {
        return PathBuf::from(appdata).join("com.vexaris.wallet");
    }
    std::env::var("HOME")
        .map(|h| PathBuf::from(h).join(".local/share/com.vexaris.wallet"))
        .unwrap_or_else(|_| PathBuf::from(".").join("com.vexaris.wallet"))
}

pub fn path() -> PathBuf {
    dir().join("keystore.json")
}

pub fn exists() -> bool {
    path().exists()
}

pub fn save(keystore: &Keystore) -> Result<(), String> {
    let dir = dir();
    fs::create_dir_all(&dir).map_err(|e| format!("Keystore dizini oluşturulamadı: {e}"))?;

    let json = serde_json::to_vec_pretty(keystore)
        .map_err(|e| format!("Keystore serileştirilemedi: {e}"))?;

    // Atomik yazma: önce geçici dosya, sonra rename.
    let tmp = dir.join("keystore.json.tmp");
    private_file(&tmp)?;
    fs::write(&tmp, &json).map_err(|e| format!("Keystore yazılamadı: {e}"))?;
    fs::rename(&tmp, path()).map_err(|e| {
        let _ = fs::remove_file(&tmp);
        format!("Keystore kaydedilemedi: {e}")
    })
}

/// Unix/Android'de dosyayı yalnızca uygulama kullanıcısına aç; Windows'ta
/// izinler ACL ile yönetilir, burada dokunulmaz.
pub(crate) fn private_file(path: &PathBuf) -> Result<(), String> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if path.exists() {
            fs::set_permissions(path, fs::Permissions::from_mode(0o600))
                .map_err(|e| format!("Keystore izinleri ayarlanamadı: {e}"))?;
        }
    }
    #[cfg(not(unix))]
    let _ = path;
    Ok(())
}

pub fn load() -> Result<Keystore, String> {
    let raw = fs::read(path()).map_err(|e| format!("Keystore okunamadı: {e}"))?;
    let keystore: Keystore =
        serde_json::from_slice(&raw).map_err(|e| format!("Keystore bozuk: {e}"))?;
    if keystore.version == 0 || keystore.version > VERSION {
        return Err(format!("Desteklenmeyen keystore sürümü: {}", keystore.version));
    }
    Ok(keystore)
}

pub fn delete() -> Result<(), String> {
    if !exists() {
        return Ok(());
    }
    fs::remove_file(path()).map_err(|e| format!("Keystore silinemedi: {e}"))
}

/// Verilen sır ile plaintext'i şifreler; kullanılan KDF parametrelerini de yazar.
pub fn wrap(secret: &str, plaintext: &str, kdf: &KdfParams) -> Result<Wrapper, String> {
    let mut salt = [0u8; SALT_LEN];
    let mut nonce = [0u8; NONCE_LEN];
    OsRng.fill_bytes(&mut salt);
    OsRng.fill_bytes(&mut nonce);

    let key = derive_key(secret, &salt, kdf)?;
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|_| "Şifreleme başlatılamadı")?;
    let ciphertext = cipher
        .encrypt(
            Nonce::from_slice(&nonce),
            Payload {
                msg: plaintext.as_bytes(),
                aad: AAD,
            },
        )
        .map_err(|_| "Şifreleme başarısız")?;

    Ok(Wrapper {
        salt: hex::encode(salt),
        nonce: hex::encode(nonce),
        ciphertext: hex::encode(ciphertext),
        kdf: Some(kdf.clone()),
    })
}

/// Sarmalayıcıyı çözer. Yanlış sır → Err (GCM kimlik doğrulaması başarısız).
/// `global` yalnızca KDF alanı olmayan v1 dosyalar için yedektir.
pub fn unwrap(
    wrapper: &Wrapper,
    secret: &str,
    global: &KdfParams,
) -> Result<Zeroizing<String>, String> {
    let salt = hex::decode(&wrapper.salt).map_err(|_| "Bozuk keystore (salt)")?;
    let nonce = hex::decode(&wrapper.nonce).map_err(|_| "Bozuk keystore (nonce)")?;
    let ciphertext = hex::decode(&wrapper.ciphertext).map_err(|_| "Bozuk keystore (veri)")?;
    if salt.len() != SALT_LEN {
        return Err("Bozuk keystore (salt uzunluğu)".into());
    }
    if nonce.len() != NONCE_LEN {
        return Err("Bozuk keystore (nonce uzunluğu)".into());
    }

    let key = derive_key(secret, &salt, wrapper.params(global))?;
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|_| "Şifre çözme başlatılamadı")?;
    let plaintext = cipher
        .decrypt(
            Nonce::from_slice(&nonce),
            Payload {
                msg: &ciphertext,
                aad: AAD,
            },
        )
        .map_err(|_| "Kimlik doğrulama başarısız")?;

    let text = String::from_utf8(plaintext).map_err(|_| "Keystore içeriği okunamadı")?;
    Ok(Zeroizing::new(text))
}

/// Sır doğru mu? (Plaintext'i dışarı vermeden kontrol eder.)
pub fn verify(wrapper: &Wrapper, secret: &str, global: &KdfParams) -> bool {
    unwrap(wrapper, secret, global).is_ok()
}

fn derive_key(secret: &str, salt: &[u8], kdf: &KdfParams) -> Result<[u8; KEY_LEN], String> {
    let params = Params::new(kdf.log_n, kdf.r, kdf.p, KEY_LEN)
        .map_err(|e| format!("KDF parametreleri: {e}"))?;
    let mut key = Zeroizing::new([0u8; KEY_LEN]);
    scrypt(secret.as_bytes(), salt, &params, key.as_mut())
        .map_err(|e| format!("Anahtar türetilemedi: {e}"))?;
    Ok(*key)
}

fn kdf_with(log_n: u8) -> KdfParams {
    KdfParams { log_n, r: R, p: P }
}

/// Uzun parola sarmalayıcısının parametreleri.
pub fn password_kdf() -> KdfParams {
    kdf_with(PASSWORD_LOG_N)
}

/// 6 haneli PIN sarmalayıcısının parametreleri.
pub fn pin_kdf() -> KdfParams {
    kdf_with(PIN_LOG_N)
}

/// v1 dosyalardaki dosya geneli parametreler (okuma uyumluluğu).
pub fn default_kdf() -> KdfParams {
    kdf_with(LEGACY_LOG_N)
}

pub fn new_id() -> String {
    let mut bytes = [0u8; 16];
    OsRng.fill_bytes(&mut bytes);
    hex::encode(bytes)
}

pub fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Testlerde KDF'yi ucuzlatır (4 MB); üretime ait parametreler ayrıca doğrulanır.
    fn fast_kdf() -> KdfParams {
        KdfParams {
            log_n: 12,
            r: R,
            p: P,
        }
    }

    fn tamper(hex_text: &str) -> String {
        let mut bytes = hex::decode(hex_text).unwrap();
        let last = bytes.len() - 1;
        bytes[last] ^= 0x01;
        hex::encode(bytes)
    }

    #[test]
    fn wrapper_round_trip_and_wrong_secret() {
        let w = wrap("parola123", "seed phrase burada", &fast_kdf()).unwrap();
        assert_eq!(
            &*unwrap(&w, "parola123", &default_kdf()).unwrap(),
            "seed phrase burada"
        );
        assert!(unwrap(&w, "yanlis", &default_kdf()).is_err());
        assert!(verify(&w, "parola123", &default_kdf()));
        assert!(!verify(&w, "yanlis", &default_kdf()));
    }

    #[test]
    fn wrappers_use_independent_salts() {
        let a = wrap("parola123", "x", &fast_kdf()).unwrap();
        let b = wrap("parola123", "x", &fast_kdf()).unwrap();
        assert_ne!(a.salt, b.salt);
        assert_ne!(a.nonce, b.nonce);
        assert_ne!(a.ciphertext, b.ciphertext);
    }

    /// AES-256-GCM yalnızca şifrelemekle kalmaz, bütünlüğü de doğrular:
    /// tek bitlik değişiklik dahi çözümü imkânsızlaştırır (sessiz bozulma/yetkisiz
    /// yeniden yazma olmaz).
    #[test]
    fn tampered_ciphertext_or_nonce_is_rejected() {
        let w = wrap("parola123", "gizli ifade", &fast_kdf()).unwrap();

        let broken_ct = Wrapper {
            ciphertext: tamper(&w.ciphertext),
            ..w.clone()
        };
        assert!(unwrap(&broken_ct, "parola123", &default_kdf()).is_err());

        let broken_nonce = Wrapper {
            nonce: tamper(&w.nonce),
            ..w.clone()
        };
        assert!(unwrap(&broken_nonce, "parola123", &default_kdf()).is_err());

        let broken_salt = Wrapper {
            salt: tamper(&w.salt),
            ..w.clone()
        };
        assert!(unwrap(&broken_salt, "parola123", &default_kdf()).is_err());
    }

    /// Sarmalayıcının kendi KDF alanı, dosya geneli parametreden önce gelir.
    #[test]
    fn per_wrapper_kdf_overrides_global() {
        let w = wrap("parola123", "gizli ifade", &fast_kdf()).unwrap();
        assert_eq!(w.kdf.as_ref(), Some(&fast_kdf()));
        // Alan yokmuş gibi dosya geneli parametre dayatılırsa anahtar değişir
        // ve GCM doğrulaması düşer → parametre taklidi çözüme ulaşamaz.
        let spoofed = Wrapper {
            kdf: Some(default_kdf()),
            ..w.clone()
        };
        assert!(unwrap(&w, "parola123", &default_kdf()).is_ok());
        assert!(unwrap(&spoofed, "parola123", &default_kdf()).is_err());
    }

    /// v1 dosyalarda `kdf` alanı yoktur → dosya geneli parametreler kullanılır.
    #[test]
    fn legacy_wrapper_without_kdf_falls_back_to_global() {
        let w = wrap("parola123", "gizli ifade", &fast_kdf()).unwrap();
        let legacy = Wrapper {
            salt: w.salt.clone(),
            nonce: w.nonce.clone(),
            ciphertext: w.ciphertext.clone(),
            kdf: None,
        };
        assert!(unwrap(&legacy, "parola123", &fast_kdf()).is_ok());
        assert!(unwrap(&legacy, "parola123", &default_kdf()).is_err());

        let json = serde_json::to_string(&legacy).unwrap();
        assert!(!json.contains("\"kdf\""), "kdf alanı yazılmamalı: {json}");
        let back: Wrapper = serde_json::from_str(&json).unwrap();
        assert_eq!(back.kdf, None);
    }

    /// Tuz/nonce uzunlukları ve desteklenmeyen KDF parametreleri reddedilmeli.
    #[test]
    fn malformed_wrappers_are_rejected() {
        let w = wrap("parola123", "x", &fast_kdf()).unwrap();

        let short_salt = Wrapper {
            salt: "00".repeat(8),
            ..w.clone()
        };
        assert!(unwrap(&short_salt, "parola123", &default_kdf()).is_err());

        let short_nonce = Wrapper {
            nonce: "00".repeat(4),
            ..w.clone()
        };
        assert!(unwrap(&short_nonce, "parola123", &default_kdf()).is_err());

        let not_hex = Wrapper {
            ciphertext: "zzzz".into(),
            ..w.clone()
        };
        assert!(unwrap(&not_hex, "parola123", &default_kdf()).is_err());

        // r = 0 geçersiz bir scrypt parametresi; sessizce kabul edilmemeli.
        assert!(wrap("parola", "x", &KdfParams { log_n: 15, r: 0, p: P }).is_err());
    }

    /// Üretim parametreleri: PIN paroladan ucuz, parola OWASP düzeyinde olmalı.
    #[test]
    fn production_kdf_params() {
        assert_eq!(password_kdf().log_n, PASSWORD_LOG_N);
        assert_eq!(pin_kdf().log_n, PIN_LOG_N);
        assert_eq!(default_kdf().log_n, LEGACY_LOG_N);
        assert_eq!(password_kdf().r, 8);
        assert_eq!(password_kdf().p, 1);
        // 2^15 → 32 MB, 2^16 → 64 MB, 2^17 → 128 MB.
        assert!(pin_kdf().log_n > LEGACY_LOG_N);
        assert!(password_kdf().log_n > pin_kdf().log_n);
        // Düşük telefonlarda tükenmesin diye üst sınırda kalıyoruz.
        assert!(password_kdf().log_n <= 17);
    }

    /// Kilit açma gecikmesini ölçer (yalnızca elle: `cargo test -- --ignored`).
    #[test]
    #[ignore = "performans ölçümü"]
    fn kdf_unwrap_latency() {
        for (label, kdf) in [("pin", pin_kdf()), ("parola", password_kdf())] {
            let w = wrap("123456", "test phrase", &kdf).unwrap();
            let start = std::time::Instant::now();
            unwrap(&w, "123456", &default_kdf()).unwrap();
            let ms = start.elapsed().as_millis();
            println!("{label} unwrap: {ms} ms");
            assert!(ms < 5000, "{label} kilit açma çok yavaş: {ms} ms");
        }
    }
}
