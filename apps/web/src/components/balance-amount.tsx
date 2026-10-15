"use client";

import { useMoney } from "@/hooks/use-settings";
import { cn } from "@/lib/utils";

/** A balance: owed amounts in red, credits in green, zero muted. */
export function BalanceAmount({ value, className }: { value: number; className?: string }) {
  const money = useMoney();
  return (
    <span
      className={cn(
        "tabular-nums",
        value > 0 && "text-destructive font-medium",
        value < 0 && "text-success",
        value === 0 && "text-muted-foreground",
        className,
      )}
    >
      {money.format(value)}
    </span>
  );
}
