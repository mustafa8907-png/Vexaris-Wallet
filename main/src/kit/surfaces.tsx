import type { ReactNode } from "react";
import { cn } from "./cn";
import { Badge, Button, Ring, type ButtonTone } from "./primitives";
import { ArrowUpRight, Check, Info, AlertTriangle, Sparkles } from "./icons";


export function Card({
  children,
  className,
  hover = false,
  interactive = false,
  padded = true,
  onClick,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  interactive?: boolean;
  padded?: boolean;
  onClick?: () => void;
  as?: "div" | "article" | "section" | "aside";
}) {
  return (
    <Tag
      onClick={onClick}
      className={cn(
        "relative overflow-hidden rounded-card border border-line bg-surface transition-all duration-300",
        padded && "p-5 sm:p-6",
        hover && "hover:-translate-y-0.5 hover:border-linestrong hover:shadow-2",
        (interactive || onClick) && "cursor-pointer group/card",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
  icon,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-3", className)}>
      <div className="flex min-w-0 items-start gap-3.5">
        {icon && (
          <span className="grid size-10 sm:size-11 shrink-0 place-items-center rounded-ctrl border border-line bg-surface2 text-text [&>svg]:size-5">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <h3 className="font-display text-[17px] leading-tight font-semibold tracking-tight text-text">{title}</h3>
          {subtitle && <p className="mt-1 text-[13px] leading-snug text-muted">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function CardBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mt-5", className)}>{children}</div>;
}

export function CardFooter({
  children,
  className,
  divided = true,
}: {
  children: ReactNode;
  className?: string;
  divided?: boolean;
}) {
  return (
    <div
      className={cn(
        "mt-6 flex flex-wrap items-center justify-between gap-3",
        divided && "-mx-5 -mb-5 sm:-mx-6 sm:-mb-6 border-t border-line bg-surface2/60 px-5 sm:px-6 py-4",
        className,
      )}
    >
      {children}
    </div>
  );
}


export function MediaCard({
  title,
  meta,
  tag,
  variant = 0,
  children,
  onClick,
}: {
  title: ReactNode;
  meta?: ReactNode;
  tag?: ReactNode;
  variant?: 0 | 1 | 2 | 3;
  children?: ReactNode;
  onClick?: () => void;
}) {
  const arts = [
    "radial-gradient(120% 120% at 15% 10%, var(--brand) 0%, transparent 55%), radial-gradient(100% 100% at 85% 90%, var(--info) 0%, transparent 60%)",
    "conic-gradient(from 210deg at 60% 40%, var(--ok) 0deg, var(--info) 120deg, var(--brand) 240deg, var(--ok) 360deg)",
    "linear-gradient(135deg, var(--text) 0%, var(--text) 45%, var(--brand) 45%, var(--brand) 100%)",
    "repeating-linear-gradient(45deg, var(--surface-3) 0 10px, transparent 10px 20px), radial-gradient(90% 90% at 80% 20%, var(--warn) 0%, transparent 60%)",
  ];
  return (
    <Card hover interactive={Boolean(onClick)} onClick={onClick} padded={false} className="flex flex-col">
      <div className="relative h-40 overflow-hidden rounded-t-card">
        <div
          className="absolute inset-0 transition-transform duration-700 ease-out group-hover/card:scale-110"
          style={{ background: arts[variant] }}
        />
        <div className="absolute inset-0 opacity-25 grid-paper" />
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-surface to-transparent" />
        {tag && <div className="absolute top-3.5 left-3.5">{tag}</div>}
      </div>
      <div className="flex flex-1 flex-col p-5.5">
        <h3 className="font-display text-[16px] leading-tight font-semibold tracking-tight text-text">{title}</h3>
        {children && <div className="mt-2 text-[13px] leading-snug text-muted">{children}</div>}
        {meta && <div className="mt-4 flex items-center gap-2 font-mono text-[11px] text-muted">{meta}</div>}
      </div>
    </Card>
  );
}


export function StatCard({
  label,
  value,
  delta,
  tone = "success",
  icon,
  spark,
}: {
  label: ReactNode;
  value: ReactNode;
  delta?: string;
  tone?: "success" | "danger" | "neutral" | "brand";
  icon?: ReactNode;
  spark?: number[];
}) {
  const min = spark ? Math.min(...spark) : 0;
  const max = spark ? Math.max(...spark) : 1;
  const span = max - min || 1;
  const stroke =
    tone === "danger"
      ? "var(--danger)"
      : tone === "success"
        ? "var(--ok)"
        : tone === "brand"
          ? "var(--brand)"
          : "var(--text)";

  return (
    <Card hover className="p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] tracking-[0.14em] text-muted uppercase">{label}</span>
        {icon && <span className="text-muted [&>svg]:size-4.5">{icon}</span>}
      </div>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-2">
        <span className="font-display text-2xl sm:text-3xl leading-none font-bold tracking-tight text-text tabular-nums">
          {value}
        </span>
        {delta && (
          <Badge
            tone={
              tone === "danger"
                ? "danger"
                : tone === "success"
                  ? "success"
                  : tone === "brand"
                    ? "brand"
                    : "neutral"
            }
            size="sm"
          >
            {delta}
          </Badge>
        )}
      </div>
      {spark && spark.length > 1 && (
        <svg viewBox="0 0 120 32" className="mt-4 h-8 w-full overflow-visible" preserveAspectRatio="none">
          <polyline
            points={spark
              .map((v, i) => `${(i / (spark.length - 1)) * 120},${29 - ((v - min) / span) * 25}`)
              .join(" ")}
            fill="none"
            stroke={stroke}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </Card>
  );
}


export function PricingCard({
  name,
  price,
  period = "/ay",
  description,
  features,
  featured = false,
  cta = "Başla",
  onSelect,
}: {
  name: string;
  price: string;
  period?: string;
  description?: string;
  features: string[];
  featured?: boolean;
  cta?: string;
  onSelect?: () => void;
}) {
  return (
    <Card
      hover
      className={cn(
        "flex h-full flex-col",
        featured && "border-transparent bg-text text-bg shadow-2",
      )}
    >
      <div className="flex items-center justify-between">
        <span className={cn("font-mono text-[11px] tracking-[0.16em] uppercase", featured ? "text-bg/60" : "text-muted")}>
          {name}
        </span>
        {featured && (
          <span className="inline-flex items-center gap-1 rounded-ctrl bg-brand px-2.5 py-1 text-[10.5px] font-semibold text-white">
            <Sparkles size={12} /> Önerilen
          </span>
        )}
      </div>
      <div className="mt-5 flex items-end gap-1.5">
        <span className="font-display text-4xl sm:text-5xl leading-none font-bold tracking-tighter">{price}</span>
        <span className={cn("pb-1 text-sm", featured ? "text-bg/60" : "text-muted")}>{period}</span>
      </div>
      {description && (
        <p className={cn("mt-3 text-[13.5px] leading-snug", featured ? "text-bg/70" : "text-muted")}>{description}</p>
      )}
      <ul className="mt-6 flex flex-1 flex-col gap-2.5">
        {features.map((f) => (
          <li key={f} className="flex items-center gap-2.5 text-[13px]">
            <span
              className={cn(
                "grid size-5 shrink-0 place-items-center rounded-full",
                featured ? "bg-bg/15 text-bg" : "bg-surface2 text-text",
              )}
            >
              <Check size={12} strokeWidth={2.6} />
            </span>
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <div className="mt-7">
        <Button
          fullWidth
          size="lg"
          variant={featured ? "soft" : "solid"}
          tone="neutral"
          onClick={onSelect}
          className={cn(featured && "border-bg/25 bg-bg/12 text-bg hover:bg-bg/22")}
          iconRight={<ArrowUpRight size={16} />}
        >
          {cta}
        </Button>
      </div>
    </Card>
  );
}


export function ProfileCard({
  name,
  role,
  stats,
  avatar,
  tone = "brand",
  badgeText = "Aktif",
}: {
  name: string;
  role: string;
  stats: { label: string; value: string }[];
  avatar?: ReactNode;
  tone?: ButtonTone;
  badgeText?: string;
}) {
  return (
    <Card hover className="text-center">
      <div className="mx-auto grid size-18 place-items-center rounded-full border border-line bg-surface2 font-display text-2xl font-bold text-text">
        {avatar ?? name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
      </div>
      <h3 className="mt-4 font-display text-lg font-semibold tracking-tight">{name}</h3>
      <p className="mt-1 font-mono text-[12px] text-muted">{role}</p>
      <div className="mt-4 flex justify-center">
        <Badge tone={tone} dot size="lg">
          {badgeText}
        </Badge>
      </div>
      <div className="mt-6 flex items-stretch justify-center gap-2">
        {stats.map((s) => (
          <div key={s.label} className="flex-1 rounded-ctrl border border-line bg-surface2 px-3 py-2.5">
            <div className="font-display text-[15px] font-bold tracking-tight tabular-nums">{s.value}</div>
            <div className="mt-0.5 font-mono text-[10px] tracking-[0.1em] text-muted uppercase">{s.label}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}


export type AlertTone = "info" | "success" | "warning" | "danger" | "neutral";

const alertStyles: Record<AlertTone, { wrap: string; icon: ReactNode }> = {
  info: { wrap: "border-info/30 bg-infosoft text-info", icon: <Info size={18} /> },
  success: { wrap: "border-ok/30 bg-oksoft text-ok", icon: <Check size={18} strokeWidth={2.4} /> },
  warning: { wrap: "border-warn/30 bg-warnsoft text-warn", icon: <AlertTriangle size={18} /> },
  danger: { wrap: "border-danger/30 bg-dangersoft text-danger", icon: <AlertTriangle size={18} /> },
  neutral: { wrap: "border-line bg-surface2 text-text", icon: <Info size={18} /> },
};

export function Alert({
  tone = "info",
  title,
  children,
  action,
  onClose,
  className,
}: {
  tone?: AlertTone;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  onClose?: () => void;
  className?: string;
}) {
  const s = alertStyles[tone];
  return (
    <div className={cn("flex items-start gap-3.5 rounded-card border p-4", s.wrap, className)} role="alert">
      <span className="mt-px shrink-0">{s.icon}</span>
      <div className="min-w-0 flex-1">
        {title && <p className="text-[13.5px] leading-tight font-semibold tracking-tight">{title}</p>}
        {children && <div className={cn("mt-1 text-[12.5px] leading-snug", title && "opacity-85")}>{children}</div>}
        {action && <div className="mt-3">{action}</div>}
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="kapat"
          className="grid size-7 shrink-0 place-items-center rounded-full opacity-60 transition hover:bg-current/10 hover:opacity-100"
        >
          <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      )}
    </div>
  );
}


export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-card border border-dashed border-linestrong px-6 py-12 text-center",
        className,
      )}
    >
      <span className="relative grid size-16 place-items-center rounded-full border border-line bg-surface2 text-muted">
        <span className="absolute inset-0 rounded-full anim-ring" />
        {icon ?? <Sparkles size={24} />}
      </span>
      <h3 className="mt-5 font-display text-[18px] font-semibold tracking-tight text-text">{title}</h3>
      {description && <p className="mt-2 max-w-sm text-[13.5px] leading-relaxed text-muted">{description}</p>}
      {action && <div className="mt-6 flex flex-wrap justify-center gap-2.5">{action}</div>}
    </div>
  );
}


export function GaugeCard({
  title,
  value,
  tone = "brand",
  hint,
}: {
  title: string;
  value: number;
  tone?: "neutral" | "brand" | "success" | "warning" | "danger" | "info";
  hint?: string;
}) {
  return (
    <Card hover className="flex items-center gap-5 p-5.5">
      <Ring value={value} tone={tone} size={76} />
      <div className="min-w-0">
        <div className="font-display text-[15px] font-semibold tracking-tight">{title}</div>
        <div className="mt-1 text-[12.5px] leading-snug text-muted">{hint}</div>
      </div>
    </Card>
  );
}


export function ListRow({
  leading,
  title,
  description,
  trailing,
  onClick,
  className,
}: {
  leading?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  trailing?: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "flex items-center gap-3.5 rounded-card border border-transparent px-3.5 py-3 transition-all duration-200",
        onClick && "cursor-pointer hover:border-line hover:bg-surface2",
        className,
      )}
    >
      {leading && <span className="shrink-0">{leading}</span>}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-medium tracking-tight text-text">{title}</div>
        {description && <div className="mt-0.5 truncate text-[12px] text-muted">{description}</div>}
      </div>
      {trailing && <div className="shrink-0 text-right">{trailing}</div>}
    </div>
  );
}
