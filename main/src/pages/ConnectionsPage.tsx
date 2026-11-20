import { t as $t } from "@/lib/i18n";
import { useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { ArrowRight, X, Button, Card, Modal } from "@/kit";
import { Activity, Globe } from "@/kit/ext";
import { ChainIcon } from "@/components/TokenIcon";
import { OriginHeader } from "@/components/walletconnect/OriginHeader";
import { methodLabel } from "@/lib/walletconnect/labels";
import { chainLabel } from "@/lib/walletconnect/chains";
import { getChain } from "@/lib/chains/registry";
import { localeTag } from "@/lib/i18n";
import { useBrowserStore } from "@/stores/browserStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { toast } from "@/stores/toastStore";
import {
  useWalletConnectStore,
  type WcSession,
} from "@/stores/walletConnectStore";
import { shortAddress } from "@/lib/utils";

function SessionRow({ session, onDisconnect }: { session: WcSession; onDisconnect: () => void }) {
  const locale = useSettingsStore((s) => s.locale);
  const until = new Date(session.expiry * 1000).toLocaleDateString(localeTag(locale), {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <li className="rounded-card border border-line bg-surface2 p-3.5">
      <div className="flex items-start gap-3">
        <OriginHeader origin={session} size={36} className="min-w-0 flex-1" />
        <button
          onClick={onDisconnect}
          title={$t("Bağlantıyı kes")}
          aria-label={$t("{0} bağlantısını kes", [session.name])}
          className="shrink-0 rounded-ctrl p-1.5 text-muted transition-colors hover:bg-surface3 hover:text-danger"
        >
          <X size={14} />
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-1">
        {session.nonEvmOnly && (
          <span className="rounded-ctrl border border-warn/25 bg-warn/10 px-1.5 py-0.5 text-[10px] text-warn">
            {$t("EVM dışı ağ — bu cüzdan burada imzalama yapmaz")}
          </span>
        )}
        {session.chains.map((chain) => (
          <span
            key={chain}
            className="rounded-ctrl border border-line px-1.5 py-0.5 text-[10px] text-textsoft"
          >
            {chainLabel(chain)}
          </span>
        ))}
        {session.methods.map((method) => (
          <span key={method} className="rounded-ctrl bg-surface3 px-1.5 py-0.5 text-[10px] text-muted">
            {methodLabel(method)}
          </span>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted">
        <span className="font-mono">
          {session.accounts.length ? shortAddress(session.accounts[0], 4) : $t("EVM hesabı paylaşılmadı")}
        </span>
        <span>{$t("{0} tarihine kadar yetkili", [until])}</span>
      </div>
    </li>
  );
}

export function ConnectionsPage() {
  const { sessions, disconnect } = useWalletConnectStore();
  const connections = useBrowserStore((s) => s.connections);
  const disconnectSite = useBrowserStore((s) => s.disconnect);
  const sites = Object.values(connections).sort((a, b) => b.connectedAt - a.connectedAt);
  const [confirm, setConfirm] = useState<WcSession | null>(null);

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl px-3 pb-8 pt-4 sm:px-5">
        <h1 className="mb-1 font-display text-lg font-semibold tracking-tight text-text">
          {$t("Bağlantılar")}
        </h1>
        <p className="mb-5 text-xs text-muted">
          {$t("Cüzdanına bağlı uygulamalar, tarayıcı siteleri ve WalletConnect oturumları")}
        </p>

        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[13px] font-medium text-text">
              <Activity size={15} className="text-muted" />
              {$t("Açık oturumlar")}
            </div>
            <span className="text-[11px] text-muted">
              {$t("{0} bağlantı", [sessions.length])}
            </span>
          </div>

          {sessions.length === 0 ? (
            <div className="rounded-card border border-dashed border-line px-3 py-8 text-center">
              <p className="text-[12px] text-textsoft">{$t("Bağlı uygulama yok")}</p>
              <p className="mx-auto mt-1 max-w-[300px] text-[11px] leading-relaxed text-muted">
                {$t("Bir uygulamanın WalletConnect penceresindeki bağlantı adresini yapıştırdığında oturum burada görünür.")}
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {sessions.map((session) => (
                <SessionRow
                  key={session.topic}
                  session={session}
                  onDisconnect={() => setConfirm(session)}
                />
              ))}
            </ul>
          )}
        </Card>

        <Card className="mt-3 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[13px] font-medium text-text">
              <Globe size={15} className="text-muted" />
              {$t("Tarayıcı siteleri")}
            </div>
            <RouterLink
              to="/browser"
              className="flex items-center gap-1 rounded-ctrl px-1.5 py-1 text-[11px] text-brand transition-colors hover:text-brand"
            >
              {$t("Tarayıcıyı aç")} <ArrowRight size={12} />
            </RouterLink>
          </div>

          {sites.length === 0 ? (
            <div className="rounded-card border border-dashed border-line px-3 py-8 text-center">
              <p className="text-[12px] text-textsoft">{$t("Tarayıcıda bağlı site yok")}</p>
              <p className="mx-auto mt-1 max-w-[320px] text-[11px] leading-relaxed text-muted">
                {$t("Tarayıcı sekmesinden bir uygulama açtığında ve adresini paylaştığında site burada listelenir.")}
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {sites.map((site) => (
                <li
                  key={site.origin}
                  className="flex items-center gap-3 rounded-card border border-line bg-surface2 p-3"
                >
                  <ChainIcon chainId={site.chainKey} size={28} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12px] font-medium text-text">{site.name}</div>
                    <div className="truncate text-[10px] text-muted">{site.origin}</div>
                    <div className="mt-0.5 truncate font-mono text-[10px] text-ok/80">
                      {shortAddress(site.address, 5)} · {getChain(site.chainKey)?.name ?? site.chainKey}
                    </div>
                  </div>
                  <button
                    onClick={() => void disconnectSite(site.origin)}
                    title={$t("Bağlantıyı kes")}
                    aria-label={$t("{0} bağlantısını kes", [site.name])}
                    className="shrink-0 rounded-ctrl p-1.5 text-muted transition-colors hover:bg-surface3 hover:text-danger"
                  >
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {confirm && (
        <Modal
          open
          title={$t("Bağlantıyı kes")}
          description={$t("{0} ile olan oturum sonlandırılır. Uygulama yeniden bağlanmak isterse senden tekrar onay isteriz.", [confirm.name])}
          onClose={() => setConfirm(null)}
          size="sm"
        >
          <div className="mt-4 flex gap-2">
            <Button variant="soft" className="flex-1" onClick={() => setConfirm(null)}>
              {$t("Vazgeç")}
            </Button>
            <Button
              variant="soft"
              tone="danger"
              className="flex-1"
              iconLeft={<X size={14} />}
              onClick={async () => {
                await disconnect(confirm.topic);
                toast($t("{0} bağlantısı kesildi", [confirm.name]), "success");
                setConfirm(null);
              }}
            >
              {$t("Bağlantıyı kes")}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
