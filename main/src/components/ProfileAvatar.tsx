import { t as $t } from "@/lib/i18n";
import { useId } from "react";
import { cn } from "@/lib/utils";

interface ProfileAvatarProps {
  size?: number;
  className?: string;
}

export function ProfileAvatar({ size = 32, className }: ProfileAvatarProps) {
  const gradientId = useId();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role="img"
      aria-label={$t("Vexaris Wallet sembolü")}
      className={cn("shrink-0", className)}
    >
      <defs>
        <linearGradient id={gradientId} x1="4" y1="2" x2="44" y2="46" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ff6b6b" />
          <stop offset="55%" stopColor="#e5484d" />
          <stop offset="100%" stopColor="#9e1b20" />
        </linearGradient>
      </defs>

      <rect x="0" y="0" width="48" height="48" rx="14" fill={`url(#${gradientId})`} />
      <path d="M24 11l10 13-10 13-10-13 10-13z" fill="none" stroke="#fff" strokeWidth="2" strokeLinejoin="round" opacity="0.92" />
      <path d="M24 18.5l5.2 6.5-5.2 6.5-5.2-6.5 5.2-6.5z" fill="#ffffff" opacity="0.95" />
      <circle cx="24" cy="24" r="2.1" fill="#9e1b20" opacity="0.75" />
    </svg>
  );
}
