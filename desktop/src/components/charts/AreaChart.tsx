import { t as $t } from "@/lib/i18n";
import { memo, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ChartRange, SeriesPoint } from "@/lib/api/defillama";
import { RANGE_SHORT } from "@/lib/api/defillama";
import { cn, formatPercent } from "@/lib/utils";

/**
 * Etkileşimli alan grafiği.
 *
 * Gerçek piksel genişliğinde çizilir (ResizeObserver) — böylece imleç
 * noktası ve etiketler ezilmez. Üzerine gelince dikey çizgi + değer balonu,
 * canlı modda son noktada nabız atan nokta gösterilir.
 */

interface Props {
  series: SeriesPoint[];
  range: ChartRange;
  ranges?: ChartRange[];
  onRange?: (range: ChartRange) => void;
  loading?: boolean;
  height?: number;
  changePct?: number;
  live?: boolean;
  color?: string;
  formatValue: (value: number) => string;
  formatTime?: (ts: number, range: ChartRange) => string;
  emptyText?: string;
  className?: string;
}

const DEFAULT_RANGES: ChartRange[] = ["24h", "7d", "30d", "90d", "1y"];

export const AreaChart = memo(function AreaChart({
  series,
  range,
  ranges = DEFAULT_RANGES,
  onRange,
  loading = false,
  height = 200,
  changePct,
  live = false,
  color,
  formatValue,
  formatTime = defaultTime,
  emptyText = $t("Grafik için yeterli veri yok"),
  className,
}: Props) {
  const gradientId = useId().replace(/:/g, "");
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  const [hover, setHover] = useState<number | null>(null);

  useLayoutEffect(() => {
    const node = wrapRef.current;
    if (!node) return;
    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width ?? 0;
      if (next > 0) setWidth(next);
    });
    observer.observe(node);
    setWidth(node.clientWidth || 720);
    return () => observer.disconnect();
  }, []);

  const pct = changePct ?? computeChange(series);
  const up = pct >= 0;
  const stroke = color ?? (up ? "#3ecf8e" : "#ff5c60");

  const geometry = useMemo(() => {
    if (series.length < 2 || width < 40) return null;
    const padTop = 14;
    const padBottom = 12;
    const values = series.map((p) => p.v);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || Math.max(Math.abs(max) * 0.02, 1e-9);
    const lo = min - span * 0.12;
    const hi = max + span * 0.12;
    const innerH = height - padTop - padBottom;
    const stepX = width / (series.length - 1);

    const points = series.map((p, i) => ({
      x: i * stepX,
      y: padTop + (1 - (p.v - lo) / (hi - lo)) * innerH,
      t: p.t,
      v: p.v,
    }));

    const line = points
      .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
      .join(" ");
    const area = `${line} L${width.toFixed(2)},${height} L0,${height} Z`;
    const gridValues = [0, 0.25, 0.5, 0.75, 1].map((r) => ({
      y: padTop + r * innerH,
      value: hi - r * (hi - lo),
    }));

    return { points, line, area, gridValues, baselineY: points[0].y };
  }, [series, width, height]);

  const hovered = hover != null ? geometry?.points[hover] : undefined;
  const last = geometry?.points[geometry.points.length - 1];

  function pointerIndex(clientX: number) {
    const node = wrapRef.current;
    if (!node || !geometry) return null;
    const rect = node.getBoundingClientRect();
    const ratio = (clientX - rect.left) / rect.width;
    const index = Math.round(ratio * (geometry.points.length - 1));
    return Math.max(0, Math.min(geometry.points.length - 1, index));
  }

  return (
    <div className={cn("relative", className)}>
      {onRange && (
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {live && (
              <span className="live-chip">
                <span className="live-dot" /> {$t("canlı")}
              </span>
            )}
            {geometry && (
              <span className={cn("tabular text-[11px] font-semibold", up ? "text-up" : "text-down")}>
                {formatPercent(pct)}%
              </span>
            )}
          </div>
          <div className="flex items-center gap-0.5 rounded-lg border border-white/[0.06] bg-surface-800/80 p-0.5">
            {ranges.map((r) => (
              <button
                key={r}
                onClick={() => onRange(r)}
                className={cn(
                  "focus-ring rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors duration-150",
                  r === range ? "bg-surface-600 text-white" : "text-zinc-500 hover:text-zinc-200",
                )}
              >
                {RANGE_SHORT[r]}
              </button>
            ))}
          </div>
        </div>
      )}

      <div ref={wrapRef} className="relative" style={{ height }}>
        {loading && !geometry ? (
          <div className="skeleton h-full w-full" />
        ) : !geometry ? (
          <div className="grid h-full place-items-center rounded-xl border border-dashed border-white/[0.07] bg-surface-800/30">
            <span className="px-4 text-center text-[11px] leading-relaxed text-zinc-600">
              {emptyText}
            </span>
          </div>
        ) : (
          <>
            <svg
              width={width}
              height={height}
              className="block touch-none select-none overflow-visible"
              onMouseMove={(e) => setHover(pointerIndex(e.clientX))}
              onMouseLeave={() => setHover(null)}
              onTouchStart={(e) => setHover(pointerIndex(e.touches[0].clientX))}
              onTouchMove={(e) => setHover(pointerIndex(e.touches[0].clientX))}
              onTouchEnd={() => setHover(null)}
              role="img"
              aria-label={$t("Fiyat grafiği, {0} yüzde değişim", [formatPercent(pct)])}
            >
              <defs>
                <linearGradient id={`fill-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={stroke} stopOpacity="0.3" />
                  <stop offset="55%" stopColor={stroke} stopOpacity="0.08" />
                  <stop offset="100%" stopColor={stroke} stopOpacity="0" />
                </linearGradient>
              </defs>

              {geometry.gridValues.map((g, i) => (
                <g key={i}>
                  <line
                    x1={0}
                    x2={width}
                    y1={g.y}
                    y2={g.y}
                    stroke="rgba(255,255,255,0.045)"
                    strokeWidth={1}
                    strokeDasharray={i === 2 ? "0" : "3 5"}
                  />
                  <text
                    x={width - 2}
                    y={g.y - 4}
                    textAnchor="end"
                    className="tabular"
                    fontSize="9"
                    fill="rgba(255,255,255,0.26)"
                  >
                    {formatValue(g.value)}
                  </text>
                </g>
              ))}

              <line
                x1={0}
                x2={width}
                y1={geometry.baselineY}
                y2={geometry.baselineY}
                stroke={stroke}
                strokeOpacity="0.22"
                strokeWidth={1}
                strokeDasharray="4 6"
              />

              <path d={geometry.area} fill={`url(#fill-${gradientId})`} />
              <path
                d={geometry.line}
                fill="none"
                stroke={stroke}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="animate-draw-line"
                style={{ strokeDasharray: 1400 }}
              />

              {live && last && !hovered && (
                <>
                  <circle cx={last.x} cy={last.y} r={7} fill={stroke} opacity={0.18}>
                    <animate attributeName="r" values="5;11;5" dur="2s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.28;0;0.28" dur="2s" repeatCount="indefinite" />
                  </circle>
                  <circle cx={last.x} cy={last.y} r={3.2} fill={stroke} stroke="#0e0d13" strokeWidth={1.5} />
                </>
              )}

              {hovered && (
                <>
                  <line
                    x1={hovered.x}
                    x2={hovered.x}
                    y1={0}
                    y2={height}
                    stroke="rgba(255,255,255,0.22)"
                    strokeWidth={1}
                  />
                  <circle cx={hovered.x} cy={hovered.y} r={5.5} fill={stroke} opacity={0.22} />
                  <circle cx={hovered.x} cy={hovered.y} r={3.4} fill={stroke} stroke="#0e0d13" strokeWidth={1.5} />
                </>
              )}
            </svg>

            {hovered && (
              <div
                className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg border border-white/[0.1] bg-surface-800/95 px-2.5 py-1.5 text-center shadow-lift backdrop-blur"
                style={{
                  left: Math.min(Math.max(hovered.x, 62), width - 62),
                }}
              >
                <div className="tabular whitespace-nowrap text-[12px] font-semibold text-white">
                  {formatValue(hovered.v)}
                </div>
                <div className="whitespace-nowrap text-[9px] text-zinc-500">
                  {formatTime(hovered.t, range)}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {geometry && (
        <div className="mt-1.5 flex items-center justify-between text-[9px] text-zinc-600">
          <span>{formatTime(series[0].t, range)}</span>
          <span>{formatTime(series[series.length - 1].t, range)}</span>
        </div>
      )}
    </div>
  );
});

export function computeChange(series: SeriesPoint[]): number {
  if (series.length < 2) return 0;
  const first = series[0].v;
  const last = series[series.length - 1].v;
  if (first <= 0) return 0;
  return ((last - first) / first) * 100;
}

function defaultTime(ts: number, range: ChartRange): string {
  const date = new Date(ts);
  if (range === "1h" || range === "24h") {
    return date.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  }
  if (range === "1y") {
    return date.toLocaleDateString("tr-TR", { month: "short", year: "2-digit" });
  }
  return date.toLocaleDateString("tr-TR", { day: "2-digit", month: "short" });
}
