import { cn } from "@/lib/utils";

/** Brand colors of the mark. Fixed on purpose: the logo looks the same on every screen. */
const TEAL = "#0E7C6B";
const BRASS = "#D6A23A";

/** The Mizan mark: the letter meem (م), its loop drawn as a coin. */
export function MizanMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
      className={cn("shrink-0", className)}
    >
      <rect width="64" height="64" rx="16" fill={TEAL} />
      <circle cx="37" cy="24" r="9.5" fill="none" stroke="#fff" strokeWidth="6.5" />
      <circle cx="37" cy="24" r="3.6" fill={BRASS} />
      <path
        d="M28.5 28.5C23 34 21 41 22.5 50"
        fill="none"
        stroke="#fff"
        strokeWidth="6.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Mark + bilingual name. `subtitle` replaces the Arabic name (e.g. the store name). */
export function MizanLogo({
  size = 32,
  subtitle,
  className,
}: {
  size?: number;
  subtitle?: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("flex min-w-0 items-center gap-2", className)}>
      <MizanMark size={size} />
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="font-display truncate font-semibold">
          Mizan{" "}
          <span lang="ar" className="font-display text-muted-foreground font-medium">
            · ميزان
          </span>
        </span>
        {subtitle && <span className="text-muted-foreground truncate text-xs">{subtitle}</span>}
      </span>
    </span>
  );
}
