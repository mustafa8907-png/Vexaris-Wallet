import { t as $t } from "@/lib/i18n";
import { useEffect, useState } from "react";
import { ShieldWarning, ShieldCheck, Shield } from "@phosphor-icons/react";
import { tokenRisk, type TokenRisk } from "@/lib/api/security";
import { cn } from "@/lib/utils";

/**
 * GoPlus güvenlik krokisi.
 *
 * Coin detayında tek istekle çalışır; aynı veri takas onayında da kullanılır
 * ve önbellekten geldiği için ikinci kez ağa sorulmaz.
 */

const TONE = {
  safe: { icon: ShieldCheck, text: "text-success", ring: "border-success/25 bg-success/[0.06]", label: $t("temiz") },
  warning: {
    icon: ShieldWarning,
    text: "text-warning",
    ring: "border-warning/25 bg-warning/[0.06]",
    label: $t("dikkatli ol"),
  },
  blocked: {
    icon: ShieldWarning,
    text: "text-danger",
    ring: "border-danger/25 bg-danger/[0.06]",
    label: $t("riskli — takas kapalı"),
  },
  unknown: {
    icon: Shield,
    text: "text-zinc-400",
    ring: "border-white/[0.08] bg-surface-800/70",
    label: $t("veri yok"),
  },
} as const;

export function TokenSafetyCard({ chainId, address }: { chainId: string; address?: string }) {
  const [risk, setRisk] = useState<TokenRisk | null>(null);

  useEffect(() => {
    let alive = true;
    setRisk(null);
    if (!address) return;
    void tokenRisk(chainId, address).then((value) => {
      if (alive) setRisk(value);
    });
    return () => {
      alive = false;
    };
  }, [chainId, address]);

  const tone = TONE[risk?.level ?? "unknown"];
  const Icon = tone.icon;

  return (
    <div className="mt-4">
      <div className="section-title">{$t("Güvenlik denetimi")}</div>
      <div className={cn("mt-2 rounded-lg border px-2.5 py-2", tone.ring)}>
        <div className="flex items-center gap-2">
          {risk ? (
            <Icon size={13} className={cn("shrink-0", tone.text)} />
          ) : (
            <span className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-zinc-600 border-t-zinc-300" />
          )}
          <span className={cn("text-[11px] font-medium", tone.text)}>
            {risk ? tone.label : $t("GoPlus sorgulanıyor…")}
          </span>
          <span className="ml-auto shrink-0 text-[10px] text-zinc-600">GoPlus Labs</span>
        </div>
        {risk && risk.reasons.length > 0 && (
          <ul className="mt-1.5 space-y-1">
            {risk.reasons.map((reason) => (
              <li key={reason} className="text-[11px] leading-relaxed text-zinc-400">
                · {reason}
              </li>
            ))}
          </ul>
        )}
        {risk?.level === "safe" && (
          <p className="mt-1.5 text-[10px] leading-relaxed text-zinc-600">
            {$t("Honeypot, satış kilidi ve ağır vergi raporlanmadı.")}
          </p>
        )}
        {risk?.level === "unknown" && (
          <p className="mt-1.5 text-[10px] leading-relaxed text-zinc-600">
            {$t("Bu sözleşme için güvenlik verisi yok; EVM ve Solana dışındaki ağlar denetlenemez.")}
          </p>
        )}
      </div>
    </div>
  );
}
