import { t as $t } from "@/lib/i18n";
import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { useBrowserStore } from "@/stores/browserStore";

interface Props {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  width?: "md" | "lg";
}

export function Modal({ title, description, onClose, children, width = "md" }: Props) {
  // Android'de dApp sekmesi native bir WebView'dir ve her HTML katmanının
  // üstünde çizilir; panel açıkken altındaki site gizlenir.
  useEffect(() => useBrowserStore.getState().cover(), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Üst çubuk gibi blur/filter içeren ebeveynler position:fixed'u kendi kutusuna
  // hapseder; panel bu yüzden document.body'ye porte edilir.
  return createPortal(
    <div
      className="fixed inset-0 z-[90] grid place-items-center bg-black/70 px-4 py-6 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "max-h-full w-full animate-fade-up overflow-y-auto rounded-xl2 border border-white/[0.09] bg-surface-850 p-5 shadow-lift",
          width === "lg" ? "max-w-2xl" : "max-w-md",
        )}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-white">{title}</h2>
            {description && (
              <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">{description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="focus-ring -mr-1 -mt-1 shrink-0 rounded-md p-1 text-zinc-500 transition-colors hover:text-white"
            aria-label={$t("Kapat")}
          >
            <X size={15} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
