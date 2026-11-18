import { Card, Zap, cn } from "@/kit";
import { llamaRangeStats } from "@/lib/api/llamaMeta";
import type { SeriesPoint } from "@/lib/api/defillama";
import { formatPrice } from "@/lib/utils";
import { t as $t } from "@/lib/i18n";

function Tile({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "up" | "down" }) {
  return (
    <div className="rounded-card border border-line bg-surface2/60 p-3">
      <div className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-muted">{label}</div>
      <div
        className={cn(
          "tabular mt-1.5 text-[14px] font-semibold",
          tone === "up" ? "text-up" : tone === "down" ? "text-down" : "text-text",
        )}
      >
        {value}
      </div>
      {hint && <div className="mt-0.5 text-[10px] text-muted">{hint}</div>}
    </div>
  );
}

export function RangeStatsCard({ series, loading }: { series: SeriesPoint[]; loading: boolean }) {
  const stats = llamaRangeStats(series);
  if (loading && !stats) {
    return (
      <Card className="p-4">
        <div className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-text">
          <Zap size={14} className="text-brand" /> {$t("Aralık istatistikleri")}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[62px] animate-pulse rounded-card bg-surface2" />
          ))}
        </div>
      </Card>
    );
  }
  if (!stats) return null;

  const last = series[series.length - 1]?.v ?? 0;
  const span = stats.high - stats.low;
  const pos = span > 0 && last > 0 ? Math.min(100, Math.max(0, ((last - stats.low) / span) * 100)) : null;

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-[13px] font-semibold text-text">
          <Zap size={14} className="text-brand" /> {$t("Aralık istatistikleri")}
        </span>
        <span className="text-[10px] text-muted">{$t("grafik serisinden")}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-2">
        <Tile label={$t("En yüksek")} value={formatPrice(stats.high)} tone="up" />
        <Tile label={$t("En düşük")} value={formatPrice(stats.low)} tone="down" />
        <Tile label={$t("Ortalama")} value={formatPrice(stats.avg)} />
        <Tile
          label={$t("Volatilite")}
          value={`%${stats.volatility.toFixed(2)}`}
          hint={$t("adım başına standart sapma")}
        />
      </div>
      {pos != null && (
        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between text-[10px] text-muted">
            <span>{$t("Aralık konumu")}</span>
            <span className="tabular">%{pos.toFixed(0)}</span>
          </div>
          <div className="relative h-1.5 rounded-full bg-gradient-to-r from-down/60 via-warn/50 to-up/60">
            <span
              className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-text"
              style={{ left: `${pos}%` }}
            />
          </div>
        </div>
      )}
    </Card>
  );
}
