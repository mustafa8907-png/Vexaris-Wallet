import { t as $t } from "@/lib/i18n";
import { useMemo, useState } from "react";
import { ArrowLeft, Badge, Button, Card, Check, Chip, Clock, Download, Search, Select, Trash, X } from "@/kit";
import { TokenIcon } from "@/components/TokenIcon";
import { ENGINE_META } from "@/lib/swap/config";
import { chainLabel } from "@/lib/swap/assets";
import { formatEta } from "@/lib/swap/intents";
import type { OrderStage, SwapOrder } from "@/lib/swap/types";
import { unitsToNumber } from "@/lib/swap/units";
import { useSwapStore } from "@/stores/swapStore";
import { toast } from "@/stores/toastStore";
import { cn, formatUsd } from "@/lib/utils";
import { tokenAmount } from "./format";
import { isActive, STAGE_FILTER_LABELS, STAGE_FILTERS, STAGE_META } from "./stages";


type SortKey = "yeni" | "eski" | "tutar" | "suren";

const SORT_LABELS: Record<SortKey, string> = {
  yeni: $t("En yeni"),
  eski: $t("En eski"),
  tutar: $t("En yüksek tutar"),
  suren: $t("Sürenler önce"),
};

function relative(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return $t("az önce");
  if (diff < 3_600_000) return $t("{0} dk önce", [Math.floor(diff / 60_000)]);
  if (diff < 86_400_000) return $t("{0} sa önce", [Math.floor(diff / 3_600_000)]);
  return new Date(ts).toLocaleDateString("tr-TR", { day: "2-digit", month: "short" });
}

function exportCsv(orders: SwapOrder[]) {
  const cell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const header = [
    $t("Tarih"),
    $t("Motor"),
    $t("Verilen"),
    $t("Ağ"),
    $t("Alınan"),
    $t("Ağ"),
    $t("Net USD"),
    $t("Komisyon USD"),
    $t("Durum"),
    $t("Adres/Hash"),
  ];
  const rows = orders.map((o) =>
    [
      new Date(o.createdAt).toISOString(),
      ENGINE_META[o.engine].name,
      `${unitsToNumber(BigInt(o.amountIn), o.amountInDecimals)} ${o.fromSymbol}`,
      chainLabel(o.fromChainId),
      `${unitsToNumber(BigInt(o.amountOut), o.amountOutDecimals)} ${o.toSymbol}`,
      chainLabel(o.toChainId),
      o.amountOutUsd.toFixed(2),
      o.feeUsd.toFixed(4),
      STAGE_META[o.stage].label,
      o.txHash ?? o.depositAddress ?? "",
    ]
      .map(cell)
      .join(","),
  );
  const csv = String.fromCharCode(0xfeff) + header.map(cell).join(",") + "\n" + rows.join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `vexaris-takaslar-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function OrderList({ onOpen }: { onOpen: (id: string) => void }) {
  const orders = useSwapStore((s) => s.orders);
  const lastRemoved = useSwapStore((s) => s.lastRemoved);
  const removeOrders = useSwapStore((s) => s.removeOrders);
  const undoRemove = useSwapStore((s) => s.undoRemove);
  const clearOrders = useSwapStore((s) => s.clearOrders);

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<OrderStage | "all" | "active">("all");
  const [sort, setSort] = useState<SortKey>("yeni");
  const [selected, setSelected] = useState<string[]>([]);
  const [confirmClear, setConfirmClear] = useState(false);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = orders.filter((o) => {
      if (filter === "active" && !isActive(o.stage)) return false;
      if (filter !== "all" && filter !== "active" && o.stage !== filter) return false;
      if (!q) return true;
      return (
        o.fromSymbol.toLowerCase().includes(q) ||
        o.toSymbol.toLowerCase().includes(q) ||
        chainLabel(o.fromChainId).toLowerCase().includes(q) ||
        chainLabel(o.toChainId).toLowerCase().includes(q) ||
        o.id.toLowerCase().includes(q) ||
        (o.txHash ?? "").toLowerCase().includes(q) ||
        (o.depositAddress ?? "").toLowerCase().includes(q)
      );
    });
    const sorted = [...list];
    sorted.sort((a, b) => {
      if (sort === "eski") return a.createdAt - b.createdAt;
      if (sort === "tutar") return b.amountInUsd - a.amountInUsd;
      if (sort === "suren") return Number(isActive(b.stage)) - Number(isActive(a.stage)) || b.createdAt - a.createdAt;
      return b.createdAt - a.createdAt;
    });
    return sorted;
  }, [orders, query, filter, sort]);

  const live = selected.filter((id) => orders.some((o) => o.id === id));
  const allChecked = rows.length > 0 && rows.every((o) => live.includes(o.id));
  const activeCount = orders.filter((o) => isActive(o.stage)).length;

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  return (
    <Card className="overflow-hidden p-0">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
        <span className="flex items-center gap-2">
          <Clock size={13} className="text-brand" />
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-textsoft">
            {$t("Son takaslar")}
          </h2>
          <Badge size="sm">{orders.length}</Badge>
          {activeCount > 0 && (
            <Badge size="sm" tone="info">
              {activeCount} {$t("süren")}
            </Badge>
          )}
        </span>
        <span className="flex items-center gap-1.5">
          <Button
            size="xs"
            variant="soft"
            iconLeft={<Download size={11} />}
            disabled={rows.length === 0}
            onClick={() => {
              exportCsv(rows);
              toast($t("{0} kayıt dışa aktarıldı", [rows.length]), "success");
            }}
          >
            CSV
          </Button>
          {confirmClear ? (
            <span className="flex items-center gap-1">
              <Button
                size="xs"
                variant="soft"
                tone="danger"
                onClick={() => {
                  clearOrders();
                  setSelected([]);
                  setConfirmClear(false);
                  toast($t("Takas geçmişi temizlendi"), "info");
                }}
              >
                {$t("Evet, temizle")}
              </Button>
              <button
                onClick={() => setConfirmClear(false)}
                className="rounded-ctrl px-2 py-1 text-[10px] text-muted transition-colors hover:text-text"
              >
                {$t("Vazgeç")}
              </button>
            </span>
          ) : (
            <Button
              size="xs"
              variant="soft"
              iconLeft={<Trash size={11} />}
              disabled={orders.length === 0}
              onClick={() => setConfirmClear(true)}
            >
              {$t("Temizle")}
            </Button>
          )}
        </span>
      </header>

      {lastRemoved.length > 0 && (
        <div className="flex items-center justify-between gap-2 border-b border-line bg-brandsoft px-4 py-2">
          <span className="text-[11px] text-textsoft">
            {lastRemoved.length > 1 ? $t("{0} kayıt silindi", [lastRemoved.length]) : $t("Kayıt silindi")}
          </span>
          <button
            onClick={undoRemove}
            className="flex items-center gap-1.5 rounded-ctrl border border-brand/35 bg-brand/10 px-2 py-1 text-[10px] text-brand transition-colors hover:bg-brand/15"
          >
            <ArrowLeft size={11} /> {$t("Geri al")}
          </button>
        </div>
      )}

      {orders.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5">
          <label className="flex min-w-[170px] flex-1 items-center gap-2 rounded-ctrl border border-line bg-surface2 px-2.5 py-1.5 focus-within:border-brand/45">
            <Search size={12} className="shrink-0 text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={$t("Token, ağ, hash veya emir no")}
              spellCheck={false}
              className="w-full bg-transparent text-[11px] text-text outline-none placeholder:text-muted"
            />
            {query && (
              <button onClick={() => setQuery("")} aria-label={$t("Aramayı temizle")} className="text-muted hover:text-text">
                <X size={11} />
              </button>
            )}
          </label>

          <div className="no-scrollbar flex items-center gap-1 overflow-x-auto">
            {STAGE_FILTERS.map((f) => (
              <Chip key={f} active={filter === f} onClick={() => setFilter(f)}>
                {STAGE_FILTER_LABELS[f]}
              </Chip>
            ))}
          </div>

          <Select
            aria-label={$t("Sıralama")}
            className="!h-8 w-auto min-w-[130px] shrink-0 py-0 text-[10.5px]"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            options={(Object.keys(SORT_LABELS) as SortKey[]).map((k) => ({ value: k, label: SORT_LABELS[k] }))}
          />
        </div>
      )}

      {live.length > 0 && (
        <div className="flex items-center justify-between gap-2 border-b border-line bg-surface2 px-4 py-2">
          <span className="text-[11px] text-textsoft">
            {live.length} {$t("kayıt seçildi")}
          </span>
          <span className="flex items-center gap-1.5">
            <Button size="xs" variant="ghost" onClick={() => setSelected([])}>
              {$t("Seçimi bırak")}
            </Button>
            <Button
              size="xs"
              variant="soft"
              tone="danger"
              iconLeft={<Trash size={11} />}
              onClick={() => {
                removeOrders(live);
                setSelected([]);
              }}
            >
              {$t("Sil")}
            </Button>
          </span>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <p className="text-[12px] text-textsoft">
            {orders.length === 0 ? $t("Henüz takas yapmadın") : $t("Filtreye uyan takas yok")}
          </p>
          <p className="mt-1 text-[11px] text-muted">
            {orders.length === 0
              ? $t("İlk takasın burada aşama aşama izlenecek.")
              : $t("Aramayı kısalt veya durum filtresini değiştir.")}
          </p>
        </div>
      ) : (
        <div className="max-h-[340px] overflow-y-auto">
          <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-line bg-surface px-4 py-1.5 backdrop-blur">
            <button
              onClick={() => setSelected(allChecked ? [] : rows.map((o) => o.id))}
              aria-label={allChecked ? $t("Seçimi kaldır") : $t("Tümünü seç")}
              className={cn(
                "grid size-[15px] shrink-0 place-items-center rounded border transition-colors",
                allChecked ? "border-brand bg-brand" : "border-linestrong hover:border-muted",
              )}
            >
              {allChecked && <Check size={10} className="text-bg" />}
            </button>
            <span className="flex-1 text-[9px] uppercase tracking-[0.14em] text-muted">{$t("Çift")}</span>
            <span className="hidden w-[92px] text-right text-[9px] uppercase tracking-[0.14em] text-muted sm:block">
              {$t("Net çıkış")}
            </span>
            <span className="w-[104px] text-right text-[9px] uppercase tracking-[0.14em] text-muted">
              {$t("Durum")}
            </span>
            <span className="hidden w-[66px] text-right text-[9px] uppercase tracking-[0.14em] text-muted md:block">
              {$t("Zaman")}
            </span>
          </div>

          <div className="divide-y divide-line">
            {rows.map((o) => (
              <OrderRow
                key={o.id}
                order={o}
                checked={live.includes(o.id)}
                onToggle={() => toggle(o.id)}
                onOpen={() => onOpen(o.id)}
              />
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

function OrderRow({
  order,
  checked,
  onToggle,
  onOpen,
}: {
  order: SwapOrder;
  checked: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const meta = ENGINE_META[order.engine];
  const stage = STAGE_META[order.stage];
  const outUi = unitsToNumber(BigInt(order.amountOut), order.amountOutDecimals);
  const inUi = unitsToNumber(BigInt(order.amountIn), order.amountInDecimals);
  const fromAddr = order.fromId.split(":")[1];
  const toAddr = order.toId.split(":")[1];

  return (
    <div className={cn("flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface2/60", checked && "bg-surface2")}>
      <button
        onClick={onToggle}
        aria-label={$t("Kaydı seç")}
        className={cn(
          "grid size-[15px] shrink-0 place-items-center rounded border transition-colors",
          checked ? "border-brand bg-brand" : "border-linestrong hover:border-muted",
        )}
      >
        {checked && <Check size={10} className="text-bg" />}
      </button>

      <button onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
        <span className="flex shrink-0 items-center">
          <TokenIcon
            symbol={order.fromSymbol}
            chainId={order.fromChainId}
            address={fromAddr === "native" ? undefined : fromAddr}
            size={26}
            badge
          />
          <TokenIcon
            symbol={order.toSymbol}
            chainId={order.toChainId}
            address={toAddr === "native" ? undefined : toAddr}
            size={26}
            badge
            className="-ml-2"
          />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-[12px] font-medium text-text">
              {order.fromSymbol} → {order.toSymbol}
            </span>
            <Badge
              size="sm"
              className={cn(
                "shrink-0",
                order.engine === "kyber"
                  ? "border-teal/30 bg-teal/10 text-teal"
                  : "border-violet/30 bg-violet/10 text-violet",
              )}
            >
              {meta.short}
            </Badge>
            {order.simulated && (
              <Badge size="sm" tone="warning" className="shrink-0">
                test
              </Badge>
            )}
          </span>
          <span className="tabular block truncate text-[10px] text-muted">
            {tokenAmount(inUi)} {order.fromSymbol} · {chainLabel(order.fromChainId)}
            {order.fromChainId !== order.toChainId ? ` → ${chainLabel(order.toChainId)}` : ""}
          </span>
        </span>
      </button>

      <span className="hidden w-[92px] shrink-0 text-right sm:block">
        <span className="tabular block truncate text-[12px] font-semibold text-text">
          {tokenAmount(outUi)}
        </span>
        <span className="tabular block text-[10px] text-muted">{formatUsd(order.amountOutUsd)}</span>
      </span>

      <span className="w-[104px] shrink-0 text-right">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-ctrl border px-2 py-0.5 text-[10px] font-medium",
            stage.border,
            stage.bg,
            stage.text,
          )}
        >
          <span className={cn("size-1.5 rounded-full", stage.dot, isActive(order.stage) && "animate-pulse")} />
          {stage.label}
        </span>
        <span className="mt-0.5 block truncate text-[9px] text-muted">
          {isActive(order.stage) ? `hedef ${formatEta(order.etaSeconds)}` : order.statusText ?? ""}
        </span>
      </span>

      <span className="hidden w-[66px] shrink-0 text-right text-[10px] text-muted md:block">
        {relative(order.createdAt)}
      </span>
    </div>
  );
}
