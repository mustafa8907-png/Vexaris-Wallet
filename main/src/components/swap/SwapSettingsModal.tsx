import { t as $t } from "@/lib/i18n";
import { DiceFive, Gauge, ArrowCounterClockwise, Path, Timer, Lightning } from "@phosphor-icons/react";
import { Modal } from "@/components/ui/Modal";
import {
  DEADLINE_PRESETS,
  ENGINE_META,
  SLIPPAGE_PRESETS,
  type EngineId,
} from "@/lib/swap/config";
import { ROUTE_LABELS, type RoutePreference } from "@/lib/swap/engine";
import { useSwapStore } from "@/stores/swapStore";
import { cn, formatAmount } from "@/lib/utils";

/**
 * Takas ayarları çekmecesi.
 *
 * Ekranı kalabalıklaştırmamak için tek bir dişli simgesinin arkasında durur;
 * açılana kadar hiçbir ayar görünmez ve varsayılan değerler geçerlidir.
 */

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
      title={$t("Takas ayarları")}
      description={$t("Değiştirmediğin sürece varsayılan değerler kullanılır.")}
      onClose={onClose}
    >
      <div className="space-y-4">
        <Field
          icon={<Gauge size={11} />}
          label={$t("Kayma toleransı")}
          value={`%${formatAmount(settings.slippagePct, 2)}`}
        >
          <div className="flex gap-1.5">
            {SLIPPAGE_PRESETS.map((p) => (
              <Chip key={p} active={settings.slippagePct === p} onClick={() => patch({ slippagePct: p })}>
                %{formatAmount(p, 1)}
              </Chip>
            ))}
          </div>
          <input
            type="range"
            min={0.05}
            max={5}
            step={0.05}
            value={settings.slippagePct}
            onChange={(e) => patch({ slippagePct: Number(e.target.value) })}
            aria-label={$t("Kayma toleransı kaydırıcısı")}
            className="vx-range mt-2.5 w-full"
          />
          <p className="mt-1 text-[10px] leading-relaxed text-zinc-600">
            {settings.slippagePct < 0.3
              ? $t("Dar tolerans: işlem geri alınabilir, ama kur korunur.")
              : settings.slippagePct > 2
                ? $t("Geniş tolerans: işlem kesin geçer, kur daha kötü olabilir.")
                : $t("Dengeli: çoğu çift için önerilen aralık.")}
          </p>
        </Field>

        <Field
          icon={<Timer size={11} />}
          label={$t("İşlem geçerlilik süresi")}
          value={$t("{0} dk", [settings.deadlineMinutes])}
        >
          <div className="flex gap-1.5">
            {DEADLINE_PRESETS.map((d) => (
              <Chip
                key={d}
                active={settings.deadlineMinutes === d}
                onClick={() => patch({ deadlineMinutes: d })}
              >
                {d} dk
              </Chip>
            ))}
          </div>
        </Field>

        <Field icon={<Path size={11} />} label={$t("Rota tercihi")} value={ROUTE_LABELS[settings.preference]}>
          <div className="grid grid-cols-3 gap-1 rounded-lg border border-white/[0.06] bg-surface-800 p-1">
            {(["auto", "kyber", "intents"] as RoutePreference[]).map((p) => (
              <button
                key={p}
                onClick={() => patch({ preference: p })}
                className={cn(
                  "focus-ring rounded-md px-1 py-1.5 text-[10px] font-medium transition-colors",
                  settings.preference === p
                    ? p === "kyber"
                      ? "bg-teal/[0.14] text-teal"
                      : p === "intents"
                        ? "bg-violet/[0.14] text-violet"
                        : "bg-accent-soft text-accent"
                    : "text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-200",
                )}
              >
                {p === "auto" ? $t("Otomatik") : ENGINE_META[p as EngineId].short}
              </button>
            ))}
          </div>
        </Field>

        <Toggle
          label={$t("Fiyatı otomatik yenile")}
          hint={$t("Süre dolmadan yeni fiyat alınır")}
          checked={settings.autoRefresh}
          onChange={(v) => patch({ autoRefresh: v })}
        />

        <Field
          icon={<Lightning size={11} />}
          label={$t("Yenileme aralığı")}
          value={$t("{0} sn", [settings.refreshSeconds])}
          disabled={!settings.autoRefresh}
        >
          <input
            type="range"
            min={10}
            max={60}
            step={5}
            value={settings.refreshSeconds}
            disabled={!settings.autoRefresh}
            onChange={(e) => patch({ refreshSeconds: Number(e.target.value) })}
            aria-label={$t("Yenileme aralığı kaydırıcısı")}
            className="vx-range w-full disabled:opacity-40"
          />
        </Field>

        <Toggle
          label={$t("Token güvenlik denetimi")}
          hint={$t("GoPlus honeypot, satış kilidi ve ağır vergi raporlarsa takas yapılmaz")}
          checked={settings.securityCheck}
          onChange={(v) => patch({ securityCheck: v })}
        />

        <Toggle
          label={$t("Test yürütmesi")}
          hint={$t("Gerçek fiyat ve rota, imza ile fon hareketi olmadan")}
          checked={settings.testMode}
          onChange={(v) => patch({ testMode: v })}
          tone="warning"
        />

        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={onRandomPair}
            className="focus-ring flex flex-1 items-center justify-center gap-2 rounded-lg border border-white/[0.07] bg-surface-800 py-2 text-[11px] font-medium text-zinc-300 transition-colors hover:border-accent/40 hover:text-white"
          >
            <DiceFive size={12} /> {$t("Rastgele çift dene")}
          </button>
          <button
            onClick={reset}
            className="focus-ring flex items-center justify-center gap-1.5 rounded-lg border border-white/[0.07] bg-surface-800 px-3 py-2 text-[11px] text-zinc-400 transition-colors hover:border-white/[0.16] hover:text-white"
          >
            <ArrowCounterClockwise size={11} /> {$t("Varsayılan")}
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
    <div className={cn(disabled && "opacity-55")}>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[11px] text-zinc-400">
          <span className="text-zinc-600">{icon}</span>
          {label}
        </span>
        <span className="tabular text-[11px] font-medium text-zinc-200">{value}</span>
      </div>
      {children}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "focus-ring tabular flex-1 rounded-lg border py-1.5 text-[11px] font-medium transition-colors",
        active
          ? "border-accent/45 bg-accent-soft text-accent"
          : "border-white/[0.07] bg-surface-800 text-zinc-400 hover:border-white/[0.16] hover:text-zinc-100",
      )}
    >
      {children}
    </button>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
  tone = "accent",
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  tone?: "accent" | "warning";
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      role="switch"
      aria-checked={checked}
      className="focus-ring flex w-full items-center gap-3 rounded-lg px-0.5 py-1 text-left"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] text-zinc-300">{label}</span>
        <span className="block text-[10px] leading-snug text-zinc-600">{hint}</span>
      </span>
      <span
        className={cn(
          "relative h-[18px] w-8 shrink-0 rounded-full transition-colors duration-200",
          checked ? (tone === "warning" ? "bg-warning/70" : "bg-accent") : "bg-surface-600",
        )}
      >
        <span
          className={cn(
            "absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white shadow transition-all duration-200",
            checked ? "left-[16px]" : "left-[2px]",
          )}
        />
      </span>
    </button>
  );
}
