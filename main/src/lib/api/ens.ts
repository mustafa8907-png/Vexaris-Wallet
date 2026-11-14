import { keccak256, toHex, toChecksumAddress } from "@/lib/crypto/keccak";
import { getChain } from "@/lib/chains/registry";
import { rpcBatch } from "./rpc";


const REGISTRY = "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e";
export const ENS_CHAIN = "ethereum";

const SELECTOR = {
  resolver: toHex(keccak256("resolver(bytes32)")).slice(0, 8),
  addr: toHex(keccak256("addr(bytes32)")).slice(0, 8),
  name: toHex(keccak256("name(bytes32)")).slice(0, 8),
};

const NAME_RE = /^[a-z0-9-]{1,63}(\.[a-z0-9-]{1,63})*\.eth$/;
const forwardCache = new Map<string, string | null>();
const reverseCache = new Map<string, string | null>();

export function looksLikeEnsName(input: string): boolean {
  return NAME_RE.test(input.trim().toLowerCase());
}

export function namehash(name: string): string {
  let node: Uint8Array = new Uint8Array(32);
  const normalized = name.trim().toLowerCase();
  if (!normalized) return `0x${toHex(node)}`;
  for (const label of normalized.split(".").reverse()) {
    node = keccak256(new Uint8Array([...node, ...keccak256(label)]));
  }
  return `0x${toHex(node)}`;
}

function wordToAddress(word?: string): string | null {
  if (!word || word === "0x" || word.length < 64) return null;
  const hex = `0x${word.slice(-40)}`;
  return /^0x0{40}$/.test(hex) ? null : toChecksumAddress(hex);
}

function decodeString(word?: string): string | null {
  if (!word || word === "0x" || word.length < 130) return null;
  const body = word.slice(2);
  const offset = Number.parseInt(body.slice(0, 64), 16) * 2;
  const length = Number.parseInt(body.slice(offset, offset + 64), 16) * 2;
  if (!Number.isFinite(offset) || !Number.isFinite(length) || offset + length > body.length)
    return null;
  const text = hexToText(body.slice(offset, offset + length));
  return text || null;
}

function hexToText(hex: string): string {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  try {
    return new TextDecoder().decode(bytes).replace(/\0/g, "").trim();
  } catch {
    return "";
  }
}

async function resolverOf(node: string): Promise<string | null> {
  const chain = getChain(ENS_CHAIN);
  if (!chain) return null;
  const [word] = await rpcBatch<string>(chain, [
    { method: "eth_call", params: [{ to: REGISTRY, data: `0x${SELECTOR.resolver}${node.slice(2)}` }, "latest"] },
  ]);
  return wordToAddress(word);
}

export async function resolveEnsName(name: string): Promise<string | null> {
  const key = name.trim().toLowerCase();
  if (forwardCache.has(key)) return forwardCache.get(key) ?? null;
  if (!looksLikeEnsName(key)) return null;

  let address: string | null = null;
  try {
    const node = namehash(key);
    const resolver = await resolverOf(node);
    if (resolver) {
      const chain = getChain(ENS_CHAIN);
      if (chain) {
        const [word] = await rpcBatch<string>(chain, [
          { method: "eth_call", params: [{ to: resolver, data: `0x${SELECTOR.addr}${node.slice(2)}` }, "latest"] },
        ]);
        address = wordToAddress(word);
      }
    }
  } catch {
    address = null;
  }
  forwardCache.set(key, address);
  return address;
}

export async function reverseEnsName(address: string): Promise<string | null> {
  const key = address.toLowerCase();
  if (reverseCache.has(key)) return reverseCache.get(key) ?? null;
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) return null;

  let name: string | null = null;
  try {
    const node = namehash(`${key.slice(2)}.addr.reverse`);
    const resolver = await resolverOf(node);
    if (resolver) {
      const chain = getChain(ENS_CHAIN);
      if (chain) {
        const [word] = await rpcBatch<string>(chain, [
          { method: "eth_call", params: [{ to: resolver, data: `0x${SELECTOR.name}${node.slice(2)}` }, "latest"] },
        ]);
        const resolved = decodeString(word);
        name = resolved && looksLikeEnsName(resolved) ? resolved : null;
      }
    }
  } catch {
    name = null;
  }
  reverseCache.set(key, name);
  return name;
}
