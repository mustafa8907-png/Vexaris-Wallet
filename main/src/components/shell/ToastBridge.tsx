import { useEffect } from "react";
import { useToast } from "@/kit";
import { useToastStore, type ToastKind } from "@/stores/toastStore";

const toneFor: Record<ToastKind, "success" | "danger" | "info"> = {
  success: "success",
  error: "danger",
  info: "info",
};

const seenIds = new Set<number>();

export function ToastBridge() {
  const { push } = useToast();
  const toasts = useToastStore((s) => s.toasts);

  useEffect(() => {
    for (const t of toasts) {
      if (!seenIds.has(t.id)) {
        seenIds.add(t.id);
        push({ title: t.message, tone: toneFor[t.kind] });
      }
      useToastStore.getState().dismiss(t.id);
    }
  }, [toasts, push]);

  return null;
}
