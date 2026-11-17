import { memo, useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import {
  cachedIcon,
  chainIconSources,
  markDead,
  markLoaded,
  tokenIconSources,
} from "@/lib/assets/icons";
import { getChain } from "@/lib/chains/registry";
import { TokenGlyph } from "./TokenGlyph";


interface TokenIconProps {
  symbol: string;
  chainId?: string;
  address?: string;
  size?: number;
  className?: string;
  badge?: boolean;
}

export const TokenIcon = memo(function TokenIcon({
  symbol,
  chainId,
  address,
  size = 32,
  className,
  badge = false,
}: TokenIconProps) {
  const chain = chainId ? getChain(chainId) : undefined;
  const sources = useMemo(
    () => tokenIconSources(chainId ?? "", symbol, address, chain?.twSlug),
    [chainId, symbol, address, chain?.twSlug],
  );
  const url = useFirstLoaded(sources);

  const image = url ? (
    <img
      src={url}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      className="h-full w-full object-contain"
      draggable={false}
    />
  ) : (
    <TokenGlyph symbol={symbol} size={size} />
  );

  return (
    <span
      className={cn("relative inline-grid shrink-0 place-items-center", className)}
      style={{ width: size, height: size }}
    >
      <span
        className="grid h-full w-full place-items-center overflow-hidden rounded-full bg-surface2 ring-1 ring-inset ring-line"
        style={{ width: size, height: size }}
      >
        {image}
      </span>
      {badge && chain && (
        <span
          className="absolute -bottom-0.5 -right-0.5 grid place-items-center overflow-hidden rounded-full ring-2 ring-surface"
          style={{ width: Math.max(12, size * 0.42), height: Math.max(12, size * 0.42) }}
        >
          <ChainIcon chainId={chain.id} size={Math.max(12, size * 0.42)} />
        </span>
      )}
    </span>
  );
});

export const ChainIcon = memo(function ChainIcon({
  chainId,
  size = 20,
  className,
}: {
  chainId: string;
  size?: number;
  className?: string;
}) {
  const chain = getChain(chainId);
  const sources = useMemo(
    () => chainIconSources(chainId, chain?.twSlug),
    [chainId, chain?.twSlug],
  );
  const url = useFirstLoaded(sources);

  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden rounded-full bg-surface2 ring-1 ring-inset ring-line",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {url ? (
        <img
          src={url}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-contain"
          draggable={false}
        />
      ) : (
        <TokenGlyph symbol={chain?.iconSymbol ?? "?"} size={size} />
      )}
    </span>
  );
});

function useFirstLoaded(sources: string[]): string | null {
  const [index, setIndex] = useState(0);
  const [loaded, setLoaded] = useState<string | null>(null);
  const signature = sources.join("|");
  const hit = cachedIcon(sources);

  useEffect(() => {
    setIndex(0);
  }, [signature]);

  useEffect(() => {
    if (hit) return;
    const url = sources[index];
    if (!url) return;
    let cancelled = false;
    const probe = new Image();
    probe.onload = () => {
      if (cancelled) return;
      markLoaded(url);
      setLoaded(url);
    };
    probe.onerror = () => {
      if (cancelled) return;
      markDead(url);
      setIndex((i) => (sources[i] === url ? i + 1 : i));
    };
    probe.src = url;
    return () => {
      cancelled = true;
      probe.onload = null;
      probe.onerror = null;
    };
  }, [sources, index, hit]);

  if (hit) return hit;
  return loaded != null && sources.includes(loaded) ? loaded : null;
}
