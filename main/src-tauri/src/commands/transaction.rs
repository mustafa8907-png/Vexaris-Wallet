use serde::{Deserialize, Serialize};
use tauri::State;
use zeroize::Zeroizing;

use crate::crypto::{keys, mnemonic, rlp, signing};
use crate::state::AppState;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UnsignedTx {
    pub chain_id: u32,
    pub from: String,
    pub to: String,
    pub value_hex: String,
    pub data_hex: String,
    pub gas_limit_hex: String,
    pub max_fee_per_gas_hex: String,
    pub max_priority_fee_hex: String,
    pub nonce_hex: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SignedTransaction {
    pub raw_hex: String,
    pub hash: String,
}

#[tauri::command]
pub fn sign_transaction(
    state: State<'_, AppState>,
    tx: UnsignedTx,
) -> Result<SignedTransaction, String> {
    let guard = state.session.lock().map_err(|_| "Oturum kilidi alınamadı")?;
    let session = guard.as_ref().ok_or("Cüzdan kilitli — önce parolanla aç.")?;

    let seed = Zeroizing::new(mnemonic::seed_of(&session.mnemonic)?);
    let key = Zeroizing::new(keys::derive_evm_key(&seed[..])?);

    if !addresses_equal(&tx.from, &keys::address_from_key(&key)?) {
        return Err("İmzalama reddedildi: gönderen adres bu cüzdana ait değil.".into());
    }

    let nonce = quantity(&tx.nonce_hex)?;
    let max_priority = quantity(&tx.max_priority_fee_hex)?;
    let max_fee = quantity(&tx.max_fee_per_gas_hex)?;
    let gas_limit = quantity(&tx.gas_limit_hex)?;
    let value = quantity(&tx.value_hex)?;
    let data = bytes(&tx.data_hex)?;
    let to = if tx.to.trim().is_empty() {
        None
    } else {
        Some(address(&tx.to)?)
    };

    let request = signing::Eip1559Tx {
        chain_id: tx.chain_id as u64,
        nonce: &nonce,
        max_priority_fee_per_gas: &max_priority,
        max_fee_per_gas: &max_fee,
        gas_limit: &gas_limit,
        to,
        value: &value,
        data: &data,
    };

    let signed = signing::sign(&key, &request)?;
    Ok(SignedTransaction {
        raw_hex: signed.raw_hex,
        hash: signed.hash,
    })
}

fn strip_prefix(value: &str) -> &str {
    let value = value.trim();
    value
        .strip_prefix("0x")
        .or_else(|| value.strip_prefix("0X"))
        .unwrap_or(value)
}

fn bytes(value: &str) -> Result<Vec<u8>, String> {
    let hex = strip_prefix(value);
    if hex.is_empty() {
        return Ok(Vec::new());
    }
    let padded = if hex.len() % 2 == 1 {
        format!("0{hex}")
    } else {
        hex.to_string()
    };
    hex::decode(&padded).map_err(|_| format!("Heksadecimal okunamadı: {value}"))
}

fn quantity(value: &str) -> Result<Vec<u8>, String> {
    let decoded = bytes(value)?;
    Ok(rlp::trimmed(&decoded).to_vec())
}

fn address(value: &str) -> Result<[u8; 20], String> {
    let decoded = bytes(value)?;
    decoded
        .as_slice()
        .try_into()
        .map_err(|_| format!("20 baytlık adres bekleniyor: {value}"))
}

fn addresses_equal(left: &str, right: &str) -> bool {
    left.trim().to_lowercase() == right.trim().to_lowercase()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn quantities_are_canonical_and_minimal() {
        assert_eq!(quantity("0x0").unwrap(), Vec::<u8>::new());
        assert_eq!(quantity("0x000").unwrap(), Vec::<u8>::new());
        assert_eq!(quantity("").unwrap(), Vec::<u8>::new());
        assert_eq!(quantity("0x1").unwrap(), vec![1]);
        assert_eq!(quantity("0xff").unwrap(), vec![0xFF]);
        assert_eq!(quantity("0x0400").unwrap(), vec![0x04, 0x00]);
        assert_eq!(quantity("0X3B9ACA00").unwrap(), vec![0x3B, 0x9A, 0xCA, 0x00]);
    }

    #[test]
    fn rejects_malformed_hex_and_short_addresses() {
        assert!(bytes("0xzz").is_err());
        assert!(quantity("0x12.5").is_err());
        assert!(address("0x1234").is_err());
        assert_eq!(
            address("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266").unwrap().len(),
            20
        );
    }

    #[test]
    fn address_compare_ignores_case_and_spaces() {
        assert!(addresses_equal(
            " 0xF39FD6E51AAD88F6F4CE6AB8827279CFFFB92266 ",
            "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
        ));
        assert!(!addresses_equal("0x01", "0x02"));
    }
}
