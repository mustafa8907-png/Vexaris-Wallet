import type { ReactNode, SVGProps } from "react";

export type IconProps = SVGProps<SVGSVGElement> & { size?: number | string };

function make(children: ReactNode, strokeWidth = 1.7) {
  return function Icon({ size = 20, ...rest }: IconProps) {
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

export const Sun = make(
  <>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </>,
);
export const Moon = make(<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />);
export const Download = make(<path d="M12 3v12m0 0 4.5-4.5M12 15l-4.5-4.5M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />);
export const Upload = make(<path d="M12 20V8m0 0 4.5 4.5M12 8l-4.5 4.5M4 6V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1" />);
export const Check = make(<path d="m4.5 12.5 5 5 10-11" />, 2);
export const Copy = make(
  <>
    <rect x="9" y="9" width="12" height="12" rx="3" />
    <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
  </>,
);
export const X = make(<path d="M6 6l12 12M18 6 6 18" />, 2);
export const Plus = make(<path d="M12 5v14M5 12h14" />, 2);
export const Minus = make(<path d="M5 12h14" />, 2);
export const ChevronDown = make(<path d="m6 9 6 6 6-6" />, 2);
export const ChevronRight = make(<path d="m9 6 6 6-6 6" />, 2);
export const ChevronLeft = make(<path d="m15 6-6 6 6 6" />, 2);
export const ArrowLeft = make(<path d="M20 12H4m0 0 6-6m-6 6 6 6" />, 1.9);
export const ArrowRight = make(<path d="M4 12h16m0 0-6-6m6 6-6 6" />, 1.9);
export const WifiOff = make(
  <>
    <path d="m3 3 18 18" />
    <path d="M8.5 8.5a9.5 9.5 0 0 1 11 1.5M5 12.5a6.5 6.5 0 0 1 4-2M12 19h.01" />
  </>,
  1.9,
);
export const ArrowUpRight = make(<path d="M7 17 17 7m0 0h-7m7 0v7" />, 1.9);
export const Search = make(
  <>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </>,
);
export const Star = make(<path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1.1 5.9L12 16.9 6.7 19.7l1.1-5.9L3.5 9.7l5.9-.8Z" />);
export const Heart = make(<path d="M12 20s-7.5-4.6-7.5-9.4A4.1 4.1 0 0 1 12 7.6a4.1 4.1 0 0 1 7.5 3C19.5 15.4 12 20 12 20Z" />);
export const Bell = make(<path d="M6 9a6 6 0 1 1 12 0c0 3.2.8 5 1.6 6H4.4C5.2 14 6 12.2 6 9ZM10 19a2 2 0 0 0 4 0" />);
export const Settings = make(
  <>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2.8 13.4 5a7.4 7.4 0 0 1 2.1.9l2.4-.8 1.5 2.6-1.6 1.9a7.6 7.6 0 0 1 0 2.2l1.6 1.9-1.5 2.6-2.4-.8a7.4 7.4 0 0 1-2.1.9L12 21.2 10.6 19a7.4 7.4 0 0 1-2.1-.9l-2.4.8-1.5-2.6L6.2 14a7.6 7.6 0 0 1 0-2.2L4.6 9.5l1.5-2.6 2.4.8a7.4 7.4 0 0 1 2.1-.9Z" />
  </>,
);
export const User = make(
  <>
    <circle cx="12" cy="8.5" r="3.8" />
    <path d="M4.8 20a7.5 7.5 0 0 1 14.4 0" />
  </>,
);
export const Mail = make(
  <>
    <rect x="3" y="5" width="18" height="14" rx="3" />
    <path d="m4 8 6.6 4.6a2.4 2.4 0 0 0 2.8 0L20 8" />
  </>,
);
export const Lock = make(
  <>
    <rect x="4.5" y="10" width="15" height="11" rx="3.5" />
    <path d="M8 10V7.5a4 4 0 0 1 8 0V10" />
  </>,
);
export const Eye = make(
  <>
    <path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="3" />
  </>,
);
export const Trash = make(<path d="M4 7h16M9.5 7V5.2A1.2 1.2 0 0 1 10.7 4h2.6a1.2 1.2 0 0 1 1.2 1.2V7M6.5 7l.8 12a1.7 1.7 0 0 0 1.7 1.6h6a1.7 1.7 0 0 0 1.7-1.6L17.5 7" />);
export const Sparkles = make(<path d="M12 3.5 13.7 9l5.5 1.7-5.5 1.7L12 18l-1.7-5.6L4.8 10.7 10.3 9 12 3.5ZM19 3v3.4M20.7 4.7h-3.4" />);
export const AlertTriangle = make(<path d="M12 4.5 21 19.5H3L12 4.5ZM12 10v4m0 2.6v.4" />);
export const Info = make(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5.5M12 7.8v.4" />
  </>,
);
export const Menu = make(<path d="M4 7h16M4 12h16M4 17h11" />, 2);
export const Layers = make(<path d="m12 3 9 5-9 5-9-5 9-5Zm9 9-9 5-9-5m18 4.5-9 5-9-5" />);
export const Code = make(<path d="m8.5 8-4.5 4 4.5 4M15.5 8l4.5 4-4.5 4M13.5 5l-3 14" />);
export const Zap = make(<path d="M13.5 3 5 13.5h5.5L10 21l8.5-10.5H13L13.5 3Z" />);
export const Grid = make(
  <>
    <rect x="3.5" y="3.5" width="7" height="7" rx="2.5" />
    <rect x="13.5" y="3.5" width="7" height="7" rx="2.5" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="2.5" />
    <rect x="13.5" y="13.5" width="7" height="7" rx="2.5" />
  </>,
);
export const Palette = make(
  <>
    <path d="M12 3a9 9 0 1 0 0 18c1.4 0 2-1 2-1.8 0-1.4-1.4-1.7-1.4-3 0-.9.7-1.7 1.8-1.7H16A5 5 0 0 0 21 9.5C21 5.9 16.9 3 12 3Z" />
    <path d="M7.5 12v.2M9.5 8.5v.2M13.5 7.5v.2" />
  </>,
);
export const Box = make(<path d="M12 3 20 7.5v9L12 21l-8-4.5v-9L12 3Zm0 0v18m8-13.5L12 12 4 7.5" />);
export const Loader = make(<path d="M12 3v4m0 10v4M3 12h4m10 0h4M5.6 5.6l2.8 2.8m7.2 7.2 2.8 2.8m0-15.6-2.8 2.8M8.4 15.6l-2.8 2.8" />);
export const Filter = make(<path d="M4 6h16M7 12h10M10 18h4" />, 2);
export const Calendar = make(
  <>
    <rect x="3.5" y="5" width="17" height="16" rx="4" />
    <path d="M3.5 10h17M8.5 3v4M15.5 3v4" />
  </>,
);
export const Play = make(<path d="M8 5.5 18 12 8 18.5v-13Z" />);
export const Bookmark = make(<path d="M6.5 4h11v17l-5.5-4-5.5 4V4Z" />);
export const Shield = make(<path d="M12 3.2 19 6v6c0 4.2-3 7-7 8.8C8 19 5 16.2 5 12V6l7-2.8Zm-2.6 8.9 2 2 3.4-3.6" />);
export const Command = make(<path d="M8.5 4.5a2 2 0 1 0 2 2v11a2 2 0 1 0 2-2h-11a2 2 0 1 0 2 2v-11a2 2 0 1 0-2 2h11" />);
export const Terminal = make(
  <>
    <rect x="3" y="4.5" width="18" height="15" rx="4" />
    <path d="m7.5 10 2.5 2-2.5 2M13 14.5h3.5" />
  </>,
);
export const Clock = make(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5V12l3 2" />
  </>,
);
export const Link = make(<path d="M10.5 13.5a4 4 0 0 0 5.7 0l2.3-2.3a4 4 0 0 0-5.7-5.7l-1 1M13.5 10.5a4 4 0 0 0-5.7 0l-2.3 2.3a4 4 0 0 0 5.7 5.7l1-1" />);
export const Github = make(<path d="M9 19.5c-4 1.2-4-2.2-5.6-2.7m11.6 5.2v-3.4c0-1 .1-1.4-.5-2 2.4-.3 4.6-1.2 4.6-5.1a4 4 0 0 0-1.1-2.8 3.7 3.7 0 0 0-.1-2.8s-.9-.3-2.9 1.1a9.8 9.8 0 0 0-5 0C8.1 4.8 7.2 5.1 7.2 5.1a3.7 3.7 0 0 0-.1 2.8A4 4 0 0 0 6 10.7c0 3.9 2.2 4.8 4.6 5.1-.6.6-.6 1.2-.5 2v3.4" />);
export const Refresh = make(<path d="M20 11a8 8 0 0 0-14-4.5L4 9m0 4a8 8 0 0 0 14 4.5L20 15m0-6v5h-5M4 20v-5h5" />);
