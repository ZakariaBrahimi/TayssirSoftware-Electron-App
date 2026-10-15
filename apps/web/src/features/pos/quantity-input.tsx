"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { hasAtMost3Decimals, isMeasured } from "@/lib/quantity";
import { cn } from "@/lib/utils";

/**
 * Quantity field that accepts "0." or "1," while typing (weights), and
 * commits only valid values: whole pieces, or up to 3 decimals.
 */
export function QuantityInput({
  value,
  unit,
  onCommit,
  className,
  ...props
}: {
  value: number;
  unit?: string;
  onCommit: (value: number) => void;
} & Omit<React.ComponentProps<typeof Input>, "value" | "onChange">) {
  const measured = isMeasured(unit);
  const [text, setText] = useState<string | null>(null);
  const parse = (raw: string) => {
    const n = Number(raw.replace(",", "."));
    if (!Number.isFinite(n) || n < 0) return null;
    if (measured ? !hasAtMost3Decimals(n) : !Number.isInteger(n)) return null;
    return n;
  };
  return (
    <Input
      {...props}
      inputMode={measured ? "decimal" : "numeric"}
      value={text ?? String(value)}
      onFocus={(e) => {
        setText(String(value));
        e.target.select();
      }}
      onChange={(e) => {
        setText(e.target.value);
        const n = parse(e.target.value);
        // Commit as you type, except a zero mid-edit ("0." on the way to 0.75).
        if (n !== null && n > 0) onCommit(n);
      }}
      onBlur={() => {
        const n = parse(text ?? "");
        if (n !== null && n !== value) onCommit(n);
        setText(null);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        props.onKeyDown?.(e);
      }}
      className={cn("tabular-nums", className)}
    />
  );
}
