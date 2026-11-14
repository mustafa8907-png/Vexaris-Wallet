/**
 * Keccak-256 (Ethereum'un SHA3 öncesi varyantı) — bağımlılıksız.
 *
 * Yalnızca EIP-55 adres checksum'ı için gerekir; Trust Wallet ikon deposu
 * klasör adlarını checksum'lı saklar, küçük harfli adres 404 döner.
 */

const MASK = (1n << 64n) - 1n;
const RATE = 136; // 1088 bit

const ROUND_CONSTANTS = [
  0x0000000000000001n, 0x0000000000008082n, 0x800000000000808an, 0x8000000080008000n,
  0x000000000000808bn, 0x0000000080000001n, 0x8000000080008081n, 0x8000000000008009n,
  0x000000000000008an, 0x0000000000000088n, 0x0000000080008009n, 0x000000008000000an,
  0x000000008000808bn, 0x800000000000008bn, 0x8000000000008089n, 0x8000000000008003n,
  0x8000000000008002n, 0x8000000000000080n, 0x000000000000800an, 0x800000008000000an,
  0x8000000080008081n, 0x8000000000008080n, 0x0000000080000001n, 0x8000000080008008n,
];

// r[x][y] — rho adımının dönüş miktarları.
const ROTATIONS = [
  [0, 36, 3, 41, 18],
  [1, 44, 10, 45, 2],
  [62, 6, 43, 15, 61],
  [28, 55, 25, 21, 56],
  [27, 20, 39, 8, 14],
];

function rotl(value: bigint, shift: number): bigint {
  if (shift === 0) return value;
  const n = BigInt(shift);
  return ((value << n) | (value >> (64n - n))) & MASK;
}

function keccakF1600(a: bigint[]): void {
  for (let round = 0; round < 24; round++) {
    const c = new Array<bigint>(5);
    for (let x = 0; x < 5; x++) {
      c[x] = a[x] ^ a[x + 5] ^ a[x + 10] ^ a[x + 15] ^ a[x + 20];
    }
    for (let x = 0; x < 5; x++) {
      const d = c[(x + 4) % 5] ^ rotl(c[(x + 1) % 5], 1);
      for (let y = 0; y < 5; y++) a[x + 5 * y] ^= d;
    }

    const b = new Array<bigint>(25).fill(0n);
    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 5; y++) {
        b[y + 5 * ((2 * x + 3 * y) % 5)] = rotl(a[x + 5 * y], ROTATIONS[x][y]);
      }
    }

    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 5; y++) {
        a[x + 5 * y] = b[x + 5 * y] ^ (~b[(x + 1) % 5 + 5 * y] & MASK & b[(x + 2) % 5 + 5 * y]);
      }
    }

    a[0] ^= ROUND_CONSTANTS[round];
  }
}

export function keccak256(input: Uint8Array | string): Uint8Array {
  const bytes =
    typeof input === "string" ? new TextEncoder().encode(input) : input;

  // pad10*1, Keccak alan ayracı 0x01 (SHA3'ün 0x06'sı değil).
  const padded = new Uint8Array(Math.ceil((bytes.length + 1) / RATE) * RATE);
  padded.set(bytes);
  padded[bytes.length] = 0x01;
  padded[padded.length - 1] |= 0x80;

  const state = new Array<bigint>(25).fill(0n);
  for (let offset = 0; offset < padded.length; offset += RATE) {
    for (let lane = 0; lane < RATE / 8; lane++) {
      let value = 0n;
      for (let i = 7; i >= 0; i--) {
        value = (value << 8n) | BigInt(padded[offset + lane * 8 + i]);
      }
      state[lane] ^= value;
    }
    keccakF1600(state);
  }

  const out = new Uint8Array(32);
  for (let lane = 0; lane < 4; lane++) {
    let value = state[lane];
    for (let i = 0; i < 8; i++) {
      out[lane * 8 + i] = Number(value & 0xffn);
      value >>= 8n;
    }
  }
  return out;
}

export function toHex(bytes: Uint8Array): string {
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return hex;
}

const checksumCache = new Map<string, string>();

/** EIP-55 karışık büyük/küçük harfli adres. Geçersiz girdi olduğu gibi döner. */
export function toChecksumAddress(address: string): string {
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) return address;
  const lower = address.toLowerCase();
  const cached = checksumCache.get(lower);
  if (cached) return cached;

  const body = lower.slice(2);
  const hash = toHex(keccak256(body));
  let out = "0x";
  for (let i = 0; i < body.length; i++) {
    out += parseInt(hash[i], 16) >= 8 ? body[i].toUpperCase() : body[i];
  }

  checksumCache.set(lower, out);
  return out;
}