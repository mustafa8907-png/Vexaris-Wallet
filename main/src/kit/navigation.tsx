import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cn } from "./cn";
import { ChevronDown, ChevronLeft, ChevronRight } from "./icons";


export type TabItem = { value: string; label: ReactNode; icon?: ReactNode; badge?: ReactNode };

export function Tabs({
  items,
  value,
  onChange,
  size = "md",
  variant = "pill",
  className,
}: {
  items: TabItem[];
  value: string;
  onChange: (v: string) => void;
  size?: "sm" | "md";
  variant?: "pill" | "underline";
  className?: string;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ left: 0, width: 0 });

  const measure = useCallback(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-tab="${value}"]`);
    if (el && listRef.current) setBox({ left: el.offsetLeft, width: el.offsetWidth });
  }, [value]);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure, items]);

  const h = size === "sm" ? "h-9 text-[12.5px]" : "h-11 text-[13.5px]";

  if (variant === "underline") {
    return (
      <div
        ref={listRef}
        className={cn("no-scrollbar relative flex max-w-full items-center gap-1 overflow-x-auto border-b border-line", className)}
      >
        {items.map((it) => (
          <button
            key={it.value}
            data-tab={it.value}
            type="button"
            onClick={() => onChange(it.value)}
            className={cn(
              "relative -mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-3.5 py-3 font-medium tracking-tight whitespace-nowrap transition-colors duration-200",
              value === it.value ? "border-text text-text" : "border-transparent text-muted hover:text-text",
            )}
          >
            {it.icon && <span className="[&>svg]:size-4">{it.icon}</span>}
            {it.label}
            {it.badge}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div
      ref={listRef}
      className={cn(
        "no-scrollbar relative inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-ctrl border border-line bg-surface2 p-1",
        size === "sm" ? "h-10" : "h-12",
        className,
      )}
      role="tablist"
    >
      <span
        className="pointer-events-none absolute top-1 bottom-1 rounded-ctrl bg-surface shadow-1 transition-all duration-350 ease-[cubic-bezier(.16,1,.3,1)]"
        style={{ left: box.left, width: box.width }}
      />
      {items.map((it) => (
        <button
          key={it.value}
          data-tab={it.value}
          type="button"
          role="tab"
          aria-selected={value === it.value}
          onClick={() => onChange(it.value)}
          className={cn(
            "relative z-1 inline-flex shrink-0 items-center gap-2 rounded-ctrl px-3.5 sm:px-4 font-medium tracking-tight whitespace-nowrap transition-colors duration-200",
            h,
            value === it.value ? "text-text" : "text-muted hover:text-textsoft",
          )}
        >
          {it.icon && <span className="[&>svg]:size-4">{it.icon}</span>}
          {it.label}
          {it.badge}
        </button>
      ))}
    </div>
  );
}


export function Breadcrumb({
  items,
  className,
}: {
  items: { label: ReactNode; href?: string; onClick?: () => void }[];
  className?: string;
}) {
  return (
    <nav aria-label="breadcrumb" className={cn("flex flex-wrap items-center gap-1 text-[13px]", className)}>
      {items.map((it, i) => {
        const last = i === items.length - 1;
        return (
          <span key={i} className="flex items-center gap-1">
            {last ? (
              <span className="rounded-ctrl bg-surface2 px-3 py-1.5 font-semibold tracking-tight text-text">
                {it.label}
              </span>
            ) : (
              <a
                href={it.href ?? "#"}
                onClick={(e) => {
                  e.preventDefault();
                  it.onClick?.();
                }}
                className="rounded-ctrl px-3 py-1.5 text-muted transition hover:bg-surface2 hover:text-text"
              >
                {it.label}
              </a>
            )}
            {!last && <ChevronRight size={14} className="text-linestrong" />}
          </span>
        );
      })}
    </nav>
  );
}


export function Pagination({
  page,
  total,
  onChange,
  siblingCount = 1,
}: {
  page: number;
  total: number;
  onChange: (p: number) => void;
  siblingCount?: number;
}) {
  const pages: (number | "…")[] = [];
  const from = Math.max(1, page - siblingCount);
  const to = Math.min(total, page + siblingCount);
  if (from > 1) {
    pages.push(1);
    if (from > 2) pages.push("…");
  }
  for (let i = from; i <= to; i++) pages.push(i);
  if (to < total) {
    if (to < total - 1) pages.push("…");
    pages.push(total);
  }

  return (
    <nav className="inline-flex items-center gap-1.5" aria-label="sayfalama">
      <button
        type="button"
        onClick={() => onChange(Math.max(1, page - 1))}
        disabled={page === 1}
        aria-label="önceki"
        className="grid size-9 sm:size-10 place-items-center rounded-ctrl border border-line bg-surface text-textsoft transition hover:-translate-y-px hover:border-linestrong disabled:pointer-events-none disabled:opacity-40"
      >
        <ChevronLeft size={16} />
      </button>
      {pages.map((p, i) =>
        p === "…" ? (
          <span key={`gap-${i}`} className="px-1 text-muted">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            aria-current={p === page ? "page" : undefined}
            className={cn(
              "h-9 sm:h-10 min-w-9 sm:min-w-10 rounded-ctrl px-3 font-mono text-[13px] font-medium tabular-nums transition-all duration-200",
              p === page
                ? "bg-text text-bg shadow-1"
                : "border border-line bg-surface text-textsoft hover:-translate-y-px hover:border-linestrong hover:text-text",
            )}
          >
            {p}
          </button>
        ),
      )}
      <button
        type="button"
        onClick={() => onChange(Math.min(total, page + 1))}
        disabled={page === total}
        aria-label="sonraki"
        className="grid size-9 sm:size-10 place-items-center rounded-ctrl border border-line bg-surface text-textsoft transition hover:-translate-y-px hover:border-linestrong disabled:pointer-events-none disabled:opacity-40"
      >
        <ChevronRight size={16} />
      </button>
    </nav>
  );
}


export function Accordion({
  items,
  defaultOpen = 0,
  className,
}: {
  items: { title: ReactNode; content: ReactNode }[];
  defaultOpen?: number | null;
  className?: string;
}) {
  const [open, setOpen] = useState<number | null>(defaultOpen);
  const uid = useId();
  return (
    <div className={cn("flex flex-col gap-2.5", className)}>
      {items.map((it, i) => {
        const isOpen = open === i;
        return (
          <div
            key={i}
            className={cn(
              "overflow-hidden rounded-card border transition-all duration-300",
              isOpen ? "border-linestrong bg-surface shadow-1" : "border-line bg-surface hover:border-linestrong",
            )}
          >
            <button
              type="button"
              aria-expanded={isOpen}
              aria-controls={`${uid}-panel-${i}`}
              onClick={() => setOpen(isOpen ? null : i)}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
            >
              <span className="text-[14px] font-semibold tracking-tight text-text">{it.title}</span>
              <span
                className={cn(
                  "grid size-8 shrink-0 place-items-center rounded-ctrl border border-line bg-surface2 text-textsoft transition-all duration-300",
                  isOpen && "rotate-180 border-transparent bg-text text-bg",
                )}
              >
                <ChevronDown size={15} />
              </span>
            </button>
            <div
              id={`${uid}-panel-${i}`}
              className="grid transition-[grid-template-rows] duration-350 ease-[cubic-bezier(.16,1,.3,1)]"
              style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
            >
              <div className="overflow-hidden">
                <div className="border-t border-line px-5 py-4 text-[13px] leading-relaxed text-textsoft">
                  {it.content}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}


export function Steps({
  steps,
  current,
  onStep,
  orientation = "horizontal",
}: {
  steps: string[];
  current: number;
  onStep?: (i: number) => void;
  orientation?: "horizontal" | "vertical";
}) {
  return (
    <ol
      className={cn(
        "flex gap-2",
        orientation === "vertical" ? "flex-col" : "flex-col sm:flex-row sm:items-center",
      )}
    >
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s} className="flex flex-1 items-center gap-2">
            <button
              type="button"
              onClick={() => onStep?.(i)}
              disabled={!onStep}
              className={cn(
                "flex items-center gap-2.5 rounded-ctrl border px-3.5 py-2 transition-all duration-200",
                active && "border-transparent bg-text text-bg shadow-1",
                done && "border-ok/40 bg-oksoft text-ok",
                !active && !done && "border-line bg-surface text-muted",
                onStep && "hover:-translate-y-px cursor-pointer",
              )}
            >
              <span
                className={cn(
                  "grid size-5.5 shrink-0 place-items-center rounded-full font-mono text-[10.5px] font-bold",
                  active ? "bg-bg/20 text-bg" : done ? "bg-ok text-white" : "bg-surface2 text-muted",
                )}
              >
                {done ? "✓" : i + 1}
              </span>
              <span className="text-[13px] font-semibold tracking-tight whitespace-nowrap">{s}</span>
            </button>
            {orientation === "horizontal" && i < steps.length - 1 && (
              <span className="hidden h-px flex-1 bg-line sm:block" />
            )}
          </li>
        );
      })}
    </ol>
  );
}


export function NavItem({
  icon,
  label,
  active = false,
  badge,
  onClick,
}: {
  icon?: ReactNode;
  label: ReactNode;
  active?: boolean;
  badge?: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative flex w-full items-center gap-3 rounded-ctrl px-4 py-2.5 text-[13.5px] font-medium tracking-tight transition-all duration-200",
        active ? "bg-surface2 text-text font-semibold" : "text-muted hover:bg-surface2/70 hover:text-text",
      )}
    >
      <span
        className={cn(
          "absolute top-1/2 left-1 h-0 w-1 -translate-y-1/2 rounded-full bg-brand transition-all duration-300",
          active && "h-4.5",
        )}
      />
      {icon && <span className={cn("[&>svg]:size-4.5 transition-colors", active && "text-text")}>{icon}</span>}
      <span className="flex-1 text-left">{label}</span>
      {badge}
    </button>
  );
}
