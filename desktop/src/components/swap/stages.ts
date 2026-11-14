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
    text: "text-warning",
    bg: "bg-warning/[0.08]",
    border: "border-warning/25",
    dot: "bg-warning",
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
    text: "text-success",
    bg: "bg-success/[0.08]",
    border: "border-success/25",
    dot: "bg-success",
    active: false,
    progress: 100,
  },
  iade: {
    label: $t("İade edildi"),
    text: "text-warning",
    bg: "bg-warning/[0.08]",
    border: "border-warning/25",
    dot: "bg-warning",
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
    text: "text-zinc-400",
    bg: "bg-white/[0.04]",
    border: "border-white/[0.08]",
    dot: "bg-zinc-500",
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