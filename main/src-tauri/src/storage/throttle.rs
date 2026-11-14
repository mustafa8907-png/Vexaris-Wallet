
use std::fs;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};

use crate::storage::keystore;

const FREE_ATTEMPTS: u32 = 5;
const BASE_DELAY_SECS: u64 = 30;
const MAX_DELAY_SECS: u64 = 8 * 60 * 60;

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Counter {
    pub failures: u32,
    pub blocked_until: u64,
    pub updated_at: u64,
}

pub fn path() -> std::path::PathBuf {
    keystore::dir().join("security.json")
}

fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

fn delay_for(failures: u32) -> u64 {
    if failures <= FREE_ATTEMPTS {
        return 0;
    }
    let steps = (failures - FREE_ATTEMPTS).min(10);
    BASE_DELAY_SECS
        .saturating_mul(1u64 << steps)
        .min(MAX_DELAY_SECS)
}

fn load() -> Counter {
    fs::read(path())
        .ok()
        .and_then(|raw| serde_json::from_slice(&raw).ok())
        .unwrap_or_default()
}

fn save(counter: &Counter) {
    let path = path();
    if let Some(dir) = path.parent() {
        let _ = fs::create_dir_all(dir);
    }
    if let Ok(json) = serde_json::to_vec_pretty(counter) {
        let _ = fs::write(&path, json);
        let _ = keystore::private_file(&path);
    }
}

fn remaining_block(counter: &Counter, wall_now: u64) -> u64 {
    let now = wall_now.max(counter.updated_at);
    counter.blocked_until.saturating_sub(now)
}

pub fn check() -> Result<(), String> {
    let remaining = remaining_block(&load(), now_secs());
    if remaining > 0 {
        return Err(format!("Çok fazla hatalı deneme. {remaining} sn sonra tekrar dene."));
    }
    Ok(())
}

pub fn record_failure() {
    let mut counter = load();
    let now = now_secs().max(counter.updated_at);
    counter.failures += 1;
    counter.blocked_until = now + delay_for(counter.failures);
    counter.updated_at = now;
    save(&counter);
}

pub fn record_success() {
    let mut counter = load();
    counter.failures = 0;
    counter.blocked_until = 0;
    counter.updated_at = now_secs().max(counter.updated_at);
    save(&counter);
}

#[cfg(test)]
mod tests {
    use super::*;

    fn isolated() -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!("vexaris-throttle-{}", keystore::new_id()));
        fs::create_dir_all(&dir).unwrap();
        std::env::set_var("VEXARIS_KEYSTORE_DIR", &dir);
        dir
    }

    #[test]
    fn backoff_starts_after_free_attempts() {
        assert_eq!(delay_for(0), 0);
        assert_eq!(delay_for(FREE_ATTEMPTS), 0);
        assert_eq!(delay_for(FREE_ATTEMPTS + 1), 60);
        assert_eq!(delay_for(FREE_ATTEMPTS + 2), 120);
        assert_eq!(delay_for(FREE_ATTEMPTS + 3), 240);
        assert_eq!(delay_for(100), MAX_DELAY_SECS);
    }

    #[test]
    fn failures_lock_the_device_until_the_delay_passes() {
        let _guard = crate::storage::env_guard();
        let dir = isolated();
        check().unwrap();

        for _ in 0..FREE_ATTEMPTS {
            record_failure();
            check().unwrap();
        }

        record_failure();
        let err = check().expect_err("6. hata beklemeye sokmalı");
        assert!(err.contains("sn"), "mesaj süre içermeli: {err}");

        record_success();
        check().unwrap();
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn clock_rollback_does_not_clear_the_block() {
        let base = 1_700_000_000;
        let blocked = Counter {
            failures: FREE_ATTEMPTS + 1,
            blocked_until: base + 60,
            updated_at: base,
        };

        assert_eq!(remaining_block(&blocked, base + 10), 50);
        assert_eq!(remaining_block(&blocked, base + 61), 0);
        assert_eq!(remaining_block(&blocked, 0), 60);
        assert_eq!(remaining_block(&blocked, base - 100_000), 60);
    }

    #[test]
    fn block_survives_a_reload() {
        let _guard = crate::storage::env_guard();
        let dir = isolated();
        for _ in 0..FREE_ATTEMPTS + 1 {
            record_failure();
        }
        let counter = load();
        assert!(counter.blocked_until > counter.updated_at, "bloke süresi yazılmalı");
        assert!(check().is_err());
        let _ = fs::remove_dir_all(dir);
    }
}
