import { t as $t } from "@/lib/i18n";
import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Warning, Check, CaretLeft, TrayArrowDown, Info, Lock, ShieldCheck, Wallet, X } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PinInput } from "@/components/ui/PinInput";
import { SecretPhraseInput, parsePhrase, phraseProblem } from "@/components/ui/SecretPhraseInput";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { walletApi } from "@/lib/tauri/wallet";
import { setScreenProtection } from "@/lib/tauri/screenProtection";
import { useWalletStore } from "@/stores/walletStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { toast } from "@/stores/toastStore";
import { cn } from "@/lib/utils";

type Step = "choose" | "phrase" | "details" | "pin" | "backup";
type Mode = "create" | "import";

const PHRASE_PLACEHOLDER =
  $t("Her bir sözcüğün arasına boşluk ekleyin ve hiç kimsenin izlemediğinden emin olun.");

function FlowHeader({
  title,
  onBack,
  onClose,
}: {
  title: string;
  onBack: () => void;
  onClose: () => void;
}) {
  return (
    <header className="relative z-10 flex h-14 shrink-0 items-center justify-between border-b border-white/[0.05] px-4">
      <button
        onClick={onBack}
        aria-label={$t("Geri")}
        title={$t("Geri")}
        className="focus-ring grid h-9 w-9 place-items-center rounded-lg text-zinc-300 transition-colors hover:bg-white/[0.05] hover:text-white"
      >
        <CaretLeft size={20} />
      </button>
      <h1 className="pointer-events-none absolute left-1/2 max-w-[62%] -translate-x-1/2 truncate text-[13px] font-semibold text-white">
        {title}
      </h1>
      <button
        onClick={onClose}
        aria-label={$t("İçe aktarmayı kapat")}
        title={$t("İçe aktarmayı kapat")}
        className="focus-ring grid h-9 w-9 place-items-center rounded-lg text-zinc-300 transition-colors hover:bg-white/[0.05] hover:text-white"
      >
        <X size={18} />
      </button>
    </header>
  );
}

function PillAction({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "focus-ring h-12 w-full select-none rounded-full text-[14px] font-semibold transition-all duration-150",
        disabled
          ? "cursor-not-allowed bg-surface-600 text-zinc-400"
          : "bg-accent text-white shadow-glow hover:bg-accent-hover active:bg-accent-press",
      )}
    >
      {label}
    </button>
  );
}

export function WelcomePage() {
  const navigate = useNavigate();
  const { createWallet, importWallet, loading } = useWalletStore();
  const { setSetUp, walletName, setWalletName } = useSettingsStore();
  const isSetUp = useSettingsStore((s) => s.isSetUp);

  const [step, setStep] = useState<Step>("choose");
  const [mode, setMode] = useState<Mode>("create");
  const [name, setName] = useState(walletName);
  const [mnemonic, setMnemonic] = useState("");
  const [phraseLocked, setPhraseLocked] = useState(false);
  const [showPhraseInfo, setShowPhraseInfo] = useState(false);
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [backupWords, setBackupWords] = useState<string[]>([]);
  const [ack, setAck] = useState(false);

  const phraseWords = parsePhrase(mnemonic);
  const phraseError = phraseProblem(mnemonic);

  useEffect(() => {
    const shouldProtect = step === "phrase" || step === "backup";
    setScreenProtection(shouldProtect);
    return () => {
      if (shouldProtect) {
        setScreenProtection(false);
      }
    };
  }, [step]);

  function resetImport() {
    setMnemonic("");
    setPhraseLocked(false);
    setShowPhraseInfo(false);
    setError(null);
    setStep("choose");
  }

  function goCreate() {
    setMode("create");
    setError(null);
    setStep("details");
  }

  function goImport() {
    setMode("import");
    setError(null);
    setStep("phrase");
  }

  function submitPhrase() {
    if (phraseLocked) {
      setError(null);
      setStep("details");
      return;
    }
    if (phraseError) return setError(phraseError);
    setPhraseLocked(true);
    setError(null);
    setStep("details");
  }

  function goPin() {
    if (name.trim().length < 2) return setError($t("Cüzdan adı en az 2 karakter olmalı."));
    if (password.length < 8) return setError($t("Parola en az 8 karakter olmalı."));
    if (password !== password2) return setError($t("Parolalar eşleşmiyor."));
    if (mode === "import" && phraseError) return setError(phraseError);
    setError(null);
    setStep("pin");
  }

  async function finish(code: string) {
    if (code.length !== 6) return;
    setError(null);
    try {
      if (mode === "create") {
        await createWallet(name.trim(), password, code);
        setWalletName(name.trim());
        setSetUp(true);
        const phrase = await walletApi.revealMnemonic(password).catch(() => "");
        setBackupWords(phrase ? phrase.trim().split(/\s+/) : []);
        setStep("backup");
        return;
      }

      await importWallet(name.trim(), mnemonic.trim().toLowerCase(), password, code);
      setWalletName(name.trim());
      setSetUp(true);
      setMnemonic("");
      setPhraseLocked(false);
      setPassword("");
      setPassword2("");
      setPin("");
      toast($t("Cüzdan hazır"), "success");
      navigate("/", { replace: true });
    } catch (e) {
      setError(String(e));
    }
  }

  function finishBackup() {
    setBackupWords([]);
    setPassword("");
    setPassword2("");
    setPin("");
    setAck(false);
    toast($t("Cüzdan hazır"), "success");
    navigate("/", { replace: true });
  }

  const detailsFields = (
    <div className="flex flex-col gap-3.5">
      <Input
        label={$t("Cüzdan adı")}
        placeholder={$t("Ana Cüzdan")}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <Input
        label={$t("Parola")}
        type="password"
        placeholder={$t("En az 8 karakter")}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <Input
        label={$t("Parola (tekrar)")}
        type="password"
        value={password2}
        onChange={(e) => setPassword2(e.target.value)}
      />
    </div>
  );

  const pinFields = (
    <div className="my-6 flex justify-center">
      <PinInput
        length={6}
        autoFocus
        value={pin}
        onChange={(code) => {
          setPin(code);
          setError(null);
        }}
        onComplete={finish}
      />
    </div>
  );

  if (mode === "import" && (step === "phrase" || step === "details" || step === "pin")) {
    const title =
      step === "phrase"
        ? $t("Gizli Kurtarma İfadesini İçe Aktar")
        : step === "details"
          ? $t("Cüzdanını Yapılandır")
          : $t("Hızlı Kilit PIN'i");

    const back = () => {
      setError(null);
      if (step === "pin") setStep("details");
      else if (step === "details") setStep("phrase");
      else resetImport();
    };

    let body: ReactNode;
    let actionLabel = $t("Devam Et");
    let actionDisabled = false;
    let action = goPin;

    if (step === "phrase") {
      action = submitPhrase;
      actionDisabled = !phraseLocked && Boolean(phraseError);
      body = (
        <>
          <h2 className="text-[30px] font-bold leading-tight tracking-tight text-white">
            {$t("Bir cüzdanı içe aktarın")}
          </h2>
          <div className="mt-2 flex items-center gap-1.5">
            <span className="text-[13px] text-zinc-400">{$t("Gizli Kurtarma İfadenizi girin")}</span>
            <button
              onClick={() => setShowPhraseInfo((v) => !v)}
              aria-label={$t("Gizli kurtarma ifadesi nedir?")}
              aria-expanded={showPhraseInfo}
              className={cn(
                "focus-ring grid h-5 w-5 place-items-center rounded-full transition-colors",
                showPhraseInfo ? "text-accent" : "text-zinc-500 hover:text-zinc-200",
              )}
            >
              <Info size={15} />
            </button>
          </div>

          {showPhraseInfo && (
            <div className="animate-fade-up mt-3 rounded-xl border border-info/20 bg-info/[0.06] p-3.5 text-[11px] leading-relaxed text-zinc-300">
              {$t(
                "Gizli Kurtarma İfadesi cüzdanının ana anahtarıdır: 12–24 kelime, doğru sırada. Vexaris Wallet bu ifadeyi cihazından dışarı göndermez, yalnızca parolanla şifrelenmiş kasada tutar. Yazdığın kelimeler sen devam ettikçe maskelenir; Enter'a bastığında ifade tamamen gizlenir.",
              )}
            </div>
          )}

          <div className="mt-4">
            {phraseLocked ? (
              <div className="animate-fade-up rounded-2xl border border-success/25 bg-success/[0.05] p-5">
                <div className="flex items-center gap-2 text-[13px] font-semibold text-success">
                  <Lock size={14} />
                  {$t("İfade girildi ve gizlendi")}
                </div>
                <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-400">
                  {phraseWords.length} {$t("kelime alındı. Güvenlik için kelimeler artık ekranda gösterilmiyor. Devam edebilir veya ifadeyi baştan girebilirsin.")}
                </p>
                <button
                  onClick={() => {
                    setMnemonic("");
                    setPhraseLocked(false);
                    setError(null);
                  }}
                  className="focus-ring mt-3 rounded-lg border border-white/[0.08] bg-surface-800 px-3 py-1.5 text-[11px] font-medium text-zinc-200 transition-colors hover:border-accent/40 hover:text-white"
                >
                  {$t("İfadeyi değiştir")}
                </button>
              </div>
            ) : (
              <SecretPhraseInput
                value={mnemonic}
                onChange={(next) => {
                  setMnemonic(next);
                  setError(null);
                }}
                onSubmit={submitPhrase}
                placeholder={PHRASE_PLACEHOLDER}
                autoFocus
              />
            )}
          </div>

          <div className="mt-5 flex items-start gap-2 text-[11px] leading-relaxed text-zinc-600">
            <ShieldCheck size={13} className="mt-px shrink-0 text-success/70" />
            {$t("Anahtarlar cihazında kalır. İfadeyi kimseyle paylaşma; Vexaris Wallet senden asla istemez.")}
          </div>
        </>
      );
    } else if (step === "details") {
      body = (
        <>
          <h2 className="text-[30px] font-bold leading-tight tracking-tight text-white">
            {$t("Cüzdanını yapılandır")}
          </h2>
          <p className="mt-2 text-[13px] text-zinc-400">
            {$t("Bu cihazda kullanacağın adı ve kasayı şifreleyecek parolayı belirle.")}
          </p>

          <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-success/25 bg-success/[0.05] px-3.5 py-2.5">
            <span className="flex items-center gap-2 text-[12px] text-success">
              <Check size={13} weight="bold" />
              {phraseWords.length} {$t("kelimelik ifade alındı ve gizlendi")}
            </span>
            <button
              onClick={() => setStep("phrase")}
              className="focus-ring rounded text-[11px] font-medium text-zinc-400 transition-colors hover:text-white"
            >
              {$t("Değiştir")}
            </button>
          </div>

          <div className="mt-4">{detailsFields}</div>

          <p className="mt-3 text-[11px] leading-relaxed text-zinc-600">
            {$t("Parola cihazındaki kasayı şifreler ve kurtarılamaz. PIN ise yalnızca hızlı kilidi açar.")}
          </p>
        </>
      );
    } else {
      actionLabel = loading ? $t("Hazırlanıyor…") : $t("Cüzdanı içe aktar");
      actionDisabled = loading || pin.length !== 6;
      action = () => void finish(pin);
      body = (
        <>
          <h2 className="text-[30px] font-bold leading-tight tracking-tight text-white">
            {$t("Hızlı kilit PIN'i")}
          </h2>
          <p className="mt-2 text-[13px] text-zinc-400">
            {$t("Cüzdanını açarken bu 6 haneli PIN'i kullanacaksın.")}
          </p>
          <div className="mt-6 rounded-2xl border border-white/[0.06] bg-surface-850 p-6 text-center">
            {pinFields}
          </div>
        </>
      );
    }

    return (
      <div className="relative flex h-[100dvh] flex-col">
        <FlowHeader title={title} onBack={back} onClose={resetImport} />
        <div className="relative z-10 flex-1 overflow-y-auto px-6 py-6">
          <div className="animate-fade-up mx-auto w-full max-w-2xl">{body}</div>
        </div>
        <footer className="relative z-10 shrink-0 px-6 pb-6 pt-2">
          <div className="mx-auto w-full max-w-2xl">
            {error && (
              <p className="animate-shake mb-2.5 rounded-lg border border-danger/25 bg-danger/[0.07] px-3 py-2 text-[11px] leading-relaxed text-danger">
                {error}
              </p>
            )}
            <PillAction label={actionLabel} disabled={actionDisabled} onClick={action} />
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div className="screen-center">
      <div className="w-full max-w-sm">
        {step === "choose" && (
          <div className="animate-fade-up">
            <div className="mb-8 flex flex-col items-center text-center">
              <ProfileAvatar size={56} />
              <h1 className="mt-4 text-xl font-semibold text-white">Vexaris Wallet</h1>
              <p className="mt-1 text-[13px] text-zinc-500">
                {$t("Çok zincirli kripto cüzdanı")}
              </p>
            </div>

            <div className="flex flex-col gap-2.5">
              <button
                onClick={goCreate}
                className="focus-ring flex items-center gap-3.5 rounded-xl border border-white/[0.07] bg-surface-850 p-4 text-left transition-colors hover:border-white/[0.14]"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
                  <Wallet size={18} />
                </span>
                <span className="flex-1">
                  <span className="block text-sm font-medium text-white">{$t("Yeni cüzdan oluştur")}</span>
                  <span className="block text-xs text-zinc-500">{$t("12 kelimelik kurtarma ifadesi üretilir")}</span>
                </span>
              </button>

              <button
                onClick={goImport}
                className="focus-ring flex items-center gap-3.5 rounded-xl border border-white/[0.07] bg-surface-850 p-4 text-left transition-colors hover:border-white/[0.14]"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-surface-700 text-zinc-300">
                  <TrayArrowDown size={18} />
                </span>
                <span className="flex-1">
                  <span className="block text-sm font-medium text-white">{$t("Cüzdanı içe aktar")}</span>
                  <span className="block text-xs text-zinc-500">{$t("Mevcut kurtarma ifadenle gir")}</span>
                </span>
              </button>
            </div>

            <div className="mt-6 flex items-center justify-center gap-1.5 text-[11px] text-zinc-600">
              <ShieldCheck size={12} className="text-success" />
              {$t("Anahtarlar cihazında kalır")}
            </div>

            {isSetUp && (
              <button
                onClick={() => navigate("/unlock", { replace: true })}
                className="mt-4 w-full text-center text-xs text-zinc-500 transition-colors hover:text-white"
              >
                {$t("Bu cihazda zaten bir cüzdan var — kilidi aç")}
              </button>
            )}
          </div>
        )}

        {step === "details" && (
          <div className="animate-fade-up rounded-xl border border-white/[0.07] bg-surface-850 p-6">
            <button
              onClick={() => setStep("choose")}
              className="mb-4 inline-flex items-center gap-1 text-xs text-zinc-500 transition-colors hover:text-white"
            >
              <CaretLeft size={13} /> {$t("Geri")}
            </button>

            <h2 className="mb-4 text-sm font-medium text-white">{$t("Yeni cüzdan")}</h2>

            {detailsFields}
            {error && <p className="mt-2 text-xs text-danger">{error}</p>}

            <div className="mt-4 flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setStep("choose")}>
                {$t("Vazgeç")}
              </Button>
              <Button className="flex-1" onClick={goPin}>
                {$t("Devam et")}
              </Button>
            </div>
          </div>
        )}

        {step === "pin" && (
          <div className="animate-fade-up rounded-xl border border-white/[0.07] bg-surface-850 p-6 text-center">
            <button
              onClick={() => setStep("details")}
              className="mb-4 inline-flex items-center gap-1 text-xs text-zinc-500 transition-colors hover:text-white"
            >
              <CaretLeft size={13} /> {$t("Geri")}
            </button>

            <h2 className="text-sm font-medium text-white">{$t("Hızlı kilit PIN'i")}</h2>
            <p className="mx-auto mt-1 max-w-[260px] text-xs leading-relaxed text-zinc-500">
              {$t("Cüzdanını açarken bu 6 haneli PIN'i kullanacaksın.")}
            </p>

            {pinFields}

            <p className="mb-4 min-h-[16px] text-xs text-danger">{error ?? ""}</p>

            <Button
              className="w-full"
              disabled={loading || pin.length !== 6}
              onClick={() => finish(pin)}
            >
              {loading ? $t("Hazırlanıyor…") : $t("Cüzdanı hazırla")}
            </Button>
          </div>
        )}

        {step === "backup" && (
          <div className="animate-fade-up rounded-xl border border-white/[0.07] bg-surface-850 p-6">
            <h2 className="text-sm font-medium text-white">{$t("Kurtarma ifadesi")}</h2>
            <p className="mt-1 text-xs leading-relaxed text-zinc-500">
              {$t("Bu 12 kelime cüzdanını geri yüklemenin tek yolu. Sırasıyla kâğıda yaz ve çevrimdışı sakla.")}
            </p>

            <div className="mt-4 grid grid-cols-3 gap-1.5">
              {backupWords.map((word, i) => (
                <div
                  key={`${word}-${i}`}
                  className="flex items-baseline gap-1.5 rounded-md border border-white/[0.06] bg-surface-800 px-2 py-1.5"
                >
                  <span className="text-[9px] tabular text-zinc-600">{i + 1}</span>
                  <span className="truncate font-mono text-[11px] text-zinc-200">{word}</span>
                </div>
              ))}
            </div>

            {backupWords.length === 0 && (
              <p className="mt-3 rounded-lg border border-danger/20 bg-danger/[0.06] px-2.5 py-2 text-[11px] leading-relaxed text-danger/90">
                {$t("İfade okunamadı. Ayarlar → Kurtarma ifadesi bölümünden parolanla tekrar görüntüleyebilirsin.")}
              </p>
            )}

            <div className="mt-3 flex items-start gap-2 rounded-lg border border-warning/20 bg-warning/[0.06] p-2.5 text-[11px] leading-relaxed text-warning/90">
              <Warning size={13} className="mt-px shrink-0" />
              {$t("Vexaris Wallet bu ifadeyi asla sormaz. Ekran görüntüsü alma, panoya kopyalama veya buluta kaydetme.")}
            </div>

            <button
              onClick={() => setAck((v) => !v)}
              className="focus-ring mt-4 flex w-full items-center gap-2.5 rounded-lg border border-white/[0.06] bg-surface-800 px-3 py-2.5 text-left transition-colors hover:border-white/[0.12]"
              aria-pressed={ack}
            >
              <span
                className={
                  ack
                    ? "grid h-4 w-4 shrink-0 place-items-center rounded border border-accent bg-accent text-white"
                    : "grid h-4 w-4 shrink-0 place-items-center rounded border border-white/20 bg-transparent text-transparent"
                }
              >
                <Check size={11} weight="bold" />
              </span>
              <span className="text-[11px] leading-snug text-zinc-300">
                {$t("Kelimeleri kâğıda yazdım ve güvenli bir yerde sakladım.")}
              </span>
            </button>

            <Button className="mt-4 w-full" disabled={!ack} onClick={finishBackup}>
              {$t("Cüzdanı aç")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
