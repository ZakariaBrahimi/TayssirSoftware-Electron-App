"use client";

import { toSVG } from "bwip-js/browser";
import { useMemo } from "react";
import { barcodeSymbology } from "@/lib/barcode";
import { cn } from "@/lib/utils";

/** Renders a barcode as inline SVG (EAN-13 when valid, Code 128 otherwise). */
export function Barcode({
  value,
  height = 12,
  className,
}: {
  value: string;
  height?: number;
  className?: string;
}) {
  const svg = useMemo(() => {
    if (!value) return null;
    try {
      return toSVG({
        bcid: barcodeSymbology(value),
        text: value,
        height,
        scale: 2,
      });
    } catch {
      return null;
    }
  }, [value, height]);

  if (!svg) return null;
  return (
    <div dir="ltr" className={cn("flex flex-col items-center gap-0.5", className)}>
      <div
        className="w-full [&>svg]:h-auto [&>svg]:w-full"
        // bwip-js output is generated locally from a validated barcode string.
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <span className="font-mono text-[0.8em] tracking-[0.2em] text-black">{value}</span>
    </div>
  );
}
