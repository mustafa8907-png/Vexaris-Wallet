import { t as $t } from "@/lib/i18n";
import { hexToAmount } from "@/lib/api/rpc";
import { formatAmount } from "@/lib/utils";
import { findChainByNumber } from "@/lib/chains/registry";
import { EIP155_NAMESPACE } from "./chains";

export interface WcTx {
  from: string;
  to?: string;
  dataHex?: string;
  valueHex?: string;
  gasHex?: string;
  gasPriceHex?: string;
  maxFeePerGasHex?: string;
  maxPriorityFeeHex?: string;
  nonceHex?: string;
}

export type CallShape =
  | { kind: "transfer"; to: string; units: bigint }
  | { kind: "approve"; spender: string; units: bigint }
  | { kind: "transferFrom"; from: string; to: string; units: bigint }
  | { kind: "allowanceChange"; spender: string; units: bigint; decrease: boolean }
  | { kind: "operatorApproval"; operator: string; all: boolean }
  | { kind: "nftTransfer"; from: string; to: string; tokenId: string }
  | { kind: "wrap" }
  | { kind: "unwrap"; units: bigint }
  | { kind: "call"; selector: string };

export const isUnlimited = (units: bigint): boolean => units >= 1n << 128n;

const SELECTORS: Record<string, CallShape["kind"]> = {
  "a9059cbb": "transfer",
  "095ea7b3": "approve",
  "23b872dd": "transferFrom",
  "39509391": "allowanceChange",
  "a457c2d7": "allowanceChange",
  "fbfa7761": "operatorApproval",
  "42842e0e": "nftTransfer",
  "b88d4fde": "nftTransfer",
  "d0e30db0": "wrap",
  "2e1a7d4d": "unwrap",
};

function word(data: string, index: number): string {
  return data.slice(10 + index * 64, 10 + (index + 1) * 64);
}

function wordBigint(data: string, index: number): bigint {
  const raw = word(data, index);
  return raw.length === 64 && /^[\da-f]*$/i.test(raw) ? BigInt(`0x${raw}`) : 0n;
}

function wordAddress(data: string, index: number): string {
  return `0x${word(data, index).slice(-40)}`;
}

export function decodeCalldata(dataHex?: string): CallShape | null {
  if (!dataHex || dataHex === "0x" || dataHex.length < 10) return null;
  const data = dataHex.toLowerCase();
  const selector = data.slice(2, 10);
  const kind = SELECTORS[selector];
  if (!kind) return { kind: "call", selector };

  switch (kind) {
    case "transfer":
      return { kind, to: wordAddress(data, 0), units: wordBigint(data, 1) };
    case "approve":
      return { kind, spender: wordAddress(data, 0), units: wordBigint(data, 1) };
    case "transferFrom":
      return {
        kind,
        from: wordAddress(data, 0),
        to: wordAddress(data, 1),
        units: wordBigint(data, 2),
      };
    case "allowanceChange":
      return {
        kind,
        spender: wordAddress(data, 0),
        units: wordBigint(data, 1),
        decrease: selector === "a457c2d7",
      };
    case "operatorApproval":
      return { kind, operator: wordAddress(data, 0), all: word(data, 1) !== "0".repeat(64) };
    case "nftTransfer":
      return {
        kind,
        from: wordAddress(data, 0),
        to: wordAddress(data, 1),
        tokenId: wordBigint(data, 2).toString(),
      };
    case "unwrap":
      return { kind, units: wordBigint(data, 0) };
    default:
      return { kind: "wrap" };
  }
}

export interface CallIntent {
  title: string;
  rows: { label: string; value: string }[];
  warnings: string[];
  tokenCall: boolean;
}

export function describeCall(
  call: CallShape | null,
  tx: WcTx,
  amount: (units: bigint) => string,
): CallIntent {
  const warnings: string[] = [];
  const rows: CallIntent["rows"] = [];

  if (!call) {
    if (tx.to) rows.push({ label: $t("Alıcı"), value: tx.to });
    return {
      title: BigInt(tx.valueHex ?? "0x0") > 0n ? $t("Coin gönder") : $t("Veri çağrısı"),
      rows,
      warnings,
      tokenCall: false,
    };
  }

  switch (call.kind) {
    case "transfer":
      rows.push({ label: $t("Alıcı"), value: call.to }, { label: $t("Tutar"), value: amount(call.units) });
      return { title: $t("Token gönder"), rows, warnings, tokenCall: true };
    case "approve": {
      rows.push({ label: $t("Harcama yetkisi verilen"), value: call.spender });
      rows.push({ label: $t("Tutar"), value: amount(call.units) });
      if (isUnlimited(call.units)) {
        warnings.push($t("Bu onay, sözleşmenin tokenlerinden istediği kadarını çekmesine izin verir. Bakiyeni sıfırlayabilir."));
      }
      return { title: $t("Harcama yetkisi ver"), rows, warnings, tokenCall: true };
    }
    case "allowanceChange": {
      rows.push({ label: $t("Harcama yetkisi verilen"), value: call.spender });
      rows.push({ label: call.decrease ? $t("Azaltılan") : $t("Artırılan"), value: amount(call.units) });
      if (!call.decrease && isUnlimited(call.units)) {
        warnings.push($t("Bu onay, sözleşmenin tokenlerinden istediği kadarını çekmesine izin verir. Bakiyeni sıfırlayabilir."));
      }
      return { title: $t("Harcama yetkisini değiştir"), rows, warnings, tokenCall: true };
    }
    case "transferFrom":
      rows.push(
        { label: $t("Şu hesaptan"), value: call.from },
        { label: $t("Alıcı"), value: call.to },
        { label: $t("Tutar"), value: amount(call.units) },
      );
      warnings.push($t("Bu çağrı senden yetki almış bir sözleşmeyi başkasının bakiyesinden çektiriyor."));
      return { title: $t("Başkasının hesabından gönder"), rows, warnings, tokenCall: true };
    case "operatorApproval":
      rows.push({ label: $t("Tüm koleksiyonuna erişim verilen"), value: call.operator });
      warnings.push(
        call.all
          ? $t("Onaylarsan bu işletmeci cüzdanındaki tüm NFT'leri tek imzayla taşıyabilir.")
          : $t("Daha önce verdiğin toplu erişim kaldırılıyor."),
      );
      return { title: $t("NFT toplu yetki"), rows, warnings, tokenCall: true };
    case "nftTransfer":
      rows.push(
        { label: $t("Şu hesaptan"), value: call.from },
        { label: $t("Alıcı"), value: call.to },
        { label: $t("NFT kimliği"), value: call.tokenId },
      );
      return { title: $t("NFT gönder"), rows, warnings, tokenCall: true };
    case "wrap":
      rows.push({ label: $t("Sarmalanan"), value: amount(BigInt(tx.valueHex ?? "0x0")) });
      return { title: $t("Yerel coini sar"), rows, warnings, tokenCall: false };
    case "unwrap":
      rows.push({ label: $t("Geri açılan"), value: amount(call.units) });
      return { title: $t("Sarmalanmış coini aç"), rows, warnings, tokenCall: false };
    default:
      rows.push({ label: $t("Sözleşme"), value: tx.to ?? $t("Sözleşme kurulumu") });
      rows.push({ label: $t("Seçici"), value: `0x${call.selector}` });
      warnings.push($t("Bu fonksiyonun ne yaptığı bilinmiyor. Çağrı verisini okuyamıyorsan onaylama."));
      return {
        title: $t("Çözümlenememiş sözleşme çağrısı"),
        rows,
        warnings,
        tokenCall: Boolean(tx.to),
      };
  }
}

export function decodeTransaction(params: unknown): WcTx | null {
  const first = Array.isArray(params) ? params[0] : params;
  if (!first || typeof first !== "object") return null;
  const raw = first as Record<string, unknown>;
  const text = (value: unknown): string | undefined =>
    typeof value === "string" && value ? value : undefined;
  const to = text(raw.to);
  return {
    from: text(raw.from) ?? "",
    to: to && to !== "0x" ? to : undefined,
    dataHex: text(raw.data ?? raw.input),
    valueHex: text(raw.value) ?? "0x0",
    gasHex: text(raw.gas ?? raw.gasLimit ?? raw.gas),
    gasPriceHex: text(raw.gasPrice),
    maxFeePerGasHex: text(raw.maxFeePerGas),
    maxPriorityFeeHex: text(raw.maxPriorityFeePerGas),
    nonceHex: text(raw.nonce),
  };
}

export function decodePersonalMessage(params: unknown): {
  message: string;
  shown: string;
  decodedFromHex: boolean;
  target: string;
} {
  const list = Array.isArray(params) ? params : [params];
  const strings = list.filter((item): item is string => typeof item === "string");
  const address = strings.find((item) => /^0x[0-9a-fA-F]{40}$/.test(item)) ?? "";
  const message = strings.find((item) => item !== address) ?? "";
  const bytes = hexBytes(message);
  const text = bytes === undefined ? message : utf8(bytes);
  return {
    message,
    shown: text ?? message,
    decodedFromHex: bytes !== undefined,
    target: address,
  };
}

function hexBytes(value: string): Uint8Array | undefined {
  const trimmed = value.trim();
  const body = trimmed.startsWith("0x") || trimmed.startsWith("0X") ? trimmed.slice(2) : undefined;
  if (body === undefined) return undefined;
  const even = body.length % 2 === 1 ? `0${body}` : body;
  if (!/^[\da-fA-F]*$/.test(even)) return undefined;
  const out = new Uint8Array(even.length / 2);
  for (let i = 0; i < out.length; i += 1) out[i] = Number.parseInt(even.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function utf8(bytes: Uint8Array): string | undefined {
  if (!bytes.length) return "";
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return undefined;
  }
  const control = [...text].filter((c) => {
    const code = c.codePointAt(0) ?? 0;
    return code < 32 && code !== 10 && code !== 13 && code !== 9;
  }).length;
  return control > text.length * 0.2 ? undefined : text;
}

export interface TypedField {
  label: string;
  value: string;
}

export interface TypedSummary {
  primaryType: string;
  contract?: string;
  chainId?: string;
  domainName?: string;
  fields: TypedField[];
  warnings: string[];
}

export function decodeTypedData(params: unknown): TypedSummary | null {
  const payload = parseTypedPayload(typedPayloadString(params));
  if (!payload || !payload.primaryType) return null;

  const fields: TypedField[] = [];
  flatten(payload.types ?? {}, payload.primaryType, payload.message ?? {}, "", fields, 0);

  const warnings: string[] = [];
  const lower = payload.primaryType.toLowerCase();
  if (lower.includes("permit") || lower.includes("approval") || lower.includes("authorize")) {
    warnings.push($t("Bu imza bir harcama ya da kullanım yetkisi kuruyor; tokenlerini çekilebilir kılar."));
  }
  if (fields.some((field) => /deadline/i.test(field.label) && field.value !== "")) {
    warnings.push($t("Süresi dolan bir talebe imza atıyor olabilirsin — tarih alanını kontrol et."));
  }
  if (fields.some((field) => field.label.toLowerCase().includes("value") && isUnlimitedText(field.value))) {
    warnings.push($t("Tutar sınırsız görünüyor; yetki veren sözleşme bakiyeni sıfırlayabilir."));
  }

  return {
    primaryType: payload.primaryType,
    contract: stringOf(payload.domain?.verifyingContract),
    chainId: stringOf(payload.domain?.chainId),
    domainName: stringOf(payload.domain?.name),
    fields,
    warnings,
  };
}

export function typedPayloadString(params: unknown): string {
  const candidates = Array.isArray(params) ? params : [params];
  for (const item of candidates) {
    if (typeof item === "string" && item.includes("primaryType")) return item;
  }
  const object = candidates.find(
    (item) => typeof item === "object" && item !== null && "primaryType" in (item as object),
  );
  return object ? JSON.stringify(object) : "";
}

function parseTypedPayload(text: string): {
  domain?: Record<string, unknown>;
  types?: Record<string, unknown>;
  primaryType?: string;
  message?: Record<string, unknown>;
} | null {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function isUnlimitedText(value: string): boolean {
  const digits = value.replace(/[^\d]/g, "");
  return digits.length >= 20;
}

function stringOf(value: unknown): string | undefined {
  if (typeof value === "string" && value) return value;
  if (typeof value === "number") return String(value);
  return undefined;
}

function flatten(
  types: Record<string, unknown>,
  typeName: string,
  message: Record<string, unknown>,
  prefix: string,
  out: TypedField[],
  depth: number,
): void {
  const members = types[typeName] as { name?: string; type?: string }[] | undefined;
  if (!members || depth > 2) {
    for (const [key, value] of Object.entries(message)) {
      out.push({ label: prefix ? `${prefix}.${key}` : key, value: render(value) });
    }
    return;
  }
  for (const member of members) {
    if (!member.name || !member.type) continue;
    const value = message[member.name];
    const structType = member.type.replace(/\[\d*\]$/, "");
    if (types[structType] && !Array.isArray(value)) {
      flatten(types, structType, (value as Record<string, unknown>) ?? {}, prefix ? `${prefix}.${member.name}` : member.name, out, depth + 1);
    } else {
      out.push({
        label: prefix ? `${prefix}.${member.name}` : member.name,
        value: render(value),
      });
    }
  }
}

function render(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (Array.isArray(value)) return `[${value.map(render).join(", ")}]`;
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function chainKeyOfCaip2(caip2: string): string | undefined {
  const [namespace, number] = caip2.split(":");
  if (namespace !== EIP155_NAMESPACE) return undefined;
  return findChainByNumber(Number(number))?.id;
}

export function amountText(units: bigint, decimals: number, symbol?: string): string {
  const value = hexToAmount(`0x${units.toString(16)}`, decimals);
  const text = formatAmount(value, Math.min(decimals, 6));
  return symbol ? `${text} ${symbol}` : text;
}
