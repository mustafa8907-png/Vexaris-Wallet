import { hostOf, originOf } from "@/lib/browser/address";

export function faviconSources(url: string, override?: string | null): string[] {
  const origin = originOf(url);
  const host = hostOf(url);
  const list: string[] = [];
  if (override && override.startsWith("data:")) return [override];
  if (host) {
    list.push(`https://icons.duckduckgo.com/ip3/${host}.ico`);
    list.push(`https://www.google.com/s2/favicons?domain=${host}&sz=64`);
  }
  if (origin) {
    list.push(`${origin}/favicon.ico`);
    list.push(`${origin}/favicon.png`);
    list.push(`${origin}/apple-touch-icon.png`);
  }
  if (override && override.startsWith("http")) list.unshift(override);
  return [...new Set(list)];
}
