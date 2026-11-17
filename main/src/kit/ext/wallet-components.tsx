import { useMemo, useRef, useState } from "react";
import { cn } from "../cn";
import { Check, ChevronDown, Copy, Eye, Star } from "../icons";
import { EyeOff, Flame, TokenGlyph, TrendingDown, TrendingUp } from "./crypto-icons";



export function AddressPill({
  address,
  ens,
  showEns = false,
  onCopy,
  size = "md",
  className,
}: {
  address: string;
  ens?: string;
  showEns?: boolean;
  onCopy?: (address: string) => void;
  size?: "sm" | "md";
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const short = address.length > 13 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;

  const trigger = () => {
    navigator.clipboard?.writeText(address).catch(() => {});
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
    onCopy?.(address);
  };

  return (
    <button
      type="button"
      onClick={trigger}
      aria-label={`Cüzdan adresini kopyala: ${short}`}
      className={cn(
        "group inline-flex min-h-[38px] items-center gap-1.5 rounded-ctrl border border-line bg-surface px-3 font-mono tracking-tight text-textsoft transition-all duration-150 hover:border-linestrong hover:bg-surface2 hover:text-text active:scale-[0.98]",
        size === "sm" ? "text-[11.5px]" : "text-[12px]",
        className,
      )}
      title={`${address} — Kopyalamak için dokun`}
    >
      <span className="truncate font-medium text-text">{showEns && ens ? `${ens} · ${short}` : short}</span>
      <span className={cn("shrink-0 transition-colors", copied ? "text-[#16A34A]" : "text-muted group-hover:text-text")}>
        {copied ? <Check size={13} strokeWidth={2.5} /> : <Copy size={13} />}
      </span>
    </button>
  );
}


export function HighlightedAddress({
  address,
  className,
}: {
  address: string;
  className?: string;
}) {
  const clean = address.trim();
  if (clean.length <= 14) {
    return (
      <span className={cn("font-mono text-[13px] font-bold break-all text-text", className)}>
        {clean}
      </span>
    );
  }
  const head = clean.slice(0, 6);
  const middle = clean.slice(6, -6);
  const tail = clean.slice(-6);

  return (
    <span className={cn("font-mono text-[12.5px] leading-relaxed break-all tabular-nums", className)}>
      <mark className="rounded-xs bg-brandsoft px-1 py-0.5 font-bold text-text ring-1 ring-brand/40">
        {head}
      </mark>
      <span className="text-muted">{middle}</span>
      <mark className="rounded-xs bg-brandsoft px-1 py-0.5 font-bold text-text ring-1 ring-brand/40">
        {tail}
      </mark>
    </span>
  );
}

export function NetworkPill({
  name,
  color = "#16A34A",
  gwei,
  onClick,
  active = false,
  className,
}: {
  name: string;
  color?: string;
  gwei?: string;
  onClick?: () => void;
  active?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Ağ seçici: Aktif ağ ${name}`}
      className={cn(
        "inline-flex min-h-[38px] items-center gap-1.5 rounded-ctrl border px-3 text-[12px] font-semibold tracking-tight transition-all duration-150",
        active
          ? "border-transparent bg-text text-bg shadow-1"
          : "border-line bg-surface text-text hover:border-linestrong hover:bg-surface2",
        className,
      )}
    >
      <span className="relative flex size-2 shrink-0">
        <span className="relative inline-flex size-2 rounded-full" style={{ backgroundColor: color }} />
      </span>
      <span className="whitespace-nowrap">{name}</span>
      {gwei && (
        <span className="hidden items-center gap-0.5 font-mono text-[10.5px] text-muted sm:inline-flex">
          · {gwei}
        </span>
      )}
      <ChevronDown size={13} className="shrink-0 text-muted" />
    </button>
  );
}


export function AmountDisplay({
  amount,
  deltaText,
  positive = true,
  sublabel,
  hidden = false,
  onToggleHidden,
  size = "lg",
}: {
  amount: string;
  deltaText?: string;
  positive?: boolean;
  sublabel?: string;
  hidden?: boolean;
  onToggleHidden?: () => void;
  size?: "md" | "lg" | "xl";
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <div
          className={cn(
            "font-display leading-none font-extrabold tracking-tight text-text tabular-nums transition-all duration-150",
            size === "xl"
              ? "text-3xl sm:text-4xl"
              : size === "lg"
                ? "text-[28px] sm:text-3xl"
                : "text-2xl sm:text-[26px]",
            hidden && "select-none tracking-widest",
          )}
        >
          {hidden ? "••••••" : amount}
        </div>
        {onToggleHidden && (
          <button
            type="button"
            onClick={onToggleHidden}
            aria-label={hidden ? "Bakiyeyi göster" : "Bakiyeyi gizle"}
            className="grid size-11 shrink-0 place-items-center rounded-ctrl border border-line bg-surface2 text-textsoft transition hover:border-linestrong hover:text-text active:scale-95"
          >
            {hidden ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        )}
      </div>
      {(deltaText || sublabel) && (
        <div className="flex flex-wrap items-center gap-2">
          {deltaText && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-ctrl px-2 py-0.5 font-mono text-[11.5px] font-semibold tabular-nums",
                positive
                  ? "bg-[#16A34A]/12 text-[#16A34A]"
                  : "bg-[#DC2626]/12 text-[#DC2626]",
              )}
            >
              {positive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              <span>{hidden ? "••••••" : deltaText}</span>
            </span>
          )}
          {sublabel && <span className="font-mono text-[11px] text-muted">{sublabel}</span>}
        </div>
      )}
    </div>
  );
}


export function MiniSparkline({
  data,
  positive = true,
  width = 56,
  height = 22,
  className,
}: {
  data: number[];
  positive?: boolean;
  width?: number;
  height?: number;
  className?: string;
}) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pad = 2.5;
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - pad - ((v - min) / span) * (height - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const color = positive ? "#16A34A" : "#DC2626";
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("overflow-visible shrink-0", className)}
      aria-hidden="true"
    >
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth={1.85}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}


export type ChartPoint = { label: string; value: number };

export function InteractiveChart({
  points,
  accent = "text",
  positive = true,
  formatValue = (v) => `$${v.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
  hidden = false,
  height = 98,
  showLabels = false,
  onHoverPoint,
}: {
  points: ChartPoint[];
  accent?: "brand" | "ok" | "text" | "auto";
  positive?: boolean;
  formatValue?: (v: number) => string;
  hidden?: boolean;
  height?: number;
  showLabels?: boolean;
  onHoverPoint?: (pt: ChartPoint | null) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const gradId = useMemo(() => `kit-chart-${Math.random().toString(36).slice(2, 8)}`, []);

  const W = 520;
  const H = height;
  const padTop = 10;
  const padBot = 10;

  const { coords, linePath, areaPath } = useMemo(() => {
    if (points.length < 2) return { coords: [], linePath: "", areaPath: "" };
    const vals = points.map((p) => p.value);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const span = max - min || 1;
    const cs = points.map((p, i) => ({
      x: (i / (points.length - 1)) * W,
      y: H - padBot - ((p.value - min) / span) * (H - padTop - padBot),
      point: p,
    }));

    let d = `M ${cs[0].x.toFixed(1)} ${cs[0].y.toFixed(1)}`;
    for (let i = 0; i < cs.length - 1; i++) {
      const c0 = cs[i];
      const c1 = cs[i + 1];
      const cx = ((c0.x + c1.x) / 2).toFixed(1);
      d += ` C ${cx} ${c0.y.toFixed(1)}, ${cx} ${c1.y.toFixed(1)}, ${c1.x.toFixed(1)} ${c1.y.toFixed(1)}`;
    }
    const area = `${d} L ${W} ${H} L 0 ${H} Z`;
    return { coords: cs, linePath: d, areaPath: area };
  }, [points, H]);

  const strokeColor =
    accent === "auto"
      ? positive
        ? "#16A34A"
        : "#DC2626"
      : accent === "ok"
        ? "#16A34A"
        : accent === "text"
          ? "var(--text)"
          : "var(--brand)";

  const handlePointer = (clientX: number) => {
    const svg = svgRef.current;
    if (!svg || coords.length === 0) return;
    const rect = svg.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const idx = Math.round(ratio * (coords.length - 1));
    setHoverIdx(idx);
    onHoverPoint?.(coords[idx]?.point ?? null);
  };

  const clear = () => {
    setHoverIdx(null);
    onHoverPoint?.(null);
  };

  const active = hoverIdx !== null ? coords[hoverIdx] : null;
  const labelIndices =
    points.length >= 5
      ? [
          0,
          Math.floor((points.length - 1) * 0.25),
          Math.floor((points.length - 1) * 0.5),
          Math.floor((points.length - 1) * 0.75),
          points.length - 1,
        ]
      : points.map((_, i) => i);

  return (
    <div className="relative w-full select-none">
      {active && (
        <div
          className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 rounded-ctrl border border-line bg-surface/95 px-2.5 py-0.5 font-mono text-[11px] font-medium text-text shadow-1 backdrop-blur-xs"
          style={{
            left: `${Math.max(15, Math.min(85, (active.x / W) * 100))}%`,
          }}
        >
          <span className="text-muted">{active.point.label}</span>
          <span className="mx-1 text-line">·</span>
          <span className="font-semibold tabular-nums">
            {hidden ? "••••••" : formatValue(active.point.value)}
          </span>
        </div>
      )}

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full cursor-crosshair touch-pan-y overflow-visible"
        style={{ height }}
        preserveAspectRatio="none"
        onMouseMove={(e) => handlePointer(e.clientX)}
        onMouseLeave={clear}
        onTouchMove={(e) => e.touches[0] && handlePointer(e.touches[0].clientX)}
        onTouchEnd={clear}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.16" />
            <stop offset="95%" stopColor={strokeColor} stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {[0.25, 0.75].map((r) => (
          <line
            key={r}
            x1={0}
            x2={W}
            y1={padTop + (H - padTop - padBot) * r}
            y2={padTop + (H - padTop - padBot) * r}
            stroke="var(--line)"
            strokeDasharray="3 5"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
            opacity={0.55}
          />
        ))}

        <path d={areaPath} fill={`url(#${gradId})`} />
        <path
          d={linePath}
          fill="none"
          stroke={strokeColor}
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />

        {active && (
          <line
            x1={active.x}
            x2={active.x}
            y1={padTop}
            y2={H - padBot}
            stroke="var(--line-strong)"
            strokeDasharray="2 3"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>

      {active && (
        <span
          className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface shadow-1"
          style={{
            left: `${(active.x / W) * 100}%`,
            top: `${active.y}px`,
            backgroundColor: strokeColor,
          }}
        />
      )}

      {showLabels && (
        <div className="mt-1 flex items-center justify-between px-0.5 font-mono text-[10px] text-muted tabular-nums">
          {labelIndices.map((idx, i) => (
            <span key={i}>{points[idx]?.label}</span>
          ))}
        </div>
      )}
    </div>
  );
}


export function TokenRow({
  symbol,
  name,
  network,
  unitPrice,
  balance,
  fiatValue,
  change24h,
  spark,
  hidden = false,
  isFavorite,
  onToggleFavorite,
  onClick,
  className,
}: {
  symbol: string;
  name: string;
  network?: string;
  unitPrice?: string;
  balance: string;
  fiatValue: string;
  change24h: number;
  spark?: number[];
  hidden?: boolean;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  onClick?: () => void;
  className?: string;
}) {
  const positive = change24h >= 0;
  return (
    <div
      className={cn(
        "group relative flex w-full items-center gap-2.5 rounded-card border border-transparent px-2.5 py-2.5 text-left transition-all duration-150 hover:border-line hover:bg-surface2",
        className,
      )}
    >
      <button
        type="button"
        onClick={onClick}
        aria-label={`${name} (${symbol}) detay sayfasını aç`}
        className="flex min-w-0 flex-1 items-center gap-2.5 text-left min-h-[48px]"
      >
        <TokenGlyph symbol={symbol} size="md" />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-display text-[14.5px] font-bold tracking-tight text-text">
              {name}
            </span>
            <span className="shrink-0 rounded-ctrl bg-surface2 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted group-hover:bg-surface">
              {symbol}
            </span>
            {network && (
              <span className="hidden font-mono text-[10px] text-muted sm:inline">· {network}</span>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-2 font-mono text-[11.5px] tabular-nums">
            {unitPrice && <span className="text-muted">{unitPrice}</span>}
            <span
              className={cn(
                "font-semibold tabular-nums",
                positive ? "text-[#16A34A]" : "text-[#DC2626]",
              )}
            >
              {positive ? "+" : ""}
              {change24h.toFixed(2).replace(".", ",")}%
            </span>
          </div>
        </div>

        {spark && spark.length > 1 && (
          <div className="flex items-center px-1">
            <MiniSparkline data={spark} positive={positive} width={52} height={22} />
          </div>
        )}

        <div className="shrink-0 text-right">
          <div className="font-display text-[14.5px] font-bold tracking-tight text-text tabular-nums">
            {hidden ? "••••••" : fiatValue}
          </div>
          <div className="mt-0.5 font-mono text-[11.5px] text-muted tabular-nums">
            {hidden ? "••••••" : `${balance} ${symbol}`}
          </div>
        </div>
      </button>

      {onToggleFavorite && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite();
          }}
          aria-label={isFavorite ? `${name} favorilerden çıkar` : `${name} favorilere ekle`}
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-ctrl transition-colors",
            isFavorite ? "text-brand" : "text-muted hover:text-text",
          )}
        >
          <Star size={15} fill={isFavorite ? "currentColor" : "none"} />
        </button>
      )}
    </div>
  );
}


export type GasTier = "slow" | "standard" | "fast";

const DEFAULT_GAS: { id: GasTier; label: string; gwei: string; eta: string; fee: string; feeUsd: number }[] = [
  { id: "slow", label: "Ekonomik", gwei: "9 Gwei", eta: "~45 sn", fee: "$0,42", feeUsd: 0.42 },
  { id: "standard", label: "Standart", gwei: "14 Gwei", eta: "~15 sn", fee: "$0,84", feeUsd: 0.84 },
  { id: "fast", label: "Anında", gwei: "22 Gwei", eta: "~6 sn", fee: "$1,38", feeUsd: 1.38 },
];

export function getGasFeeUsd(tier: GasTier): number {
  return DEFAULT_GAS.find((g) => g.id === tier)?.feeUsd ?? 0.84;
}

export function GasSelector({
  value,
  onChange,
  options = DEFAULT_GAS,
}: {
  value: GasTier;
  onChange: (tier: GasTier) => void;
  options?: typeof DEFAULT_GAS;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between px-1">
        <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold tracking-tight text-textsoft">
          <Flame size={14} className="text-brand" /> Ağ Ücreti
        </span>
        <span className="font-mono text-[11px] text-muted">Tahmini Süre &amp; Maliyet</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {options.map((g) => {
          const active = value === g.id;
          return (
            <button
              key={g.id}
              type="button"
              aria-label={`${g.label} ağ ücreti: ${g.fee}`}
              onClick={() => onChange(g.id)}
              className={cn(
                "flex min-h-[68px] flex-col items-start justify-center rounded-card border p-2.5 text-left transition-all duration-150",
                active
                  ? "border-brand bg-brandsoft/40 text-text shadow-1"
                  : "border-line bg-surface text-muted hover:border-linestrong hover:text-textsoft",
              )}
            >
              <span className="text-[12px] font-semibold tracking-tight text-text">{g.label}</span>
              <span className="mt-0.5 font-mono text-[12px] font-bold text-text tabular-nums">{g.fee}</span>
              <span className="mt-0.5 font-mono text-[10px] text-muted tabular-nums">
                {g.gwei} · {g.eta}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}


export function QrMatrix({
  value,
  size = 180,
  symbol = "ETH",
}: {
  value: string;
  size?: number;
  symbol?: string;
}) {
  const N = 25;
  const cells = useMemo(() => {
    let seed = 2166136261;
    for (let i = 0; i < value.length; i++) {
      seed ^= value.charCodeAt(i);
      seed = Math.imul(seed, 16777619);
    }
    const grid: boolean[][] = Array.from({ length: N }, () => Array(N).fill(false));

    const drawFinder = (r0: number, c0: number) => {
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 7; c++) {
          const edge = r === 0 || r === 6 || c === 0 || c === 6;
          const core = r >= 2 && r <= 4 && c >= 2 && c <= 4;
          grid[r0 + r][c0 + c] = edge || core;
        }
      }
    };
    drawFinder(0, 0);
    drawFinder(0, N - 7);
    drawFinder(N - 7, 0);

    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const inFinder =
          (r < 8 && c < 8) || (r < 8 && c >= N - 8) || (r >= N - 8 && c < 8);
        const inCenter = r >= 9 && r <= 15 && c >= 9 && c <= 15;
        if (inFinder || inCenter) continue;
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        grid[r][c] = (seed & 7) < 4;
      }
    }
    return grid;
  }, [value]);

  return (
    <div
      className="relative mx-auto inline-grid place-items-center rounded-card border border-line bg-white p-4 shadow-2"
      style={{ width: size + 32, height: size + 32 }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${N} ${N}`} shapeRendering="crispEdges">
        {cells.map((row, r) =>
          row.map((on, c) =>
            on ? <rect key={`${r}-${c}`} x={c} y={r} width={0.92} height={0.92} rx={0.22} fill="#0B0B0D" /> : null,
          ),
        )}
      </svg>
      <span className="absolute grid size-11 place-items-center rounded-ctrl bg-white p-1 shadow-1">
        <TokenGlyph symbol={symbol} size="sm" />
      </span>
    </div>
  );
}
