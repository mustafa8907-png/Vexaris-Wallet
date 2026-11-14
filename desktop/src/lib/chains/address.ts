import { t as $t } from "@/lib/i18n";
import { getChain } from "./registry";

/**
 * Zincir bağımsız adres yardımcıları.
 *
 * Cüzdanın kendi adresi yalnızca EVM ağlarda geçerlidir; Bitcoin, Solana,
 * Tron ve benzeri ağlarda adres kullanıcı tarafından kaydedilir.
 */

const ADDRESS_PATTERNS: Record<string, RegExp> = {
  bitcoin: /^(bc1[a-z0-9]{25,87}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/,
  litecoin: /^(ltc1[a-z0-9]{25,87}|[LM][a-km-zA-HJ-NP-Z1-9]{25,34})$/,
  bitcoincash: /^(bitcoincash:[qp][a-z0-9]{41,42}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/i,
  solana: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
  tron: /^T[1-9A-HJ-NP-Za-km-z]{33}$/,
  ton: /^(UQ|EQ|kQ|0Q)[A-Za-z0-9_-]{46}$|^0:[a-f0-9]{64}$/i,
  ripple: /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/,
  dogecoin: /^D[1-9A-HJ-NP-Za-km-z]{25,34}$/,
  near: /^0x[0-9a-f]{64}$|^[a-z0-9][a-z0-9._-]{1,62}[a-z0-9]$/i,
  aptos: /^0x[0-9a-f]{1,64}$/i,
  sui: /^0x[0-9a-f]{1,128}$/i,
  cardano: /^(addr1|stake1)[a-z0-9]{45,120}$/,
  stellar: /^G[A-Z2-7]{55}$/,
};

const ADDRESS_HINTS: Record<string, string> = {
  evm: "0x… (40 hex)",
  bitcoin: "bc1… / 1… / 3…",
  litecoin: "ltc1… / L… / M…",
  bitcoincash: "bitcoincash:q… / 1… / 3…",
  solana: $t("Solana cüzdan adresi"),
  tron: "T… (34 karakter)",
  ton: "UQ… / EQ…",
  ripple: $t("r… (XRP adresi)"),
  dogecoin: $t("D… (Dogecoin adresi)"),
  near: "hesap.near / 64 hex",
  aptos: "0x… (Aptos adresi)",
  sui: "0x… (Sui adresi)",
  cardano: "addr1… / stake1…",
  stellar: "G… (56 karakter)",
};

export function addressKind(chainId: string): string {
  return getChain(chainId)?.kind ?? "evm";
}

export function addressHint(chainId: string): string {
  return ADDRESS_HINTS[addressKind(chainId)] ?? ADDRESS_HINTS.evm;
}

export function isValidAddress(chainId: string, value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  const kind = addressKind(chainId);
  if (kind === "evm") return /^0x[0-9a-fA-F]{40}$/.test(v);
  const pattern = ADDRESS_PATTERNS[kind];
  return pattern ? pattern.test(v) : v.length >= 20;
}

/** Cüzdanın EVM adresi bu zincirde doğrudan kullanılabilir mi. */
export function isEvmChain(chainId: string): boolean {
  return addressKind(chainId) === "evm";
}

/**
 * Kullanıcı adresi kaydetmemişse fiyat sorgusunun reddetmemesi için gönderilen
 * örnek adres. Yalnızca tahmin alma aşamasında kullanılır, fon taşımaz.
 */
const SAMPLE_ADDRESSES: Record<string, string> = {
  bitcoin: "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
  solana: "So11111111111111111111111111111111111111112",
  dogecoin: "DH5yaieqoZN36fDVciNyRueRGvGLR3mr7L",
};

export function sampleAddress(chainId: string): string | undefined {
  return SAMPLE_ADDRESSES[addressKind(chainId)];
}
