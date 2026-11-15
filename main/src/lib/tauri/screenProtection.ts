import { isTauri } from "./ipc";
import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

export async function setScreenProtection(enabled: boolean): Promise<void> {
  if (!isTauri()) return;

  await Promise.allSettled([
    getCurrentWindow().setContentProtected(enabled),
    tauriInvoke("plugin:vexwebview|set_secure", { enabled }),
  ]);
}
