import { t as $t } from "@/lib/i18n";
import { useEffect, useState } from "react";
import { AlertTriangle, Loader, Shield } from "@/kit";
import { tokenRisk, type TokenRisk } from "@/lib/api/security";
import { cn } from "@/lib/utils";

const TONE = {
  safe: { icon: Shield, text: "text-ok", ring: "border-ok/25 bg-ok/[0.06]", label: $t("temiz") },
  warning: {
    icon: AlertTriangle,
    text: "text-warn",
    ring: "border-warn/25 bg-warn/[0.06]",
    label: $t("dikkatli ol"),
  },
  blocked: {
    icon: AlertTriangle,
    text: "text-danger",
    ring: "border-danger/25 bg-danger/[0.06]",
    label: $t("riskli — takas kapalı"),
  },
  unknown: {
    icon: Shield,
    text: "text-textsoft",
    ring: "border-line bg-surface2",
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
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
        {$t("Güvenlik denetimi")}
      </div>
      <div className={cn("mt-2 rounded-ctrl border px-2.5 py-2", tone.ring)}>
        <div className="flex items-center gap-2">
          {risk ? (
            <Icon size={13} className={cn("shrink-0", tone.text)} />
          ) : (
            <Loader size={13} className="shrink-0 animate-spin text-muted" />
          )}
          <span className={cn("text-[11px] font-medium", tone.text)}>
            {risk ? tone.label : $t("GoPlus sorgulanıyor…")}
          </span>
          <span className="ml-auto shrink-0 text-[10px] text-muted">GoPlus Labs</span>
        </div>
        {risk && risk.reasons.length > 0 && (
          <ul className="mt-1.5 space-y-1">
            {risk.reasons.map((reason) => (
              <li key={reason} className="text-[11px] leading-relaxed text-textsoft">
                · {reason}
              </li>
            ))}
          </ul>
        )}
        {risk?.level === "safe" && (
          <p className="mt-1.5 text-[10px] leading-relaxed text-muted">
            {$t("Honeypot, satış kilidi ve ağır vergi raporlanmadı.")}
          </p>
        )}
        {risk?.level === "unknown" && (
          <p className="mt-1.5 text-[10px] leading-relaxed text-muted">
            {$t("Bu sözleşme için güvenlik verisi yok; EVM ve Solana dışındaki ağlar denetlenemez.")}
          </p>
        )}
      </div>
    </div>
  );
}
