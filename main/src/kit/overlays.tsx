import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "./cn";
import { AlertTriangle, Check, Info, X } from "./icons";


export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  const width = size === "sm" ? "max-w-sm" : size === "lg" ? "max-w-3xl" : "max-w-xl";

  return createPortal(
    <div className="fixed inset-0 z-100 flex items-end justify-center p-3 sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-bg/75 backdrop-blur-[4px] anim-pop"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "anim-pop relative w-full overflow-hidden rounded-card border border-line bg-surface shadow-2",
          width,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6 sm:py-5">
          <div className="min-w-0">
            {title && (
              <h2 className="font-display text-lg sm:text-xl leading-tight font-bold tracking-tight text-text">
                {title}
              </h2>
            )}
            {description && <p className="mt-1 text-[13px] leading-snug text-muted">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Pencereyi kapat"
            className="grid size-11 shrink-0 place-items-center rounded-ctrl border border-line bg-surface2 text-muted transition duration-150 hover:border-linestrong hover:text-text"
          >
            <X size={17} />
          </button>
        </div>
        {children && <div className="max-h-[70vh] overflow-y-auto px-5 py-4 sm:px-6 sm:py-5">{children}</div>}
        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-line bg-surface2/60 px-5 py-3.5 sm:px-6 sm:py-4">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}


export function Drawer({
  open,
  onClose,
  title,
  children,
  footer,
  side = "right",
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  side?: "left" | "right";
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-100">
      <div className="absolute inset-0 bg-bg/75 backdrop-blur-[4px] anim-pop" onClick={onClose} aria-hidden="true" />
      <aside
        role="dialog"
        aria-modal="true"
        className={cn(
          "absolute top-0 flex h-full w-full max-w-sm flex-col bg-surface shadow-2",
          side === "right" ? "right-0 border-l border-line anim-in-right" : "left-0 border-r border-line anim-pop",
        )}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div className="font-display text-lg font-bold tracking-tight">{title}</div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Paneli kapat"
            className="grid size-11 place-items-center rounded-ctrl border border-line bg-surface2 text-muted transition duration-150 hover:text-text"
          >
            <X size={17} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer && <div className="border-t border-line px-5 py-4">{footer}</div>}
      </aside>
    </div>,
    document.body,
  );
}


export type MenuItem = {
  label?: ReactNode;
  icon?: ReactNode;
  onSelect?: () => void;
  danger?: boolean;
  disabled?: boolean;
  separator?: boolean;
};

export function Dropdown({
  trigger,
  items,
  align = "start",
  className,
}: {
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode;
  items: MenuItem[];
  align?: "start" | "end";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className={cn("relative inline-block", className)}>
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      {open && (
        <div
          className={cn(
            "anim-pop absolute z-50 mt-2 min-w-56 overflow-hidden rounded-card border border-line bg-surface p-1.5 shadow-2",
            align === "end" ? "right-0" : "left-0",
          )}
          role="menu"
        >
          {items.map((item, i) =>
            item.separator ? (
              <div key={`sep-${i}`} className="my-1.5 h-px bg-line" />
            ) : (
              <button
                key={i}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  item.onSelect?.();
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-ctrl px-3 py-2 text-left text-[13.5px] font-medium tracking-tight transition-colors duration-150",
                  item.disabled
                    ? "cursor-not-allowed text-muted opacity-50"
                    : item.danger
                      ? "text-danger hover:bg-dangersoft"
                      : "text-textsoft hover:bg-surface2 hover:text-text",
                )}
              >
                {item.icon && <span className="shrink-0 [&>svg]:size-4">{item.icon}</span>}
                <span className="flex-1">{item.label}</span>
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}


export function Popover({
  trigger,
  children,
  align = "start",
}: {
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode;
  children: ReactNode;
  align?: "start" | "end";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);
  return (
    <div ref={ref} className="relative inline-block">
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      {open && (
        <div
          className={cn(
            "anim-pop absolute z-50 mt-2 w-72 rounded-card border border-line bg-surface p-4 shadow-2",
            align === "end" ? "right-0" : "left-0",
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}


export type ToastTone = "neutral" | "success" | "danger" | "warning" | "info";
export type ToastItem = {
  id: number;
  title: ReactNode;
  description?: ReactNode;
  tone: ToastTone;
  duration: number;
};

type ToastContextValue = {
  push: (t: { title: ReactNode; description?: ReactNode; tone?: ToastTone; duration?: number }) => number;
  dismiss: (id: number) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const toastTone: Record<ToastTone, { icon: ReactNode; accent: string }> = {
  neutral: { icon: <Info size={16} />, accent: "var(--text)" },
  success: { icon: <Check size={16} strokeWidth={2.4} />, accent: "var(--ok)" },
  danger: { icon: <AlertTriangle size={16} />, accent: "var(--danger)" },
  warning: { icon: <AlertTriangle size={16} />, accent: "var(--warn)" },
  info: { icon: <Info size={16} />, accent: "var(--info)" },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => setItems((list) => list.filter((t) => t.id !== id)), []);

  const push = useCallback<ToastContextValue["push"]>(
    ({ title, description, tone = "neutral", duration = 3800 }) => {
      const id = ++seq.current;
      setItems((list) => [...list.slice(-2), { id, title, description, tone, duration }]);
      window.setTimeout(() => dismiss(id), duration);
      return id;
    },
    [dismiss],
  );

  const value = useMemo(() => ({ push, dismiss }), [push, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-3 bottom-21 z-200 mx-auto flex w-auto max-w-[400px] flex-col gap-2 lg:bottom-5"
      >
        {items.map((t) => {
          const tone = toastTone[t.tone];
          return (
            <div
              key={t.id}
              className="anim-in-right pointer-events-auto relative overflow-hidden rounded-card border border-line bg-surface px-3.5 py-3 pr-12 shadow-2"
              role="status"
            >
              <span className="absolute top-0 bottom-0 left-0 w-1" style={{ background: tone.accent }} />
              <div className="flex items-start gap-2.5 pl-1">
                <span className="mt-0.5 shrink-0" style={{ color: tone.accent }}>
                  {tone.icon}
                </span>
                <div className="min-w-0">
                  <div className="text-[13px] leading-tight font-semibold tracking-tight text-text">{t.title}</div>
                  {t.description && (
                    <div className="mt-0.5 text-[12px] leading-snug text-muted">{t.description}</div>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Bildirimi kapat"
                className="absolute top-1.5 right-1.5 grid size-9 place-items-center rounded-full text-muted transition duration-150 hover:bg-surface2 hover:text-text"
              >
                <X size={14} />
              </button>
              <span
                className="absolute bottom-0 left-0 h-0.5 origin-left"
                style={{
                  background: tone.accent,
                  animation: `kit-toast-bar ${t.duration}ms linear forwards`,
                }}
              />
            </div>
          );
        })}
      </div>
      <style>{`@keyframes kit-toast-bar{from{width:100%}to{width:0%}}`}</style>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast, ToastProvider içinde kullanılmalıdır.");
  return ctx;
}
