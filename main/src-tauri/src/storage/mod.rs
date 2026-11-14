//! Kalıcı depolama katmanı.

pub mod keystore;
pub mod throttle;

/// `VEXARIS_KEYSTORE_DIR` süreç düzeyinde bir değişkendir. Testler farklı
/// dizinler için bu değişkeni yazdığından, birbirlerinin dosyalarını ezmemeleri
/// için sıraya alınır.
#[cfg(test)]
pub static ENV_LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());

#[cfg(test)]
pub fn env_guard() -> std::sync::MutexGuard<'static, ()> {
    ENV_LOCK.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
}
