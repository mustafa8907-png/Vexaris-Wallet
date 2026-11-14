
use k256::ecdsa::{RecoveryId, SigningKey};
use sha3::{Digest, Keccak256};

pub fn personal_digest(message: &[u8]) -> [u8; 32] {
    let header = format!("\x19Ethereum Signed Message:\n{}", message.len());
    let mut buffer = Vec::with_capacity(header.len() + message.len());
    buffer.extend_from_slice(header.as_bytes());
    buffer.extend_from_slice(message);
    Keccak256::digest(buffer).into()
}

pub fn sign_digest(key: &[u8; 32], digest: &[u8; 32]) -> Result<String, String> {
    let signing = SigningKey::from_slice(key).map_err(|_| "Geçersiz imzalama anahtarı".to_string())?;
    let (signature, _) = signing
        .sign_prehash_recoverable(digest)
        .map_err(|_| "İmzalama başarısız".to_string())?;

    let signature = signature.normalize_s().unwrap_or(signature);
    let recovery = RecoveryId::trial_recovery_from_prehash(signing.verifying_key(), digest, &signature)
        .map_err(|_| "İmza geri çözülemedi".to_string())?;
    if recovery.is_x_reduced() {
        return Err("İmzalama başarısız (r azaltması)".into());
    }

    let mut out = signature.to_bytes().to_vec();
    out.push(27 + recovery.is_y_odd() as u8);
    Ok(format!("0x{}", hex::encode(out)))
}

pub fn personal_sign(key: &[u8; 32], message: &[u8]) -> Result<String, String> {
    sign_digest(key, &personal_digest(message))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::crypto::{keys, mnemonic};
    use k256::ecdsa::{Signature, VerifyingKey};

    fn key() -> [u8; 32] {
        let (_, seed) =
            mnemonic::from_phrase("test test test test test test test test test test test junk")
                .unwrap();
        keys::derive_evm_key(&seed).unwrap()
    }

    #[test]
    fn personal_digest_matches_reference_vectors() {
        assert_eq!(
            hex::encode(personal_digest(b"Some data")),
            "1da44b586eb0729ff70a73c326926f6ed5a25f5b056e7f47fbc6e58d86871655"
        );
        assert_eq!(
            hex::encode(personal_digest("hello vexaris".as_bytes())),
            "8a7af6fde6103c00899ffa959d6b9a8cbf7f434017cabba4458ae73755ffc4c6"
        );
    }

    #[test]
    fn digest_counts_bytes_not_characters() {
        let text = "ğ".as_bytes();
        assert_eq!(text.len(), 2);
        assert_ne!(
            personal_digest(text),
            personal_digest("ğ".chars().count().to_string().as_bytes())
        );
    }

    #[test]
    fn signature_is_low_s_and_recovers_the_wallet_key() {
        let secret = key();
        let expected = SigningKey::from_slice(&secret).unwrap();
        for message in [
            b"Some data".as_slice(),
            "Vexaris giriş isteği ✓".as_bytes(),
            &[0u8; 32][..],
        ] {
            let digest = personal_digest(message);
            let signature = personal_sign(&secret, message).unwrap();
            let raw = hex::decode(&signature[2..]).unwrap();
            assert_eq!(raw.len(), 65);
            assert!([27u8, 28].contains(&raw[64]), "v = {}", raw[64]);

            let parsed = Signature::from_slice(&raw[..64]).unwrap();
            assert!(parsed.normalize_s().is_none(), "S düşük yarıda olmalı");

            let recovery = RecoveryId::from_byte(raw[64] - 27).unwrap();
            let recovered =
                VerifyingKey::recover_from_prehash(&digest, &parsed, recovery).unwrap();
            assert_eq!(&recovered, expected.verifying_key());
        }
    }
}
