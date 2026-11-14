import { t as $t } from "@/lib/i18n";
import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Warning, CaretRight, Copy, Eye, Globe, Key, Link, Lock, Palette, PencilSimple, Plus, ShieldCheck, Trash, Wallet } from "@phosphor-icons/react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { ChainIcon } from "@/components/TokenIcon";
import { NetworkDialog } from "@/components/NetworkDialog";
import { CHAINS } from "@/lib/chains/config";
import type { Chain } from "@/types/chain";
import { walletApi } from "@/lib/tauri/wallet";
import { useWalletStore } from "@/stores/walletStore";
import { useChainStore } from "@/stores/chainStore";
import {
  useSettingsStore,
  type Currency,
  type Theme,
} from "@/stores/settingsStore";
import { LOCALE_LABELS, LOCALES, type Locale } from "@/lib/i18n/locales";
import { toast } from "@/stores/toastStore";
import { cn } from "@/lib/utils";

function Section({
  icon,
  title,
  children,
  className,
  action,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <Card className={cn("p-5", className)}>
      <div className="mb-3.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[13px] font-medium text-white">
          <span className="text-zinc-500">{icon}</span>
          {title}
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}

function Segmented<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-white/[0.07] bg-surface-800 p-0.5">
      {options.map((o) => (
        <button
          key={String(o.value)}
          onClick={() => onChange(o.value)}
          className={cn(
            "focus-ring rounded-md px-3 py-1.5 text-xs font-medium transition-colors duration-150",
            o.value === value ? "bg-surface-700 text-white" : "text-zinc-500 hover:text-zinc-200",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      role="switch"
      aria-checked={on}
      className={cn(
        "focus-ring relative h-5 w-9 shrink-0 rounded-full transition-colors duration-150",
        on ? "bg-accent" : "bg-surface-600",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all duration-150",
          on ? "left-[18px]" : "left-0.5",
        )}
      />
    </button>
  );
}

function RevealDialog({ onClose }: { onClose: () => void }) {
  const [password, setPassword] = useState("");
  const [words, setWords] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function reveal() {
    setBusy(true);
    setError(null);
    try {
      const phrase = await walletApi.revealMnemonic(password);
      setWords(phrase.trim().split(/\s+/));
    } catch (e) {
      setError(String(e).replace(/^Error: /, ""));
    } finally {
      setBusy(false);
    }
  }

  if (words) {
    return (
      <Modal
        title={$t("Kurtarma ifadesi")}
        description={$t("Bu kelimeleri kâğıda yazıp güvenli bir yerde sakla. Kimseyle paylaşma.")}
        onClose={onClose}
      >
        <div className="grid grid-cols-3 gap-1.5">
          {words.map((word, i) => (
            <div
              key={`${word}-${i}`}
              className="flex items-baseline gap-1.5 rounded-md border border-white/[0.06] bg-surface-800 px-2 py-1.5"
            >
              <span className="text-[9px] tabular text-zinc-600">{i + 1}</span>
              <span className="truncate font-mono text-[11px] text-zinc-200">{word}</span>
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-start gap-2 rounded-lg border border-warning/20 bg-warning/[0.06] p-2.5 text-[11px] leading-relaxed text-warning/90">
          <Warning size={13} className="mt-px shrink-0" />
          {$t("Vexaris Wallet bu ifadeyi asla sormaz. Ekran görüntüsü almayı ve panoya kopyalamayı önermiyoruz.")}
        </div>

        <div className="mt-4 flex gap-2">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => {
              void navigator.clipboard.writeText(words.join(" "));
              toast($t("Kurtarma ifadesi kopyalandı"), "info");
            }}
          >
            <Copy size={14} /> {$t("Kopyala")}
          </Button>
          <Button className="flex-1" onClick={onClose}>
            {$t("Gizle")}
          </Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      title={$t("Kurtarma ifadesini göster")}
      description={$t("Devam etmek için cüzdan parolanı gir. PIN yeterli değil.")}
      onClose={onClose}
    >
      <div className="flex flex-col gap-3">
        <Input
          type="password"
          placeholder={$t("Parola")}
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void reveal()}
          error={error ?? undefined}
        />
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            {$t("Vazgeç")}
          </Button>
          <Button className="flex-1" disabled={busy || !password} onClick={() => void reveal()}>
            <Eye size={14} /> {busy ? $t("Doğrulanıyor…") : $t("Göster")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function ResetDialog({ onClose }: { onClose: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function reset() {
    setBusy(true);
    setError(null);
    try {
      await walletApi.reset(password);
      localStorage.clear();
      sessionStorage.clear();
      window.location.hash = "#/welcome";
      window.location.reload();
    } catch (e) {
      setError(String(e).replace(/^Error: /, ""));
      setBusy(false);
    }
  }

  return (
    <Modal
      title={$t("Cüzdanı sıfırla")}
      description={$t("Bu işlem geri alınamaz. Keystore cihazdan silinir; kurtarma ifaden yoksa varlıklarına erişemezsin.")}
      onClose={onClose}
    >
      <div className="flex flex-col gap-3">
        <Input
          type="password"
          placeholder={$t("Parola")}
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void reset()}
          error={error ?? undefined}
        />
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            {$t("Vazgeç")}
          </Button>
          <Button
            variant="danger"
            className="flex-1"
            disabled={busy || !password}
            onClick={() => void reset()}
          >
            <Trash size={14} /> {busy ? $t("Siliniyor…") : $t("Kalıcı olarak sil")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function ChainRow({
  chain,
  onEdit,
  onDelete,
}: {
  chain: Chain;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const enabledChainIds = useChainStore((s) => s.enabledChainIds);
  const toggleEnabled = useChainStore((s) => s.toggleEnabled);
  const on = enabledChainIds.includes(chain.id);

  return (
    <li className="flex items-center gap-2.5 rounded-lg border border-white/[0.05] bg-surface-800/40 px-2.5 py-2 transition-colors hover:border-white/[0.12]">
      <ChainIcon chainId={chain.id} size={24} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[12px] font-medium text-zinc-100">{chain.name}</span>
          {chain.custom && <span className="chip shrink-0 text-violet">{$t("özel")}</span>}
          {!chain.blockscoutUrl && chain.kind === "evm" && (
            <span className="chip shrink-0 text-warning" title={$t("Bu ağda işlem geçmişi kaynağı yok")}>
              {$t("geçmiş yok")}
            </span>
          )}
        </div>
        <div className="truncate text-[10px] text-zinc-600">
          {chain.nativeSymbol} · ID {chain.chainId ?? "—"}
          {chain.llamaChain ? ` · llama:${chain.llamaChain}` : $t(" · fiyat eşlemesi yok")}
        </div>
      </div>
      {onEdit && (
        <button
          onClick={onEdit}
          className="focus-ring rounded-md p-1.5 text-zinc-500 transition-colors hover:text-white"
          title={$t("Ağı düzenle")}
          aria-label={$t("{0} ağını düzenle", [chain.name])}
        >
          <PencilSimple size={13} />
        </button>
      )}
      {onDelete && (
        <button
          onClick={onDelete}
          className="focus-ring rounded-md p-1.5 text-zinc-500 transition-colors hover:text-danger"
          title={$t("Ağı kaldır")}
          aria-label={$t("{0} ağını kaldır", [chain.name])}
        >
          <Trash size={13} />
        </button>
      )}
      <Toggle
        on={on}
        label={$t("{0} ağını aç/kapat", [chain.name])}
        onClick={() => {
          toggleEnabled(chain.id);
          toast(on ? $t("{0} devre dışı", [chain.name]) : `${chain.name} etkin`, "success");
        }}
      />
    </li>
  );
}

export function SettingsPage() {
  const s = useSettingsStore();
  const navigate = useNavigate();
  const renameWallet = useWalletStore((st) => st.rename);
  const customChains = useChainStore((st) => st.customChains);
  const removeCustomChain = useChainStore((st) => st.removeCustomChain);
  const [dialog, setDialog] = useState<"reveal" | "reset" | null>(null);
  const [networkOpen, setNetworkOpen] = useState(false);
  const [editing, setEditing] = useState<Chain | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Chain | null>(null);

  function changeLocale(next: Locale) {
    if (next === s.locale) return;
    s.setLocale(next);
    window.location.reload();
  }

  return (
    <div className="page">
      <div className="mx-auto max-w-4xl pb-6">
        <h1 className="mb-1 text-lg font-semibold text-white">{$t("Ayarlar")}</h1>
        <p className="mb-5 text-xs text-zinc-500">{$t("Cüzdan, görünüm, güvenlik ve ağ tercihleri")}</p>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <Section icon={<Wallet size={15} />} title={$t("Cüzdan")}>
            <div className="mb-3.5 flex items-center gap-3 rounded-lg border border-white/[0.06] bg-surface-800 p-3">
              <ProfileAvatar size={40} />
              <div className="min-w-0">
                <div className="truncate text-[13px] font-medium text-white">{s.walletName}</div>
                <div className="text-[11px] text-zinc-500">{$t("Yerel cüzdan · anahtar cihazda")}</div>
              </div>
            </div>
            <Input
              label={$t("Cüzdan adı")}
              value={s.walletName}
              onChange={(e) => s.setWalletName(e.target.value)}
              onBlur={(e) => void renameWallet(e.target.value)}
            />
          </Section>

          <Section icon={<Palette size={15} />} title={$t("Görünüm")}>
            <div className="space-y-4">
              <div>
                <div className="mb-2 text-xs text-zinc-500">{$t("Dil")}</div>
                <Segmented<Locale>
                  value={s.locale}
                  onChange={changeLocale}
                  options={LOCALES.map((value) => ({ label: LOCALE_LABELS[value], value }))}
                />
                <p className="mt-2 text-[11px] text-zinc-600">
                  {$t("Arayüz dili anında uygulanır; sayfa etiketleri yeniden yüklenir.")}
                </p>
              </div>
              <div>
                <div className="mb-2 text-xs text-zinc-500">{$t("Tema")}</div>
                <Segmented<Theme>
                  value={s.theme}
                  onChange={s.setTheme}
                  options={[
                    { label: $t("Koyu"), value: "dark" },
                    { label: $t("Açık"), value: "light" },
                  ]}
                />
                <p className="mt-2 text-[11px] text-zinc-600">
                  {s.theme === "light"
                    ? $t("Açık tema sonraki sürümde — şimdilik koyu görünüm kullanılıyor.")
                    : $t("Koyu tema etkin.")}
                </p>
              </div>
              <div>
                <div className="mb-2 text-xs text-zinc-500">{$t("Para birimi")}</div>
                <Segmented<Currency>
                  value={s.currency}
                  onChange={s.setCurrency}
                  options={[
                    { label: "USD", value: "USD" },
                    { label: "EUR", value: "EUR" },
                    { label: "TRY", value: "TRY" },
                  ]}
                />
              </div>
            </div>
          </Section>

          <Section icon={<Lock size={15} />} title={$t("Güvenlik")} className="lg:col-span-2">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <button
                  onClick={() => void useWalletStore.getState().lock()}
                  className="focus-ring flex w-full items-center justify-between rounded-lg border border-white/[0.06] bg-surface-800 px-3 py-2.5 text-left transition-colors hover:border-white/[0.14]"
                >
                  <span className="flex items-center gap-2 text-[13px] text-zinc-200">
                    <Lock size={14} className="text-zinc-500" />
                    {$t("Cüzdanı kilitle")}
                  </span>
                  <span className="text-[11px] text-zinc-500">{$t("Parola ile aç")}</span>
                </button>

                <button
                  onClick={() => setDialog("reveal")}
                  className="focus-ring mt-2 flex w-full items-center justify-between rounded-lg border border-white/[0.06] bg-surface-800 px-3 py-2.5 text-left transition-colors hover:border-white/[0.14]"
                >
                  <span className="flex items-center gap-2 text-[13px] text-zinc-200">
                    <Key size={14} className="text-zinc-500" />
                    {$t("Kurtarma ifadesi")}
                  </span>
                  <span className="text-[11px] text-zinc-500">{$t("Parola ile göster")}</span>
                </button>
              </div>

              <div className="flex items-start gap-2 rounded-lg bg-surface-800 p-3 text-[11px] leading-relaxed text-zinc-500">
                <ShieldCheck size={13} className="mt-px shrink-0 text-success" />
                {$t(
                  "Anahtarlar cihazında, AES-256-GCM ile şifreli tutulur. Kilitlendiğinde oturumdaki mnemonic bellekten silinir. Ağ sorguları yalnızca herkese açık adresini kullanır; özel anahtar hiçbir uç nokta ile paylaşılmaz.",
                )}
              </div>
            </div>
          </Section>

          <Section icon={<Link size={15} />} title={$t("Bağlantılar")}>
            <button
              onClick={() => navigate("/connections")}
              className="focus-ring flex w-full items-center justify-between gap-3 rounded-lg border border-white/[0.06] bg-surface-800 p-3 text-left transition-colors hover:border-white/[0.12]"
            >
              <span className="min-w-0">
                <span className="block text-[13px] text-zinc-200">{$t("Uygulama bağlantıları")}</span>
                <span className="block text-[11px] text-zinc-500">
                  {$t("WalletConnect ile bağlı uygulamaları yönet")}
                </span>
              </span>
              <CaretRight size={15} className="shrink-0 text-zinc-600" />
            </button>
          </Section>

          <Section
            icon={<Globe size={15} />}
            title={$t("Ağlar")}
            className="lg:col-span-2"
            action={
              <Button
                size="sm"
                onClick={() => {
                  setEditing(null);
                  setNetworkOpen(true);
                }}
              >
                <Plus size={13} /> Ağ ekle
              </Button>
            }
          >
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div>
                <div className="section-title mb-2">{$t("Yerleşik ağlar")}</div>
                <ul className="space-y-1">
                  {CHAINS.map((c) => (
                    <ChainRow key={c.id} chain={c} />
                  ))}
                </ul>
              </div>
              <div>
                <div className="section-title mb-2">
                  {$t("Eklenen ağlar")} {customChains.length > 0 && `(${customChains.length})`}
                </div>
                {customChains.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-white/[0.08] px-3 py-8 text-center">
                    <p className="text-[12px] text-zinc-400">{$t("Henüz özel ağ eklenmedi")}</p>
                    <p className="mx-auto mt-1 max-w-[260px] text-[11px] leading-relaxed text-zinc-600">
                      
                      {$t("Ağ ekle")} {$t("ile hazır listeden seç ya da kendi RPC adresini tanımla.")}
                    </p>
                  </div>
                ) : (
                  <ul className="space-y-1">
                    {customChains.map((c) => (
                      <ChainRow
                        key={c.id}
                        chain={c}
                        onEdit={() => {
                          setEditing(c);
                          setNetworkOpen(true);
                        }}
                        onDelete={() => setConfirmDelete(c)}
                      />
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </Section>

          <Card className="border-danger/20 p-5 lg:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[13px] font-medium text-danger">{$t("Tehlikeli bölge")}</div>
                <p className="mt-1 max-w-lg text-[11px] leading-relaxed text-zinc-500">
                  {$t("Keystore dosyasını cihazdan siler. Kurtarma ifadesi olmadan bu cüzdana bir daha erişilemez.")}
                </p>
              </div>
              <Button variant="danger" onClick={() => setDialog("reset")}>
                <Trash size={15} /> {$t("Sıfırla")}
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {dialog === "reveal" && <RevealDialog onClose={() => setDialog(null)} />}
      {dialog === "reset" && <ResetDialog onClose={() => setDialog(null)} />}
      {networkOpen && (
        <NetworkDialog
          editing={editing}
          onClose={() => {
            setNetworkOpen(false);
            setEditing(null);
          }}
        />
      )}
      {confirmDelete && (
        <Modal
          title={$t("Ağı kaldır")}
          description={$t("{0} listeden silinir. Zincirdeki varlıkların etkilenmez; ağı yeniden ekleyebilirsin.", [confirmDelete.name])}
          onClose={() => setConfirmDelete(null)}
        >
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setConfirmDelete(null)}>
              {$t("Vazgeç")}
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              onClick={() => {
                removeCustomChain(confirmDelete.id);
                toast($t("{0} kaldırıldı", [confirmDelete.name]), "success");
                setConfirmDelete(null);
              }}
            >
              <Trash size={14} /> {$t("Kaldır")}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
