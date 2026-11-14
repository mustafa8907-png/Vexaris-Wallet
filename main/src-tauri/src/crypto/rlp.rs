
pub fn trimmed(bytes: &[u8]) -> &[u8] {
    let first = bytes.iter().position(|b| *b != 0).unwrap_or(bytes.len());
    &bytes[first..]
}

fn header(out: &mut Vec<u8>, offset: u8, len: usize) {
    if len <= 55 {
        out.push(offset + len as u8);
    } else {
        let encoded = len.to_be_bytes();
        let len_bytes = trimmed(&encoded);
        out.push(offset + 55 + len_bytes.len() as u8);
        out.extend_from_slice(len_bytes);
    }
}

pub fn encode_bytes(data: &[u8]) -> Vec<u8> {
    let mut out = Vec::with_capacity(data.len() + 9);
    if data.len() == 1 && data[0] < 0x80 {
        out.push(data[0]);
    } else {
        header(&mut out, 0x80, data.len());
        out.extend_from_slice(data);
    }
    out
}

pub fn wrap_list(payload: &[u8]) -> Vec<u8> {
    let mut out = Vec::with_capacity(payload.len() + 9);
    header(&mut out, 0xC0, payload.len());
    out.extend_from_slice(payload);
    out
}

pub fn uint(value: u64) -> Vec<u8> {
    trimmed(&value.to_be_bytes()).to_vec()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn list_of(items: &[&[u8]]) -> Vec<u8> {
        let mut payload = Vec::new();
        for item in items {
            payload.extend_from_slice(&encode_bytes(item));
        }
        wrap_list(&payload)
    }

    #[test]
    fn encodes_spec_vectors() {
        assert_eq!(encode_bytes(b""), vec![0x80]);
        assert_eq!(encode_bytes(b"dog"), vec![0x83, b'd', b'o', b'g']);
        assert_eq!(encode_bytes(&[0x0f]), vec![0x0f]);
        assert_eq!(encode_bytes(&[0x80]), vec![0x81, 0x80]);
        assert_eq!(
            list_of(&[b"cat", b"dog"]),
            vec![0xC8, 0x83, b'c', b'a', b't', 0x83, b'd', b'o', b'g']
        );
        assert_eq!(list_of(&[]), vec![0xC0]);
    }

    #[test]
    fn long_payloads_use_len_of_len_prefix() {
        let data = vec![7u8; 1024];
        let encoded = encode_bytes(&data);
        assert_eq!(encoded[0], 0xB9);
        assert_eq!(encoded[1..3], [0x04, 0x00]);
        assert_eq!(encoded.len(), 1027);

        let list = list_of(&[&data, &data]);
        assert_eq!(list[0], 0xF9);
        assert_eq!(list[1..3], [0x08, 0x06]);
        assert_eq!(list.len(), 3 + 2 * 1027);
    }

    #[test]
    fn integers_are_minimal() {
        assert_eq!(uint(0), Vec::<u8>::new());
        assert_eq!(uint(1), vec![1]);
        assert_eq!(uint(0x7f), vec![0x7f]);
        assert_eq!(uint(0x80), vec![0x80]);
        assert_eq!(uint(1024), vec![0x04, 0x00]);
    }
}
