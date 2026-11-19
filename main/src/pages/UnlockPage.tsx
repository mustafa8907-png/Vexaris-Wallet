import { t as $t } from "@/lib/i18n";
import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Button, Input, Lock } from "@/kit";
import { Backspace, Key } from "@/kit/ext";
import { useWalletStore } from "@/stores/walletStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { toast } from "@/stores/toastStore";
import {
  clearBiometricSecret,
  decryptBiometricSecret,
  enrollBiometric,
  shouldEnrollBiometric,
} from "@/lib/biometric";
import { shortAddress } from "@/lib/utils";
import { cn } from "@/lib/utils";

const PIN_LENGTH = 6;
const MAX_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 15;

export function UnlockPage() {
  const navigate = useNavigate();
  const unlock = useWalletStore((s) => s.unlock);
  const wallet = useWalletStore((s) => s.wallet);
  const wallets = useWalletStore((s) => s.wallets);
  const unlocked = useWalletStore((s) => s.unlocked);
  const settingsName = useSettingsStore((s) => s.walletName);
  const isSetUp = useSettingsStore((s) => s.isSetUp);
  const missingCredential = useWalletStore((s) => s.missingCredential);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const displayWallet = wallets.find((item) => item.id === selectedId) ?? wallet;
  const displayName = displayWallet?.name || settingsName;

  const [view, setView] = useState<"pin" | "password">(
    missingCredential === "pin" ? "password" : "pin",
  );
  const [digits, setDigits] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [shaking, setShaking] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockoutLeft, setLockoutLeft] = useState(0);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const bioTried = useRef(false);

  useEffect(() => {
    if (lockoutLeft <= 0) return;
    const id = window.setInterval(() => {
      setLockoutLeft((s) => {
        if (s <= 1) {
          setError(null);
          setAttempts(0);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [lockoutLeft]);

  useEffect(() => {
    if (wallets.length === 0) return;
    setSelectedId((prev) => {
      if (prev && wallets.some((item) => item.id === prev)) return prev;
      return wallet?.id ?? wallets[0].id;
    });
  }, [wallet, wallets]);

  useEffect(() => {
    if (!isSetUp || unlocked || wallets.length === 0 || bioTried.current) return;
    bioTried.current = true;
    void (async () => {
      if (busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      const secret = await decryptBiometricSecret();
      if (!secret) {
        busyRef.current = false;
        setBusy(false);
        return;
      }
      const ok = await unlock(secret, selectedId ?? undefined);
      busyRef.current = false;
      setBusy(false);
      if (!ok) {
        const storeErr = useWalletStore.getState().error;
        if (storeErr) setError(storeErr);
        clearBiometricSecret();
        return;
      }
      if (useWalletStore.getState().missingCredential) {
        toast($t("Diğer giriş yöntemini Ayarlar → Cüzdanlar bölümünden ekleyebilirsin."), "info");
      }
      toast($t("Cüzdan açıldı"), "success");
      setTimeout(() => navigate("/", { replace: true }), 260);
    })();
  }, [isSetUp, navigate, selectedId, unlock, unlocked, wallets.length]);

  const attempt = useCallback(
    async (secret: string) => {
      if (busyRef.current || !secret) return;
      busyRef.current = true;
      setBusy(true);
      setError(null);
      const ok = await unlock(secret, selectedId ?? undefined);
      if (ok) {
        if (await shouldEnrollBiometric()) await enrollBiometric(secret);
      }
      busyRef.current = false;
      setBusy(false);
      if (ok) {
        if (useWalletStore.getState().missingCredential) {
          toast($t("Diğer giriş yöntemini Ayarlar → Cüzdanlar bölümünden ekleyebilirsin."), "info");
        }
        toast($t("Cüzdan açıldı"), "success");
        setTimeout(() => navigate("/", { replace: true }), 260);
        return;
      }
      setDigits("");
      setPassword("");
      const storeErr = useWalletStore.getState().error;
      if (storeErr) {
        setError(storeErr);
        return;
      }
      const next = attempts + 1;
      setAttempts(next);
      setShaking(true);
      window.setTimeout(() => setShaking(false), 220);
      if (next >= MAX_ATTEMPTS) {
        setLockoutLeft(LOCKOUT_SECONDS);
        setError($t("Çok fazla hatalı deneme. {0} saniye bekleyin.", [LOCKOUT_SECONDS]));
      } else {
        setError(
          view === "password"
            ? $t("Parola hatalı.")
            : $t("Hatalı PIN kodu. Kalan deneme hakkı: {0}", [MAX_ATTEMPTS - next]),
        );
      }
    },
    [attempts, navigate, selectedId, unlock, view],
  );

  const pressDigit = useCallback(
    (d: string) => {
      if (lockoutLeft > 0 || busy) return;
      setError(null);
      setDigits((prev) => {
        if (prev.length >= PIN_LENGTH) return prev;
        const next = prev + d;
        if (next.length === PIN_LENGTH) window.setTimeout(() => void attempt(next), 90);
        return next;
      });
    },
    [attempt, busy, lockoutLeft],
  );

  const pressDelete = useCallback(() => {
    if (lockoutLeft > 0 || busy) return;
    setError(null);
    setDigits((prev) => prev.slice(0, -1));
  }, [busy, lockoutLeft]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || view !== "pin") return;
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        pressDigit(e.key);
      } else if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        pressDelete();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pressDelete, pressDigit, view]);

  if (!isSetUp) return <Navigate to="/welcome" replace />;
  if (unlocked) return <Navigate to="/" replace />;

  const keyClass =
    "flex h-15 w-full items-center justify-center rounded-ctrl border border-line bg-surface font-mono text-[22px] font-bold tabular-nums text-text shadow-1 transition duration-150 hover:border-linestrong hover:bg-surface2 active:scale-95 active:bg-brand active:text-white disabled:opacity-40";
  const sideKeyClass =
    "flex h-15 w-full items-center justify-center rounded-ctrl border border-line bg-surface2 text-textsoft transition duration-150 hover:border-linestrong hover:text-text active:scale-95 disabled:opacity-35";

  return (
    <div
      className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col justify-between overflow-y-auto overscroll-contain bg-bg px-5 py-7 text-text sm:border-x sm:border-line sm:shadow-2"
      style={{ paddingBottom: "calc(1.75rem + var(--keyboard-inset, 0px))" }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-ctrl bg-brand font-display text-[15px] font-extrabold text-white">
            V
          </span>
          <span className="font-display text-[15px] font-bold tracking-tight">
            Vexaris <span className="font-semibold text-muted">Wallet</span>
          </span>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-ctrl border border-line bg-surface px-3 py-1 font-mono text-[10.5px] font-semibold uppercase text-muted">
          <Lock size={12} />
          {$t("Kilitli")}
        </span>
      </div>

      {wallets.length > 1 && (
        <div className="mt-4">
          <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted">
            {$t("Cüzdan seç")}
          </div>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {wallets.map((item) => {
              const active = item.id === (selectedId ?? wallet?.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(item.id);
                    setDigits("");
                    setPassword("");
                    setError(null);
                  }}
                  className={cn(
                    "shrink-0 rounded-ctrl border px-3 py-2 text-left transition-colors",
                    active
                      ? "border-brand/50 bg-brandsoft"
                      : "border-line bg-surface hover:border-linestrong",
                  )}
                >
                  <span
                    className={cn(
                      "block max-w-[130px] truncate text-[12px] font-semibold",
                      active ? "text-brand" : "text-text",
                    )}
                  >
                    {item.name}
                  </span>
                  <span className="block font-mono text-[10px] text-muted">
                    {shortAddress(item.address, 5)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {view === "pin" ? (
        <>
          <div className="my-4 flex flex-col items-center text-center">
            <div className="mb-3 grid size-13 place-items-center rounded-ctrl border border-line bg-surface shadow-1">
              <Lock size={22} className="text-brand" />
            </div>

            <h1 className="font-display text-[24px] font-extrabold leading-tight tracking-tight">
              {$t("PIN Kodunuzu Girin")}
            </h1>
            <p className="mt-1 text-[13px] text-muted">
              {$t("Cüzdan kasasının kilidini açmak için 6 haneli PIN girin")}
            </p>

            <div className="mt-3 inline-flex items-center gap-2 rounded-ctrl border border-line bg-surface px-3.5 py-1.5 font-mono text-[11px] text-textsoft">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-brand" />
              <span className="font-semibold text-text">{displayName}</span>
              {displayWallet && <span>{shortAddress(displayWallet.address, 5)}</span>}
            </div>

            <div
              role="status"
              aria-label={`Girilen PIN hanesi: ${digits.length} / ${PIN_LENGTH}`}
              className={cn("mt-6 flex items-center justify-center gap-3.5", shaking && "anim-shake")}
            >
              {Array.from({ length: PIN_LENGTH }).map((_, i) => {
                const filled = i < digits.length;
                const isCurrent = i === digits.length && lockoutLeft === 0;
                return (
                  <span
                    key={i}
                    className={cn(
                      "block size-4 rounded-full border-2 transition-all duration-150",
                      error
                        ? "border-danger bg-danger"
                        : filled
                          ? "scale-110 border-brand bg-brand"
                          : isCurrent
                            ? "border-brand bg-surface"
                            : "border-linestrong bg-surface",
                    )}
                  />
                );
              })}
            </div>

            <div className="mt-3.5 min-h-5" aria-live="assertive">
              {lockoutLeft > 0 ? (
                <p className="font-mono text-[12px] font-semibold tabular-nums text-danger">
                  {$t("Geçici kilit aktif · {0} sn kaldı", [lockoutLeft])}
                </p>
              ) : (
                error && <p className="text-[12.5px] font-semibold text-danger">{error}</p>
              )}
            </div>
          </div>

          <div className="mx-auto w-full max-w-[320px]">
            <div role="group" aria-label={$t("PIN sayısal tuş takımı")} className="grid grid-cols-3 gap-3">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
                <button
                  key={num}
                  type="button"
                  disabled={lockoutLeft > 0 || busy}
                  onClick={() => pressDigit(num)}
                  aria-label={$t("Rakam {0}", [num])}
                  className={keyClass}
                >
                  {num}
                </button>
              ))}

              <button
                type="button"
                disabled={lockoutLeft > 0 || busy || missingCredential === "password"}
                onClick={() => {
                  setView("password");
                  setError(null);
                }}
                aria-label={$t("Parola ile gir")}
                className={sideKeyClass}
              >
                <Key size={22} />
              </button>

              <button
                type="button"
                disabled={lockoutLeft > 0 || busy}
                onClick={() => pressDigit("0")}
                aria-label={$t("Rakam 0")}
                className={keyClass}
              >
                0
              </button>

              <button
                type="button"
                disabled={lockoutLeft > 0 || busy || digits.length === 0}
                onClick={pressDelete}
                aria-label={$t("Son girilen rakamı sil")}
                className={sideKeyClass}
              >
                <Backspace size={21} />
              </button>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="my-4 flex flex-col items-center text-center">
            <div className="mb-3 grid size-13 place-items-center rounded-ctrl border border-line bg-surface shadow-1">
              <Lock size={22} className="text-brand" />
            </div>
            <h1 className="font-display text-[24px] font-extrabold leading-tight tracking-tight">
              {$t("Parola ile kilidi aç")}
            </h1>
            <p className="mt-1 text-[13px] text-muted">{displayName}</p>
            {error && <p className="mt-3 text-[12.5px] font-semibold text-danger">{error}</p>}
          </div>

          <div className="mx-auto flex w-full max-w-[320px] flex-col gap-3">
            <Input
              type="password"
              placeholder={$t("Parola")}
              autoFocus
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && void attempt(password)}
            />
            <Button size="lg" fullWidth disabled={busy || !password || lockoutLeft > 0} onClick={() => void attempt(password)}>
              {busy ? $t("Açılıyor…") : $t("Kilidi aç")}
            </Button>
            {missingCredential !== "pin" && (
              <button
                onClick={() => {
                  setView("pin");
                  setError(null);
                }}
                className="inline-flex items-center justify-center gap-1.5 text-xs text-muted transition-colors hover:text-text"
              >
                {$t("PIN kullan")}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
