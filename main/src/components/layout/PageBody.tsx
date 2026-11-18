import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type PageWidth = "wide" | "narrow" | "compact" | "form";

const widths: Record<PageWidth, string> = {
  wide: "max-w-6xl",
  narrow: "max-w-4xl",
  compact: "max-w-3xl",
  form: "max-w-2xl",
};

export function PageBody({
  width = "wide",
  className,
  children,
}: {
  width?: PageWidth;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className="h-full overflow-y-auto">
      <div
        className={cn(
          "mx-auto w-full px-3 pb-[calc(5.25rem+env(safe-area-inset-bottom))] pt-4 sm:px-5 lg:px-6 lg:pb-8",
          widths[width],
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}
