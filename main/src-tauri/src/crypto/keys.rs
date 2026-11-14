//! BIP-32 HD türetme (EVM yolu) ve EIP-55 adres üretimi.
//!
//! `m/44'/60'/0'/0/0` yolu üzerinden secp256k1 anahtarı türetilir; adres,
//! açık anahtarın Keccak-256 özetinin son 20 baytıdır.

use hmac::{Hmac, Mac};
use k256::{
    elliptic_curve::{ops::Reduce, sec1::ToEncodedPoint},
    Scalar, SecretKey, U256,
};
use sha2::{Digest, Sha512};
use sha3::Keccak256;

type HmacSha512 = Hmac<Sha512>;

const HARDENED: u32 = 0x8000_0000;
const EVM_PATH: [u32; 5] = [44 | HARDENED, 60 | HARDENED, HARDENED, 0, 0];

struct ExtKey {
    key: [u8; 32],
    chain: [u8; 32],
}

/// BIP-39 seed'inden EVM private key'i türetir.
pub fn derive_evm_key(seed: &[u8]) -> Result<[u8; 32], String> {
    let master = master_key(seed)?;
    let mut ext = master;
    for index in EVM_PATH {
        ext = derive_child(&ext, index)?;
    }
    Ok(ext.key)
}

/// Private key'den EIP-55 checksum'lı adres üretir.
pub fn address_from_key(key: &[u8; 32]) -> Result<String, String> {
    let secret = SecretKey::from_slice(key).map_err(|_| "Geçersiz private key".to_string())?;
    let public = secret.public_key().to_encoded_point(false);
    let bytes = public.as_bytes();
    if bytes.len() != 65 || bytes[0] != 0x04 {
        return Err("Beklenmeyen açık anahtar formatı".into());
    }
    let digest = Keccak256::digest(&bytes[1..]);
    let mut address = [0u8; 20];
    address.copy_from_slice(&digest[12..]);
    Ok(to_checksum(&address))
}

fn master_key(seed: &[u8]) -> Result<ExtKey, String> {
    let i = hmac_sha512(b"Bitcoin seed", seed);
    let mut key = [0u8; 32];
    let mut chain = [0u8; 32];
    key.copy_from_slice(&i[..32]);
    chain.copy_from_slice(&i[32..]);
    if bool::from(Scalar::reduce(U256::from_be_slice(&key)).is_zero()) {
        return Err("Geçersiz seed".into());
    }
    Ok(ExtKey { key, chain })
}

fn derive_child(parent: &ExtKey, index: u32) -> Result<ExtKey, String> {
    let mut data = Vec::with_capacity(37);
    if index & HARDENED != 0 {
        data.push(0u8);
        data.extend_from_slice(&parent.key);
    } else {
        let secret =
            SecretKey::from_slice(&parent.key).map_err(|_| "Geçersiz ebeveyn anahtar".to_string())?;
        data.extend_from_slice(secret.public_key().to_encoded_point(true).as_bytes());
    }
    data.extend_from_slice(&index.to_be_bytes());

    let i = hmac_sha512(&parent.chain, &data);
    let (left, right) = i.split_at(32);

    let key = add_mod_n(left, &parent.key).ok_or("Anahtar türetme sınırı aşıldı")?;
    let mut chain = [0u8; 32];
    chain.copy_from_slice(right);

    // Türetme tamponunu temizle.
    use zeroize::Zeroize;
    data.zeroize();

    Ok(ExtKey { key, chain })
}

fn add_mod_n(left: &[u8], parent: &[u8; 32]) -> Option<[u8; 32]> {
    let left = Scalar::reduce(U256::from_be_slice(left));
    let parent = Scalar::reduce(U256::from_be_slice(parent));
    let sum = left + parent;
    if bool::from(sum.is_zero()) {
        return None;
    }
    let bytes = sum.to_bytes();
    let mut out = [0u8; 32];
    out.copy_from_slice(bytes.as_slice());
    Some(out)
}

fn hmac_sha512(key: &[u8], data: &[u8]) -> [u8; 64] {
    let mut mac = HmacSha512::new_from_slice(key).expect("HMAC her uzunlukta anahtar kabul eder");
    mac.update(data);
    let out = mac.finalize().into_bytes();
    let mut buf = [0u8; 64];
    buf.copy_from_slice(&out);
    buf
}

/// EIP-55 mixed-case checksum.
fn to_checksum(address: &[u8; 20]) -> String {
    let lower = hex::encode(address);
    let digest = Keccak256::digest(lower.as_bytes());
    let digest_hex = hex::encode(digest);
    let mut out = String::with_capacity(42);
    out.push_str("0x");
    for (i, ch) in lower.chars().enumerate() {
        let nibble = u8::from_str_radix(&digest_hex[i..i + 1], 16).unwrap_or(0);
        if ch.is_ascii_alphabetic() && nibble >= 8 {
            out.push(ch.to_ascii_uppercase());
        } else {
            out.push(ch);
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::crypto::mnemonic;

    /// Hardhat'in standart test mnemonic'i → bilinen ilk adres.
    #[test]
    fn derives_known_hardhat_address() {
        let (_, seed) = mnemonic::from_phrase(
            "test test test test test test test test test test test junk",
        )
        .unwrap();
        let key = derive_evm_key(&seed).unwrap();
        assert_eq!(
            address_from_key(&key).unwrap(),
            "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
        );
    }

    #[test]
    fn checksum_matches_eip55_reference() {
        let mut raw = [0u8; 20];
        raw.copy_from_slice(&hex::decode("5aaeb6053f3e94c9b9a09f33669435e7ef1beaed").unwrap());
        assert_eq!(
            to_checksum(&raw),
            "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed"
        );
    }
}
