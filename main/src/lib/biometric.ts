import { biometricCipher, checkStatus } from "@tauri-apps/plugin-biometric";
import { t as $t } from "@/lib/i18n";
import { isTauri } from "@/lib/tauri/ipc";

const STORAGE_KEY = "vexaris-biometric-secret";
const STATUS_TTL_MS = 8000;
const RETRY_AFTER_MS = 20000;

interface Status {
  available: boolean;
  checkedAt: number;
  reason?: string;
}

export interface BiometricResult {
  ok: boolean;
  error?: string;
}

let status: Status | null = null;
let lastEnrollAt = 0;
let lastDecryptFailed = false;

function readStored(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStored(value: string) {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {}
}

export function hasBiometricSecret(): boolean {
  return Boolean(readStored());
}

export function clearBiometricSecret() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
  lastDecryptFailed = false;
}

export async function biometricStatus(force = false): Promise<Status> {
  if (!isTauri()) return { available: false, checkedAt: Date.now(), reason: "not-tauri" };
  if (!force && status && Date.now() - status.checkedAt < STATUS_TTL_MS) return status;
  try {
    const result = await checkStatus();
    status = { available: result.isAvailable, checkedAt: Date.now(), reason: result.error };
  } catch (error) {
    status = { available: false, checkedAt: Date.now(), reason: String(error) };
  }
  return status;
}

export async function biometricAvailable(force = false): Promise<boolean> {
  return (await biometricStatus(force)).available;
}

export async function shouldEnrollBiometric(): Promise<boolean> {
  if (!(await biometricAvailable())) return false;
  if (Date.now() - lastEnrollAt < RETRY_AFTER_MS) return false;
  return !hasBiometricSecret() || lastDecryptFailed;
}

function promptOptions(allowDeviceCredential: boolean) {
  return {
    title: $t("Biyometrik doğrulama"),
    subtitle: $t("Cüzdanını açmak için kimliğini doğrula"),
    cancelTitle: $t("Vazgeç"),
    confirmationRequired: false,
    allowDeviceCredential,
    maxAttemps: 3,
  };
}

function isCancelled(error: unknown): boolean {
  const text = String(error).toLowerCase();
  return ["usercancel", "systemcancel", "appcancel", "userfallback", "negative"].some((key) =>
    text.includes(key),
  );
}

function isInvalidKey(error: unknown): boolean {
  const text = String(error).toLowerCase();
  return (
    text.includes("key") ||
    text.includes("invalid") ||
    text.includes("decrypt") ||
    text.includes("notauthenticated") ||
    text.includes("permanently")
  );
}

export async function enrollBiometric(secret: string): Promise<BiometricResult> {
  if (!secret) return { ok: false, error: "empty" };
  if (!(await biometricAvailable())) return { ok: false, error: "unavailable" };
  lastEnrollAt = Date.now();

  let lastError = "unknown";
  for (const allowDeviceCredential of [true, false]) {
    try {
      const encrypted = await biometricCipher($t("Cüzdanı biyometri ile aç"), {
        ...promptOptions(allowDeviceCredential),
        dataToEncrypt: secret,
      });
      if (!encrypted.data) {
        lastError = "empty";
        continue;
      }
      writeStored(encrypted.data);
      lastDecryptFailed = false;
      return { ok: true };
    } catch (error) {
      lastError = String(error);
      if (isCancelled(error)) return { ok: false, error: "cancelled" };
    }
  }
  return { ok: false, error: lastError };
}

export async function decryptBiometricSecret(): Promise<string | null> {
  if (!(await biometricAvailable())) return null;
  const stored = readStored();
  if (!stored) return null;

  for (const allowDeviceCredential of [true, false]) {
    try {
      const decrypted = await biometricCipher($t("Cüzdanı biyometri ile aç"), {
        ...promptOptions(allowDeviceCredential),
        dataToDecrypt: stored,
      });
      if (decrypted.data) {
        lastDecryptFailed = false;
        return decrypted.data;
      }
    } catch (error) {
      if (isCancelled(error)) return null;
      if (isInvalidKey(error)) {
        clearBiometricSecret();
        lastDecryptFailed = true;
        return null;
      }
    }
  }

  clearBiometricSecret();
  lastDecryptFailed = true;
  return null;
}

export function biometricNeedsReenroll(): boolean {
  return lastDecryptFailed;
}
