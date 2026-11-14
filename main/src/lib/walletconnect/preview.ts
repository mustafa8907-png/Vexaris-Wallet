/**
 * Onay ekranının gösterdiği önizleme.
 *
 * Ekran ile imza aynı çözümleme kodunu paylaşır: kullanıcının gördüğü niyet,
 * imzalanan baytların yorumudur. Burada hiçbir şey imzalanmaz veya yayınlanmaz;
 * yalnızca okunur ve maliyet tahmin edilir.
 */
import { t as $t } from "@/lib/i18n";
import { tokenRisk } from "@/lib/api/security";
import { findChainByNumber } from "@/lib/chains/registry";
import { chainLabel } from "./chains";
import { methodLabel } from "./labels";
import {
  amountText,
  chainKeyOfCaip2,
  decodeCalldata,
  decodePersonalMessage,
  decodeTransaction,
  decodeTypedData,
  describeCall,
} from "./requests";
import { nativeAmount, prepareTransaction, tokenMeta } from "./execute";
import { parseAddChain } from "@/lib/browser/execute";
import type { WcRequest } from "@/stores/walletConnectStore";

export interface PreviewRow {
  label: string;
  value: string;
}

export interface RequestPreview {
  /** Kullanıcının ne yapmaya çağrıldığını tek cümlede anlatan başlık. */
  headline: string;
  /** Niye dikkat etmesi gerektiği — imzanın kapsamı. */
  intent: string;
  rows: PreviewRow[];
  /** İmzalanabilir ama bilinmesi gereken tehlikeler. */
  warnings: string[];
  /** Biri bile varsa onay düğmesi kapalıdır. */
  blockers: string[];
  /** Ham veri: mesaj metni ya da çözümlenememiş çağrı verisi. */
  raw?: string;
}

/** `0x…` alanını güvenle bireye çevirir; bozuk girdi sıfır sayılır. */
function units(hex?: string): bigint {
  if (!hex || hex === "0x" || !/^0x[0-9a-fA-F]+$/.test(hex)) return 0n;
  try {
    return BigInt(hex);
  } catch {
    return 0n;
  }
}

/**
 * `describeCall` kendi satırlarını üretiyor ve ekran da hesap/sözleşme satırını
 * yazıyor; aynı etiket+değer iki kez görünmesin (aynı anda React anahtarı da).
 */
function uniqueRows(rows: PreviewRow[]): PreviewRow[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = `${row.label}=${row.value.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function previewRequest(request: WcRequest): Promise<RequestPreview> {
  switch (request.method) {
    case "eth_sendTransaction":
      return previewTransaction(request);
    case "personal_sign":
      return previewMessage(request);
    case "eth_signTypedData_v4":
      return previewTyped(request);
    case "eth_accounts":
      return {
        headline: $t("Adresi paylaş"),
        intent: $t("Uygulama yalnızca oturumdaki EVM adresini görecek; hiçbir şey imzalanmaz."),
        rows: [{ label: $t("Paylaşılacak adres"), value: request.address }],
        warnings: [],
        blockers: [],
      };
    case "wallet_switchEthereumChain":
      return {
        headline: $t("Ağ değiştirme talebi"),
        intent: request.source
          ? $t("Yalnızca bu sekmenin ağı değişir; cüzdanın etkin ağı olduğu gibi kalır.")
          : $t("Cüzdan bu oturumda paylaştığı ağlarda kalır; bu talep işlem gerektirmez."),
        rows: [{ label: $t("İstenen ağ"), value: switchTarget(request.params) }],
        warnings: [],
        blockers: [],
      };
    case "wallet_addEthereumChain":
      return previewAddChain(request);
    default:
      return {
        headline: methodLabel(request.method),
        intent: $t("Bu yöntemin ne yaptığı çözümlenemiyor — tanımadığın bir isteği onaylama."),
        rows: [{ label: $t("Yöntem"), value: request.method }],
        warnings: [],
        blockers: [$t("Desteklenmeyen imzalama yöntemi.")],
      };
  }
}

/** Sitenin bildirdiği RPC ile yeni ağ ekleme: en tehlikeli ağ talebi. */
function previewAddChain(request: WcRequest): RequestPreview {
  const added = parseAddChain(request.params);
  if (!added) {
    return {
      headline: $t("Yeni ağ ekle"),
      intent: $t("Ağ bilgileri okunamadı — neye bağlandığın belli değil."),
      rows: [],
      warnings: [],
      blockers: [$t("Ağ parametreleri çözümlenemedi.")],
    };
  }

  const known = findChainByNumber(added.chainId);
  const rows: PreviewRow[] = [
    { label: $t("Ağ adı"), value: added.name },
    { label: $t("Zincir numarası"), value: String(added.chainId) },
    { label: $t("RPC adresi"), value: added.rpcUrl },
    { label: $t("Yerel coin"), value: `${added.symbol} (${added.decimals} basamak)` },
  ];
  if (added.explorerUrl) rows.push({ label: $t("Gezgin"), value: added.explorerUrl });

  const warnings = [
    $t("RPC adresini site seçiyor: bakiye ve işlem yanıtları bu sunucudan gelir, yanıltıcı olabilir."),
  ];
  const blockers: string[] = [];
  if (!/^https:\/\//i.test(added.rpcUrl) && !/^http:\/\/(localhost|127\.0\.0\.1)/i.test(added.rpcUrl)) {
    blockers.push($t("Şifrelenmemiş RPC adresi kabul edilmiyor."));
  }
  if (known && !known.custom) {
    warnings.push($t("Bu zincir zaten cüzdanda var; sitenin RPC'si yerine yerleşik adres kullanılır."));
  }

  return {
    headline: $t("{0} ağını ekle", [added.name]),
    intent: $t("Ağ cüzdanına kaydedilir ve bu sekme ona geçer. İmza atılmaz, coin taşınmaz."),
    rows,
    warnings,
    blockers,
  };
}

function switchTarget(params: unknown): string {
  const list = Array.isArray(params) ? params : [params];
  const first = list.find((item): item is { chainId?: unknown } => typeof item === "object" && item !== null);
  const raw = typeof first?.chainId === "string" ? first.chainId.trim() : "";
  if (!raw) return $t("Ağ belirtilmedi");
  const hex = raw.startsWith("0x");
  const number = Number.parseInt(hex ? raw.slice(2) : raw, hex ? 16 : 10);
  const chain = Number.isFinite(number) ? findChainByNumber(number) : undefined;
  return chain?.name ?? $t("Bilinmeyen ağ ({0})", [raw]);
}

async function previewTransaction(request: WcRequest): Promise<RequestPreview> {
  const prepared = await prepareTransaction(request);
  const tx = decodeTransaction(request.params);
  const call = decodeCalldata(prepared.dataHex);
  const nativeValue = units(prepared.valueHex);

  const meta = await tokenMeta(prepared.chain, prepared.to);
  const intent = describeCall(call, tx ?? { from: prepared.from, to: prepared.to }, (value) =>
    amountText(value, meta.decimals, meta.symbol || undefined),
  );

  const rows: PreviewRow[] = [
    { label: $t("Ağ"), value: chainLabel(request.chainId) },
    { label: $t("Hesabın"), value: prepared.from },
    { label: intent.tokenCall ? $t("Sözleşme") : $t("Alıcı"), value: prepared.to },
  ];
  if (meta.symbol) rows.push({ label: $t("Token"), value: meta.symbol });
  rows.push(...intent.rows);
  rows.push(
    { label: $t("Ağ ücreti (en fazla)"), value: nativeAmount(prepared.chain, prepared.cost.maxFeeUnits) },
    { label: $t("Gaz limiti"), value: prepared.cost.gasLimitUnits.toString() },
  );

  const warnings = [...intent.warnings];
  if (prepared.cost.feeOverridden) {
    warnings.push($t("Uygulama kendi gaz fiyatını gönderdi; cüzdan onun yerine kendi tahminini imzalıyor."));
  }
  if (!meta.symbol) {
    warnings.push($t("Bu sözleşmenin token sembolü okunamadı — tanımadığın bir sözleşmeye onay veriyorsun."));
  }

  // Risk perlonu ekran tarafı: yürütmede de tekrarlanır, burada ama neden
  // engellendiğini kullanıcı onaylamadan önce görmeli.
  const targets: string[] = [prepared.to];
  if (call && "spender" in call) targets.push(call.spender);
  if (call && "operator" in call) targets.push(call.operator);
  const blockers: string[] = [];
  for (const target of targets) {
    const risk = await tokenRisk(prepared.chain.id, target);
    if (risk.blocked) blockers.push(...risk.reasons);
    else if (target !== prepared.to) warnings.push(...risk.reasons);
  }

  const total = nativeValue + prepared.cost.maxFeeUnits;
  return {
    headline: intent.title,
    intent:
      total > 0n
        ? $t("Bu işlem hesabından en fazla {0} götürebilir.", [nativeAmount(prepared.chain, total)])
        : $t("Bu işlem yerel coinini hareket ettirmiyor; yalnızca ağ ücreti ödersin."),
    rows: uniqueRows(rows),
    warnings,
    blockers,
    raw: call?.kind === "call" ? prepared.dataHex : undefined,
  };
}

function previewMessage(request: WcRequest): RequestPreview {
  const { message, shown, decodedFromHex, target } = decodePersonalMessage(request.params);
  const rows: PreviewRow[] = [{ label: $t("İmzalayan hesap"), value: request.address }];
  if (target) rows.push({ label: $t("Hedef uygulama"), value: target });

  const warnings: string[] = [];
  if (decodedFromHex) warnings.push($t("Mesaj bayt olarak gönderildi; ekrandaki metin çözümlemedir."));
  if (!shown.trim()) warnings.push($t("Mesaj boş görünüyor — neye imza attığın belli değil."));

  return {
    headline: $t("Mesaj imzala"),
    intent: $t("Mesaj imzası coinlerini taşımaz ama bir uygulamada seni giriş yapmış gösterebilir."),
    rows,
    warnings,
    blockers: [],
    raw: shown || message,
  };
}

async function previewTyped(request: WcRequest): Promise<RequestPreview> {
  const summary = decodeTypedData(request.params);
  if (!summary) {
    return {
      headline: $t("Tipli veri imzala"),
      intent: $t("Veri çözümlenemedi — içeriğini okuyamadığın bir imzayı onaylama."),
      rows: [{ label: $t("İmzalayan hesap"), value: request.address }],
      warnings: [],
      blockers: [$t("Tip verisi okunamadı.")],
    };
  }

  const rows: PreviewRow[] = [
    { label: $t("İmzalayan hesap"), value: request.address },
    { label: $t("Veri türü"), value: summary.primaryType },
  ];
  if (summary.domainName) rows.push({ label: $t("Sitenin beyan ettiği ad"), value: summary.domainName });
  if (summary.chainId) rows.push({ label: $t("Verinin ağı"), value: summary.chainId });
  if (summary.contract) rows.push({ label: $t("Sözleşme"), value: summary.contract });
  rows.push(...summary.fields.map((field) => ({ label: field.label, value: field.value })));

  const blockers: string[] = [];
  const warnings = [...summary.warnings];
  if (summary.contract) {
    const risk = await tokenRisk(chainKeyOfCaip2(request.chainId) ?? request.chainId, summary.contract);
    if (risk.blocked) blockers.push(...risk.reasons);
    else warnings.push(...risk.reasons);
  }

  return {
    headline: $t("{0} imzala", [summary.primaryType]),
    intent: $t("Bu imza sözleşmede bir hak kurabilir — alanları tek tek kontrol et."),
    rows: uniqueRows(rows),
    warnings,
    blockers,
  };
}
