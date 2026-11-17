import { t as $t } from "@/lib/i18n";
import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Button, Input, Loader, Lock, OtpInput } from "@/kit";
import { Key } from "@/kit/ext";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { useWalletStore } from "@/stores/walletStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { toast } from "@/stores/toastStore";
import { shortAddress } from "@/lib/utils";

type Method = "pin" | "password";

const PIN_LENGTH = 6;

export function UnlockPage() {
  const navigate = useNavigate();
  const { unlock, wallet, unlocked } = useWalletStore();
  const settingsName = useSettingsStore((s) => s.walletName);
  const isSetUp = useSettingsStore((s) => s.isSetUp);
  const displayName = wallet?.name || settingsName;

  const [method, setMethod] = useState<Method>("pin");
  const [pin, setPin] = useState<string[]>(() => Array(PIN_LENGTH).fill(""));
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const digits = pin.join("");

  if (!isSetUp) return <Navigate to="/welcome" replace />;
  if (unlocked) return <Navigate to="/" replace />;

  async function attempt(secret: string) {
    if (busy || !secret) return;
    setBusy(true);
    setError(null);
    const ok = await unlock(secret);
    setBusy(false);
    if (ok) {
      toast($t("Cüzdan açıldı"), "success");
      setTimeout(() => navigate("/", { replace: true }), 260);
    } else {
      setError(useWalletStore.getState().error ?? $t("Hatalı giriş. Tekrar dene."));
      setTimeout(() => {
        setError(null);
        setPin(Array(PIN_LENGTH).fill(""));
      }, 700);
    }
  }

  return (
    <div className="screen-center">
      <div className="w-full max-w-sm animate-fade-up rounded-card border border-line bg-surface p-7 text-center">
        <div className="mx-auto w-fit">
          <ProfileAvatar size={48} />
        </div>

        <h1 className="mt-4 text-base font-semibold text-text">{displayName}</h1>
        <p className="mt-0.5 font-mono text-[11px] text-muted">
          {wallet ? shortAddress(wallet.address, 5) : $t("Cüzdan kilitli")}
        </p>

        {method === "pin" ? (
          <>
            <div className="mt-7 flex justify-center">
              <OtpInput
                length={PIN_LENGTH}
                value={pin}
                onChange={(next) => {
                  setPin(next);
                  setError(null);
                  const code = next.join("");
                  if (code.length === PIN_LENGTH) void attempt(code);
                }}
              />
            </div>
            <p className="mb-4 mt-3 min-h-[16px] text-xs text-danger">{error ?? ""}</p>

            <Button className="w-full" disabled={busy || digits.length !== PIN_LENGTH} onClick={() => void attempt(digits)}>
              {busy ? <Loader size={15} className="animate-spin" /> : <Lock size={15} />}
              {busy ? $t("Açılıyor…") : $t("Kilidi aç")}
            </Button>

            <button
              onClick={() => {
                setMethod("password");
                setError(null);
              }}
              className="mt-4 inline-flex items-center gap-1.5 text-xs text-muted transition-colors hover:text-text"
            >
              <Key size={12} /> {$t("Parola ile gir")}
            </button>
          </>
        ) : (
          <div className="mt-6 flex flex-col gap-3 text-left">
            <Input
              type="password"
              placeholder={$t("Parola")}
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void attempt(password)}
              error={error ?? undefined}
            />
            <Button onClick={() => void attempt(password)} disabled={busy} size="lg" className="w-full" iconLeft={<Lock size={15} />}>
              {busy ? <Loader size={15} className="animate-spin" /> : null}
              {busy ? $t("Açılıyor…") : $t("Kilidi aç")}
            </Button>
            <button
              onClick={() => {
                setMethod("pin");
                setError(null);
              }}
              className="text-center text-xs text-muted transition-colors hover:text-text"
            >
              {$t("PIN kullan")}
            </button>
          </div>
        )}

        <div className="mt-6 border-t border-line pt-4">
          <button
            onClick={() => navigate("/welcome")}
            className="text-[11px] text-muted transition-colors hover:text-textsoft"
          >
            {$t("Başka cüzdan kullan")}
          </button>
          <div className="mt-3 text-[10px] font-medium uppercase tracking-[0.2em] text-muted">
            Vexaris Wallet
          </div>
        </div>
      </div>
    </div>
  );
}
