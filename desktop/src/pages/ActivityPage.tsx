import { t as $t } from "@/lib/i18n";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Warning, Export, CaretDown, ArrowLineDown, ArrowSquareOut, Funnel, ArrowsClockwise, MagnifyingGlass, ShieldWarning, X } from "@phosphor-icons/react";
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
import { useSwapStore } from "@/stores/swapStore";
import { formatAmount, formatUsd, shortAddress, cn } from "@/lib/utils";
import { toast } from "@/stores/toastStore";

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

function Select<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  label: string;
}) {
  return (
    <div className="relative">
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="focus-ring h-8 appearance-none rounded-lg border border-white/[0.06] bg-surface-800/70 pl-2.5 pr-7 text-[11px] text-zinc-300 outline-none transition-colors hover:border-white/[0.14]"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-surface-800 text-zinc-200">
            {o.label}
          </option>
        ))}
      </select>
      <CaretDown
        size={12}
        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-zinc-600"
      />
    </div>
  );
}

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
  // BOM: Excel'in Türkçe başlıkları UTF-8 olarak tanıması için gerekli.
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
      // Kimlik avı airdropları gerçek zincir kaydıdır; gizlenir ama silinmez.
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

  return (
    <div className="page">
      <div className="mx-auto max-w-6xl pb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-white">{$t("İşlem geçmişi")}</h1>
            <p className="mt-0.5 text-[11px] text-zinc-500">
              {tab === "swaps"
                ? $t("Takas emirlerinin aşamaları ve sonuçları")
                : $t("Zincir üzerindeki gerçek transferler")}
            </p>
          </div>
          {tab === "tx" && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (filtered.length === 0) {
                    toast($t("Dışa aktarılacak işlem yok"), "info");
                    return;
                  }
                  exportCsv(filtered);
                  toast($t("{0} işlem CSV olarak indirildi", [filtered.length]), "success");
                }}
                className="focus-ring flex h-8 items-center gap-1.5 rounded-lg border border-white/[0.07] bg-surface-850 px-2.5 text-[11px] text-zinc-400 transition-colors hover:border-accent/40 hover:text-white"
              >
                <Export size={12} /> CSV
              </button>
              <button
                onClick={history.refreshNow}
                disabled={history.loading}
                className="focus-ring flex h-8 items-center gap-1.5 rounded-lg border border-white/[0.07] bg-surface-850 px-2.5 text-[11px] text-zinc-400 transition-colors hover:border-accent/40 hover:text-white disabled:opacity-60"
              >
                <ArrowsClockwise size={12} className={cn(history.loading && "animate-spin")} />
                {history.loading ? $t("Yenileniyor…") : $t("Yenile")}
              </button>
            </div>
          )}
        </div>

        <div className="mt-3 flex items-center gap-5 border-b border-white/[0.06]">
          {(
            [
              ["tx", $t("İşlemler")],
              ["swaps", $t("Takaslar")],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setParams(key === "tx" ? {} : { tab: key }, { replace: true })}
              className={cn(
                "relative py-2 text-[13px] font-medium transition-colors",
                tab === key ? "text-white" : "text-zinc-500 hover:text-zinc-300",
              )}
            >
              {label}
              {key === "swaps" && swapOrders.length > 0 && (
                <span className="ml-1.5 chip align-middle">{swapOrders.length}</span>
              )}
              {tab === key && <span className="absolute inset-x-0 bottom-0 h-[2px] rounded-full bg-accent" />}
            </button>
          ))}
        </div>

        {tab === "swaps" ? (
          <div className="mt-4">
            <OrderList onOpen={setActiveOrder} />
            {liveSwaps > 0 && (
              <p className="mt-2 text-center text-[11px] text-zinc-600">
                {liveSwaps} {$t("takasın sonucu arka planda izleniyor.")}
              </p>
            )}
          </div>
        ) : (
          <>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="stat-tile">
            <div className="text-[10px] uppercase tracking-[0.12em] text-zinc-500">{$t("Kayıt")}</div>
            <div className="tabular mt-1 text-[16px] font-semibold text-white">
              {filtered.length}
              {filtered.length !== history.records.length && (
                <span className="ml-1 text-[11px] font-normal text-zinc-600">
                  / {history.records.length}
                </span>
              )}
            </div>
          </div>
          <div className="stat-tile">
            <div className="text-[10px] uppercase tracking-[0.12em] text-zinc-500">{$t("Gelen")}</div>
            <div className="tabular mt-1 text-[16px] font-semibold text-up">
              {formatUsd(totals.incoming)}
            </div>
          </div>
          <div className="stat-tile">
            <div className="text-[10px] uppercase tracking-[0.12em] text-zinc-500">{$t("Giden")}</div>
            <div className="tabular mt-1 text-[16px] font-semibold text-down">
              {formatUsd(totals.outgoing)}
            </div>
          </div>
          <div className="stat-tile">
            <div className="text-[10px] uppercase tracking-[0.12em] text-zinc-500">{$t("Ağ ücretleri")}</div>
            <div className="tabular mt-1 text-[16px] font-semibold text-warning">
              {formatUsd(totals.fees)}
            </div>
          </div>
        </div>

        <div className="panel mt-4">
          <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.06] p-3">
            <div className="flex h-8 min-w-[180px] flex-1 items-center gap-2 rounded-lg border border-white/[0.06] bg-surface-800/70 px-2.5 focus-within:border-accent/50">
              <MagnifyingGlass size={13} className="shrink-0 text-zinc-600" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={$t("Hash, adres, token veya yöntem ara")}
                className="w-full bg-transparent text-[12px] text-zinc-100 outline-none placeholder:text-zinc-600"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="focus-ring shrink-0 rounded text-zinc-600 hover:text-white"
                  aria-label={$t("Aramayı temizle")}
                >
                  <X size={12} />
                </button>
              )}
            </div>

            <Select
              label={$t("Ağ filtresi")}
              value={chainFilter}
              onChange={setChainFilter}
              options={[
                { value: "all", label: $t("Tüm ağlar") },
                ...chains.map((c) => ({ value: c.id, label: c.name })),
              ]}
            />
            <Select label={$t("Tür filtresi")} value={kindFilter} onChange={setKindFilter} options={KIND_OPTIONS} />
            <Select
              label={$t("Durum filtresi")}
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: "all", label: $t("Tüm durumlar") },
                { value: "confirmed", label: $t("Onaylandı") },
                { value: "pending", label: $t("Beklemede") },
                { value: "failed", label: $t("Başarısız") },
              ]}
            />
            <Select
              label={$t("Sıralama")}
              value={sort}
              onChange={setSort}
              options={(Object.keys(SORT_LABELS) as SortKey[]).map((k) => ({
                value: k,
                label: SORT_LABELS[k],
              }))}
            />
            {suspicious.size > 0 && (
              <button
                onClick={() => setShowSuspicious((v) => !v)}
                className={cn(
                  "focus-ring flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] transition-colors",
                  showSuspicious
                    ? "border-danger/40 bg-danger/[0.1] text-danger"
                    : "border-white/[0.06] bg-surface-800/70 text-zinc-400 hover:border-white/[0.14] hover:text-white",
                )}
                title={$t("Benzer glifli sembol veya reklam içeren kimlik avı airdropları")}
              >
                <ShieldWarning size={12} />
                {$t("Şüpheli")} {suspicious.size}
              </button>
            )}
            {activeFilters > 0 && (
              <button
                onClick={clearFilters}
                className="focus-ring flex h-8 items-center gap-1.5 rounded-lg border border-accent/30 bg-accent-soft px-2.5 text-[11px] text-accent transition-colors hover:bg-accent/20"
              >
                <Funnel size={11} /> {activeFilters} {$t("filtre · temizle")}
              </button>
            )}
          </div>

          {(history.error || history.failed.length > 0 || history.unsupported.length > 0) && (
            <div className="flex items-start gap-2 border-b border-white/[0.05] bg-warning/[0.05] px-4 py-2.5 text-[11px] leading-relaxed text-warning/90">
              <Warning size={13} className="mt-px shrink-0" />
              <span>
                {history.error ??
                  [
                    history.failed.length > 0
                      ? `Yanıt vermeyen ağ: ${history.failed
                          .map((c) => getChain(c)?.shortName ?? c)
                          .join(", ")}.`
                      : "",
                    history.unsupported.length > 0
                      ? `Geçmişi okunamayan ağ: ${history.unsupported
                          .map((c) => getChain(c)?.shortName ?? c)
                          .join(", ")} — bakiye ve fiyatlar bu ağlarda çalışmaya devam eder.`
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
              </span>
            </div>
          )}

          {history.loading && history.records.length === 0 ? (
            <div className="space-y-1.5 p-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="skeleton h-[54px]" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-surface-800 text-zinc-600">
                <ArrowLineDown size={18} />
              </span>
              <span className="text-sm text-zinc-300">
                {activeFilters > 0 ? $t("Filtreyle eşleşen işlem yok") : $t("Henüz işlem kaydı yok")}
              </span>
              <span className="max-w-[380px] text-[11px] leading-relaxed text-zinc-600">
                {activeFilters > 0
                  ? $t("Filtreleri temizleyip tekrar dene ya da daha fazla sayfa yükle.")
                  : $t("Bu adrese gelen ve giden transferler zincirden okunur; ilk işlemden sonra burada listelenir.")}
              </span>
              {activeFilters > 0 && (
                <button
                  onClick={clearFilters}
                  className="focus-ring mt-1 rounded-lg border border-white/[0.08] px-3 py-1.5 text-[11px] text-zinc-300 hover:border-accent/40 hover:text-white"
                >
                  {$t("Filtreleri temizle")}
                </button>
              )}
            </div>
          ) : (
            <div>
              {groups.map((group) => (
                <div key={group.label}>
                  <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/[0.05] bg-surface-850/95 px-4 py-2 backdrop-blur">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                      {group.label}
                    </span>
                    <span className="text-[10px] text-zinc-600">{group.items.length} {$t("işlem")}</span>
                  </div>
                  <ul className="p-1.5">
                    {group.items.map((tx) => {
                      const chain = getChain(tx.chainId);
                      const risky = suspicious.has(tx.id);
                      return (
                        <li key={tx.id}>
                          <div
                            className={cn(
                              "row-hover group flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5",
                              risky && "opacity-60 hover:opacity-100",
                            )}
                          >
                            <button
                              onClick={() => setOpenTx(tx)}
                              className="focus-ring flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left"
                            >
                              <TxKindBadge tx={tx} size={34} />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="truncate text-[13px] font-medium text-white">
                                    {KIND_LABELS[tx.kind]}
                                  </span>
                                  {risky && (
                                    <span className="chip shrink-0 border-danger/30 bg-danger/[0.08] text-danger">
                                      <ShieldWarning size={9} /> {$t("Şüpheli")}
                                    </span>
                                  )}
                                  {tx.methodLabel && tx.kind !== "approve" && (
                                    <span className="chip shrink-0">{tx.methodLabel}</span>
                                  )}
                                  {tx.status !== "confirmed" && (
                                    <span
                                      className={cn(
                                        "chip shrink-0",
                                        tx.status === "failed" ? "text-down" : "text-warning",
                                      )}
                                    >
                                      {STATUS_LABELS[tx.status]}
                                    </span>
                                  )}
                                </div>
                                <div className="mt-0.5 flex items-center gap-1.5 truncate text-[11px] text-zinc-500">
                                  <span className="truncate">
                                    {tx.direction === "in" ? $t("Kimden: ") : $t("Kime: ")}
                                    {tx.counterpartyLabel ?? shortAddress(tx.counterparty, 6)}
                                  </span>
                                  <span className="text-zinc-700">·</span>
                                  <span className="shrink-0">
                                    {new Date(tx.timestamp).toLocaleTimeString("tr-TR", {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </span>
                                </div>
                              </div>

                              <span className="hidden shrink-0 items-center gap-1.5 rounded-md border border-white/[0.06] bg-surface-800/60 px-1.5 py-1 sm:flex">
                                <ChainIcon chainId={tx.chainId} size={14} />
                                <span className="text-[10px] text-zinc-400">{chain?.shortName}</span>
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
                                    "tabular truncate text-[13px] font-medium",
                                    tx.direction === "in"
                                      ? "text-up"
                                      : tx.direction === "out"
                                        ? "text-white"
                                        : "text-zinc-300",
                                  )}
                                >
                                  {tx.direction === "in" ? "+" : tx.direction === "out" ? "−" : ""}
                                  {formatAmount(tx.amount, 6)} {tx.symbol}
                                </div>
                                <div className="tabular text-[11px] text-zinc-500">
                                  {tx.usdValue > 0 ? formatUsd(tx.usdValue) : $t("fiyat yok")}
                                </div>
                              </div>
                            </button>

                            <a
                              href={tx.explorerUrl}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="focus-ring hidden shrink-0 rounded-md p-1.5 text-zinc-700 transition-colors hover:text-accent md:block"
                              title={$t("Gezginde aç")}
                            >
                              <ArrowSquareOut size={13} />
                            </a>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}

              <div className="border-t border-white/[0.06] p-3">
                {history.hasMore ? (
                  <button
                    onClick={history.loadMore}
                    disabled={history.loadingMore}
                    className="focus-ring flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-surface-800/70 text-[12px] font-medium text-zinc-300 transition-colors hover:border-accent/40 hover:text-white disabled:opacity-60"
                  >
                    {history.loadingMore ? (
                      <>
                        <ArrowsClockwise size={13} className="animate-spin" /> {$t("Önceki işlemler yükleniyor…")}
                      </>
                    ) : (
                      <>
                        <CaretDown size={14} /> {$t("Daha fazla yükle")}
                      </>
                    )}
                  </button>
                ) : (
                  <p className="py-1 text-center text-[11px] text-zinc-600">
                    {$t("Yüklenen")} {history.records.length} {$t("kaydın sonuna gelindi.")}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
          </>
        )}
      </div>

      <TxDetailDrawer tx={openTx} onClose={() => setOpenTx(null)} />
      {activeOrder && <OrderDrawer order={activeOrder} onClose={() => setActiveOrder(null)} />}
    </div>
  );
}
