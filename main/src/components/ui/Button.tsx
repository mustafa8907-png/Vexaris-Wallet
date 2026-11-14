import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

const variants: Record<Variant, string> = {
  primary:
    "bg-accent text-white hover:bg-accent-hover active:bg-accent-press disabled:bg-surface-700 disabled:text-zinc-500",
  secondary:
    "border border-white/[0.08] bg-surface-800 text-zinc-100 hover:border-white/[0.14] hover:bg-surface-700 disabled:opacity-50",
  ghost: "text-zinc-400 hover:bg-white/[0.04] hover:text-white disabled:opacity-50",
  danger:
    "border border-danger/25 bg-danger/[0.08] text-danger hover:bg-danger/[0.14] disabled:opacity-50",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-xs rounded-lg",
  md: "h-10 px-4 text-sm rounded-xl",
  lg: "h-12 px-5 text-sm rounded-xl",
};

export function Button({ variant = "primary", size = "md", className, children, ...rest }: ButtonProps) {
  return (
    <button
      className={cn(
        "focus-ring inline-flex select-none items-center justify-center gap-2 font-medium transition-colors duration-150 disabled:cursor-not-allowed",
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
