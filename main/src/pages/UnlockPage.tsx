import { t as $t } from "@/lib/i18n";
import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Key, Lock } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PinInput } from "@/components/ui/PinInput";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { useWalletStore } from "@/stores/walletStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { toast } from "@/stores/toastStore";
import { shortAddress } from "@/lib/utils";

type Method = "pin" | "password";

export function UnlockPage() {
  const navigate = useNavigate();
  const { unlock, wallet, unlocked } = useWalletStore();
  const settingsName = useSettingsStore((s) => s.walletName);
  const isSetUp = useSettingsStore((s) => s.isSetUp);
  const displayName = wallet?.name || settingsName;

  const [method, setMethod] = useState<Method>("pin");
  const [pin, setPin] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "error" | "success">("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keystore yoksa kilit ekranı anlamsız; kullanıcıyı kuruluma gönder.
  if (!isSetUp) return <Navigate to="/welcome" replace />;
  if (unlocked) return <Navigate to="/" replace />;

  async function attempt(secret: string) {
    if (busy || !secret) return;
    setBusy(true);
    setError(null);
    const ok = await unlock(secret);
    setBusy(false);
    if (ok) {
      setStatus("success");
      toast($t("Cüzdan açıldı"), "success");
      setTimeout(() => navigate("/", { replace: true }), 260);
    } else {
      setStatus("error");
      // Deneme sayacı blokeyi metinle döndürür: süreyi kullanıcıya göster.
      setError(useWalletStore.getState().error ?? $t("Hatalı giriş. Tekrar dene."));
      setTimeout(() => {
        setStatus("idle");
        setPin("");
      }, 700);
    }
  }

  return (
    <div className="screen-center">
      <div className="w-full max-w-sm animate-fade-up rounded-xl border border-white/[0.07] bg-surface-850 p-7 text-center">
        <div className="mx-auto w-fit">
          <ProfileAvatar size={48} />
        </div>

        <h1 className="mt-4 text-base font-semibold text-white">{displayName}</h1>
        <p className="mt-0.5 font-mono text-[11px] text-zinc-500">
          {wallet ? shortAddress(wallet.address, 5) : $t("Cüzdan kilitli")}
        </p>

        {method === "pin" ? (
          <>
            <div className="mt-7 flex justify-center">
              <PinInput
                length={6}
                autoFocus
                value={pin}
                status={status}
                onChange={(code) => {
                  setPin(code);
                  if (status === "error") setStatus("idle");
                  setError(null);
                }}
                onComplete={attempt}
              />
            </div>
            <p className="mb-4 mt-3 min-h-[16px] text-xs text-danger">{error ?? ""}</p>

            <Button className="w-full" disabled={busy || pin.length !== 6} onClick={() => attempt(pin)}>
              {busy ? $t("Açılıyor…") : $t("Kilidi aç")}
            </Button>

            <button
              onClick={() => {
                setMethod("password");
                setError(null);
                setStatus("idle");
              }}
              className="mt-4 inline-flex items-center gap-1.5 text-xs text-zinc-500 transition-colors hover:text-white"
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
              onKeyDown={(e) => e.key === "Enter" && attempt(password)}
              error={error ?? undefined}
            />
            <Button onClick={() => attempt(password)} disabled={busy} size="lg" className="w-full">
              <Lock size={15} /> {busy ? $t("Açılıyor…") : $t("Kilidi aç")}
            </Button>
            <button
              onClick={() => {
                setMethod("pin");
                setError(null);
              }}
              className="text-center text-xs text-zinc-500 transition-colors hover:text-white"
            >
              {$t("PIN kullan")}
            </button>
          </div>
        )}

        <div className="mt-6 border-t border-white/[0.06] pt-4">
          <button
            onClick={() => navigate("/welcome")}
            className="text-[11px] text-zinc-600 transition-colors hover:text-zinc-300"
          >
            {$t("Başka cüzdan kullan")}
          </button>
          <div className="mt-3 text-[10px] font-medium uppercase tracking-[0.2em] text-zinc-700">
            Vexaris Wallet
          </div>
        </div>
      </div>
    </div>
  );
}
