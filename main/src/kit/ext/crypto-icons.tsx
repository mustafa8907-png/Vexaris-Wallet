import type { ReactNode, SVGProps } from "react";
import { cn } from "../cn";


export type ExtIconProps = SVGProps<SVGSVGElement> & { size?: number | string };

function makeExt(children: ReactNode, strokeWidth = 1.7) {
  return function ExtIcon({ size = 20, ...rest }: ExtIconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
        {...rest}
      >
        {children}
      </svg>
    );
  };
}

export const Wallet = makeExt(
  <>
    <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18a2 2 0 0 1 2 2v1.5" />
    <rect x="3.5" y="7.5" width="17" height="12" rx="3" />
    <path d="M15.5 13.5h5" />
    <circle cx="15.5" cy="13.5" r="1" fill="currentColor" />
  </>,
);

export const Send = makeExt(
  <>
    <path d="m20.5 3.5-9.5 9.5" />
    <path d="m20.5 3.5-6 17-3.5-7.5-7.5-3.5 17-6Z" />
  </>,
);

export const ArrowDownLeft = makeExt(<path d="M17 7 7 17m0 0h7.5M7 17V9.5" />, 1.9);

export const Swap = makeExt(
  <>
    <path d="M7 10V4m0 0L4 7m3-3 3 3" />
    <path d="M17 14v6m0 0-3-3m3 3 3-3" />
    <path d="M7 14a4 4 0 0 0 4 4h1M17 10a4 4 0 0 0-4-4h-1" />
  </>,
  1.8,
);

export const QrCode = makeExt(
  <>
    <rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1.5" />
    <rect x="14" y="3.5" width="6.5" height="6.5" rx="1.5" />
    <rect x="3.5" y="14" width="6.5" height="6.5" rx="1.5" />
    <path d="M14 14h2.5v2.5H14ZM18 14h2.5v2.5H18ZM14 18h6.5v2.5H16" />
  </>,
);

export const Globe = makeExt(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M3.4 9.5h17.2M3.4 14.5h17.2" />
    <path d="M12 3a13.5 13.5 0 0 1 0 18M12 3a13.5 13.5 0 0 0 0 18" />
  </>,
);

export const TrendingUp = makeExt(
  <>
    <path d="m3.5 16.5 5.5-5.5 4 4 7.5-7.5" />
    <path d="M15 7.5h5.5V13" />
  </>,
  1.9,
);

export const TrendingDown = makeExt(
  <>
    <path d="m3.5 7.5 5.5 5.5 4-4 7.5 7.5" />
    <path d="M15 16.5h5.5V11" />
  </>,
  1.9,
);

export const EyeOff = makeExt(
  <>
    <path d="M3 3l18 18" />
    <path d="M10.6 10.6a2.5 2.5 0 0 0 3.5 3.5" />
    <path d="M9.4 5.5A9.7 9.7 0 0 1 12 5.2c6 0 9.5 6.8 9.5 6.8a16.8 16.8 0 0 1-3.1 4.1M6.2 6.8C3.9 8.6 2.5 12 2.5 12s3.5 6.8 9.5 6.8c1.5 0 2.9-.4 4.1-1" />
  </>,
);

export const Key = makeExt(
  <>
    <circle cx="8" cy="15" r="4.2" />
    <path d="m11 12 9-9M16.5 6.5l2.5 2.5M14 9l2 2" />
  </>,
);

export const Fingerprint = makeExt(
  <>
    <path d="M6.5 11a5.5 5.5 0 0 1 11 0v2.5" />
    <path d="M9.5 11a2.5 2.5 0 0 1 5 0c0 3.5-1.2 6.5-3 8.5" />
    <path d="M12 11.5c0 2.8-.8 5.2-2.5 7" />
    <path d="M4 9.5a8.5 8.5 0 0 1 15.2-3.2M6.2 15.5c-.3 1.4-.9 2.7-1.7 3.8M17 16.5a11 11 0 0 1-1.3 3.2" />
  </>,
);

export const Sliders = makeExt(
  <>
    <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
    <circle cx="15" cy="7" r="2" />
    <circle cx="9" cy="17" r="2" />
  </>,
);

export const ExternalLink = makeExt(
  <>
    <path d="M14 4h6v6M20 4l-8.5 8.5" />
    <path d="M18 13.5V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4.5" />
  </>,
);

export const Coins = makeExt(
  <>
    <ellipse cx="9.5" cy="7" rx="5.5" ry="2.8" />
    <path d="M4 7v5c0 1.5 2.5 2.8 5.5 2.8S15 13.5 15 12V7" />
    <path d="M15 10.2c2.8.3 5 1.4 5 2.8v4c0 1.5-2.5 2.8-5.5 2.8-2.6 0-4.8-.9-5.3-2.2" />
  </>,
);

export const Flame = makeExt(
  <path d="M12 3c.6 3.2-2 4.8-2 7.5a2.5 2.5 0 0 0 4.6 1.3c.3-1 .4-2 .4-2.8 2.6 1.6 4 4 4 6.5a7 7 0 1 1-14 0c0-3.8 3.2-6.8 7-12.5Z" />,
);

export const Compass = makeExt(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="m15.8 8.2-2.2 5.4-5.4 2.2 2.2-5.4 5.4-2.2Z" />
  </>,
);

export const Archive = makeExt(
  <>
    <rect x="3" y="4" width="18" height="4.5" rx="1.5" />
    <path d="M5 8.5V18a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5M10 12.5h4" />
  </>,
);

export const FileCode = makeExt(
  <>
    <path d="M14 3.5H7A2.5 2.5 0 0 0 4.5 6v12A2.5 2.5 0 0 0 7 20.5h10a2.5 2.5 0 0 0 2.5-2.5V9L14 3.5Z" />
    <path d="M14 3.5V9h5.5M10 13l-2 2 2 2M14 13l2 2-2 2" />
  </>,
);

export const Activity = makeExt(<path d="M3 12h3.8l2.4-6.5 4.6 13 2.7-6.5H21" />, 1.9);

export const CreditCard = makeExt(
  <>
    <rect x="3" y="5" width="18" height="14" rx="3" />
    <path d="M3 10h18M7 15h4" />
  </>,
);


export type TokenSymbol =
  | "BTC"
  | "ETH"
  | "USDT"
  | "SOL"
  | "BNB"
  | "TRX"
  | "USDC"
  | "AVAX"
  | "ARB"
  | "TON"
  | "LINK";

const TOKEN_META: Record<TokenSymbol, { bg: string; fg: string; glyph: ReactNode }> = {
  BTC: {
    bg: "#F7931A",
    fg: "#FFFFFF",
    glyph: (
      <path
        d="M10.2 6.5v1.6m2.8-1.6v1.6M10.2 15.9v1.6m2.8-1.6v1.6M8.5 8.1h5.2a2 2 0 0 1 0 3.9H9.5h4.6a2 2 0 0 1 0 3.9H8.5M9.6 8.1v7.8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    ),
  },
  ETH: {
    bg: "#627EEA",
    fg: "#FFFFFF",
    glyph: (
      <>
        <path d="M12 4.5 7.4 12.1 12 14.7l4.6-2.6L12 4.5Z" fill="currentColor" fillOpacity="0.92" />
        <path d="M12 16.2 7.4 13.5 12 19.8l4.6-6.3-4.6 2.7Z" fill="currentColor" fillOpacity="0.72" />
      </>
    ),
  },
  USDT: {
    bg: "#26A17B",
    fg: "#FFFFFF",
    glyph: (
      <>
        <path
          d="M7 7.5h10M12 7.5v10"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <ellipse
          cx="12"
          cy="11.5"
          rx="5.2"
          ry="1.7"
          stroke="currentColor"
          strokeWidth="1.5"
          fill="none"
        />
      </>
    ),
  },
  SOL: {
    bg: "#14F195",
    fg: "#0B0B0D",
    glyph: (
      <>
        <path d="M7.5 8.2h10.2l-1.7-1.8H5.8l1.7 1.8Z" fill="currentColor" />
        <path d="M16.5 12.9H6.3l1.7-1.8h10.2l-1.7 1.8Z" fill="currentColor" />
        <path d="M7.5 17.6h10.2l-1.7-1.8H5.8l1.7 1.8Z" fill="currentColor" />
      </>
    ),
  },
  BNB: {
    bg: "#F0B90B",
    fg: "#0B0B0D",
    glyph: (
      <>
        <path
          d="m12 5.5 2.8 2.8-1.4 1.4L12 8.3l-1.4 1.4-1.4-1.4L12 5.5Zm0 13-2.8-2.8 1.4-1.4 1.4 1.4 1.4-1.4 1.4 1.4L12 18.5Zm-4.8-4.8L5.5 12l1.7-1.7 1.4 1.7-1.4 1.7Zm9.6 0-1.4-1.7 1.4-1.7L18.5 12l-1.7 1.7ZM12 10.3 13.7 12 12 13.7 10.3 12 12 10.3Z"
          fill="currentColor"
        />
      </>
    ),
  },
  TRX: {
    bg: "#EF0027",
    fg: "#FFFFFF",
    glyph: (
      <path
        d="M6.2 6.8 17.8 9l-6.1 9.5L6.2 6.8Zm0 0 6.5 5.4m5.1-3.2-5.1 3.2-1 6.3"
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    ),
  },
  USDC: {
    bg: "#2775CA",
    fg: "#FFFFFF",
    glyph: (
      <path
        d="M12 6.6v1.2m0 8.4v1.2M14.3 9.4c-.3-.9-1.2-1.5-2.3-1.5-1.3 0-2.3.8-2.3 1.9 0 2.4 4.7 1.6 4.7 4.1 0 1.2-1 2.1-2.4 2.1-1.2 0-2.1-.6-2.5-1.6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />
    ),
  },
  AVAX: {
    bg: "#E84142",
    fg: "#FFFFFF",
    glyph: (
      <>
        <path d="M12 6 6.4 16.5h3.8L13.9 9.6 12 6Z" fill="currentColor" />
        <path d="m15.2 12.2-2.3 4.3h4.7l-2.4-4.3Z" fill="currentColor" />
      </>
    ),
  },
  ARB: {
    bg: "#28A0F0",
    fg: "#FFFFFF",
    glyph: (
      <path
        d="M12 5.2 17.6 8.4v7.2L12 18.8l-5.6-3.2V8.4L12 5.2Zm-2.2 9.8 2.2-5.6 2.2 5.6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    ),
  },
  TON: {
    bg: "#0098EA",
    fg: "#FFFFFF",
    glyph: (
      <path
        d="M7.2 7.2h9.6c1 0 1.6 1.1 1.1 2L12 18.5 6.1 9.2c-.5-.9.1-2 1.1-2ZM12 7.2v11"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    ),
  },
  LINK: {
    bg: "#375BD2",
    fg: "#FFFFFF",
    glyph: (
      <path
        d="M12 5.3 17.5 8.5v7L12 18.7 6.5 15.5v-7L12 5.3Z"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinejoin="round"
        fill="none"
      />
    ),
  },
};

export function TokenGlyph({
  symbol,
  size = "md",
  className,
}: {
  symbol: TokenSymbol | string;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}) {
  const meta = TOKEN_META[symbol as TokenSymbol];
  const dims =
    size === "xs"
      ? "size-6 text-[10px]"
      : size === "sm"
        ? "size-8 text-[11px]"
        : size === "lg"
          ? "size-12 text-sm"
          : "size-10 text-xs";
  const svgSize = size === "xs" ? 15 : size === "sm" ? 18 : size === "lg" ? 26 : 22;

  if (!meta) {
    return (
      <span
        className={cn(
          dims,
          "inline-grid shrink-0 place-items-center rounded-ctrl border border-line bg-surface3 font-mono font-bold text-text",
          className,
        )}
      >
        {symbol.slice(0, 3).toUpperCase()}
      </span>
    );
  }

  return (
    <span
      className={cn(
        dims,
        "inline-grid shrink-0 place-items-center rounded-ctrl shadow-1 ring-1 ring-black/10 dark:ring-white/10",
        className,
      )}
      style={{ backgroundColor: meta.bg, color: meta.fg }}
      aria-hidden="true"
    >
      <svg width={svgSize} height={svgSize} viewBox="0 0 24 24">
        {meta.glyph}
      </svg>
    </span>
  );
}

export const Backspace = makeExt(
  <>
    <path d="M8.5 4H19a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H8.5L2.5 12l6-8Z" />
    <path d="m12.5 9.5 5 5" />
    <path d="m17.5 9.5-5 5" />
  </>,
);
