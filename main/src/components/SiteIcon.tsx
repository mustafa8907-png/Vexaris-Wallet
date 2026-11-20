import { useMemo, useState } from "react";
import { faviconSources } from "@/lib/browser/favicon";
import { cn } from "@/lib/utils";

export function SiteIcon({
  url,
  name,
  size = 30,
  override,
  className,
}: {
  url: string;
  name: string;
  size?: number;
  override?: string | null;
  className?: string;
}) {
  const sources = useMemo(() => faviconSources(url, override), [url, override]);
  const [index, setIndex] = useState(0);
  const src = sources[index];

  if (!src) {
    return (
      <span
        style={{ width: size, height: size }}
        className={cn(
          "grid shrink-0 place-items-center rounded-ctrl border border-line bg-surface2 text-[12px] font-semibold text-muted",
          className,
        )}
      >
        {name.slice(0, 1).toUpperCase()}
      </span>
    );
  }

  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      onError={() => setIndex((value) => value + 1)}
      style={{ width: size, height: size }}
      className={cn("shrink-0 rounded-ctrl border border-line bg-surface2 object-cover", className)}
    />
  );
}
