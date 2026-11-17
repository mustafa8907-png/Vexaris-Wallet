import { t as $t } from "@/lib/i18n";
import type { OrderStage } from "@/lib/swap/types";

export const STAGE_META: Record<
  OrderStage,
  { label: string; text: string; bg: string; border: string; dot: string; active: boolean; progress: number }
> = {
  hazirlaniyor: {
    label: $t("Hazırlanıyor"),
    text: "text-info",
    bg: "bg-info/[0.08]",
    border: "border-info/25",
    dot: "bg-info",
    active: true,
    progress: 8,
  },
  "yatirma-bekleniyor": {
    label: $t("Yatırma bekleniyor"),
    text: "text-warn",
    bg: "bg-warn/10",
    border: "border-warn/25",
    dot: "bg-warn",
    active: true,
    progress: 25,
  },
  gonderildi: {
    label: $t("Ağa gönderildi"),
    text: "text-info",
    bg: "bg-info/[0.08]",
    border: "border-info/25",
    dot: "bg-info",
    active: true,
    progress: 55,
  },
  isleniyor: {
    label: $t("İşleniyor"),
    text: "text-violet",
    bg: "bg-violet/[0.08]",
    border: "border-violet/25",
    dot: "bg-violet",
    active: true,
    progress: 78,
  },
  tamamlandi: {
    label: $t("Tamamlandı"),
    text: "text-ok",
    bg: "bg-ok/10",
    border: "border-ok/25",
    dot: "bg-ok",
    active: false,
    progress: 100,
  },
  iade: {
    label: $t("İade edildi"),
    text: "text-warn",
    bg: "bg-warn/10",
    border: "border-warn/25",
    dot: "bg-warn",
    active: false,
    progress: 100,
  },
  basarisiz: {
    label: $t("Başarısız"),
    text: "text-danger",
    bg: "bg-danger/[0.08]",
    border: "border-danger/25",
    dot: "bg-danger",
    active: false,
    progress: 100,
  },
  iptal: {
    label: $t("İptal edildi"),
    text: "text-muted",
    bg: "bg-surface2",
    border: "border-line",
    dot: "bg-muted",
    active: false,
    progress: 100,
  },
};

export const STAGE_FILTERS: (OrderStage | "all" | "active")[] = [
  "all",
  "active",
  "tamamlandi",
  "basarisiz",
  "iptal",
];

export const STAGE_FILTER_LABELS: Record<string, string> = {
  all: $t("Tümü"),
  active: $t("Süren"),
  tamamlandi: $t("Tamamlanan"),
  basarisiz: $t("Başarısız"),
  iptal: $t("İptal"),
};

export function isActive(stage: OrderStage): boolean {
  return STAGE_META[stage].active;
}