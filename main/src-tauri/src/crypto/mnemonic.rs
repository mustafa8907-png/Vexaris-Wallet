
use bip39::{Language, Mnemonic, MnemonicType, Seed};

#[allow(dead_code)]
pub const WORD_COUNT: usize = 12;

pub fn generate() -> Result<(String, [u8; 64]), String> {
    let mnemonic = Mnemonic::new(MnemonicType::Words12, Language::English);
    Ok(extract(mnemonic))
}

pub fn from_phrase(input: &str) -> Result<(String, [u8; 64]), String> {
    let mnemonic = parse(input)?;
    Ok(extract(mnemonic))
}

pub fn seed_of(input: &str) -> Result<[u8; 64], String> {
    let mnemonic = parse(input)?;
    let seed = Seed::new(&mnemonic, "");
    let mut bytes = [0u8; 64];
    bytes.copy_from_slice(seed.as_bytes());
    Ok(bytes)
}

fn parse(input: &str) -> Result<Mnemonic, String> {
    let normalized = normalize(input);
    Mnemonic::from_phrase(&normalized, Language::English).map_err(|_| {
        "Kurtarma ifadesi geçersiz (kelime sayısı veya checksum hatalı).".to_string()
    })
}

fn extract(mnemonic: Mnemonic) -> (String, [u8; 64]) {
    let seed = Seed::new(&mnemonic, "");
    let mut bytes = [0u8; 64];
    bytes.copy_from_slice(seed.as_bytes());
    (mnemonic.phrase().to_string(), bytes)
}

fn normalize(input: &str) -> String {
    input
        .split_whitespace()
        .map(|w| w.to_lowercase())
        .collect::<Vec<_>>()
        .join(" ")
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;

    #[test]
    fn generated_phrase_round_trips() {
        let (phrase, seed) = generate().unwrap();
        assert_eq!(phrase.split_whitespace().count(), WORD_COUNT);
        let (parsed, seed2) = from_phrase(&phrase).unwrap();
        assert_eq!(phrase, parsed);
        assert_eq!(seed, seed2);
    }

    #[test]
    fn generated_phrases_are_distinct() {
        let mut seen = HashSet::new();
        for _ in 0..32 {
            let (phrase, _) = generate().unwrap();
            assert!(seen.insert(phrase), "mnemonic tekrarı: CSPRNG sanal görünüyor");
        }
    }

    #[test]
    fn rejects_phrase_with_bad_checksum() {
        let bad = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon zombie";
        assert!(from_phrase(bad).is_err());
    }

    #[test]
    fn seed_matches_bip39_vector() {
        let seed = seed_of(
            "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
        )
        .unwrap();
        assert_eq!(
            hex::encode(seed),
            "5eb00bbddcf069084889a8ab9155568165f5c453ccb85e70811aaed6f6da5fc1\
             9a5ac40b389cd370d086206dec8aa6c43daea6690f20ad3d8d48b2d2ce9e38e4"
        );
    }

    #[test]
    fn rejects_unknown_word() {
        let bad = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon xyzzy";
        assert!(from_phrase(bad).is_err());
    }

    #[test]
    fn normalizes_case_and_whitespace() {
        let (phrase, _) = generate().unwrap();
        let messy = format!("  {}  ", phrase.to_uppercase().replace(' ', "   "));
        let (parsed, _) = from_phrase(&messy).unwrap();
        assert_eq!(parsed, phrase);
    }
}
