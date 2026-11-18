import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  useState,
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { cn } from "./cn";
import { Loader } from "./icons";


export type ButtonVariant = "solid" | "soft" | "outline" | "ghost" | "link";
export type ButtonTone = "neutral" | "brand" | "success" | "warning" | "danger" | "info";
export type ButtonSize = "xs" | "sm" | "md" | "lg" | "xl";

const sizes: Record<ButtonSize, string> = {
  xs: "h-7 px-3 text-[11px] gap-1.5",
  sm: "h-9 px-4 text-[13px] gap-1.5",
  md: "h-11 px-5 text-sm gap-2",
  lg: "h-13 px-6 text-[15px] gap-2",
  xl: "h-16 px-8 text-base gap-2.5",
};

const iconSizes: Record<ButtonSize, string> = {
  xs: "size-7",
  sm: "size-9",
  md: "size-11",
  lg: "size-13",
  xl: "size-16",
};

const tones: Record<ButtonTone, Record<ButtonVariant, string>> = {
  neutral: {
    solid: "bg-text text-bg hover:bg-text/88 shadow-1",
    soft: "bg-surface2 text-text border border-line hover:border-linestrong hover:bg-surface3",
    outline: "border border-linestrong text-text hover:bg-surface2",
    ghost: "text-textsoft hover:text-text hover:bg-surface2",
    link: "text-text underline underline-offset-4 decoration-linestrong hover:decoration-text",
  },
  brand: {
    solid: "bg-brand text-white hover:brightness-110 shadow-1",
    soft: "bg-brandsoft text-brand border border-brand/30 hover:border-brand/60",
    outline: "border border-brand/45 text-brand hover:bg-brandsoft",
    ghost: "text-brand hover:bg-brandsoft",
    link: "text-brand underline underline-offset-4 hover:opacity-80",
  },
  success: {
    solid: "bg-ok text-white hover:brightness-110 shadow-1",
    soft: "bg-oksoft text-ok border border-ok/30 hover:border-ok/60",
    outline: "border border-ok/45 text-ok hover:bg-oksoft",
    ghost: "text-ok hover:bg-oksoft",
    link: "text-ok underline underline-offset-4 hover:opacity-80",
  },
  warning: {
    solid: "bg-warn text-white hover:brightness-110 shadow-1",
    soft: "bg-warnsoft text-warn border border-warn/30 hover:border-warn/60",
    outline: "border border-warn/45 text-warn hover:bg-warnsoft",
    ghost: "text-warn hover:bg-warnsoft",
    link: "text-warn underline underline-offset-4 hover:opacity-80",
  },
  danger: {
    solid: "bg-danger text-white hover:brightness-110 shadow-1",
    soft: "bg-dangersoft text-danger border border-danger/30 hover:border-danger/60",
    outline: "border border-danger/45 text-danger hover:bg-dangersoft",
    ghost: "text-danger hover:bg-dangersoft",
    link: "text-danger underline underline-offset-4 hover:opacity-80",
  },
  info: {
    solid: "bg-info text-white hover:brightness-110 shadow-1",
    soft: "bg-infosoft text-info border border-info/30 hover:border-info/60",
    outline: "border border-info/45 text-info hover:bg-infosoft",
    ghost: "text-info hover:bg-infosoft",
    link: "text-info underline underline-offset-4 hover:opacity-80",
  },
};

type CommonButtonProps = {
  variant?: ButtonVariant;
  tone?: ButtonTone;
  size?: ButtonSize;
  loading?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  fullWidth?: boolean;
  className?: string;
  children?: ReactNode;
};

const buttonBase =
  "relative inline-flex select-none items-center justify-center rounded-ctrl font-medium tracking-tight " +
  "transition-[transform,background-color,border-color,color,box-shadow,opacity] duration-200 ease-out " +
  "hover:-translate-y-px active:translate-y-0 active:scale-[0.985] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg " +
  "disabled:pointer-events-none disabled:border disabled:border-line disabled:bg-surface2 disabled:text-muted disabled:opacity-100 disabled:shadow-none whitespace-nowrap";

export type ButtonProps = CommonButtonProps &
  ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };
export type ButtonLinkProps = CommonButtonProps &
  AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

export function Button(props: ButtonProps | ButtonLinkProps) {
  const {
    variant = "solid",
    tone = "neutral",
    size = "md",
    loading = false,
    iconLeft,
    iconRight,
    fullWidth,
    className,
    children,
    ...rest
  } = props as CommonButtonProps & Record<string, unknown>;

  const classes = cn(
    buttonBase,
    sizes[size as ButtonSize],
    tones[tone as ButtonTone][variant as ButtonVariant],
    fullWidth && "w-full",
    loading && "pointer-events-none",
    className as string,
  );

  if (typeof (props as ButtonLinkProps).href === "string") {
    const { disabled: _disabled, ...anchorRest } = rest as AnchorHTMLAttributes<HTMLAnchorElement> & {
      disabled?: boolean;
    };
    return (
      <a className={classes} {...anchorRest}>
        <ButtonInner loading={loading} iconLeft={iconLeft} iconRight={iconRight}>
          {children}
        </ButtonInner>
      </a>
    );
  }

  const { href: _href, ...buttonRest } = rest as ButtonHTMLAttributes<HTMLButtonElement> & {
    href?: string;
  };
  return (
    <button
      className={classes}
      {...(buttonRest as ButtonHTMLAttributes<HTMLButtonElement>)}
      disabled={loading || Boolean((buttonRest as ButtonHTMLAttributes<HTMLButtonElement>).disabled)}
    >
      <ButtonInner loading={loading} iconLeft={iconLeft} iconRight={iconRight}>
        {children}
      </ButtonInner>
    </button>
  );
}

function ButtonInner({
  loading,
  iconLeft,
  iconRight,
  children,
}: {
  loading?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <>
      {loading ? (
        <Loader className="anim-spin" size={16} />
      ) : (
        iconLeft && <span className="shrink-0 [&>svg]:size-[1.05em]">{iconLeft}</span>
      )}
      <span className={cn(loading && "opacity-70")}>{children}</span>
      {!loading && iconRight && <span className="shrink-0 [&>svg]:size-[1.05em]">{iconRight}</span>}
    </>
  );
}


export type IconButtonProps = CommonButtonProps & ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  children: ReactNode;
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { variant = "soft", tone = "neutral", size = "md", className, label, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      aria-label={label}
      title={label}
      className={cn(buttonBase, iconSizes[size], tones[tone][variant], className)}
      {...rest}
    >
      <span className="[&>svg]:size-[1.15em]">{children}</span>
    </button>
  );
});


export function ButtonGroup({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 border border-line bg-surface p-1 rounded-ctrl shadow-1",
        className,
      )}
    >
      {children}
    </div>
  );
}


export type BadgeTone = ButtonTone | "muted";

const badgeTones: Record<BadgeTone, string> = {
  neutral: "bg-surface2 text-text border-line",
  muted: "bg-transparent text-muted border-line",
  brand: "bg-brandsoft text-brand border-brand/25",
  success: "bg-oksoft text-ok border-ok/25",
  warning: "bg-warnsoft text-warn border-warn/25",
  danger: "bg-dangersoft text-danger border-danger/25",
  info: "bg-infosoft text-info border-info/25",
};

export function Badge({
  tone = "neutral",
  dot = false,
  size = "md",
  className,
  children,
}: {
  tone?: BadgeTone;
  dot?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
  children?: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-ctrl border font-medium tracking-tight whitespace-nowrap",
        size === "sm" && "h-5 px-2 text-[10px]",
        size === "md" && "h-6.5 px-2.5 text-[11.5px]",
        size === "lg" && "h-8 px-3.5 text-[13px]",
        badgeTones[tone],
        className,
      )}
    >
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export function Chip({
  active = false,
  removable = false,
  onRemove,
  tone = "neutral",
  className,
  children,
  ...rest
}: {
  active?: boolean;
  removable?: boolean;
  onRemove?: () => void;
  tone?: BadgeTone;
  children?: ReactNode;
  className?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "group inline-flex h-9 items-center gap-2 rounded-ctrl border px-3.5 text-[13px] font-medium tracking-tight transition-all duration-200",
        "hover:-translate-y-px active:translate-y-0",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
        "disabled:pointer-events-none disabled:border-line disabled:bg-surface2 disabled:text-muted disabled:opacity-100 disabled:shadow-none",
        active
          ? "border-transparent bg-text text-bg shadow-1"
          : cn(badgeTones[tone], "hover:border-linestrong"),
        className,
      )}
      {...rest}
    >
      {children}
      {removable && (
        <span
          role="button"
          tabIndex={-1}
          onClick={(e) => {
            e.stopPropagation();
            onRemove?.();
          }}
          className="grid size-4.5 place-items-center rounded-full opacity-55 transition duration-200 group-hover:opacity-100 hover:scale-115 active:scale-95"
        >
          <svg viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </span>
      )}
    </button>
  );
}

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-grid h-6 min-w-6 place-items-center rounded-ctrl border border-line bg-surface2 px-1.5 font-mono text-[10.5px] font-medium text-muted shadow-[0_1px_0_var(--line-strong)]",
        className,
      )}
    >
      {children}
    </kbd>
  );
}


export type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";
const avatarSizes: Record<AvatarSize, string> = {
  xs: "size-6 text-[10px]",
  sm: "size-8 text-[11px]",
  md: "size-10 text-[13px]",
  lg: "size-14 text-base",
  xl: "size-20 text-2xl",
};

export function Avatar({
  src,
  name,
  size = "md",
  status,
  className,
}: {
  src?: string;
  name?: string;
  size?: AvatarSize;
  status?: "online" | "away" | "busy" | "offline";
  className?: string;
}) {
  const initials = (name ?? "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toLocaleUpperCase())
    .join("");
  const statusColor =
    status === "online"
      ? "bg-ok"
      : status === "away"
        ? "bg-warn"
        : status === "busy"
          ? "bg-danger"
          : "bg-muted";
  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      {src ? (
        <img
          src={src}
          alt={name ?? "avatar"}
          className={cn(
            avatarSizes[size],
            "rounded-ctrl object-cover ring-1 ring-line bg-surface2",
          )}
        />
      ) : (
        <span
          className={cn(
            avatarSizes[size],
            "grid place-items-center rounded-ctrl border border-line bg-surface2 font-semibold tracking-tight text-textsoft",
          )}
        >
          {initials}
        </span>
      )}
      {status && (
        <span
          className={cn(
            "absolute right-0 bottom-0 size-[26%] min-h-2 min-w-2 rounded-full ring-2 ring-surface",
            statusColor,
          )}
        />
      )}
    </span>
  );
}

export function AvatarGroup({
  people,
  max = 4,
  size = "sm",
}: {
  people: { name: string; src?: string }[];
  max?: number;
  size?: AvatarSize;
}) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return (
    <div className="flex items-center">
      {shown.map((p, i) => (
        <span key={p.name + i} className={cn(i > 0 && "-ml-2.5")} style={{ zIndex: 10 - i }}>
          <Avatar name={p.name} src={p.src} size={size} className="ring-2 ring-surface rounded-ctrl" />
        </span>
      ))}
      {rest > 0 && (
        <span
          className={cn(
            avatarSizes[size],
            "-ml-2.5 grid place-items-center rounded-ctrl border border-line bg-surface3 text-[11px] font-semibold text-textsoft ring-2 ring-surface",
          )}
        >
          +{rest}
        </span>
      )}
    </div>
  );
}


export function Spinner({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cn("inline-block anim-spin rounded-full border-2 border-current border-t-transparent", className)}
      style={{ width: size, height: size }}
      role="status"
      aria-label="yükleniyor"
    />
  );
}

export function Progress({
  value = 0,
  tone = "neutral",
  size = "md",
  striped = false,
  className,
}: {
  value?: number;
  tone?: "neutral" | "brand" | "success" | "warning" | "danger" | "info";
  size?: "sm" | "md" | "lg";
  striped?: boolean;
  className?: string;
}) {
  const fill = {
    neutral: "bg-text",
    brand: "bg-brand",
    success: "bg-ok",
    warning: "bg-warn",
    danger: "bg-danger",
    info: "bg-info",
  }[tone];
  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-ctrl bg-surface3",
        size === "sm" && "h-1.5",
        size === "md" && "h-2.5",
        size === "lg" && "h-4",
        className,
      )}
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn("h-full rounded-ctrl transition-[width] duration-700 ease-out", fill)}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      >
        {striped && (
          <div className="h-full w-full rounded-ctrl opacity-30 bg-[repeating-linear-gradient(115deg,transparent_0_6px,currentColor_6px_12px)]" />
        )}
      </div>
    </div>
  );
}

export function Ring({
  value = 0,
  size = 72,
  stroke = 7,
  tone = "brand",
  label,
}: {
  value?: number;
  size?: number;
  stroke?: number;
  tone?: "neutral" | "brand" | "success" | "warning" | "danger" | "info";
  label?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const color = {
    neutral: "var(--text)",
    brand: "var(--brand)",
    success: "var(--ok)",
    warning: "var(--warn)",
    danger: "var(--danger)",
    info: "var(--info)",
  }[tone];
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (c * Math.max(0, Math.min(100, value))) / 100}
          style={{ transition: "stroke-dashoffset .8s cubic-bezier(.16,1,.3,1)" }}
        />
      </svg>
      <span className="absolute font-mono text-[13px] font-semibold tabular-nums">
        {label ?? `${Math.round(value)}%`}
      </span>
    </div>
  );
}

export function Rating({
  value = 0,
  onChange,
  max = 5,
  size = 20,
}: {
  value?: number;
  onChange?: (v: number) => void;
  max?: number;
  size?: number;
}) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div className="inline-flex items-center gap-1" onMouseLeave={() => setHover(0)}>
      {Array.from({ length: max }).map((_, i) => {
        const filled = i < shown;
        return (
          <button
            key={i}
            type="button"
            disabled={!onChange}
            onMouseEnter={() => onChange && setHover(i + 1)}
            onClick={() => onChange?.(i + 1)}
            className={cn(
              "rounded-ctrl p-0.5 transition-transform duration-200",
              onChange && "hover:scale-125 active:scale-95 cursor-pointer",
            )}
            aria-label={`${i + 1} yıldız`}
          >
            <svg
              width={size}
              height={size}
              viewBox="0 0 24 24"
              fill={filled ? "var(--warn)" : "none"}
              stroke={filled ? "var(--warn)" : "var(--line-strong)"}
              strokeWidth={1.6}
              strokeLinejoin="round"
            >
              <path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1.1 5.9L12 16.9 6.7 19.7l1.1-5.9L3.5 9.7l5.9-.8Z" />
            </svg>
          </button>
        );
      })}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("relative overflow-hidden rounded-ctrl bg-surface3", className)}>
      <div className="absolute inset-0 -translate-x-full bg-[linear-gradient(90deg,transparent,var(--sheen),transparent)] motion-safe:animate-[kit-shimmer_1.6s_infinite]" />
    </div>
  );
}


export function Tooltip({
  label,
  side = "top",
  children,
}: {
  label: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const pos = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  }[side];
  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <span aria-describedby={open ? id : undefined} className="inline-flex">
        {children}
      </span>
      {open && (
        <span
          role="tooltip"
          id={id}
          className={cn(
            "anim-pop pointer-events-none absolute z-50 whitespace-nowrap rounded-ctrl border border-line bg-surface px-3 py-1.5 text-[12px] font-medium text-text shadow-2",
            pos,
          )}
        >
          {label}
        </span>
      )}
    </span>
  );
}


export function Divider({ className, label }: { className?: string; label?: ReactNode }) {
  if (!label) return <hr className={cn("h-px w-full border-0 bg-line", className)} />;
  return (
    <div className={cn("flex items-center gap-3 text-[11px] font-medium text-muted", className)}>
      <span className="h-px flex-1 bg-line" />
      <span className="uppercase tracking-[0.18em]">{label}</span>
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}


export function CountUp({ to, duration = 1200, suffix = "" }: { to: number; duration?: number; suffix?: string }) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    let raf = 0;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const p = Math.min(1, (now - start) / duration);
          setVal(to * (1 - Math.pow(1 - p, 3)));
          if (p < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );
    io.observe(node);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [to, duration]);
  return (
    <span ref={ref} className="tabular-nums">
      {Math.round(val)}
      {suffix}
    </span>
  );
}
