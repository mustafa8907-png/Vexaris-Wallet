import {
  forwardRef,
  useEffect,
  useRef,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "./cn";
import { Check, ChevronDown, Eye, Search, X } from "./icons";

const fieldBase =
  "w-full rounded-ctrl border bg-surface text-text placeholder:text-muted/80 " +
  "transition-[border-color,box-shadow,background-color] duration-200 " +
  "focus:outline-none focus:border-text/45 focus:shadow-[0_0_0_4px_var(--glow)]";

export type FieldTone = "default" | "error" | "success";
const toneRing: Record<FieldTone, string> = {
  default: "border-line hover:border-linestrong",
  error: "border-danger/60 focus:border-danger",
  success: "border-ok/50 focus:border-ok",
};

type FieldShellProps = {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  optional?: boolean;
  className?: string;
  children: ReactNode;
  htmlFor?: string;
};

export function Field({ label, hint, error, optional, className, children, htmlFor }: FieldShellProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <label
          htmlFor={htmlFor}
          className="flex items-center gap-2 px-1 text-[12.5px] font-semibold tracking-tight text-textsoft"
        >
          {label}
          {optional && <span className="text-[11px] font-normal text-muted">(isteğe bağlı)</span>}
        </label>
      )}
      {children}
      {(hint || error) && (
        <p
          className={cn(
            "flex items-center gap-1.5 px-1 text-[11.5px]",
            error ? "text-danger font-medium" : "text-muted",
          )}
        >
          {error ?? hint}
        </p>
      )}
    </div>
  );
}


export type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  optional?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  size?: "sm" | "md" | "lg";
  tone?: FieldTone;
  revealPassword?: boolean;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    label,
    hint,
    error,
    optional,
    iconLeft,
    iconRight,
    size = "md",
    tone = "default",
    className,
    id,
    type = "text",
    revealPassword,
    ...rest
  },
  ref,
) {
  const [visible, setVisible] = useState(false);
  const inputType = revealPassword ? (visible ? "text" : "password") : type;
  const height = size === "sm" ? "h-9 text-[13px]" : size === "lg" ? "h-14 text-[15px]" : "h-11 text-sm";
  const pad = iconLeft ? "pl-11" : "pl-4.5";
  const padR = iconRight || revealPassword ? "pr-11" : "pr-4.5";

  return (
    <Field label={label} hint={hint} error={error} optional={optional} htmlFor={id} className={className}>
      <div className="relative">
        {iconLeft && (
          <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted [&>svg]:size-[1.05em]">
            {iconLeft}
          </span>
        )}
        <input
          ref={ref}
          id={id}
          type={inputType}
          className={cn(
            fieldBase,
            height,
            pad,
            padR,
            toneRing[error ? "error" : tone],
            error && "border-danger/60",
          )}
          {...rest}
        />
        {(iconRight || revealPassword) && (
          <span className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted">
            {revealPassword ? (
              <button
                type="button"
                onClick={() => setVisible((v) => !v)}
                className="grid size-8 place-items-center rounded-ctrl transition hover:bg-surface2 hover:text-text"
                aria-label={visible ? "Şifreyi gizle" : "Şifreyi göster"}
              >
                <Eye />
              </button>
            ) : (
              <span className="grid size-8 place-items-center [&>svg]:size-[1.05em]">{iconRight}</span>
            )}
          </span>
        )}
      </div>
    </Field>
  );
});


export function SearchInput({
  value,
  onChange,
  placeholder = "Ara…",
  shortcut = "/",
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  shortcut?: string;
  className?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!shortcut) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && /^(input|textarea|select)$/i.test(t.tagName)) return;
      if (e.key === shortcut) {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shortcut]);

  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted" />
      <input
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(fieldBase, toneRing.default, "h-11 pr-14 pl-11 text-sm")}
      />
      <span className="absolute top-1/2 right-2.5 flex -translate-y-1/2 items-center gap-1">
        {value ? (
          <button
            type="button"
            onClick={() => onChange("")}
            className="grid size-7 place-items-center rounded-ctrl text-muted transition hover:bg-surface2 hover:text-text"
            aria-label="temizle"
          >
            <X size={14} />
          </button>
        ) : (
          shortcut && (
            <kbd className="hidden h-6 min-w-6 place-items-center rounded-ctrl border border-line bg-surface2 px-1.5 font-mono text-[10px] text-muted sm:grid">
              {shortcut}
            </kbd>
          )
        )}
      </span>
    </div>
  );
}


export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  optional?: boolean;
  max?: number;
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, optional, max, id, className, ...rest },
  ref,
) {
  return (
    <Field label={label} hint={hint} error={error} optional={optional} htmlFor={id}>
      <textarea
        ref={ref}
        id={id}
        maxLength={max}
        className={cn(
          fieldBase,
          "min-h-28 rounded-card px-4.5 py-3.5 text-sm leading-relaxed resize-y",
          toneRing[error ? "error" : "default"],
          className,
        )}
        {...rest}
      />
      {max && (
        <span className="self-end font-mono text-[11px] text-muted">
          {String(rest.value ?? "").length}/{max}
        </span>
      )}
    </Field>
  );
});


export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  optional?: boolean;
  options: { value: string; label: string }[];
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, error, optional, options, id, className, ...rest },
  ref,
) {
  return (
    <Field label={label} hint={hint} error={error} optional={optional} htmlFor={id}>
      <div className="relative">
        <select
          ref={ref}
          id={id}
          className={cn(
            fieldBase,
            toneRing[error ? "error" : "default"],
            "h-11 cursor-pointer appearance-none pr-11 pl-4.5 text-sm",
            className,
          )}
          {...rest}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value} className="bg-surface text-text">
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-muted" />
      </div>
    </Field>
  );
});


export function Checkbox({
  checked,
  onChange,
  label,
  description,
  disabled,
  tone = "neutral",
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  tone?: "neutral" | "brand" | "success";
}) {
  const active = tone === "brand" ? "bg-brand border-brand" : tone === "success" ? "bg-ok border-ok" : "bg-text border-text";
  return (
    <label
      className={cn(
        "group flex cursor-pointer items-start gap-3 select-none",
        disabled && "pointer-events-none opacity-45",
      )}
    >
      <span className="relative mt-px grid shrink-0">
        <input
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span
          className={cn(
            "grid size-5.5 place-items-center rounded-ctrl border-2 transition-all duration-200",
            checked ? cn(active, "text-bg") : "border-linestrong bg-surface group-hover:border-text/50",
            "peer-focus-visible:ring-2 peer-focus-visible:ring-brand peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-bg",
          )}
        >
          <Check
            size={13}
            className={cn("transition-transform duration-200", checked ? "scale-100" : "scale-50 opacity-0")}
            strokeWidth={3}
          />
        </span>
      </span>
      <span className="flex flex-col">
        <span className="text-[13.5px] leading-tight font-medium tracking-tight text-text">{label}</span>
        {description && <span className="mt-1 text-[12px] leading-snug text-muted">{description}</span>}
      </span>
    </label>
  );
}


export function Radio({
  checked,
  onChange,
  label,
  description,
  disabled,
  name,
  value,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  name?: string;
  value?: string;
}) {
  return (
    <label
      className={cn(
        "group flex cursor-pointer items-start gap-3 select-none",
        disabled && "pointer-events-none opacity-45",
      )}
    >
      <span className="relative mt-px grid shrink-0">
        <input
          type="radio"
          name={name}
          value={value}
          className="peer sr-only"
          checked={checked}
          disabled={disabled}
          onChange={() => onChange(true)}
        />
        <span
          className={cn(
            "grid size-5.5 place-items-center rounded-full border-2 transition-all duration-200",
            checked ? "border-text" : "border-linestrong bg-surface group-hover:border-text/50",
            "peer-focus-visible:ring-2 peer-focus-visible:ring-brand peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-bg",
          )}
        >
          <span
            className={cn(
              "size-2.5 rounded-full bg-text transition-transform duration-200",
              checked ? "scale-100" : "scale-0",
            )}
          />
        </span>
      </span>
      <span className="flex flex-col">
        <span className="text-[13.5px] leading-tight font-medium tracking-tight text-text">{label}</span>
        {description && <span className="mt-1 text-[12px] leading-snug text-muted">{description}</span>}
      </span>
    </label>
  );
}


export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
  size = "md",
  tone = "neutral",
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  size?: "sm" | "md";
  tone?: "neutral" | "brand" | "success";
}) {
  const dims =
    size === "sm"
      ? { track: "h-5.5 w-10", knob: "size-4", move: "translate-x-4.5" }
      : { track: "h-7 w-12.5", knob: "size-5", move: "translate-x-5.5" };
  const on = tone === "brand" ? "bg-brand" : tone === "success" ? "bg-ok" : "bg-text";
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-3 select-none",
        disabled && "pointer-events-none opacity-45",
      )}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={typeof label === "string" ? label : "Anahtarı değiştir"}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative inline-flex shrink-0 items-center rounded-ctrl border transition-colors duration-300",
          dims.track,
          checked ? cn(on, "border-transparent") : "border-line bg-surface3",
        )}
      >
        <span
          className={cn(
            "absolute left-1 inline-block rounded-full bg-surface shadow-1 transition-transform duration-300 ease-[cubic-bezier(.16,1,.3,1)]",
            dims.knob,
            checked ? dims.move : "translate-x-0",
            !checked && "bg-textsoft",
          )}
        />
      </button>
      {(label || description) && (
        <span className="flex flex-col">
          {label && <span className="text-[13.5px] leading-tight font-medium tracking-tight text-text">{label}</span>}
          {description && <span className="mt-1 text-[12px] leading-snug text-muted">{description}</span>}
        </span>
      )}
    </label>
  );
}


export function Slider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  label,
  unit = "",
  tone = "neutral",
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: ReactNode;
  unit?: string;
  tone?: "neutral" | "brand";
}) {
  const pct = ((value - min) / (max - min || 1)) * 100;
  const fill = tone === "brand" ? "var(--brand)" : "var(--text)";
  return (
    <div className="flex flex-col gap-2">
      {label && (
        <div className="flex items-center justify-between px-1">
          <span className="text-[12.5px] font-semibold tracking-tight text-textsoft">{label}</span>
          <span className="font-mono text-[12px] font-medium text-text tabular-nums">
            {value}
            {unit}
          </span>
        </div>
      )}
      <div className="relative flex h-6 items-center">
        <div className="absolute h-2 w-full rounded-ctrl bg-surface3" />
        <div className="absolute h-2 rounded-ctrl transition-[width] duration-100" style={{ width: `${pct}%`, background: fill }} />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="kit-range relative z-10 w-full appearance-none bg-transparent"
          style={{ ["--pct" as string]: `${pct}%`, ["--fill" as string]: fill }}
        />
      </div>
    </div>
  );
}


export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = "md",
  fullWidth = false,
  contrast = true,
  ariaLabel,
  className,
}: {
  options: { value: T; label: ReactNode; icon?: ReactNode; ariaLabel?: string }[];
  value: T;
  onChange: (v: T) => void;
  size?: "sm" | "md";
  fullWidth?: boolean;
  contrast?: boolean;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "no-scrollbar inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-ctrl border border-line bg-surface2 p-1",
        fullWidth && "flex w-full",
        className,
      )}
      role="tablist"
      aria-label={ariaLabel}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={o.ariaLabel ?? (typeof o.label === "string" ? o.label : undefined)}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-ctrl font-semibold tracking-tight whitespace-nowrap transition-all duration-150",
              fullWidth && "flex-1",
              size === "sm" ? "min-h-8.5 px-2.5 text-[11.5px]" : "min-h-10.5 px-3.5 text-[13px]",
              active
                ? contrast
                  ? "bg-text text-bg shadow-1"
                  : "bg-surface text-text shadow-1"
                : "text-muted hover:text-text",
            )}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}


export function OtpInput({
  length = 5,
  value,
  onChange,
}: {
  length?: number;
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const set = (i: number, v: string) => {
    const next = [...value];
    next[i] = v.slice(-1);
    onChange(next);
    if (v && i < length - 1) refs.current[i + 1]?.focus();
  };
  return (
    <div className="flex flex-wrap gap-2">
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={value[i] ?? ""}
          onChange={(e) => set(i, e.target.value.replace(/\D/g, ""))}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !value[i] && i > 0) refs.current[i - 1]?.focus();
          }}
          inputMode="numeric"
          maxLength={1}
          aria-label={`Doğrulama hanesi ${i + 1}`}
          className={cn(
            fieldBase,
            toneRing.default,
            "size-11 sm:size-12 text-center font-mono text-lg font-semibold",
            value[i] && "border-text/45",
          )}
        />
      ))}
    </div>
  );
}
