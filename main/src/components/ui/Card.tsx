import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function Card({ className, children, ...rest }: CardProps) {
  return (
    <div
      className={cn("rounded-xl2 border border-white/[0.06] bg-surface-850", className)}
      {...rest}
    >
      {children}
    </div>
  );
}
