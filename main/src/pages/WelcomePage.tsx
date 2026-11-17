import { t as $t } from "@/lib/i18n";
import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Button,
  Check,
  ChevronLeft,
  Download,
  Info,
  Input,
  Lock,
  OtpInput,
  Shield,
  X,
  cn,
} from "@/kit";
import { Wallet } from "@/kit/ext";
import { SecretPhraseInput, parsePhrase, phraseProblem } from "@/components/SecretPhraseInput";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { walletApi } from "@/lib/tauri/wallet";
import { setScreenProtection } from "@/lib/tauri/screenProtection";
import { useWalletStore } from "@/stores/walletStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { toast } from "@/stores/toastStore";

type Step = "choose" | "phrase" | "details" | "pin" | "pinConfirm" | "backup";
type Mode = "create" | "import";

const PHRASE_PLACEHOLDER =
  $t("Her bir sözcüğün arasına boşluk ekleyin ve hiç kimsenin izlemediğinden emin olun.");

const PIN_LENGTH = 6;

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
    <header className="relative z-10 flex h-14 shrink-0 items-center justify-between border-b border-line px-4">
      <button
        onClick={onBack}
        aria-label={$t("Geri")}
        title={$t("Geri")}
        className="grid h-9 w-9 place-items-center rounded-ctrl text-textsoft transition-colors hover:bg-surface2 hover:text-text"
      >
        <ChevronLeft size={20} />
      </button>
      <h1 className="pointer-events-none absolute left-1/2 max-w-[62%] -translate-x-1/2 truncate text-[13px] font-semibold text-text">
        {title}
      </h1>
      <button
        onClick={onClose}
        aria-label={$t("İçe aktarmayı kapat")}
        title={$t("İçe aktarmayı kapat")}
        className="grid h-9 w-9 place-items-center rounded-ctrl text-textsoft transition-colors hover:bg-surface2 hover:text-text"
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
        "h-12 w-full select-none rounded-ctrl text-[14px] font-semibold transition-all duration-150",
        disabled
          ? "cursor-not-allowed bg-surface3 text-muted"
          : "bg-brand text-bg shadow-2 hover:bg-brand/90",
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
  const [pin, setPin] = useState<string[]>(() => Array(PIN_LENGTH).fill(""));
  const [pinFirst, setPinFirst] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [backupWords, setBackupWords] = useState<string[]>([]);
  const [ack, setAck] = useState(false);

  const digits = pin.join("");

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
    setPinFirst("");
    setPin(Array(PIN_LENGTH).fill(""));
    setStep("pin");
  }

  function toConfirm(code: string) {
    setPinFirst(code);
    setPin(Array(PIN_LENGTH).fill(""));
    setError(null);
    setStep("pinConfirm");
  }

  function verifyConfirm(code: string) {
    if (code !== pinFirst) {
      setError($t("PIN'ler eşleşmiyor. Tekrar dene."));
      setPin(Array(PIN_LENGTH).fill(""));
      return;
    }
    void finish(code);
  }

  async function finish(code: string) {
    if (code.length !== PIN_LENGTH) return;
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
      setPin(Array(PIN_LENGTH).fill(""));
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
    setPin(Array(PIN_LENGTH).fill(""));
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
      <OtpInput
        length={PIN_LENGTH}
        value={pin}
        onChange={(next) => {
          setPin(next);
          setError(null);
          const code = next.join("");
          if (code.length !== PIN_LENGTH) return;
          if (step === "pin") toConfirm(code);
          else if (step === "pinConfirm") verifyConfirm(code);
        }}
      />
    </div>
  );

  if (mode === "import" && (step === "phrase" || step === "details" || step === "pin" || step === "pinConfirm")) {
    const title =
      step === "phrase"
        ? $t("Gizli Kurtarma İfadesini İçe Aktar")
        : step === "details"
          ? $t("Cüzdanını Yapılandır")
          : step === "pin"
            ? $t("Hızlı Kilit PIN'i")
            : $t("PIN'i Doğrula");

    const back = () => {
      setError(null);
      if (step === "pinConfirm") {
        setPin(Array(PIN_LENGTH).fill(""));
        setStep("pin");
      } else if (step === "pin") setStep("details");
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
          <h2 className="text-[30px] font-bold leading-tight tracking-tight text-text">
            {$t("Bir cüzdanı içe aktarın")}
          </h2>
          <div className="mt-2 flex items-center gap-1.5">
            <span className="text-[13px] text-textsoft">{$t("Gizli Kurtarma İfadenizi girin")}</span>
            <button
              onClick={() => setShowPhraseInfo((v) => !v)}
              aria-label={$t("Gizli kurtarma ifadesi nedir?")}
              aria-expanded={showPhraseInfo}
              className={cn(
                "grid h-5 w-5 place-items-center rounded-full transition-colors",
                showPhraseInfo ? "text-brand" : "text-muted hover:text-text",
              )}
            >
              <Info size={15} />
            </button>
          </div>

          {showPhraseInfo && (
            <div className="animate-fade-up mt-3 rounded-card border border-info/20 bg-info/[0.06] p-3.5 text-[11px] leading-relaxed text-textsoft">
              {$t(
                "Gizli Kurtarma İfadesi cüzdanının ana anahtarıdır: 12–24 kelime, doğru sırada. Vexaris Wallet bu ifadeyi cihazından dışarı göndermez, yalnızca parolanla şifrelenmiş kasada tutar. Yazdığın kelimeler sen devam ettikçe maskelenir; Enter'a bastığında ifade tamamen gizlenir.",
              )}
            </div>
          )}

          <div className="mt-4">
            {phraseLocked ? (
              <div className="animate-fade-up rounded-card border border-ok/25 bg-ok/[0.05] p-5">
                <div className="flex items-center gap-2 text-[13px] font-semibold text-ok">
                  <Lock size={14} />
                  {$t("İfade girildi ve gizlendi")}
                </div>
                <p className="mt-1.5 text-[11px] leading-relaxed text-textsoft">
                  {phraseWords.length} {$t("kelime alındı. Güvenlik için kelimeler artık ekranda gösterilmiyor. Devam edebilir veya ifadeyi baştan girebilirsin.")}
                </p>
                <button
                  onClick={() => {
                    setMnemonic("");
                    setPhraseLocked(false);
                    setError(null);
                  }}
                  className="mt-3 rounded-ctrl border border-line bg-surface2 px-3 py-1.5 text-[11px] font-medium text-textsoft transition-colors hover:border-brand/40 hover:text-text"
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

          <div className="mt-5 flex items-start gap-2 text-[11px] leading-relaxed text-muted">
            <Shield size={13} className="mt-px shrink-0 text-ok/70" />
            {$t("Anahtarlar cihazında kalır. İfadeyi kimseyle paylaşma; Vexaris Wallet senden asla istemez.")}
          </div>
        </>
      );
    } else if (step === "details") {
      body = (
        <>
          <h2 className="text-[30px] font-bold leading-tight tracking-tight text-text">
            {$t("Cüzdanını yapılandır")}
          </h2>
          <p className="mt-2 text-[13px] text-textsoft">
            {$t("Bu cihazda kullanacağın adı ve kasayı şifreleyecek parolayı belirle.")}
          </p>

          <div className="mt-4 flex items-center justify-between gap-3 rounded-card border border-ok/25 bg-ok/[0.05] px-3.5 py-2.5">
            <span className="flex items-center gap-2 text-[12px] text-ok">
              <Check size={13} />
              {phraseWords.length} {$t("kelimelik ifade alındı ve gizlendi")}
            </span>
            <button
              onClick={() => setStep("phrase")}
              className="rounded text-[11px] font-medium text-textsoft transition-colors hover:text-text"
            >
              {$t("Değiştir")}
            </button>
          </div>

          <div className="mt-4">{detailsFields}</div>

          <p className="mt-3 text-[11px] leading-relaxed text-muted">
            {$t("Parola cihazındaki kasayı şifreler ve kurtarılamaz. PIN ise yalnızca hızlı kilidi açar.")}
          </p>
        </>
      );
    } else if (step === "pin") {
      actionDisabled = digits.length !== PIN_LENGTH;
      action = () => toConfirm(digits);
      body = (
        <>
          <h2 className="text-[30px] font-bold leading-tight tracking-tight text-text">
            {$t("Hızlı kilit PIN'i")}
          </h2>
          <p className="mt-2 text-[13px] text-textsoft">
            {$t("Cüzdanını açarken bu 6 haneli PIN'i kullanacaksın.")}
          </p>
          <div className="mt-6 rounded-card border border-line bg-bg2 p-6 text-center">
            {pinFields}
          </div>
        </>
      );
    } else {
      actionLabel = loading ? $t("Hazırlanıyor…") : $t("Cüzdanı içe aktar");
      actionDisabled = loading || digits.length !== PIN_LENGTH;
      action = () => verifyConfirm(digits);
      body = (
        <>
          <h2 className="text-[30px] font-bold leading-tight tracking-tight text-text">
            {$t("PIN'i tekrar gir")}
          </h2>
          <p className="mt-2 text-[13px] text-textsoft">
            {$t("Güvenlik için az önce belirlediğin 6 haneli PIN'i tekrar gir.")}
          </p>
          <div className="mt-6 rounded-card border border-line bg-bg2 p-6 text-center">
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
              <p className="mb-2.5 rounded-ctrl border border-danger/25 bg-danger/[0.07] px-3 py-2 text-[11px] leading-relaxed text-danger">
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
              <h1 className="mt-4 text-xl font-semibold text-text">Vexaris Wallet</h1>
              <p className="mt-1 text-[13px] text-muted">
                {$t("Çok zincirli kripto cüzdanı")}
              </p>
            </div>

            <div className="flex flex-col gap-2.5">
              <button
                onClick={goCreate}
                className="flex items-center gap-3.5 rounded-card border border-line bg-surface2 p-4 text-left transition-colors hover:border-linestrong"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-ctrl bg-brandsoft text-brand">
                  <Wallet size={18} />
                </span>
                <span className="flex-1">
                  <span className="block text-sm font-medium text-text">{$t("Yeni cüzdan oluştur")}</span>
                  <span className="block text-xs text-muted">{$t("12 kelimelik kurtarma ifadesi üretilir")}</span>
                </span>
              </button>

              <button
                onClick={goImport}
                className="flex items-center gap-3.5 rounded-card border border-line bg-surface2 p-4 text-left transition-colors hover:border-linestrong"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-ctrl bg-surface3 text-textsoft">
                  <Download size={18} />
                </span>
                <span className="flex-1">
                  <span className="block text-sm font-medium text-text">{$t("Cüzdanı içe aktar")}</span>
                  <span className="block text-xs text-muted">{$t("Mevcut kurtarma ifadenle gir")}</span>
                </span>
              </button>
            </div>

            <div className="mt-6 flex items-center justify-center gap-1.5 text-[11px] text-muted">
              <Shield size={12} className="text-ok" />
              {$t("Anahtarlar cihazında kalır")}
            </div>

            {isSetUp && (
              <button
                onClick={() => navigate("/unlock", { replace: true })}
                className="mt-4 w-full text-center text-xs text-muted transition-colors hover:text-text"
              >
                {$t("Bu cihazda zaten bir cüzdan var — kilidi aç")}
              </button>
            )}
          </div>
        )}

        {step === "details" && (
          <div className="animate-fade-up rounded-card border border-line bg-surface2 p-6">
            <button
              onClick={() => setStep("choose")}
              className="mb-4 inline-flex items-center gap-1 text-xs text-muted transition-colors hover:text-text"
            >
              <ChevronLeft size={13} /> {$t("Geri")}
            </button>

            <h2 className="mb-4 text-sm font-medium text-text">{$t("Yeni cüzdan")}</h2>

            {detailsFields}
            {error && <p className="mt-2 text-xs text-danger">{error}</p>}

            <div className="mt-4 flex gap-2">
              <Button variant="soft" className="flex-1" onClick={() => setStep("choose")}>
                {$t("Vazgeç")}
              </Button>
              <Button className="flex-1" onClick={goPin}>
                {$t("Devam et")}
              </Button>
            </div>
          </div>
        )}

        {step === "pin" && (
          <div className="animate-fade-up rounded-card border border-line bg-surface2 p-6 text-center">
            <button
              onClick={() => setStep("details")}
              className="mb-4 inline-flex items-center gap-1 text-xs text-muted transition-colors hover:text-text"
            >
              <ChevronLeft size={13} /> {$t("Geri")}
            </button>

            <h2 className="text-sm font-medium text-text">{$t("Hızlı kilit PIN'i")}</h2>
            <p className="mx-auto mt-1 max-w-[260px] text-xs leading-relaxed text-muted">
              {$t("Cüzdanını açarken bu 6 haneli PIN'i kullanacaksın.")}
            </p>

            {pinFields}

            <p className="mb-4 min-h-[16px] text-xs text-danger">{error ?? ""}</p>

            <Button className="w-full" disabled={digits.length !== PIN_LENGTH} onClick={() => toConfirm(digits)}>
              {$t("Devam et")}
            </Button>
          </div>
        )}

        {step === "pinConfirm" && (
          <div className="animate-fade-up rounded-card border border-line bg-surface2 p-6 text-center">
            <button
              onClick={() => {
                setPin(Array(PIN_LENGTH).fill(""));
                setError(null);
                setStep("pin");
              }}
              className="mb-4 inline-flex items-center gap-1 text-xs text-muted transition-colors hover:text-text"
            >
              <ChevronLeft size={13} /> {$t("Geri")}
            </button>

            <h2 className="text-sm font-medium text-text">{$t("PIN'i tekrar gir")}</h2>
            <p className="mx-auto mt-1 max-w-[260px] text-xs leading-relaxed text-muted">
              {$t("Güvenlik için az önce belirlediğin 6 haneli PIN'i tekrar gir.")}
            </p>

            {pinFields}

            <p className="mb-4 min-h-[16px] text-xs text-danger">{error ?? ""}</p>

            <Button
              className="w-full"
              disabled={loading || digits.length !== PIN_LENGTH}
              onClick={() => verifyConfirm(digits)}
            >
              {loading ? $t("Hazırlanıyor…") : $t("Cüzdanı hazırla")}
            </Button>
          </div>
        )}

        {step === "backup" && (
          <div className="animate-fade-up rounded-card border border-line bg-surface2 p-6">
            <h2 className="text-sm font-medium text-text">{$t("Kurtarma ifadesi")}</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              {$t("Bu 12 kelime cüzdanını geri yüklemenin tek yolu. Sırasıyla kâğıda yaz ve çevrimdışı sakla.")}
            </p>

            <div className="mt-4 grid grid-cols-3 gap-1.5">
              {backupWords.map((word, i) => (
                <div
                  key={`${word}-${i}`}
                  className="flex items-baseline gap-1.5 rounded-ctrl border border-line bg-bg2 px-2 py-1.5"
                >
                  <span className="text-[9px] tabular text-muted">{i + 1}</span>
                  <span className="truncate font-mono text-[11px] text-textsoft">{word}</span>
                </div>
              ))}
            </div>

            {backupWords.length === 0 && (
              <p className="mt-3 rounded-ctrl border border-danger/20 bg-danger/[0.06] px-2.5 py-2 text-[11px] leading-relaxed text-danger">
                {$t("İfade okunamadı. Ayarlar → Kurtarma ifadesi bölümünden parolanla tekrar görüntüleyebilirsin.")}
              </p>
            )}

            <Alert tone="warning" className="!mt-3 !p-2.5">
              {$t("Vexaris Wallet bu ifadeyi asla sormaz. Ekran görüntüsü alma, panoya kopyalama veya buluta kaydetme.")}
            </Alert>

            <button
              onClick={() => setAck((v) => !v)}
              className="mt-4 flex w-full items-center gap-2.5 rounded-ctrl border border-line bg-bg2 px-3 py-2.5 text-left transition-colors hover:border-linestrong"
              aria-pressed={ack}
            >
              <span
                className={cn(
                  "grid h-4 w-4 shrink-0 place-items-center rounded border",
                  ack
                    ? "border-brand bg-brand text-bg"
                    : "border-line bg-transparent text-transparent",
                )}
              >
                <Check size={11} />
              </span>
              <span className="text-[11px] leading-snug text-textsoft">
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
