import { t as $t } from "@/lib/i18n";
import { useState } from "react";
import { CheckCircle, SpinnerGap, Plugs, Plus, XCircle } from "@phosphor-icons/react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ChainIcon } from "@/components/TokenIcon";
import { CHAIN_PRESETS, LLAMA_CHAIN_OPTIONS } from "@/lib/chains/presets";
import { allChains } from "@/lib/chains/registry";
import { normalizeRpcUrl, probeRpc, type RpcProbe } from "@/lib/api/network";
import type { Chain } from "@/types/chain";
import { useChainStore } from "@/stores/chainStore";
import { toast } from "@/stores/toastStore";
import { cn } from "@/lib/utils";

interface Props {
  editing?: Chain | null;
  onClose: () => void;
}

interface FormState {
  name: string;
  chainId: string;
  nativeSymbol: string;
  rpcUrl: string;
  explorerUrl: string;
  blockscoutUrl: string;
  llamaChain: string;
  twSlug: string;
  color: string;
}

const EMPTY: FormState = {
  name: "",
  chainId: "",
  nativeSymbol: "ETH",
  rpcUrl: "",
  explorerUrl: "",
  blockscoutUrl: "",
  llamaChain: "",
  twSlug: "",
  color: "#e5484d",
};

function toForm(chain: Chain): FormState {
  return {
    name: chain.name,
    chainId: chain.chainId != null ? String(chain.chainId) : "",
    nativeSymbol: chain.nativeSymbol,
    rpcUrl: chain.rpcUrl,
    explorerUrl: chain.explorerUrl,
    blockscoutUrl: chain.blockscoutUrl ?? "",
    llamaChain: chain.llamaChain ?? "",
    twSlug: chain.twSlug ?? "",
    color: chain.color,
  };
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32);
}

export function NetworkDialog({ editing, onClose }: Props) {
  const { customChains, addCustomChain, updateCustomChain } = useChainStore();
  const [form, setForm] = useState<FormState>(editing ? toForm(editing) : EMPTY);
  const [probe, setProbe] = useState<RpcProbe | null>(null);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const presets = CHAIN_PRESETS.filter((p) => !allChains().some((c) => c.id === p.id));

  const endpointChanged =
    !editing ||
    normalizeRpcUrl(form.rpcUrl) !== normalizeRpcUrl(editing.rpcUrl) ||
    Number(form.chainId) !== editing.chainId;

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (key === "rpcUrl" || key === "chainId") setProbe(null);
    setError(null);
  };

  async function test() {
    setTesting(true);
    setError(null);
    const expected = form.chainId ? Number(form.chainId) : undefined;
    const result = await probeRpc(form.rpcUrl, Number.isFinite(expected) ? expected : undefined);
    setProbe(result);
    if (result.ok && !form.chainId && result.chainId != null) {
      setForm((f) => ({ ...f, chainId: String(result.chainId) }));
    }
    setTesting(false);
  }

  function save() {
    const name = form.name.trim();
    const rpc = normalizeRpcUrl(form.rpcUrl);
    const chainNumber = Number(form.chainId);
    const symbol = form.nativeSymbol.trim().toUpperCase();

    if (name.length < 2) return setError($t("Ağ adı en az 2 karakter olmalı."));
    if (!Number.isInteger(chainNumber) || chainNumber <= 0) {
      return setError($t("Ağ kimliği (chain ID) pozitif bir tam sayı olmalı."));
    }
    if (!rpc) return setError($t("Geçerli bir http(s) RPC adresi gir."));
    if (!symbol) return setError($t("Yerel coin sembolü gerekli (ör. ETH)."));
    if (endpointChanged && !probe?.ok) return setError($t("Kaydetmeden önce bağlantıyı test et."));

    const clash = allChains().find(
      (c) => c.chainId === chainNumber && c.id !== editing?.id,
    );
    if (clash) return setError($t("Bu ağ kimliği zaten kayıtlı: {0}.", [clash.name]));

    const id = editing?.id ?? `custom-${slugify(name) || chainNumber}`;
    if (!editing && customChains.some((c) => c.id === id)) {
      return setError($t("Bu adda bir ağ zaten var. Farklı bir ad seç."));
    }

    const explorer = form.explorerUrl.trim().replace(/\/$/, "");
    const blockscout = form.blockscoutUrl.trim().replace(/\/$/, "");
    const chain: Chain = {
      id,
      kind: "evm",
      name,
      shortName: symbol.slice(0, 6),
      nativeSymbol: symbol,
      iconSymbol: symbol,
      color: form.color,
      rpcUrl: rpc,
      explorerUrl: explorer || rpc,
      blockscoutUrl: blockscout || undefined,
      chainId: chainNumber,
      live: true,
      twSlug: form.twSlug.trim() || undefined,
      llamaChain: form.llamaChain.trim() || undefined,
      custom: true,
    };

    if (editing) {
      updateCustomChain(editing.id, chain);
      toast($t("{0} güncellendi", [name]), "success");
    } else {
      addCustomChain(chain);
      toast($t("{0} eklendi ve etkinleştirildi", [name]), "success");
    }
    onClose();
  }

  return (
    <Modal
      title={editing ? $t("Ağı düzenle") : $t("Ağ ekle")}
      description={
        editing
          ? $t("RPC ucunu değiştirdiysen yeniden test et.")
          : $t("Hazır ağlardan birini seç ya da kendi EVM ağını tanımla. Uç, kaydedilmeden önce sınanır.")
      }
      onClose={onClose}
      width="lg"
    >
      {!editing && presets.length > 0 && (
        <div className="mb-5">
          <div className="section-title mb-2">{$t("Hazır ağlar")}</div>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {presets.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  addCustomChain(p);
                  toast(`${p.name} eklendi`, "success");
                  onClose();
                }}
                className="focus-ring flex items-center gap-2 rounded-lg border border-white/[0.06] bg-surface-800/70 px-2.5 py-2 text-left transition-colors hover:border-accent/40"
              >
                <ChainIcon chainId={p.id} size={20} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] text-zinc-200">{p.name}</span>
                  <span className="block text-[10px] text-zinc-600">
                    {p.nativeSymbol} · {p.chainId}
                  </span>
                </span>
                <Plus size={13} className="shrink-0 text-zinc-600" />
              </button>
            ))}
          </div>
          <div className="hairline mt-5 h-px" />
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input
          label={$t("Ağ adı")}
          placeholder={$t("ör. zkSync Sepolia")}
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
        />
        <Input
          label={$t("Ağ kimliği (chain ID)")}
          placeholder={$t("ör. 8453")}
          inputMode="numeric"
          value={form.chainId}
          onChange={(e) => set("chainId", e.target.value.replace(/[^0-9]/g, ""))}
        />
        <Input
          label={$t("Yerel coin sembolü")}
          placeholder="ETH"
          value={form.nativeSymbol}
          onChange={(e) => set("nativeSymbol", e.target.value.toUpperCase().slice(0, 10))}
        />
        <div>
          <span className="mb-1.5 block text-xs font-medium text-zinc-400">{$t("Vurgu rengi")}</span>
          <div className="flex h-11 items-center gap-2 rounded-xl border border-white/[0.08] bg-surface-800 px-3">
            <input
              type="color"
              value={form.color}
              onChange={(e) => set("color", e.target.value)}
              className="h-6 w-8 cursor-pointer rounded border-0 bg-transparent p-0"
              aria-label={$t("Ağ rengi")}
            />
            <span className="font-mono text-[12px] text-zinc-400">{form.color}</span>
          </div>
        </div>
        <div className="sm:col-span-2">
          <Input
            label={$t("RPC adresi")}
            placeholder="https://mainnet.base.org"
            value={form.rpcUrl}
            onChange={(e) => set("rpcUrl", e.target.value)}
          />
        </div>
        <Input
          label={$t("Gezgin adresi (isteğe bağlı)")}
          placeholder="https://basescan.org"
          value={form.explorerUrl}
          onChange={(e) => set("explorerUrl", e.target.value)}
        />
        <Input
          label={$t("Gezgin API adresi (isteğe bağlı)")}
          placeholder="https://base.blockscout.com"
          value={form.blockscoutUrl}
          onChange={(e) => set("blockscoutUrl", e.target.value)}
        />
        <div>
          <span className="mb-1.5 block text-xs font-medium text-zinc-400">
            {$t("Fiyat kaynağı anahtarı")}
          </span>
          <input
            list="llama-chains"
            value={form.llamaChain}
            onChange={(e) => set("llamaChain", e.target.value)}
            placeholder="base"
            className="focus-ring h-11 w-full rounded-xl border border-white/[0.08] bg-surface-800 px-3.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-accent/60"
          />
          <datalist id="llama-chains">
            {LLAMA_CHAIN_OPTIONS.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <Input
          label={$t("İkon klasörü (isteğe bağlı)")}
          placeholder="base"
          value={form.twSlug}
          onChange={(e) => set("twSlug", e.target.value)}
        />
      </div>

      <p className="mt-2 text-[10px] leading-relaxed text-zinc-600">
        {$t("Fiyat ve ikon anahtarları ilgili verileri besler. Boş bırakılırsa o bölüm \"veri yok\" olarak gösterilir.")}
      </p>

      {probe && (
        <div
          className={cn(
            "mt-3 flex items-start gap-2 rounded-lg border p-2.5 text-[11px] leading-relaxed",
            probe.ok
              ? "border-success/25 bg-success/[0.07] text-success"
              : "border-danger/25 bg-danger/[0.07] text-danger",
          )}
        >
          {probe.ok ? (
            <CheckCircle size={14} className="mt-px shrink-0" />
          ) : (
            <XCircle size={14} className="mt-px shrink-0" />
          )}
          <span>
            {probe.ok
              ? `Bağlantı başarılı · ağ ${probe.chainId} · blok ${probe.blockNumber?.toLocaleString(
                  "tr-TR",
                )} · ${probe.latencyMs} ms`
              : probe.error}
          </span>
        </div>
      )}

      {error && (
        <div className="mt-3 rounded-lg border border-danger/25 bg-danger/[0.07] px-2.5 py-2 text-[11px] text-danger">
          {error}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          variant="secondary"
          onClick={() => void test()}
          disabled={testing || !form.rpcUrl.trim()}
        >
          {testing ? <SpinnerGap size={14} className="animate-spin" /> : <Plugs size={14} />}
          {testing ? $t("Sınanıyor…") : $t("Bağlantıyı test et")}
        </Button>
        <Button className="flex-1" onClick={save} disabled={testing}>
          {editing ? $t("Değişiklikleri kaydet") : $t("Ağı ekle")}
        </Button>
      </div>
    </Modal>
  );
}
