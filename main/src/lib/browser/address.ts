import { t as $t } from "@/lib/i18n";

const SEARCH = "https://duckduckgo.com/?q=";
const ALLOWED = new Set(["http:", "https:", "about:"]);
const HOSTISH = /^[a-z0-9-]+(\.[a-z0-9-]+)+(:\d{1,5})?([/?#].*)?$/i;
const LOCAL = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:\d{1,5})?([/?#].*)?$/i;
const SCHEME = /^([a-z][a-z0-9+.-]*):/i;

export interface AddressResult {
  url: string;
  search: boolean;
}

export function resolveAddress(input: string): AddressResult | null {
  const value = input.trim();
  if (!value) return null;

  if (/^wc:/i.test(value)) return null;

  if (LOCAL.test(value)) {
    return { url: `http://${value}`, search: false };
  }

  const scheme = SCHEME.exec(value);
  if (scheme) {
    const protocol = `${scheme[1].toLowerCase()}:`;
    if (ALLOWED.has(protocol)) {
      try {
        const parsed = new URL(value);
        return { url: parsed.href, search: false };
      } catch {
        return null;
      }
    }
    if (!HOSTISH.test(value)) return null;
  }

  if (!/\s/.test(value) && HOSTISH.test(value) && !/\.(eth|xyz|crypto)$/i.test(value.split("/")[0])) {
    return { url: `https://${value}`, search: false };
  }

  return { url: SEARCH + encodeURIComponent(value), search: true };
}

export function originOf(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.origin : "";
  } catch {
    return "";
  }
}

export function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}

export function isSecure(url: string): boolean {
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

export function prettyUrl(url: string): string {
  if (!url || url === "about:blank") return "";
  try {
    const parsed = new URL(url);
    const path = parsed.pathname === "/" ? "" : parsed.pathname;
    return `${parsed.host}${path}${parsed.search}`;
  } catch {
    return url;
  }
}

export function titleFor(url: string, title: string): string {
  return title.trim() || hostOf(url) || $t("Yeni sekme");
}

export function faviconGuess(url: string): string {
  const origin = originOf(url);
  return origin ? `${origin}/favicon.ico` : "";
}