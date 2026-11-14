
use serde_json::Value;
use tauri::State;
use zeroize::Zeroizing;

use crate::crypto::{eip712, keys, mnemonic, signature};
use crate::state::AppState;

#[tauri::command]
pub fn personal_sign(
    state: State<'_, AppState>,
    message: String,
    account: String,
) -> Result<String, String> {
    let bytes = message_bytes(&message)?;
    with_wallet_key(&state, &account, |key| {
        signature::personal_sign(key, &bytes)
    })
}

#[tauri::command]
pub fn sign_typed_data(
    state: State<'_, AppState>,
    payload: String,
    account: String,
) -> Result<String, String> {
    let value: Value = serde_json::from_str(&payload)
        .map_err(|error| format!("Tip verisi JSON olarak okunamadı: {error}"))?;
    let digest = eip712::digest(&value)?;
    with_wallet_key(&state, &account, move |key| {
        signature::sign_digest(key, &digest)
    })
}

fn with_wallet_key<T>(
    state: &State<'_, AppState>,
    account: &str,
    sign: impl FnOnce(&[u8; 32]) -> Result<T, String>,
) -> Result<T, String> {
    let guard = state
        .session
        .lock()
        .map_err(|_| "Oturum kilidi alınamadı")?;
    let session = guard
        .as_ref()
        .ok_or("Cüzdan kilitli — önce parolanla aç.")?;

    let seed = Zeroizing::new(mnemonic::seed_of(&session.mnemonic)?);
    let key = Zeroizing::new(keys::derive_evm_key(&seed[..])?);

    if !account
        .trim()
        .eq_ignore_ascii_case(&keys::address_from_key(&key)?)
    {
        return Err("İmzalama reddedildi: adres bu cüzdana ait değil.".into());
    }

    sign(&key)
}

fn message_bytes(value: &str) -> Result<Vec<u8>, String> {
    let trimmed = value.trim();
    let Some(digits) = trimmed
        .strip_prefix("0x")
        .or_else(|| trimmed.strip_prefix("0X"))
    else {
        return Ok(trimmed.as_bytes().to_vec());
    };
    if digits.is_empty() {
        return Ok(Vec::new());
    }
    let even = if digits.len() % 2 == 1 {
        format!("0{digits}")
    } else {
        digits.to_string()
    };
    if !even.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        return Ok(trimmed.as_bytes().to_vec());
    }
    hex::decode(&even).map_err(|_| format!("Heksadecimal okunamadı: {value}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hex_prefixed_messages_decode_to_bytes() {
        assert_eq!(message_bytes("0x48656c6c6f").unwrap(), b"Hello");
        assert_eq!(message_bytes("0X48656C6C6F").unwrap(), b"Hello");
        assert_eq!(message_bytes("0x").unwrap(), Vec::<u8>::new());
        assert_eq!(message_bytes("0xf").unwrap(), vec![0x0F]);
    }

    #[test]
    fn plain_text_stays_text_even_when_it_looks_like_hex() {
        assert_eq!(message_bytes("Hello").unwrap(), b"Hello");
        assert_eq!(message_bytes("abcdef01").unwrap(), b"abcdef01");
        assert_eq!(message_bytes("0xzz").unwrap(), b"0xzz");
        assert_eq!(
            message_bytes("  doğrulama ✓  ").unwrap(),
            "doğrulama ✓".as_bytes()
        );
    }
}
