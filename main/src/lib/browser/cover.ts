import { useEffect } from "react";
import { useBrowserStore } from "@/stores/browserStore";

export function useBrowserCover(active: boolean) {
  const supported = useBrowserStore((s) => s.supported);

  useEffect(() => {
    if (!supported || !active) return;
    return useBrowserStore.getState().cover();
  }, [supported, active]);
}
