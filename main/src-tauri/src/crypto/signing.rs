
use k256::ecdsa::{RecoveryId, SigningKey};
use sha3::{Digest, Keccak256};

use super::rlp;

pub struct Eip1559Tx<'a> {
    pub chain_id: u64,
    pub nonce: &'a [u8],
    pub max_priority_fee_per_gas: &'a [u8],
    pub max_fee_per_gas: &'a [u8],
    pub gas_limit: &'a [u8],
    pub to: Option<[u8; 20]>,
    pub value: &'a [u8],
    pub data: &'a [u8],
}

pub struct SignedTx {
    pub raw_hex: String,
    pub hash: String,
}

pub fn sign(key: &[u8; 32], tx: &Eip1559Tx) -> Result<SignedTx, String> {
    let payload = encode(tx, None);
    let digest = Keccak256::digest(&payload);

    let signing = SigningKey::from_slice(key).map_err(|_| "Geçersiz imzalama anahtarı".to_string())?;
    let (signature, _) = signing
        .sign_prehash_recoverable(&digest)
        .map_err(|_| "İmzalama başarısız".to_string())?;

    let signature = signature.normalize_s().unwrap_or(signature);
    let recovery = RecoveryId::trial_recovery_from_prehash(signing.verifying_key(), &digest, &signature)
        .map_err(|_| "İmza geri çözülemedi".to_string())?;
    if recovery.is_x_reduced() {
        return Err("İmzalama başarısız (r azaltması)".into());
    }

    let rs = signature.to_bytes();
    let raw = encode(
        tx,
        Some((
            recovery.is_y_odd() as u8,
            rlp::trimmed(&rs[..32]),
            rlp::trimmed(&rs[32..]),
        )),
    );
    let hash = Keccak256::digest(&raw);

    Ok(SignedTx {
        raw_hex: format!("0x{}", hex::encode(&raw)),
        hash: format!("0x{}", hex::encode(hash)),
    })
}

fn body(tx: &Eip1559Tx) -> Vec<u8> {
    let mut out = Vec::new();
    for field in [
        rlp::uint(tx.chain_id),
        rlp::trimmed(tx.nonce).to_vec(),
        rlp::trimmed(tx.max_priority_fee_per_gas).to_vec(),
        rlp::trimmed(tx.max_fee_per_gas).to_vec(),
        rlp::trimmed(tx.gas_limit).to_vec(),
        tx.to.map(|a| a.to_vec()).unwrap_or_default(),
        rlp::trimmed(tx.value).to_vec(),
        tx.data.to_vec(),
    ] {
        out.extend_from_slice(&rlp::encode_bytes(&field));
    }
    out.extend_from_slice(&[0xC0]);
    out
}

fn encode(tx: &Eip1559Tx, signature: Option<(u8, &[u8], &[u8])>) -> Vec<u8> {
    let mut payload = body(tx);
    if let Some((parity, r, s)) = signature {
        payload.extend_from_slice(&rlp::encode_bytes(&[parity]));
        payload.extend_from_slice(&rlp::encode_bytes(r));
        payload.extend_from_slice(&rlp::encode_bytes(s));
    }

    let mut out = Vec::with_capacity(payload.len() + 10);
    out.push(0x02);
    out.extend_from_slice(&rlp::wrap_list(&payload));
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::crypto::{keys, mnemonic};
    use k256::ecdsa::{Signature, VerifyingKey};
    use std::cmp::Ordering;

    const HALF_ORDER: [u8; 32] = [
        0x7f, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
        0xff, 0x5d, 0x57, 0x6e, 0x73, 0x57, 0xa4, 0x50, 0x1d, 0xdf, 0xe9, 0x2f, 0x46, 0x68, 0x1b,
        0x20, 0xa0,
    ];

    fn sample_tx<'a>(data: &'a [u8]) -> Eip1559Tx<'a> {
        Eip1559Tx {
            chain_id: 1,
            nonce: &[0x01],
            max_priority_fee_per_gas: &[0x02, 0x58],
            max_fee_per_gas: &[0x47, 0xDE, 0x22, 0x9C, 0x00],
            gas_limit: &[0x52, 0x08],
            to: Some([0x35; 20]),
            value: &[0x0D, 0xE0, 0xB6, 0xB3, 0xA7, 0x64, 0x00, 0x00],
            data,
        }
    }

    fn key() -> [u8; 32] {
        let (_, seed) =
            mnemonic::from_phrase("test test test test test test test test test test test junk")
                .unwrap();
        keys::derive_evm_key(&seed).unwrap()
    }

    #[test]
    fn signing_payload_is_hand_checked() {
        let tx = sample_tx(&[]);
        let payload = encode(&tx, None);
        assert_eq!(payload[0], 0x02);
        assert_eq!(payload[1], 0xEE);
        assert_eq!(payload[payload.len() - 1], 0xC0);
        assert_eq!(
            &payload[2..8],
            &[0x01, 0x01, 0x82, 0x02, 0x58, 0x85]
        );
    }

    #[test]
    fn raw_transaction_round_trips_and_hashes() {
        let tx = sample_tx(&[0xAB, 0xCD]);
        let signed = sign(&key(), &tx).unwrap();
        let raw = hex::decode(&signed.raw_hex[2..]).unwrap();

        assert_eq!(raw[0], 0x02);
        let items = decode_items(&raw[1..]);
        assert_eq!(items.len(), 12);

        let rebuilt = encode(
            &tx,
            Some((items[9][0], rlp::trimmed(&items[10]), rlp::trimmed(&items[11]))),
        );
        assert_eq!(rebuilt, raw, "çözülen alanlar yeniden kodlanınca aynı olmalı");
        assert_eq!(
            signed.hash,
            format!("0x{}", hex::encode(Keccak256::digest(&raw)))
        );
    }

    #[test]
    fn signature_recovers_the_wallet_key() {
        let key = key();
        let expected = SigningKey::from_slice(&key).unwrap();
        let tx = sample_tx(&[]);
        let signed = sign(&key, &tx).unwrap();

        let digest = Keccak256::digest(&encode(&tx, None));
        let raw = hex::decode(&signed.raw_hex[2..]).unwrap();
        let items = decode_items(&raw[1..]);
        let signature = Signature::from_scalars(pad32(&items[10]), pad32(&items[11])).unwrap();
        let recovered = VerifyingKey::recover_from_prehash(
            &digest,
            &signature,
            RecoveryId::from_byte(items[9][0]).unwrap(),
        )
        .unwrap();

        assert_eq!(&recovered, expected.verifying_key());
        assert_eq!(
            keys::address_from_key(&key).unwrap(),
            "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
        );
    }

    #[test]
    fn signature_uses_low_s() {
        let key = key();
        for i in 0..12u8 {
            let data = [i];
            let tx = sample_tx(&data);
            let signed = sign(&key, &tx).unwrap();
            let raw = hex::decode(&signed.raw_hex[2..]).unwrap();
            let items = decode_items(&raw[1..]);
            let s = pad32(&items[11]);
            assert_eq!(s.cmp(&HALF_ORDER), Ordering::Less);
        }
    }

    fn pad32(bytes: &[u8]) -> [u8; 32] {
        assert!(bytes.len() <= 32, "32 bayttan uzun alan: {}", bytes.len());
        let mut out = [0u8; 32];
        out[32 - bytes.len()..].copy_from_slice(bytes);
        out
    }

    fn decode_items(bytes: &[u8]) -> Vec<Vec<u8>> {
        let (len, header) = list_extent(bytes);
        let payload = &bytes[header..header + len];
        let mut items = Vec::new();
        let mut i = 0;
        while i < payload.len() {
            let (item, consumed) = read_item(&payload[i..]);
            items.push(item);
            i += consumed;
        }
        items
    }

    fn be_len(bytes: &[u8], digits: u8) -> usize {
        let mut len = 0usize;
        for b in &bytes[..digits as usize] {
            len = (len << 8) | *b as usize;
        }
        len
    }

    fn list_extent(bytes: &[u8]) -> (usize, usize) {
        let prefix = bytes[0];
        if prefix >= 0xC0 && prefix <= 0xF7 {
            ((prefix - 0xC0) as usize, 1)
        } else if prefix >= 0xF8 {
            let digits = (prefix - 0xF7) as usize;
            (be_len(&bytes[1..], digits as u8), 1 + digits)
        } else {
            panic!("liste beklenirken 0x{prefix:02x} bulundu");
        }
    }

    fn read_item(bytes: &[u8]) -> (Vec<u8>, usize) {
        let prefix = bytes[0];
        if prefix < 0x80 {
            return (bytes[..1].to_vec(), 1);
        }
        if prefix <= 0xB7 {
            let len = (prefix - 0x80) as usize;
            return (bytes[1..1 + len].to_vec(), 1 + len);
        }
        if prefix < 0xC0 {
            let digits = (prefix - 0xB7) as usize;
            let len = be_len(&bytes[1..], digits as u8);
            let start = 1 + digits;
            return (bytes[start..start + len].to_vec(), start + len);
        }
        if prefix <= 0xF7 {
            let total = 1 + (prefix - 0xC0) as usize;
            return (bytes[..total].to_vec(), total);
        }
        let digits = (prefix - 0xF7) as usize;
        let total = 1 + digits + be_len(&bytes[1..], digits as u8);
        (bytes[..total].to_vec(), total)
    }
}
