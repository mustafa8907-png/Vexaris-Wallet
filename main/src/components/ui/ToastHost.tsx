import { X } from "@phosphor-icons/react";
import { useToastStore, type ToastKind } from "@/stores/toastStore";
import { cn } from "@/lib/utils";

const kindStyle: Record<ToastKind, string> = {
  info: "border-white/[0.1] bg-surface-800 text-zinc-200",
  success: "border-success/30 bg-surface-800 text-success",
  error: "border-danger/30 bg-surface-800 text-danger",
};

export function ToastHost() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[100] flex w-72 flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "pointer-events-auto flex animate-fade-up items-start justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-[13px] shadow-xl",
            kindStyle[t.kind],
          )}
        >
          <span>{t.message}</span>
          <button onClick={() => dismiss(t.id)} className="text-zinc-500 transition-colors hover:text-white">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
