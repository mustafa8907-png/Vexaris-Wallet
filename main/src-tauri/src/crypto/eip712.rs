//! EIP-712 tip verisi (`eth_signTypedData_v4`) ön özeti.
//!
//! `digest(typed)` → `keccak256(0x1901 || domainSeparator || hashStruct(message))`.
//! Kodlama kuralları: atomik tipler 32 bayta hizalanır, `string`/`bytes` ve
//! diziler kendi özetleriyle temsil edilir, yapılar `typeHash` ile başlar.

use std::collections::BTreeSet;

use serde_json::{json, Map, Value};
use sha3::{Digest, Keccak256};

/// Alan sırası spekte sabittir; domain nesnesinde bulunmayanlar atlanır.
const DOMAIN_FIELDS: [(&str, &str); 5] = [
    ("name", "string"),
    ("version", "string"),
    ("chainId", "uint256"),
    ("verifyingContract", "address"),
    ("salt", "bytes32"),
];

pub fn digest(typed: &Value) -> Result<[u8; 32], String> {
    let types = typed
        .get("types")
        .and_then(Value::as_object)
        .ok_or("Tip verisinde `types` alanı yok")?;
    let primary = typed
        .get("primaryType")
        .and_then(Value::as_str)
        .ok_or("Tip verisinde `primaryType` alanı yok")?;
    let message = typed
        .get("message")
        .ok_or("Tip verisinde `message` alanı yok")?;
    let domain = typed.get("domain").ok_or("Tip verisinde `domain` alanı yok")?;

    // Zorunlu alan eksikse sessizce sıfır kodlamak, kullanıcının onayladığı
    // veriyi imzalanan veriden farklılaştırır.
    if !types.contains_key(primary) {
        return Err(format!("`{primary}` tipi `types` içinde tanımlı değil"));
    }

    let struct_hash = hash_struct(primary, message, types)?;
    let separator = domain_separator(domain, types)?;

    let mut buffer = Vec::with_capacity(66);
    buffer.extend_from_slice(&[0x19, 0x01]);
    buffer.extend_from_slice(&separator);
    buffer.extend_from_slice(&struct_hash);
    Ok(keccak(&buffer))
}

fn domain_separator(domain: &Value, types: &Map<String, Value>) -> Result<[u8; 32], String> {
    let object = domain.as_object().ok_or("`domain` bir nesne olmalı")?;
    let fields: Vec<Value> = DOMAIN_FIELDS
        .iter()
        .filter(|(name, _)| object.contains_key(*name))
        .map(|(name, kind)| json!({ "name": name, "type": kind }))
        .collect();
    if fields.is_empty() {
        return Err("`domain` hiç EIP-712 alanı taşımıyor".into());
    }

    let mut local = types.clone();
    local.insert("EIP712Domain".into(), Value::Array(fields));
    hash_struct("EIP712Domain", domain, &local)
}

fn hash_struct(
    name: &str,
    value: &Value,
    types: &Map<String, Value>,
) -> Result<[u8; 32], String> {
    let type_hash = keccak(encode_type(name, types)?.as_bytes());
    let mut buffer = type_hash.to_vec();
    for field in fields_of(name, types)? {
        let kind = field_type(&field)?;
        let label = field_name(&field)?;
        let item = value
            .get(label)
            .ok_or_else(|| format!("`{name}` içinde `{label}` alanı yok"))?;
        buffer.extend_from_slice(&encode_field(kind, item, types)?);
    }
    Ok(keccak(&buffer))
}

fn encode_field(kind: &str, value: &Value, types: &Map<String, Value>) -> Result<[u8; 32], String> {
    if let Some(inner) = array_inner(kind) {
        let items = value
            .as_array()
            .ok_or_else(|| format!("`{kind}` için dizi bekleniyor"))?;
        let mut joined = Vec::with_capacity(items.len() * 32);
        for item in items {
            joined.extend_from_slice(&encode_field(inner, item, types)?);
        }
        return Ok(keccak(&joined));
    }

    match kind {
        "string" => Ok(keccak(text(value)?.as_bytes())),
        "bytes" => Ok(keccak(&data_bytes(value)?)),
        "address" => Ok(pad_left(&address_bytes(value)?)),
        "bool" => {
            let flag = value
                .as_bool()
                .ok_or_else(|| "`bool` için true/false bekleniyor".to_string())?;
            let mut out = [0u8; 32];
            out[31] = flag as u8;
            Ok(out)
        }
        _ if kind.starts_with("bytes") && kind.len() > 5 => {
            let width: usize = kind[5..]
                .parse()
                .map_err(|_| format!("Geçersiz sabit bayt tipi: {kind}"))?;
            if !(1..=32).contains(&width) {
                return Err(format!("`bytes{width}` geçersiz (1–32)"));
            }
            let raw = data_bytes(value)?;
            if raw.len() > width {
                return Err(format!(
                    "`{kind}` için en fazla {width} bayt bekleniyor, {} geldi",
                    raw.len()
                ));
            }
            Ok(pad_left(&raw))
        }
        _ if kind.starts_with("uint") => encode_uint(kind, value),
        _ if kind.starts_with("int") => encode_int(kind, value),
        _ => {
            if !types.contains_key(kind) {
                return Err(format!("Bilinmeyen EIP-712 tipi: `{kind}`"));
            }
            if !value.is_object() {
                return Err(format!("`{kind}` yapı değeri nesne olmalı"));
            }
            hash_struct(kind, value, types)
        }
    }
}

fn encode_uint(kind: &str, value: &Value) -> Result<[u8; 32], String> {
    let bits = type_bits(kind, "uint")?;
    let (negative, magnitude) = number(value)?;
    if negative {
        return Err(format!("`{kind}` negatif değer alamaz"));
    }
    fit_unsigned(&magnitude, bits, kind)?;
    Ok(pad_left(&magnitude))
}

fn encode_int(kind: &str, value: &Value) -> Result<[u8; 32], String> {
    let bits = type_bits(kind, "int")?;
    let (negative, magnitude) = number(value)?;
    if !negative {
        fit_unsigned(&magnitude, bits - 1, kind)?;
        return Ok(pad_left(&magnitude));
    }
    if compare(&magnitude, &power_of_two(bits - 1)) == std::cmp::Ordering::Greater {
        return Err(format!("Değer `{kind}` aralığının altında"));
    }
    // İki'nin tümleyeni `2^bits - |x|`; ABI gereği üst baytlar 0xFF ile uzatılır.
    let width = bits / 8;
    let mut word = vec![0u8; width];
    let mut borrow = 0u16;
    for i in (0..width).rev() {
        let offset = width - 1 - i;
        let subtrahend = if offset < magnitude.len() {
            magnitude[magnitude.len() - 1 - offset]
        } else {
            0
        };
        let difference = 0i16 - subtrahend as i16 - borrow as i16;
        word[i] = (difference & 0xFF) as u8;
        borrow = if difference < 0 { 1 } else { 0 };
    }
    let mut out = [0xFFu8; 32];
    out[32 - width..].copy_from_slice(&word);
    Ok(out)
}

/// `2^n - 1` değerinin big-endian bayt karşılığı (n ≤ 255).
fn max_for_bits(bits: usize) -> Vec<u8> {
    let full_bytes = bits / 8;
    let rest_bits = bits % 8;
    let mut out = Vec::with_capacity(full_bytes + 1);
    if rest_bits > 0 {
        out.push((1u16 << rest_bits) as u8 - 1);
    }
    out.extend(std::iter::repeat(0xFF).take(full_bytes));
    out
}

/// `2^n` değerinin big-endian bayt karşılığı (negatif aralık sınırı için).
fn power_of_two(exponent: usize) -> Vec<u8> {
    let full_bytes = exponent / 8;
    let rest_bits = exponent % 8;
    let mut out = vec![if rest_bits == 0 { 1 } else { 1u8 << rest_bits }];
    out.extend(std::iter::repeat(0u8).take(full_bytes));
    out
}

fn fit_unsigned(magnitude: &[u8], bits: usize, kind: &str) -> Result<(), String> {
    if magnitude.len() * 8 > bits && compare(magnitude, &max_for_bits(bits)) == std::cmp::Ordering::Greater {
        return Err(format!("Değer `{kind}` aralığının üzerinde"));
    }
    if magnitude.len() > 32 {
        return Err(format!("Değer `{kind}` için 32 bayta sığmıyor"));
    }
    Ok(())
}

fn compare(left: &[u8], right: &[u8]) -> std::cmp::Ordering {
    let left = trim(left);
    let right = trim(right);
    left.len().cmp(&right.len()).then_with(|| left.cmp(right))
}

fn type_bits(kind: &str, prefix: &str) -> Result<usize, String> {
    let digits = kind
        .strip_prefix(prefix)
        .ok_or_else(|| format!("Beklenmeyen tip adı: {kind}"))?;
    if digits.is_empty() {
        return Ok(256);
    }
    let bits: usize = digits
        .parse()
        .map_err(|_| format!("Geçersiz `{prefix}` genişliği: {kind}"))?;
    if bits == 0 || bits > 256 || bits % 8 != 0 {
        return Err(format!("`{kind}` geçersiz (8–256, 8'in katı)"));
    }
    Ok(bits)
}

/// JSON sayısını (veya onaltılık/onluk metni) işaret + mutlak değer çiftine çevirir.
fn number(value: &Value) -> Result<(bool, Vec<u8>), String> {
    if let Some(text) = value.as_str() {
        return parse_integer_text(text);
    }
    if let Some(unsigned) = value.as_u64() {
        return Ok((false, be_bytes(unsigned.to_be_bytes())));
    }
    if let Some(signed) = value.as_i64() {
        return Ok((signed < 0, be_bytes(signed.unsigned_abs().to_be_bytes())));
    }
    Err("Tamsayı değeri okunamadı (büyük sayıları metin olarak gönderin)".into())
}

fn parse_integer_text(text: &str) -> Result<(bool, Vec<u8>), String> {
    let text = text.trim();
    let (negative, rest) = match text.strip_prefix('-') {
        Some(rest) => (true, rest),
        None => (false, text.strip_prefix('+').unwrap_or(text)),
    };
    if let Some(hex_digits) = rest.strip_prefix("0x").or_else(|| rest.strip_prefix("0X")) {
        let bytes = decode_hex(hex_digits)?;
        return Ok((negative, trim(&bytes).to_vec()));
    }
    if rest.is_empty() || !rest.bytes().all(|b| b.is_ascii_digit()) {
        return Err(format!("Tamsayı okunamadı: {text}"));
    }
    Ok((negative, decimal_to_bytes(rest)?))
}

/// Ondalık metni big-endian baytlara çevirir (2^256 sınırı kontrol edilmez).
fn decimal_to_bytes(digits: &str) -> Result<Vec<u8>, String> {
    let mut magnitude: Vec<u8> = Vec::new();
    for ch in digits.chars() {
        let mut carry = ch.to_digit(10).ok_or("Rakam bekleniyor")?;
        for byte in magnitude.iter_mut().rev() {
            let accumulated = *byte as u32 * 10 + carry;
            *byte = (accumulated & 0xFF) as u8;
            carry = accumulated >> 8;
        }
        while carry > 0 {
            magnitude.insert(0, (carry & 0xFF) as u8);
            carry >>= 8;
        }
    }
    Ok(trim(&magnitude).to_vec())
}

fn encode_type(name: &str, types: &Map<String, Value>) -> Result<String, String> {
    let mut dependencies = BTreeSet::new();
    collect_dependencies(name, name, types, &mut dependencies)?;
    let mut out = segment(name, types)?;
    for dependency in dependencies {
        out.push_str(&segment(&dependency, types)?);
    }
    Ok(out)
}

fn segment(name: &str, types: &Map<String, Value>) -> Result<String, String> {
    let fields = fields_of(name, types)?;
    let joined: Vec<String> = fields
        .iter()
        .map(|field| Ok(format!("{} {}", field_type(field)?, field_name(field)?)))
        .collect::<Result<_, String>>()?;
    Ok(format!("{}({})", name, joined.join(",")))
}

fn collect_dependencies(
    root: &str,
    current: &str,
    types: &Map<String, Value>,
    found: &mut BTreeSet<String>,
) -> Result<(), String> {
    for field in fields_of(current, types)? {
        let base = base_type(field_type(field)?);
        // Kök kendi bağımlılıklarının arasında tekrar yazılmaz; atomik tipler
        // ve zaten visit edilmiş yapılar atlanır (döngü tipi sonlandırılamaz).
        if base == root || found.contains(base) || !types.contains_key(base) {
            continue;
        }
        found.insert(base.to_string());
        collect_dependencies(root, base, types, found)?;
    }
    Ok(())
}

/// `T[3][]` → `T[3]`, `T[3]` → `T`; dizi değilse `None`.
fn array_inner(kind: &str) -> Option<&str> {
    if !kind.ends_with(']') {
        return None;
    }
    let open = kind.rfind('[')?;
    Some(&kind[..open])
}

fn base_type(kind: &str) -> &str {
    let mut current = kind;
    while let Some(inner) = array_inner(current) {
        current = inner;
    }
    current
}

fn fields_of<'a>(
    name: &str,
    types: &'a Map<String, Value>,
) -> Result<Vec<&'a Value>, String> {
    let entry = types
        .get(name)
        .ok_or_else(|| format!("`{name}` tipi tanımsız"))?;
    let fields = entry
        .as_array()
        .ok_or_else(|| format!("`{name}` alan listesi değil"))?;
    if fields.is_empty() {
        return Err(format!("`{name}` hiç alan içermiyor"));
    }
    Ok(fields.iter().collect())
}

fn field_type(field: &Value) -> Result<&str, String> {
    field
        .get("type")
        .and_then(Value::as_str)
        .ok_or_else(|| "Tip alanının `type` değeri metin olmalı".to_string())
}

fn field_name(field: &Value) -> Result<&str, String> {
    field
        .get("name")
        .and_then(Value::as_str)
        .ok_or_else(|| "Tip alanının `name` değeri metin olmalı".to_string())
}

fn text(value: &Value) -> Result<String, String> {
    match value {
        Value::String(inner) => Ok(inner.clone()),
        Value::Number(inner) => Ok(inner.to_string()),
        Value::Bool(inner) => Ok(inner.to_string()),
        _ => Err("Metin değeri okunamadı".into()),
    }
}

fn address_bytes(value: &Value) -> Result<[u8; 20], String> {
    let raw = decode_hex(text(value)?.trim().trim_start_matches("0x"))?;
    let trimmed = trim(&raw);
    if trimmed.len() > 20 {
        return Err(format!("Adres 20 bayttan uzun: {} bayt", trimmed.len()));
    }
    let mut out = [0u8; 20];
    out[20 - trimmed.len()..].copy_from_slice(trimmed);
    Ok(out)
}

fn data_bytes(value: &Value) -> Result<Vec<u8>, String> {
    let text = text(value)?;
    let text = text.trim();
    if let Some(hex_digits) = text.strip_prefix("0x").or_else(|| text.strip_prefix("0X")) {
        return decode_hex(hex_digits);
    }
    Ok(text.as_bytes().to_vec())
}

fn decode_hex(value: &str) -> Result<Vec<u8>, String> {
    if value.len() % 2 == 1 {
        return decode_hex(&format!("0{value}"));
    }
    hex::decode(value).map_err(|_| format!("Heksadecimal okunamadı: {value}"))
}

fn keccak(data: &[u8]) -> [u8; 32] {
    Keccak256::digest(data).into()
}

fn pad_left(raw: &[u8]) -> [u8; 32] {
    let raw = trim(raw);
    debug_assert!(raw.len() <= 32, "32 baytlık alan aşıldı: {} bayt", raw.len());
    // Uzun girdide korunan baytlar en az anlamlı olanlardır (big-endian kuyruk).
    let kept = &raw[raw.len().saturating_sub(32)..];
    let mut out = [0u8; 32];
    out[32 - kept.len()..].copy_from_slice(kept);
    out
}

fn trim(bytes: &[u8]) -> &[u8] {
    let first = bytes.iter().position(|b| *b != 0).unwrap_or(bytes.len());
    &bytes[first..]
}

fn be_bytes(raw: [u8; 8]) -> Vec<u8> {
    trim(&raw).to_vec()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn json(raw: &str) -> Value {
        serde_json::from_str(raw).unwrap()
    }

    /// Tip tanımlarını sözlüğe çevirir (`digest` dışında testler bu biçimi kullanır).
    fn types_of(raw: &str) -> Map<String, Value> {
        json(raw).as_object().unwrap().clone()
    }

    /// EIP-712 spekindeki `Mail` örneği — toplam ön özet.
    #[test]
    fn digest_matches_eip712_spec_example() {
        let typed = json(
            r#"{
              "types": {
                "EIP712Domain": [
                  { "name": "name", "type": "string" },
                  { "name": "version", "type": "string" },
                  { "name": "chainId", "type": "uint256" },
                  { "name": "verifyingContract", "type": "address" }
                ],
                "Person": [
                  { "name": "name", "type": "string" },
                  { "name": "wallet", "type": "address" }
                ],
                "Mail": [
                  { "name": "from", "type": "Person" },
                  { "name": "to", "type": "Person" },
                  { "name": "contents", "type": "string" }
                ]
              },
              "primaryType": "Mail",
              "domain": {
                "name": "Ether Mail",
                "version": "1",
                "chainId": 1,
                "verifyingContract": "0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC"
              },
              "message": {
                "from": { "name": "Cow", "wallet": "0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826" },
                "to": { "name": "Bob", "wallet": "0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB" },
                "contents": "Hello, Bob!"
              }
            }"#,
        );
        assert_eq!(
            hex::encode(digest(&typed).unwrap()),
            "be609aee343fb3c4b28e1df9e632fca64fcfaede20f02e86244efddf30957bd2"
        );
    }

    /// `types` içinde `EIP712Domain` olmasa bile domain, alanda bulunan
    /// anahtarlardan speksırasıyla kurulur (MetaMask'ın gönderdiği biçim).
    #[test]
    fn domain_separator_is_built_from_present_fields() {
        let typed = json(
            r#"{
              "types": {
                "Person": [
                  { "name": "name", "type": "string" },
                  { "name": "wallet", "type": "address" }
                ],
                "Mail": [
                  { "name": "from", "type": "Person" },
                  { "name": "to", "type": "Person" },
                  { "name": "contents", "type": "string" }
                ]
              },
              "primaryType": "Mail",
              "domain": {
                "name": "Ether Mail",
                "version": "1",
                "chainId": 1,
                "verifyingContract": "0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC"
              },
              "message": {
                "from": { "name": "Cow", "wallet": "0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826" },
                "to": { "name": "Bob", "wallet": "0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB" },
                "contents": "Hello, Bob!"
              }
            }"#,
        );
        assert_eq!(
            hex::encode(digest(&typed).unwrap()),
            "be609aee343fb3c4b28e1df9e632fca64fcfaede20f02e86244efddf30957bd2"
        );
    }

    #[test]
    fn encode_type_orders_dependencies_alphabetically() {
        let typed = json(
            r#"{
              "types": {
                "Person": [ { "name": "name", "type": "string" }, { "name": "wallet", "type": "address" } ],
                "Mail": [ { "name": "from", "type": "Person" }, { "name": "to", "type": "Person" }, { "name": "contents", "type": "string" } ]
              }
            }"#,
        );
        let types = typed.get("types").unwrap().as_object().unwrap();
        assert_eq!(
            encode_type("Mail", types).unwrap(),
            "Mail(Person from,Person to,string contents)Person(string name,address wallet)"
        );
    }

    #[test]
    fn numbers_accept_hex_and_decimal_strings() {
        assert_eq!(number(&json("42")).unwrap(), (false, vec![42]));
        assert_eq!(number(&json("\"42\"")).unwrap(), (false, vec![42]));
        assert_eq!(number(&json("\"0x2a\"")).unwrap(), (false, vec![42]));
        assert_eq!(number(&json("\"-5\"")).unwrap(), (true, vec![5]));
        let (negative, magnitude) = number(&json("\"115792089237316195423570985008687907853269984665640564039457584007913129639935\"")).unwrap();
        assert!(!negative);
        assert_eq!(magnitude.len(), 32);
        assert_eq!(magnitude, vec![0xFFu8; 32]);
    }

    #[test]
    fn int_encodes_twos_complement_with_sign_extension() {
        let types = types_of(r#"{ "Amount": [ { "name": "v", "type": "int256" } ] }"#);
        let minus_one = encode_field("int256", &json("\"-1\""), &types).unwrap();
        assert_eq!(minus_one, [0xFFu8; 32]);
        let minus_two = encode_field("int8", &json("\"-2\""), &types).unwrap();
        assert_eq!(&minus_two[..31], &[0xFFu8; 31][..]);
        assert_eq!(minus_two[31], 0xFE);
        assert_eq!(encode_field("int8", &json("\"-128\""), &types).unwrap()[31], 0x80);
        assert_eq!(encode_field("int8", &json("\"127\""), &types).unwrap()[31], 127);
        assert!(encode_field("int8", &json("\"128\""), &types).is_err());
        assert!(encode_field("int8", &json("\"-129\""), &types).is_err());
    }

    #[test]
    fn rejects_out_of_range_overflow_and_unknown_types() {
        let types = types_of(r#"{ "X": [ { "name": "v", "type": "uint8" } ] }"#);
        assert!(encode_field("uint8", &json("255"), &types).is_ok());
        assert!(encode_field("uint8", &json("256"), &types).is_err());
        assert!(encode_field("uint8", &json("\"0x0100\""), &types).is_err());
        assert!(encode_field("uint256", &json("\"115792089237316195423570985008687907853269984665640564039457584007913129639936\""), &types).is_err());
        assert!(encode_field("uint", &json("7"), &types).is_ok());
        assert!(encode_field("Custom", &json("{}"), &types).is_err());
        assert!(encode_field("bytes4", &json("\"0xdeadbeef\""), &types).is_ok());
        assert!(encode_field("bytes4", &json("\"0xdeadbeef00\""), &types).is_err());
    }

    #[test]
    fn arrays_and_nested_structs_hash_recursively() {
        let types = types_of(
            r#"{
              "Root": [
                { "name": "values", "type": "uint256[]" },
                { "name": "who", "type": "Person[2]" },
                { "name": "blob", "type": "bytes32" }
              ],
              "Person": [ { "name": "wallet", "type": "address" } ]
            }"#,
        );
        let message = json(r#"{ "values": ["1","2"], "who": [{ "wallet": "0x0000000000000000000000000000000000000001" }, { "wallet": "0x0000000000000000000000000000000000000002" }], "blob": "0x" }"#);
        let first = hash_struct("Root", &message, &types).unwrap();

        // Bağımsız yeniden hesaplama: spec kuralı elle kuruldu.
        let type_hash = keccak(
            b"Root(uint256[] values,Person[2] who,bytes32 blob)Person(address wallet)",
        );
        let mut buffer = type_hash.to_vec();
        let mut joined = Vec::new();
        joined.extend_from_slice(&encode_field("uint256", &json("\"1\""), &types).unwrap());
        joined.extend_from_slice(&encode_field("uint256", &json("\"2\""), &types).unwrap());
        buffer.extend_from_slice(&keccak(&joined));
        let mut people = Vec::new();
        people.extend_from_slice(&hash_struct("Person", &json(r#"{ "wallet": "0x01" }"#), &types).unwrap());
        people.extend_from_slice(&hash_struct("Person", &json(r#"{ "wallet": "0x02" }"#), &types).unwrap());
        buffer.extend_from_slice(&keccak(&people));
        buffer.extend_from_slice(&[0u8; 32]);
        assert_eq!(first, keccak(&buffer));
    }

    #[test]
    fn missing_required_fields_are_rejected_not_zeroed() {
        let types = types_of(r#"{ "Mail": [ { "name": "contents", "type": "string" } ] }"#);
        let error = hash_struct("Mail", &json("{}"), &types).unwrap_err();
        assert!(error.contains("contents"), "beklenen alan adı: {error}");
    }
}
