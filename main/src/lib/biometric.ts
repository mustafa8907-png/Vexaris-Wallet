import { biometricCipher, checkStatus } from "@tauri-apps/plugin-biometric";
import { t as $t } from "@/lib/i18n";
import { isTauri } from "@/lib/tauri/ipc";

const STORAGE_KEY = "vexaris-biometric-secret";

let availability: boolean | null = null;
let lastDecryptFailed = false;
let enrollFailed = false;

export async function biometricAvailable(): Promise<boolean> {
  if (!isTauri()) return false;
  if (availability !== null) return availability;
  try {
    const status = await checkStatus();
    availability = status.isAvailable;
  } catch {
    availability = false;
  }
  return availability;
}

export function hasBiometricSecret(): boolean {
  try {
    return Boolean(localStorage.getItem(STORAGE_KEY));
  } catch {
    return false;
  }
}

export function clearBiometricSecret() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
  lastDecryptFailed = false;
}

export async function shouldEnrollBiometric(): Promise<boolean> {
  if (enrollFailed) return false;
  if (!(await biometricAvailable())) return false;
  return !hasBiometricSecret() || lastDecryptFailed;
}

export async function enrollBiometric(secret: string): Promise<boolean> {
  if (!(await biometricAvailable())) return false;
  try {
    const encrypted = await biometricCipher($t("Cüzdanı biyometri ile aç"), {
      dataToEncrypt: secret,
      title: $t("Biyometrik doğrulama"),
      subtitle: $t("Cüzdanını açmak için kimliğini doğrula"),
      cancelTitle: $t("Vazgeç"),
      confirmationRequired: false,
      allowDeviceCredential: false,
    });
    if (!encrypted.data) return false;
    localStorage.setItem(STORAGE_KEY, encrypted.data);
    lastDecryptFailed = false;
    enrollFailed = false;
    return true;
  } catch {
    enrollFailed = true;
    return false;
  }
}

export async function decryptBiometricSecret(): Promise<string | null> {
  if (!(await biometricAvailable())) return null;
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (!stored) return null;
  try {
    const decrypted = await biometricCipher($t("Cüzdanı biyometri ile aç"), {
      dataToDecrypt: stored,
      title: $t("Biyometrik doğrulama"),
      subtitle: $t("Cüzdanını açmak için kimliğini doğrula"),
      cancelTitle: $t("Vazgeç"),
      confirmationRequired: false,
      allowDeviceCredential: false,
    });
    lastDecryptFailed = false;
    return decrypted.data || null;
  } catch (e) {
    const text = String(e).toLowerCase();
    const cancelled = ["usercancel", "systemcancel", "appcancel", "userfallback"].some((key) =>
      text.includes(key),
    );
    if (!cancelled) {
      clearBiometricSecret();
      lastDecryptFailed = true;
    }
    return null;
  }
}
