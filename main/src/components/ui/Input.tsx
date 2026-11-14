import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  suffix?: ReactNode;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, suffix, error, className, ...rest }, ref) => (
    <label className="block">
      {label && <span className="mb-1.5 block text-xs font-medium text-zinc-400">{label}</span>}
      <div
        className={cn(
          "flex items-center gap-2 rounded-xl border bg-surface-800 px-3.5 transition-colors duration-150",
          "focus-within:border-accent/60",
          error ? "border-danger/50" : "border-white/[0.08] hover:border-white/[0.14]",
        )}
      >
        <input
          ref={ref}
          className={cn(
            "h-11 w-full bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-600",
            className,
          )}
          {...rest}
        />
        {suffix && <span className="shrink-0 text-xs text-zinc-500">{suffix}</span>}
      </div>
      {error && <span className="mt-1 block text-xs text-danger">{error}</span>}
    </label>
  ),
);
Input.displayName = "Input";
