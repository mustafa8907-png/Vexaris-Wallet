import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface PinInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  status?: "idle" | "error" | "success";
  autoFocus?: boolean;
  disabled?: boolean;
  className?: string;
}

export function PinInput({
  length = 6,
  value,
  onChange,
  onComplete,
  status = "idle",
  autoFocus = false,
  disabled = false,
  className,
}: PinInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const digits = value.replace(/\D/g, "").slice(0, length);
  const activeIndex = Math.min(digits.length, length - 1);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  function update(next: string) {
    const clean = next.replace(/\D/g, "").slice(0, length);
    onChange(clean);
    if (clean.length === length) onComplete?.(clean);
  }

  return (
    <div
      className={cn("relative", className)}
      onClick={() => inputRef.current?.focus()}
      role="group"
      aria-label={`${length} haneli PIN`}
    >
      <input
        ref={inputRef}
        value={digits}
        onChange={(e) => update(e.target.value)}
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={length}
        disabled={disabled}
        aria-label={`${length} haneli PIN`}
        className="absolute inset-0 z-10 h-full w-full cursor-text opacity-0"
        style={{ fontSize: 16 }}
      />

      <div
        className={cn(
          "flex items-center gap-2.5",
          status === "error" && "animate-shake",
        )}
      >
        {Array.from({ length }).map((_, i) => {
          const filled = i < digits.length;
          const isActive = !disabled && i === activeIndex && status !== "success";

          return (
            <div
              key={i}
              className={cn(
                "grid h-12 w-11 place-items-center rounded-xl border transition-colors duration-150",
                status === "error"
                  ? "border-danger/60 bg-danger/[0.06]"
                  : status === "success"
                    ? "border-success/50 bg-success/[0.06]"
                    : isActive
                      ? "border-accent/70 bg-surface-800"
                      : "border-white/[0.08] bg-surface-800/60",
              )}
            >
              {filled ? (
                <span
                  className={cn(
                    "h-2 w-2 rounded-full",
                    status === "error" ? "bg-danger" : status === "success" ? "bg-success" : "bg-white",
                  )}
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
