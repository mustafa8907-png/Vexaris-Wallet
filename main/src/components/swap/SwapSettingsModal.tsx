import { t as $t } from "@/lib/i18n";
import { Clock, Layers, Refresh, Settings, Sparkles } from "@/kit";
import { Modal, Segmented, Slider, Switch } from "@/kit";
import {
  DEADLINE_PRESETS,
  ENGINE_META,
  SLIPPAGE_PRESETS,
  type EngineId,
} from "@/lib/swap/config";
import { ROUTE_LABELS, type RoutePreference } from "@/lib/swap/engine";
import { useSwapStore } from "@/stores/swapStore";
import { cn, formatAmount } from "@/lib/utils";


export function SwapSettingsModal({
  onClose,
  onRandomPair,
}: {
  onClose: () => void;
  onRandomPair: () => void;
}) {
  const settings = useSwapStore((s) => s.settings);
  const patch = useSwapStore((s) => s.patchSettings);
  const reset = useSwapStore((s) => s.resetSettings);

  return (
    <Modal
      open
      title={$t("Takas ayarları")}
      description={$t("Değiştirmediğin sürece varsayılan değerler kullanılır.")}
      onClose={onClose}
      size="sm"
    >
      <div className="space-y-4">
        <Field
          icon={<Settings size={12} />}
          label={$t("Kayma toleransı")}
          value={`%${formatAmount(settings.slippagePct, 2)}`}
        >
          <div className="flex gap-1.5">
            {SLIPPAGE_PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => patch({ slippagePct: p })}
                className={cn(
                  "tabular flex-1 rounded-ctrl border px-2 py-1.5 text-[11px] font-medium transition-colors",
                  settings.slippagePct === p
                    ? "border-brand/45 bg-brandsoft text-brand"
                    : "border-line bg-surface2 text-muted hover:border-linestrong hover:text-text",
                )}
              >
                %{formatAmount(p, 1)}
              </button>
            ))}
          </div>
          <Slider
            value={settings.slippagePct}
            min={0.05}
            max={5}
            step={0.05}
            tone="brand"
            onChange={(v) => patch({ slippagePct: v })}
          />
          <p className="mt-1 text-[10px] leading-relaxed text-muted">
            {settings.slippagePct < 0.3
              ? $t("Dar tolerans: işlem geri alınabilir, ama kur korunur.")
              : settings.slippagePct > 2
                ? $t("Geniş tolerans: işlem kesin geçer, kur daha kötü olabilir.")
                : $t("Dengeli: çoğu çift için önerilen aralık.")}
          </p>
        </Field>

        <Field icon={<Clock size={12} />} label={$t("İşlem geçerlilik süresi")} value={$t("{0} dk", [settings.deadlineMinutes])}>
          <Segmented
            size="sm"
            fullWidth
            ariaLabel={$t("İşlem geçerlilik süresi")}
            value={String(settings.deadlineMinutes)}
            onChange={(v) => patch({ deadlineMinutes: Number(v) })}
            options={DEADLINE_PRESETS.map((d) => ({ value: String(d), label: $t("{0} dk", [d]) }))}
          />
        </Field>

        <Field icon={<Layers size={12} />} label={$t("Rota tercihi")} value={ROUTE_LABELS[settings.preference]}>
          <Segmented
            size="sm"
            fullWidth
            ariaLabel={$t("Rota tercihi")}
            value={settings.preference}
            onChange={(p) => patch({ preference: p as RoutePreference })}
            options={(["auto", "kyber", "intents"] as RoutePreference[]).map((p) => ({
              value: p,
              label: p === "auto" ? $t("Otomatik") : ENGINE_META[p as EngineId].short,
            }))}
          />
        </Field>

        <div className="rounded-card border border-line bg-surface2 p-3">
          <Switch
            checked={settings.autoRefresh}
            onChange={(v) => patch({ autoRefresh: v })}
            label={$t("Fiyatı otomatik yenile")}
            description={$t("Süre dolmadan yeni fiyat alınır")}
          />
        </div>

        <Field
          icon={<Refresh size={12} />}
          label={$t("Yenileme aralığı")}
          value={$t("{0} sn", [settings.refreshSeconds])}
          disabled={!settings.autoRefresh}
        >
          <Slider
            value={settings.refreshSeconds}
            min={10}
            max={60}
            step={5}
            onChange={(v) => patch({ refreshSeconds: v })}
          />
        </Field>

        <div className="rounded-card border border-line bg-surface2 p-3">
          <Switch
            checked={settings.securityCheck}
            onChange={(v) => patch({ securityCheck: v })}
            label={$t("Token güvenlik denetimi")}
            description={$t("GoPlus honeypot, satış kilidi ve ağır vergi raporlarsa takas yapılmaz")}
          />
        </div>

        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={onRandomPair}
            className="flex flex-1 items-center justify-center gap-2 rounded-ctrl border border-line bg-surface2 py-2 text-[11px] font-medium text-textsoft transition-colors hover:border-linestrong hover:text-text"
          >
            <Sparkles size={13} /> {$t("Rastgele çift dene")}
          </button>
          <button
            onClick={reset}
            className="flex items-center justify-center gap-1.5 rounded-ctrl border border-line bg-surface2 px-3 py-2 text-[11px] text-muted transition-colors hover:border-linestrong hover:text-text"
          >
            <Refresh size={12} /> {$t("Varsayılan")}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Field({
  icon,
  label,
  value,
  disabled,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-2", disabled && "opacity-50")}>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[11px] text-textsoft">
          <span className="text-muted">{icon}</span>
          {label}
        </span>
        <span className="tabular text-[11px] font-medium text-textsoft">{value}</span>
      </div>
      {children}
    </div>
  );
}
