import { t as $t } from "@/lib/i18n";
import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Button,
  Card,
  ChevronRight,
  Copy,
  Divider,
  Eye,
  Input,
  Info,
  Link as LinkIcon,
  Loader,
  Lock,
  Modal,
  Palette,
  Plus,
  Segmented,
  Shield,
  Slider,
  Switch,
  Tabs,
  Trash,
  X,
  cn,
  useTheme,
} from "@/kit";
import { Globe, Key, Sliders } from "@/kit/ext";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { ChainIcon } from "@/components/TokenIcon";
import { NetworkDialog } from "@/components/NetworkDialog";
import { PageBody } from "@/components/layout/PageBody";
import { CHAINS } from "@/lib/chains/config";
import type { Chain } from "@/types/chain";
import { walletApi } from "@/lib/tauri/wallet";
import { setScreenProtection } from "@/lib/tauri/screenProtection";
import { useWalletStore } from "@/stores/walletStore";
import { useChainStore } from "@/stores/chainStore";
import { useBrowserStore } from "@/stores/browserStore";
import {
  useSettingsStore,
  type Currency,
} from "@/stores/settingsStore";
import type { ThemeMode } from "@/kit";
import { LOCALE_LABELS, LOCALES, type Locale } from "@/lib/i18n/locales";
import { toast } from "@/stores/toastStore";

type TabKey = "appearance" | "security" | "networks" | "connections" | "about";

const radiusPresets = (): { value: string; label: string }[] => [
  { value: "0", label: $t("Keskin") },
  { value: "12", label: $t("Yumuşak") },
  { value: "20", label: $t("Ekstra yumuşak") },
  { value: "999", label: $t("Hap") },
];

const SETTINGS_TABS: { value: TabKey; label: string; icon: ReactNode }[] = [
  { value: "appearance", label: $t("Görünüm"), icon: <Palette size={15} /> },
  { value: "security", label: $t("Güvenlik"), icon: <Shield size={15} /> },
  { value: "networks", label: $t("Ağlar"), icon: <Globe size={15} /> },
  { value: "connections", label: $t("Bağlantılar"), icon: <LinkIcon size={15} /> },
  { value: "about", label: $t("Hakkında"), icon: <Info size={15} /> },
];

function SettingRow({
  icon,
  title,
  hint,
  value,
  onClick,
  danger,
}: {
  icon: ReactNode;
  title: string;
  hint?: string;
  value?: string;
  onClick?: () => void;
  danger?: boolean;
}) {
  const classes = cn(
    "flex w-full items-center gap-3 rounded-card border border-line bg-surface2 px-3 py-3 text-left transition-colors",
    danger ? "hover:border-danger/35" : "hover:border-brand/35 hover:bg-surface3",
  );
  const inner = (
    <>
      <span className={cn("shrink-0", danger ? "text-danger" : "text-muted")}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate text-[13px]", danger ? "text-danger" : "text-text")}>{title}</span>
        {hint && <span className="block truncate text-[11px] text-muted">{hint}</span>}
      </span>
      {value && <span className="shrink-0 text-[11px] text-muted">{value}</span>}
      {onClick && <ChevronRight size={15} className="shrink-0 text-muted" />}
    </>
  );
  if (!onClick) return <div className={classes}>{inner}</div>;
  return (
    <button onClick={onClick} className={classes}>
      {inner}
    </button>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{title}</div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function RevealDialog({ onClose }: { onClose: () => void }) {
  const [password, setPassword] = useState("");
  const [words, setWords] = useState<string[] | null>(null);
  const [revealed, setRevealed] = useState(false);
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

  useEffect(() => {
    if (words && revealed) {
      setScreenProtection(true);
      return () => {
        setScreenProtection(false);
      };
    }
  }, [words, revealed]);

  if (words) {
    return (
      <Modal
        open
        title={$t("Kurtarma ifadesi")}
        description={$t("Bu kelimeleri kâğıda yazıp güvenli bir yerde sakla. Kimseyle paylaşma.")}
        onClose={onClose}
        size="md"
      >
        {revealed ? (
          <div className="grid grid-cols-3 gap-1.5">
            {words.map((word, i) => (
              <div
                key={`${word}-${i}`}
                className="flex items-baseline gap-1.5 rounded-ctrl border border-line bg-surface2 px-2 py-1.5"
              >
                <span className="text-[9px] tabular text-muted">{i + 1}</span>
                <span className="truncate font-mono text-[11px] text-textsoft">{word}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1.5">
            {words.map((_, i) => (
              <div
                key={`hidden-${i}`}
                className="flex items-center justify-center rounded-ctrl border border-dashed border-line bg-bg2/60 px-2 py-1.5 text-[11px] text-muted"
              >
                ••••••
              </div>
            ))}
          </div>
        )}

        <Alert tone="warning" className="!mt-3 !p-3">
          {$t("Vexaris Wallet bu ifadeyi asla sormaz. Ekran görüntüsü almayı ve panoya kopyalamayı önermiyoruz.")}
        </Alert>

        <div className="mt-4 flex gap-2">
          {revealed ? (
            <>
              <Button
                variant="soft"
                className="flex-1"
                iconLeft={<Copy size={14} />}
                onClick={() => {
                  void navigator.clipboard.writeText(words.join(" "));
                  toast($t("Kurtarma ifadesi kopyalandı"), "info");
                }}
              >
                {$t("Kopyala")}
              </Button>
              <Button variant="soft" className="flex-1" onClick={() => setRevealed(false)}>
                {$t("Gizle")}
              </Button>
            </>
          ) : (
            <Button className="w-full" iconLeft={<Eye size={14} />} onClick={() => setRevealed(true)}>
              {$t("Göster")}
            </Button>
          )}
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open
      title={$t("Kurtarma ifadesini göster")}
      description={$t("Devam etmek için cüzdan parolanı gir. PIN yeterli değil.")}
      onClose={onClose}
      size="sm"
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
          <Button variant="soft" className="flex-1" onClick={onClose}>
            {$t("Vazgeç")}
          </Button>
          <Button className="flex-1" disabled={busy || !password} onClick={() => void reveal()}>
            {busy ? <Loader size={14} className="animate-spin" /> : <Eye size={14} />}
            {busy ? $t("Doğrulanıyor…") : $t("Göster")}
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
      open
      title={$t("Cüzdanı sıfırla")}
      description={$t("Bu işlem geri alınamaz. Keystore cihazdan silinir; kurtarma ifaden yoksa varlıklarına erişemezsin.")}
      onClose={onClose}
      size="sm"
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
          <Button variant="soft" className="flex-1" onClick={onClose}>
            {$t("Vazgeç")}
          </Button>
          <Button
            variant="soft"
            tone="danger"
            className="flex-1"
            disabled={busy || !password}
            iconLeft={busy ? <Loader size={14} className="animate-spin" /> : <Trash size={14} />}
            onClick={() => void reset()}
          >
            {busy ? $t("Siliniyor…") : $t("Kalıcı olarak sil")}
          </Button>
        </div>
      </div>
    </Modal>
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
        "relative h-5 w-9 shrink-0 rounded-full transition-colors duration-150",
        on ? "bg-brand" : "bg-surface3",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-4 w-4 rounded-full bg-bg transition-all duration-150",
          on ? "left-[18px]" : "left-0.5",
        )}
      />
    </button>
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
    <li className="flex items-center gap-2.5 rounded-ctrl border border-line bg-surface2 px-2.5 py-2 transition-colors hover:border-linestrong">
      <ChainIcon chainId={chain.id} size={24} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[12px] font-medium text-text">{chain.name}</span>
          {chain.custom && <span className="chip shrink-0 text-violet">{$t("özel")}</span>}
          {!chain.blockscoutUrl && chain.kind === "evm" && (
            <span className="chip shrink-0 text-warn" title={$t("Bu ağda işlem geçmişi kaynağı yok")}>
              {$t("geçmiş yok")}
            </span>
          )}
        </div>
        <div className="truncate text-[10px] text-muted">
          {chain.nativeSymbol} · ID {chain.chainId ?? "—"}
          {chain.llamaChain ? ` · llama:${chain.llamaChain}` : $t(" · fiyat eşlemesi yok")}
        </div>
      </div>
      {onEdit && (
        <button
          onClick={onEdit}
          className="rounded-ctrl p-1.5 text-muted transition-colors hover:text-text"
          title={$t("Ağı düzenle")}
          aria-label={$t("{0} ağını düzenle", [chain.name])}
        >
          <Sliders size={13} />
        </button>
      )}
      {onDelete && (
        <button
          onClick={onDelete}
          className="rounded-ctrl p-1.5 text-muted transition-colors hover:text-danger"
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
  const unlocked = useWalletStore((st) => st.unlocked);
  const customChains = useChainStore((st) => st.customChains);
  const removeCustomChain = useChainStore((st) => st.removeCustomChain);
  const connections = useBrowserStore((st) => st.connections);
  const siteCount = Object.keys(connections).length;
  const { themeMode, setThemeMode, radius, setRadius } = useTheme();
  const [tab, setTab] = useState<TabKey>("appearance");
  const [dialog, setDialog] = useState<"reveal" | "reset" | null>(null);
  const [networkOpen, setNetworkOpen] = useState(false);
  const [editing, setEditing] = useState<Chain | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Chain | null>(null);
  const [version, setVersion] = useState("");

  useEffect(() => {
    let alive = true;
    import("@tauri-apps/api/app")
      .then((m) => m.getVersion())
      .then((v) => alive && setVersion(v))
      .catch(() => alive && setVersion("0.1.0"));
    return () => {
      alive = false;
    };
  }, []);

  function changeLocale(next: Locale) {
    if (next === s.locale) return;
    s.setLocale(next);
    window.location.reload();
  }

  return (
    <PageBody width="narrow">
        <h1 className="mb-1 text-lg font-semibold text-text">{$t("Ayarlar")}</h1>
        <p className="mb-4 text-xs text-muted">{$t("Cüzdan, görünüm, güvenlik ve ağ tercihleri")}</p>

        <div className="lg:grid lg:grid-cols-[210px_minmax(0,1fr)] lg:items-start lg:gap-6">
          <nav className="hidden lg:flex lg:flex-col lg:gap-1 lg:rounded-card lg:border lg:border-line lg:bg-surface lg:p-1.5">
            {SETTINGS_TABS.map(({ value, label, icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setTab(value)}
                className={cn(
                  "focus-ring flex items-center gap-2.5 rounded-ctrl px-3 py-2 text-left text-[13px] font-medium transition-colors",
                  tab === value
                    ? "bg-brandsoft text-brand ring-1 ring-inset ring-brand/20"
                    : "text-muted hover:bg-surface2 hover:text-text",
                )}
              >
                {icon}
                {label}
              </button>
            ))}
          </nav>

          <div className="min-w-0">
            <div className="lg:hidden">
              <Tabs
                variant="underline"
                value={tab}
                onChange={(v) => setTab(v as TabKey)}
                items={SETTINGS_TABS}
              />
            </div>

            <div className="mt-4 space-y-4">
          {tab === "appearance" && (
            <>
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <ProfileAvatar size={40} />
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-medium text-text">{s.walletName}</div>
                    <div className="text-[11px] text-muted">{$t("Yerel cüzdan · anahtar cihazda")}</div>
                  </div>
                </div>
                <div className="mt-3">
                  <Input
                    label={$t("Cüzdan adı")}
                    value={s.walletName}
                    onChange={(e) => s.setWalletName(e.target.value)}
                    onBlur={(e) => void renameWallet(e.target.value)}
                  />
                </div>
              </Card>

              <Group title={$t("Görünüm")}>
                <Card className="space-y-4 p-4">
                  <div>
                    <div className="mb-2 text-xs text-muted">{$t("Dil")}</div>
                    <Segmented
                      value={s.locale}
                      onChange={(v) => changeLocale(v as Locale)}
                      size="sm"
                      options={LOCALES.map((value) => ({ label: LOCALE_LABELS[value], value }))}
                    />
                    <p className="mt-2 text-[11px] text-muted">
                      {$t("Arayüz dili anında uygulanır; sayfa etiketleri yeniden yüklenir.")}
                    </p>
                  </div>
                  <div>
                    <div className="mb-2 text-xs text-muted">{$t("Tema")}</div>
                    <Segmented
                      value={themeMode}
                      onChange={(v) => setThemeMode(v as ThemeMode)}
                      size="sm"
                      options={[
                        { label: $t("Koyu"), value: "dark" },
                        { label: $t("Açık"), value: "light" },
                        { label: $t("Sistem"), value: "system" },
                      ]}
                    />
                  </div>
                  <div>
                    <div className="mb-2 text-xs text-muted">{$t("Para birimi")}</div>
                    <Segmented
                      value={s.currency}
                      onChange={(v) => s.setCurrency(v as Currency)}
                      size="sm"
                      options={[
                        { label: "USD", value: "USD" },
                        { label: "EUR", value: "EUR" },
                        { label: "TRY", value: "TRY" },
                      ]}
                    />
                  </div>
                  <div>
                    <div className="mb-2 text-xs text-muted">{$t("Köşe yarıçapı")}</div>
                    <Slider
                      value={radius}
                      onChange={setRadius}
                      min={0}
                      max={999}
                      step={1}
                      unit="px"
                      tone="brand"
                    />
                    <div className="mt-2">
                      <Segmented
                        value={String(radius)}
                        onChange={(v) => setRadius(Number(v))}
                        size="sm"
                        options={radiusPresets()}
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 pt-1">
                    <div className="min-w-0">
                      <div className="text-[12.5px] text-text">{$t("Bakiyeyi gizle")}</div>
                      <div className="text-[11px] text-muted">{$t("Tutarlar kalıcı olarak noktalı gösterilir.")}</div>
                    </div>
                    <Switch
                      size="sm"
                      tone="brand"
                      checked={s.hideBalance}
                      onChange={s.setHideBalance}
                    />
                  </div>
                </Card>
              </Group>
            </>
          )}

          {tab === "security" && (
            <Group title={$t("Güvenlik")}>
              <SettingRow
                icon={<Key size={15} />}
                title={$t("Kurtarma ifadesi")}
                hint={$t("Parola ile göster")}
                onClick={() => setDialog("reveal")}
              />
              <SettingRow
                icon={<Lock size={15} />}
                title={$t("Kilit durumu")}
                hint={$t("PIN veya parolan yalnızca bu cihazda; hiçbir sunucuya gönderilmez.")}
                value={unlocked ? $t("Cüzdan açık") : $t("Cüzdan kilitli")}
              />
              <div className="flex items-start gap-2 rounded-card border border-line bg-surface2 p-3 text-[11px] leading-relaxed text-muted">
                <Shield size={13} className="mt-px shrink-0 text-ok" />
                {$t(
                  "Anahtarlar cihazında, AES-256-GCM ile şifreli tutulur. Kilitlendiğinde oturumdaki mnemonic bellekten silinir. Ağ sorguları yalnızca herkese açık adresini kullanır; özel anahtar hiçbir uç nokta ile paylaşılmaz.",
                )}
              </div>
            </Group>
          )}

          {tab === "networks" && (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                  {$t("Yerleşik ağlar")}
                </div>
                <ul className="space-y-1">
                  {CHAINS.map((c) => (
                    <ChainRow key={c.id} chain={c} />
                  ))}
                </ul>
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                    {$t("Eklenen ağlar")} {customChains.length > 0 && `(${customChains.length})`}
                  </span>
                  <Button
                    size="sm"
                    iconLeft={<Plus size={13} />}
                    onClick={() => {
                      setEditing(null);
                      setNetworkOpen(true);
                    }}
                  >
                    {$t("Ağ ekle")}
                  </Button>
                </div>
                {customChains.length === 0 ? (
                  <div className="rounded-card border border-dashed border-line px-3 py-8 text-center">
                    <p className="text-[12px] text-textsoft">{$t("Henüz özel ağ eklenmedi")}</p>
                    <p className="mx-auto mt-1 max-w-[260px] text-[11px] leading-relaxed text-muted">
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
          )}

          {tab === "connections" && (
            <Group title={$t("Bağlantılar")}>
              <SettingRow
                icon={<LinkIcon size={15} />}
                title={$t("Uygulama bağlantıları")}
                hint={$t("WalletConnect ile bağlı uygulamaları yönet")}
                value={siteCount > 0 ? $t("{0} bağlantı", [siteCount]) : undefined}
                onClick={() => navigate("/connections")}
              />
            </Group>
          )}

          {tab === "about" && (
            <Group title={$t("Hakkında")}>
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <ProfileAvatar size={36} />
                  <div>
                    <div className="text-[13px] font-medium text-text">Vexaris Wallet</div>
                    <div className="text-[11px] text-muted">{$t("Çok zincirli, kendi kendine saklama cüzdanı")}</div>
                  </div>
                </div>
                <Divider className="my-3" />
                <div className="flex items-center justify-between py-1 text-[12px]">
                  <span className="text-muted">{$t("Sürüm")}</span>
                  <span className="font-mono text-textsoft">{version || "—"}</span>
                </div>
                <div className="flex items-center justify-between py-1 text-[12px]">
                  <span className="text-muted">{$t("Lisans")}</span>
                  <span className="font-mono text-textsoft">AGPL-3.0-only</span>
                </div>
              </Card>

              <Card className="border-danger/20 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-[13px] font-medium text-danger">{$t("Tehlikeli bölge")}</div>
                    <p className="mt-1 max-w-lg text-[11px] leading-relaxed text-muted">
                      {$t("Keystore dosyasını cihazdan siler. Kurtarma ifadesi olmadan bu cüzdana bir daha erişilemez.")}
                    </p>
                  </div>
                  <Button variant="soft" tone="danger" iconLeft={<Trash size={15} />} onClick={() => setDialog("reset")}>
                    {$t("Sıfırla")}
                  </Button>
                </div>
              </Card>
            </Group>
          )}
            </div>
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
          open
          title={$t("Ağı kaldır")}
          description={$t("{0} listeden silinir. Zincirdeki varlıkların etkilenmez; ağı yeniden ekleyebilirsin.", [confirmDelete.name])}
          onClose={() => setConfirmDelete(null)}
          size="sm"
        >
          <div className="flex gap-2">
            <Button variant="soft" className="flex-1" onClick={() => setConfirmDelete(null)}>
              {$t("Vazgeç")}
            </Button>
            <Button
              variant="soft"
              tone="danger"
              className="flex-1"
              iconLeft={<X size={14} />}
              onClick={() => {
                removeCustomChain(confirmDelete.id);
                toast($t("{0} kaldırıldı", [confirmDelete.name]), "success");
                setConfirmDelete(null);
              }}
            >
              {$t("Kaldır")}
            </Button>
          </div>
        </Modal>
      )}
    </PageBody>
  );
}
