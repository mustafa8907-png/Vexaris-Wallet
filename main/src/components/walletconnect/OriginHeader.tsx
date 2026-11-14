import { t as $t } from "@/lib/i18n";
import { ShieldWarning, ShieldCheck, Shield } from "@phosphor-icons/react";
import { originBadge } from "@/lib/walletconnect/labels";
import type { WcOrigin } from "@/stores/walletConnectStore";
import { cn } from "@/lib/utils";

const TONES = {
  ok: "border-success/25 bg-success/[0.08] text-success",
  warn: "border-warning/25 bg-warning/[0.08] text-warning",
  danger: "border-danger/30 bg-danger/[0.1] text-danger",
} as const;

const ICONS = { ok: ShieldCheck, warn: Shield, danger: ShieldWarning } as const;

function host(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export function OriginHeader({
  origin,
  size = 40,
  className,
}: {
  origin: WcOrigin;
  size?: number;
  className?: string;
}) {
  const badge = originBadge(origin.validation, origin.isScam);
  const Icon = ICONS[badge.tone];

  return (
    <div className={cn("flex items-start gap-3", className)}>
      {origin.icons?.[0] ? (
        <img
          src={origin.icons[0]}
          alt=""
          width={size}
          height={size}
          className="shrink-0 rounded-xl border border-white/[0.08] bg-surface-800 object-cover"
          onError={(e) => {
            e.currentTarget.style.visibility = "hidden";
          }}
        />
      ) : (
        <div
          style={{ width: size, height: size }}
          className="grid shrink-0 place-items-center rounded-xl border border-white/[0.08] bg-surface-800 text-[13px] font-semibold text-zinc-300"
        >
          {origin.name.slice(0, 1).toUpperCase()}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-medium text-white">{origin.name}</div>
        {origin.url && (
          <div className="truncate text-[11px] text-zinc-500">{host(origin.url)}</div>
        )}
        <span
          className={cn(
            "mt-1.5 inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium",
            TONES[badge.tone],
          )}
        >
          <Icon size={11} />
          {badge.label}
        </span>
        {badge.tone === "danger" && (
          <p className="mt-1.5 text-[11px] leading-relaxed text-danger">
            {$t("Bu site Reown kara listesinde. Bağlanma ve imzalama.")}
          </p>
        )}
      </div>
    </div>
  );
}
