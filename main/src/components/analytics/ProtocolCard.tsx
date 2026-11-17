import { Card, Layers, Shield, Zap } from "@/kit";
import { ExternalLink } from "@/kit/ext";
import type { LlamaProtocol } from "@/lib/api/llamaMeta";
import { compactUsd } from "@/lib/utils";
import { t as $t } from "@/lib/i18n";

export function ProtocolCard({ protocol }: { protocol: LlamaProtocol | null }) {
  if (!protocol) return null;

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-[13px] font-semibold text-text">
          <Layers size={14} className="text-brand" /> {$t("DefiLlama protokolü")}
        </span>
        {protocol.url && (
          <a
            href={protocol.url}
            target="_blank"
            rel="noreferrer noopener"
            className="focus-ring inline-flex items-center gap-1 rounded text-[10px] text-muted transition-colors hover:text-text"
          >
            {protocol.name} <ExternalLink size={10} />
          </a>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <div className="rounded-card border border-line bg-surface2/60 p-3">
          <div className="flex items-center gap-1 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-muted">
            <Zap size={10} /> {$t("TVL")}
          </div>
          <div className="tabular mt-1.5 text-[14px] font-semibold text-text">
            {protocol.tvl > 0 ? compactUsd(protocol.tvl) : "—"}
          </div>
        </div>
        <div className="rounded-card border border-line bg-surface2/60 p-3">
          <div className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-muted">{$t("Kategori")}</div>
          <div className="mt-1.5 text-[13px] font-semibold text-text">{protocol.category ?? "—"}</div>
        </div>
        <div className="rounded-card border border-line bg-surface2/60 p-3">
          <div className="flex items-center gap-1 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-muted">
            <Shield size={10} /> {$t("Denetim")}{protocol.audits > 0 ? ` ${protocol.audits}` : ""}
          </div>
          <div className="mt-1.5 text-[13px] font-semibold text-text">
            {protocol.audits > 0 ? $t("Denetlenmiş") : $t("Kayıt yok")}
          </div>
        </div>
      </div>

      {protocol.chains.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {protocol.chains.slice(0, 8).map((c) => (
            <span key={c} className="rounded-xs border border-line bg-surface2 px-1.5 py-0.5 text-[9.5px] font-medium text-muted">
              {c}
            </span>
          ))}
          {protocol.chains.length > 8 && (
            <span className="rounded-xs border border-line bg-surface2 px-1.5 py-0.5 text-[9.5px] font-medium text-muted">
              +{protocol.chains.length - 8}
            </span>
          )}
        </div>
      )}
    </Card>
  );
}
