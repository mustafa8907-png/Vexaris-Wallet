/**
 * Protokol terimlerinin cüzdan arayüzündeki karşılıkları.
 *
 * Kullanıcı `eth_signTypedData_v4` bilmez; onay verdiği şeyi kendi dilinde
 * okumalı. Bilinmeyen yöntemler ham adıyla gösterilir — sessizce
 * çevirip yumuşatmak tehlikeli bir talebi maskeleyebilir.
 */
import { t as $t } from "@/lib/i18n";
import type { Verify } from "@walletconnect/types";

export function methodLabel(method: string): string {
  switch (method) {
    case "eth_accounts":
      return $t("Adreslerini gör");
    case "eth_sendTransaction":
      return $t("İşlem gönder");
    case "personal_sign":
      return $t("Mesaj imzala");
    case "eth_signTypedData_v4":
      return $t("Veri imzala");
    case "wallet_switchEthereumChain":
      return $t("Ağ değiştir");
    case "wallet_addEthereumChain":
      return $t("Yeni ağ ekle");
    case "eth_requestAccounts":
      return $t("Cüzdanını bağla");
    default:
      return method;
  }
}

export type Validation = Verify.Context["verified"]["validation"];

/** Reown'un dApp doğrulama sonucu; dolandırıcı kaydı ayrı ve daha ağır basar.
 *  `validation` tek başına yeterli sinyal değil: doğrulanmamış ama kayıtlı
 *  siteler de `VALID` alabiliyor, o yüzden `isScam` ayrıca değerlendirilir. */
export function originBadge(validation: Validation, isScam: boolean): {
  label: string;
  tone: "ok" | "warn" | "danger";
} {
  if (isScam) return { label: $t("Dolandırıcı olarak işaretli"), tone: "danger" };
  if (validation === "VALID") return { label: $t("Doğrulanmış uygulama"), tone: "ok" };
  if (validation === "INVALID") return { label: $t("Doğrulama başarısız"), tone: "danger" };
  return { label: $t("Doğrulanmamış uygulama"), tone: "warn" };
}
