import { cn } from "@/lib/utils";


const UNKNOWN_HUES = [
  ["#e5484d", "#ff8a5c"],
  ["#2f6bff", "#4cc9f0"],
  ["#3ecf8e", "#c7f284"],
  ["#ff4d9d", "#ffa1c9"],
  ["#f5a524", "#ffd166"],
  ["#8b5cf6", "#c084fc"],
  ["#14b8a6", "#5eead4"],
  ["#f43f5e", "#fda4af"],
];

function hueFor(symbol: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < symbol.length; i++) hash = (hash * 31 + symbol.charCodeAt(i)) >>> 0;
  const pair = UNKNOWN_HUES[hash % UNKNOWN_HUES.length];
  return [pair[0], pair[1]];
}

interface Props {
  symbol: string;
  size?: number;
  className?: string;
}

export function TokenGlyph({ symbol, size = 32, className }: Props) {
  const key = symbol.toUpperCase();
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 32 32",
    className: cn("shrink-0", className),
    "aria-hidden": true as const,
  };

  switch (key) {
    case "ETH":
    case "WETH":
      return (
        <svg {...common}>
          <circle cx="16" cy="16" r="16" fill="#627EEA" />
          <path d="M16 4.5v8.6l5.9 2.6L16 4.5z" fill="#fff" opacity=".9" />
          <path d="M16 4.5L10.1 15.7 16 13.1V4.5z" fill="#fff" opacity=".62" />
          <path d="M16 21.2v6.3l5.9-8.3-5.9 2z" fill="#fff" opacity=".9" />
          <path d="M16 27.5v-6.3l-5.9-2 5.9 8.3z" fill="#fff" opacity=".62" />
          <path d="M16 20l5.9-3.4L16 13.1V20z" fill="#fff" opacity=".95" />
          <path d="M10.1 16.6L16 20v-6.9l-5.9 3.5z" fill="#fff" opacity=".78" />
        </svg>
      );

    case "SOL":
      return (
        <svg {...common}>
          <defs>
            <linearGradient id="sol-g" x1="6" y1="26" x2="26" y2="6" gradientUnits="userSpaceOnUse">
              <stop stopColor="#9945FF" />
              <stop offset="1" stopColor="#14F195" />
            </linearGradient>
          </defs>
          <circle cx="16" cy="16" r="16" fill="#0f0f12" />
          <circle cx="16" cy="16" r="16" fill="url(#sol-g)" opacity=".16" />
          <g fill="url(#sol-g)">
            <polygon points="8.6,10 23.4,10 20.9,13.1 6.1,13.1" />
            <polygon points="6.1,14.5 20.9,14.5 18.4,17.6 3.6,17.6" />
            <polygon points="8.6,19 23.4,19 20.9,22.1 6.1,22.1" />
          </g>
        </svg>
      );

    case "POL":
    case "MATIC":
      return (
        <svg {...common}>
          <circle cx="16" cy="16" r="16" fill="#8247E5" />
          <path
            d="M16 7.2l6.6 3.8v7.6L16 22.4l-6.6-3.8V11l6.6-3.8z"
            fill="none"
            stroke="#fff"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <circle cx="16" cy="14.8" r="2.6" fill="#fff" />
        </svg>
      );

    case "BNB":
      return (
        <svg {...common}>
          <circle cx="16" cy="16" r="16" fill="#F3BA2F" />
          <g fill="#fff">
            <path d="M16 6.6l3 3-3 3-3-3 3-3z" />
            <path d="M9.2 13.4l3 3-3 3-3-3 3-3z" />
            <path d="M22.8 13.4l3 3-3 3-3-3 3-3z" />
            <path d="M16 19.4l3 3-3 3-3-3 3-3z" />
            <path d="M16 13.2l2.8 2.8L16 18.8 13.2 16 16 13.2z" />
          </g>
        </svg>
      );

    case "USDC":
      return (
        <svg {...common}>
          <circle cx="16" cy="16" r="16" fill="#2775CA" />
          <path
            d="M16 5.5a10.5 10.5 0 100 21 10.5 10.5 0 000-21zm0 18.8a8.3 8.3 0 110-16.6 8.3 8.3 0 010 16.6z"
            fill="#fff"
            opacity=".35"
          />
          <text x="16" y="21.4" textAnchor="middle" fontFamily="Inter Variable, sans-serif" fontSize="14" fontWeight="700" fill="#fff">
            $
          </text>
        </svg>
      );

    case "USDT":
      return (
        <svg {...common}>
          <circle cx="16" cy="16" r="16" fill="#26A17B" />
          <path d="M8 10h16v3.4h-6.2V23h-3.6V13.4H8V10z" fill="#fff" />
        </svg>
      );

    case "DAI":
      return (
        <svg {...common}>
          <circle cx="16" cy="16" r="16" fill="#F5AC37" />
          <path d="M9 10h7.5a6 6 0 010 12H9V10zm3.4 3.2v5.6h4a2.8 2.8 0 000-5.6h-4z" fill="#fff" />
          <path d="M7.5 14.6h11v1.5h-11zM7.5 17.2h11v1.5h-11z" fill="#F5AC37" />
        </svg>
      );

    case "LINK":
      return (
        <svg {...common}>
          <circle cx="16" cy="16" r="16" fill="#2A5ADA" />
          <path
            d="M16 6.2l7.1 4.1v8.3L16 22.7l-7.1-4.1v-8.3L16 6.2z"
            fill="none"
            stroke="#fff"
            strokeWidth="2.1"
            strokeLinejoin="round"
          />
          <path d="M16 12.2l3 1.8v3.5l-3 1.8-3-1.8v-3.5l3-1.8z" fill="#fff" />
        </svg>
      );

    case "ARB":
      return (
        <svg {...common}>
          <circle cx="16" cy="16" r="16" fill="#12AAFF" />
          <path d="M16 6.4L25 24h-5.6L16 15.3 12.6 24H7l9-17.6z" fill="#fff" />
          <path d="M18.4 24l4.2-7.4 2 3.5L22.4 24h-4z" fill="#fff" opacity=".7" />
        </svg>
      );

    case "OP":
      return (
        <svg {...common}>
          <circle cx="16" cy="16" r="16" fill="#FF0420" />
          <text x="16" y="20.6" textAnchor="middle" fontFamily="Inter Variable, sans-serif" fontSize="11" fontWeight="700" fill="#fff">
            OP
          </text>
        </svg>
      );

    case "AVAX":
      return (
        <svg {...common}>
          <circle cx="16" cy="16" r="16" fill="#E84142" />
          <path d="M16 7l8 15h-6l-2-3.6-2 3.6H8L16 7z" fill="#fff" />
        </svg>
      );

    case "WBTC":
    case "BTCB":
    case "BTC":
      return (
        <svg {...common}>
          <circle cx="16" cy="16" r="16" fill="#F09242" />
          <text x="16" y="21.6" textAnchor="middle" fontFamily="Inter Variable, sans-serif" fontSize="15" fontWeight="700" fill="#fff">
            ₿
          </text>
        </svg>
      );

    default: {
      const [from, to] = hueFor(key);
      const id = `glyph-${key.replace(/[^A-Z0-9]/g, "")}-${size}`;
      const label = key.replace(/[^A-Z0-9]/g, "").slice(0, 3) || "?";
      return (
        <svg {...common}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
              <stop stopColor={from} />
              <stop offset="1" stopColor={to} />
            </linearGradient>
          </defs>
          <circle cx="16" cy="16" r="16" fill={`url(#${id})`} />
          <circle cx="16" cy="16" r="16" fill="#09090a" opacity=".28" />
          <text
            x="16"
            y={label.length > 2 ? 20 : 21}
            textAnchor="middle"
            fontFamily="Inter Variable, sans-serif"
            fontSize={label.length > 2 ? 9 : 12}
            fontWeight="700"
            fill="#fff"
          >
            {label}
          </text>
        </svg>
      );
    }
  }
}
