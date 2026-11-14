import { t as $t } from "@/lib/i18n";
import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import { mockInvoke } from "./mock";

export function isTauri(): boolean {
  return "__TAURI_INTERNALS__" in window;
}

export async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (isTauri()) {
    return tauriInvoke<T>(cmd, args);
  }
  console.warn($t("[ipc] Tauri yok — mock yanıt: {0}", [cmd]));
  return mockInvoke(cmd, args) as Promise<T>;
}
