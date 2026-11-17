import { t as $t } from "@/lib/i18n";
import { memo } from "react";
import { AreaChart } from "@/components/charts/AreaChart";
import type { ChartRange, SeriesPoint } from "@/lib/api/defillama";
import { formatUsd } from "@/lib/utils";

interface Props {
  series: SeriesPoint[];
  range: ChartRange;
  changePct: number;
  loading: boolean;
  onRange: (range: ChartRange) => void;
}

export const PortfolioChart = memo(function PortfolioChart({
  series,
  range,
  changePct,
  loading,
  onRange,
}: Props) {
  return (
    <div className="rounded-card border border-line bg-surface2 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium text-text">{$t("Portföy grafiği")}</span>
        <span className="hidden text-[10px] text-muted sm:inline">
          {$t("Geçmiş fiyat × güncel miktar")}
        </span>
      </div>
      <AreaChart
        series={series}
        range={range}
        onRange={onRange}
        loading={loading}
        changePct={changePct}
        live
        height={190}
        formatValue={formatUsd}
        emptyText={$t("Grafik için fiyat verisi bulunamadı. Varlık ekledikçe eğri oluşur.")}
      />
    </div>
  );
});
