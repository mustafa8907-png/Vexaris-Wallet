import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Alert,
  Button,
  Card,
  ChevronDown,
  Download,
  Filter,
  Input,
  Refresh,
  Search,
  Segmented,
  Select,
  Shield,
  Skeleton,
  X,
  cn,
} from "@/kit";
import { ArrowDownLeft, ExternalLink } from "@/kit/ext";
import { ChainIcon, TokenIcon } from "@/components/TokenIcon";
import { TxDetailDrawer, TxKindBadge } from "@/components/TxDetailDrawer";
import { OrderDrawer } from "@/components/swap/OrderDrawer";
import { OrderList } from "@/components/swap/OrderList";
import { isActive } from "@/components/swap/stages";
import { useHistory } from "@/hooks/useHistory";
import { KIND_LABELS, STATUS_LABELS } from "@/stores/historyStore";
import { getChain } from "@/lib/chains/registry";
import { isSpamToken } from "@/lib/assets/filters";
import { historyChains, type TxKind, type TxRecord } from "@/lib/api/history";
import { useChainStore } from "@/stores/chainStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useSwapStore } from "@/stores/swapStore";
import { formatAmount, formatUsd, shortAddress } from "@/lib/utils";
import { toast } from "@/stores/toastStore";
import { t as $t } from "@/lib/i18n";

type SortKey = "new" | "old" | "value" | "amount";
type Tab = "tx" | "swaps";

const SORT_LABELS: Record<SortKey, string> = {
  new: $t("En yeni"),
  old: $t("En eski"),
  value: $t("USD değeri"),
  amount: $t("Miktar"),
};

const KIND_OPTIONS: { value: TxKind | "all"; label: string }[] = [
  { value: "all", label: $t("Tüm türler") },
  { value: "receive", label: $t("Alınan") },
  { value: "send", label: $t("Gönderilen") },
  { value: "swap", label: $t("Takas") },
  { value: "approve", label: $t("Onay") },
  { value: "contract", label: $t("Sözleşme") },
  { value: "self", label: $t("Kendine") },
];

const FILTER_SELECT_CLASS = "h-9 text-[12px] font-medium pr-9";

function dayKey(ts: number): string {
  const date = new Date(ts);
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86_400_000);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(date, today)) return $t("Bugün");
  if (same(date, yesterday)) return $t("Dün");
  return date.toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" });
}

function csvCell(value: string | number | undefined): string {
  const text = value == null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function exportCsv(records: TxRecord[]) {
  const header = [
    $t("Tarih"),
    $t("Ağ"),
    $t("Tür"),
    $t("Yön"),
    $t("Durum"),
    $t("Sembol"),
    $t("Miktar"),
    "USD",
    $t("Gönderen"),
    $t("Alıcı"),
    $t("Ücret"),
    "Hash",
    $t("Gezgin"),
  ];
  const rows = records.map((r) =>
    [
      new Date(r.timestamp).toISOString(),
      getChain(r.chainId)?.name ?? r.chainId,
      KIND_LABELS[r.kind],
      r.direction,
      STATUS_LABELS[r.status],
      r.symbol,
      r.amount,
      r.usdValue.toFixed(2),
      r.from,
      r.to,
      r.feeNative ?? "",
      r.hash,
      r.explorerUrl,
    ]
      .map(csvCell)
      .join(","),
  );
  const bom = String.fromCharCode(0xfeff);
  const csv = bom + header.map(csvCell).join(",") + "\n" + rows.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `vexaris-islemler-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function ActivityPage() {
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get("tab") === "swaps" ? "swaps" : "tx";
  const swapOrders = useSwapStore((s) => s.orders);
  const activeOrderId = useSwapStore((s) => s.activeOrderId);
  const setActiveOrder = useSwapStore((s) => s.setActiveOrder);
  const trackOrder = useSwapStore((s) => s.trackOrder);
  const history = useHistory();
  const enabledChainIds = useChainStore((s) => s.enabledChainIds);
  const hideBalance = useSettingsStore((s) => s.hideBalance);
  const chains = historyChains(enabledChainIds);

  useEffect(() => {
    for (const o of useSwapStore.getState().orders) {
      if (isActive(o.stage)) trackOrder(o.id);
    }
  }, [trackOrder]);

  const [query, setQuery] = useState("");
  const [chainFilter, setChainFilter] = useState<string>("all");
  const [kindFilter, setKindFilter] = useState<TxKind | "all">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | TxRecord["status"]>("all");
  const [sort, setSort] = useState<SortKey>("new");
  const [showSuspicious, setShowSuspicious] = useState(false);
  const [openTx, setOpenTx] = useState<TxRecord | null>(null);

  const suspicious = useMemo(
    () => new Set(history.records.filter((r) => isSpamToken(r.symbol)).map((r) => r.id)),
    [history.records],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = history.records.filter((r) => {
      if (!showSuspicious && !q && suspicious.has(r.id)) return false;
      if (chainFilter !== "all" && r.chainId !== chainFilter) return false;
      if (kindFilter !== "all" && r.kind !== kindFilter) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!q) return true;
      return (
        r.hash.toLowerCase().includes(q) ||
        r.symbol.toLowerCase().includes(q) ||
        r.from.toLowerCase().includes(q) ||
        r.to.toLowerCase().includes(q) ||
        (r.counterpartyLabel ?? "").toLowerCase().includes(q) ||
        (r.methodLabel ?? "").toLowerCase().includes(q) ||
        (r.tokenAddress ?? "").toLowerCase().includes(q)
      );
    });
    const sorted = [...list];
    if (sort === "new") sorted.sort((a, b) => b.timestamp - a.timestamp);
    if (sort === "old") sorted.sort((a, b) => a.timestamp - b.timestamp);
    if (sort === "value") sorted.sort((a, b) => b.usdValue - a.usdValue);
    if (sort === "amount") sorted.sort((a, b) => b.amount - a.amount);
    return sorted;
  }, [history.records, suspicious, showSuspicious, query, chainFilter, kindFilter, statusFilter, sort]);

  const groups = useMemo(() => {
    if (sort === "value" || sort === "amount") {
      return [{ label: $t("{0} işlem · {1}", [filtered.length, SORT_LABELS[sort]]), items: filtered }];
    }
    const map = new Map<string, TxRecord[]>();
    for (const r of filtered) {
      const key = dayKey(r.timestamp);
      (map.get(key) ?? map.set(key, []).get(key)!).push(r);
    }
    return [...map.entries()].map(([label, items]) => ({ label, items }));
  }, [filtered, sort]);

  const totals = useMemo(() => {
    let incoming = 0;
    let outgoing = 0;
    let fees = 0;
    for (const r of filtered) {
      if (r.direction === "in") incoming += r.usdValue;
      if (r.direction === "out") outgoing += r.usdValue;
      fees += r.feeUsd ?? 0;
    }
    return { incoming, outgoing, fees };
  }, [filtered]);

  const activeOrder = swapOrders.find((o) => o.id === activeOrderId) ?? null;

  const activeFilters =
    (chainFilter !== "all" ? 1 : 0) +
    (kindFilter !== "all" ? 1 : 0) +
    (statusFilter !== "all" ? 1 : 0) +
    (query ? 1 : 0);

  function clearFilters() {
    setQuery("");
    setChainFilter("all");
    setKindFilter("all");
    setStatusFilter("all");
  }

  const liveSwaps = swapOrders.filter((o) => isActive(o.stage)).length;

  const stats: { label: string; value: string; tone: string }[] = [
    {
      label: $t("Kayıt"),
      value: hideBalance
        ? "••••"
        : `${filtered.length}${filtered.length !== history.records.length ? ` / ${history.records.length}` : ""}`,
      tone: "text-text",
    },
    { label: $t("Gelen"), value: hideBalance ? "••••" : formatUsd(totals.incoming), tone: "text-up" },
    { label: $t("Giden"), value: hideBalance ? "••••" : formatUsd(totals.outgoing), tone: "text-down" },
    { label: $t("Ağ ücretleri"), value: hideBalance ? "••••" : formatUsd(totals.fees), tone: "text-warn" },
  ];

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl space-y-4 px-3 pb-8 pt-4 sm:px-5 lg:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-lg font-semibold tracking-tight text-text">{$t("İşlem geçmişi")}</h1>
            <p className="mt-0.5 text-[11px] text-muted">
              {tab === "swaps"
                ? $t("Takas emirlerinin aşamaları ve sonuçları")
                : $t("Zincir üzerindeki gerçek transferler")}
            </p>
          </div>
          {tab === "tx" && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                iconLeft={<Download size={13} />}
                onClick={() => {
                  if (filtered.length === 0) {
                    toast($t("Dışa aktarılacak işlem yok"), "info");
                    return;
                  }
                  exportCsv(filtered);
                  toast($t("{0} işlem CSV olarak indirildi", [filtered.length]), "success");
                }}
              >
                CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={history.loading}
                iconLeft={<Refresh size={13} className={cn(history.loading && "anim-spin")} />}
                onClick={() => void history.refreshNow()}
              >
                {history.loading ? $t("Yenileniyor…") : $t("Yenile")}
              </Button>
            </div>
          )}
        </div>

        <Segmented
          ariaLabel={$t("Geçmiş görünümü")}
          value={tab}
          onChange={(next) => setParams(next === "tx" ? {} : { tab: next }, { replace: true })}
          options={[
            { value: "tx", label: $t("İşlemler") },
            {
              value: "swaps",
              label: (
                <span className="flex items-center gap-1.5">
                  {$t("Takaslar")}
                  {swapOrders.length > 0 && (
                    <span className="tabular rounded-xs bg-brand px-1.5 py-0.5 text-[9.5px] font-bold text-white">
                      {swapOrders.length}
                    </span>
                  )}
                </span>
              ),
            },
          ]}
        />

        {tab === "swaps" ? (
          <div>
            <OrderList onOpen={setActiveOrder} />
            {liveSwaps > 0 && (
              <p className="mt-2 text-center text-[11px] text-muted">
                {liveSwaps} {$t("takasın sonucu arka planda izleniyor.")}
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {stats.map((s) => (
                <Card key={s.label} className="p-3.5">
                  <div className="text-[10px] uppercase tracking-[0.12em] text-muted">{s.label}</div>
                  <div className={cn("tabular mt-1 text-[16px] font-semibold", s.tone)}>{s.value}</div>
                </Card>
              ))}
            </div>

            <Card className="overflow-visible">
              <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
                <Input
                  size="sm"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={$t("Hash, adres, token veya yöntem ara")}
                  iconLeft={<Search size={13} />}
                  className="min-w-[180px] flex-1"
                  aria-label={$t("Hash, adres, token veya yöntem ara")}
                />

                <Select
                  aria-label={$t("Ağ filtresi")}
                  value={chainFilter}
                  onChange={(e) => setChainFilter(e.target.value)}
                  className={FILTER_SELECT_CLASS}
                  options={[
                    { value: "all", label: $t("Tüm ağlar") },
                    ...chains.map((c) => ({ value: c.id, label: c.name })),
                  ]}
                />
                <Select
                  aria-label={$t("Tür filtresi")}
                  value={kindFilter}
                  onChange={(e) => setKindFilter(e.target.value as TxKind | "all")}
                  className={FILTER_SELECT_CLASS}
                  options={KIND_OPTIONS}
                />
                <Select
                  aria-label={$t("Durum filtresi")}
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as "all" | TxRecord["status"])}
                  className={FILTER_SELECT_CLASS}
                  options={[
                    { value: "all", label: $t("Tüm durumlar") },
                    { value: "confirmed", label: $t("Onaylandı") },
                    { value: "pending", label: $t("Beklemede") },
                    { value: "failed", label: $t("Başarısız") },
                  ]}
                />
                <Select
                  aria-label={$t("Sıralama")}
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortKey)}
                  className={FILTER_SELECT_CLASS}
                  options={(Object.keys(SORT_LABELS) as SortKey[]).map((k) => ({
                    value: k,
                    label: SORT_LABELS[k],
                  }))}
                />
                {suspicious.size > 0 && (
                  <button
                    onClick={() => setShowSuspicious((v) => !v)}
                    className={cn(
                      "focus-ring flex h-9 items-center gap-1.5 rounded-ctrl border px-2.5 text-[11px] transition-colors",
                      showSuspicious
                        ? "border-danger/40 bg-dangersoft text-danger"
                        : "border-line bg-surface2 text-muted hover:border-linestrong hover:text-text",
                    )}
                    title={$t("Benzer glifli sembol veya reklam içeren kimlik avı airdropları")}
                  >
                    <Shield size={12} />
                    {$t("Şüpheli")} {suspicious.size}
                  </button>
                )}
                {activeFilters > 0 && (
                  <button
                    onClick={clearFilters}
                    className="focus-ring flex h-9 items-center gap-1.5 rounded-ctrl border border-brand/40 bg-brandsoft px-2.5 text-[11px] text-brand transition-colors hover:border-brand/70"
                  >
                    <Filter size={11} /> {activeFilters} {$t("filtre · temizle")}
                  </button>
                )}
              </div>

              {(history.error || history.failed.length > 0 || history.unsupported.length > 0) && (
                <Alert
                  tone="warning"
                  className="m-3"
                  title={$t("Geçmişte eksik var")}
                >
                  {history.error ??
                    [
                      history.failed.length > 0
                        ? $t("Yanıt vermeyen ağ: {0}.", [
                            history.failed.map((c) => getChain(c)?.shortName ?? c).join(", "),
                          ])
                        : "",
                      history.unsupported.length > 0
                        ? $t("Geçmişi okunamayan ağ: {0} — bakiye ve fiyatlar bu ağlarda çalışmaya devam eder.", [
                            history.unsupported.map((c) => getChain(c)?.shortName ?? c).join(", "),
                          ])
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                </Alert>
              )}

              {history.loading && history.records.length === 0 ? (
                <div className="space-y-1.5 p-3">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-[58px] w-full rounded-card" />
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
                  <span className="grid size-11 place-items-center rounded-full bg-surface2 text-muted">
                    <ArrowDownLeft size={18} />
                  </span>
                  <span className="text-sm text-textsoft">
                    {activeFilters > 0 ? $t("Filtreyle eşleşen işlem yok") : $t("Henüz işlem kaydı yok")}
                  </span>
                  <span className="max-w-[380px] text-[11px] leading-relaxed text-muted">
                    {activeFilters > 0
                      ? $t("Filtreleri temizleyip tekrar dene ya da daha fazla sayfa yükle.")
                      : $t("Bu adrese gelen ve giden transferler zincirden okunur; ilk işlemden sonra burada listelenir.")}
                  </span>
                  {activeFilters > 0 && (
                    <Button variant="outline" size="sm" className="mt-1" iconLeft={<X size={12} />} onClick={clearFilters}>
                      {$t("Filtreleri temizle")}
                    </Button>
                  )}
                </div>
              ) : (
                <div>
                  {groups.map((group) => (
                    <div key={group.label}>
                      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface/95 px-4 py-2 backdrop-blur">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
                          {group.label}
                        </span>
                        <span className="text-[10px] text-muted">{group.items.length} {$t("işlem")}</span>
                      </div>
                      <ul className="space-y-0.5 p-1.5">
                        {group.items.map((tx) => {
                          const chain = getChain(tx.chainId);
                          const risky = suspicious.has(tx.id);
                          return (
                            <li key={tx.id}>
                              <div
                                className={cn(
                                  "group flex w-full items-center gap-3 rounded-card border border-transparent px-2.5 py-2.5 transition-all hover:border-line hover:bg-surface2",
                                  risky && "opacity-60 hover:opacity-100",
                                )}
                              >
                                <button
                                  onClick={() => setOpenTx(tx)}
                                  className="focus-ring flex min-w-0 flex-1 items-center gap-3 rounded-card text-left"
                                >
                                  <TxKindBadge tx={tx} size={34} />
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5">
                                      <span className="truncate text-[13px] font-semibold text-text">
                                        {KIND_LABELS[tx.kind]}
                                      </span>
                                      {risky && (
                                        <span className="flex shrink-0 items-center gap-1 rounded-xs border border-danger/30 bg-dangersoft px-1.5 py-0.5 text-[9.5px] font-medium text-danger">
                                          <Shield size={9} /> {$t("Şüpheli")}
                                        </span>
                                      )}
                                      {tx.methodLabel && tx.kind !== "approve" && (
                                        <span className="shrink-0 rounded-xs border border-line bg-surface2 px-1.5 py-0.5 text-[9.5px] font-medium text-muted">
                                          {tx.methodLabel}
                                        </span>
                                      )}
                                      {tx.status !== "confirmed" && (
                                        <span
                                          className={cn(
                                            "shrink-0 rounded-xs border border-line bg-surface2 px-1.5 py-0.5 text-[9.5px] font-medium",
                                            tx.status === "failed" ? "text-down" : "text-warn",
                                          )}
                                        >
                                          {STATUS_LABELS[tx.status]}
                                        </span>
                                      )}
                                    </div>
                                    <div className="mt-0.5 flex items-center gap-1.5 truncate text-[11px] text-muted">
                                      <span className="truncate">
                                        {tx.direction === "in" ? $t("Kimden: ") : $t("Kime: ")}
                                        {tx.counterpartyLabel ?? shortAddress(tx.counterparty, 6)}
                                      </span>
                                      <span>·</span>
                                      <span className="shrink-0">
                                        {new Date(tx.timestamp).toLocaleTimeString("tr-TR", {
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        })}
                                      </span>
                                    </div>
                                  </div>

                                  <span className="hidden shrink-0 items-center gap-1.5 rounded-xs border border-line bg-surface2 px-1.5 py-1 sm:flex">
                                    <ChainIcon chainId={tx.chainId} size={14} />
                                    <span className="text-[10px] text-muted">{chain?.shortName}</span>
                                  </span>

                                  <TokenIcon
                                    symbol={tx.symbol}
                                    chainId={tx.chainId}
                                    address={tx.tokenAddress}
                                    size={26}
                                  />

                                  <div className="w-[132px] shrink-0 text-right">
                                    <div
                                      className={cn(
                                        "tabular truncate text-[13px] font-semibold",
                                        tx.direction === "in"
                                          ? "text-up"
                                          : tx.direction === "out"
                                            ? "text-text"
                                            : "text-textsoft",
                                      )}
                                    >
                                      {hideBalance
                                        ? "••••"
                                        : `${tx.direction === "in" ? "+" : tx.direction === "out" ? "−" : ""}${formatAmount(tx.amount, 6)} ${tx.symbol}`}
                                    </div>
                                    <div className="tabular text-[11px] text-muted">
                                      {hideBalance ? "••••" : tx.usdValue > 0 ? formatUsd(tx.usdValue) : $t("fiyat yok")}
                                    </div>
                                  </div>
                                </button>

                                <a
                                  href={tx.explorerUrl}
                                  target="_blank"
                                  rel="noreferrer noopener"
                                  className="focus-ring hidden shrink-0 rounded-ctrl p-1.5 text-muted transition-colors hover:text-brand md:block"
                                  title={$t("Gezginde aç")}
                                >
                                  <ExternalLink size={13} />
                                </a>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}

                  <div className="border-t border-line p-3">
                    {history.hasMore ? (
                      <Button
                        variant="outline"
                        fullWidth
                        disabled={history.loadingMore}
                        iconLeft={
                          history.loadingMore ? <Refresh size={13} className="anim-spin" /> : <ChevronDown size={14} />
                        }
                        onClick={() => void history.loadMore()}
                      >
                        {history.loadingMore ? $t("Önceki işlemler yükleniyor…") : $t("Daha fazla yükle")}
                      </Button>
                    ) : (
                      <p className="py-1 text-center text-[11px] text-muted">
                        {$t("Yüklenen")} {history.records.length} {$t("kaydın sonuna gelindi.")}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </Card>
          </>
        )}
      </div>

      <TxDetailDrawer tx={openTx} onClose={() => setOpenTx(null)} />
      {activeOrder && <OrderDrawer order={activeOrder} onClose={() => setActiveOrder(null)} />}
    </div>
  );
}
