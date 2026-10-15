"use client";

import { toSVG } from "bwip-js/browser";
import { useMemo } from "react";
import { barcodeSymbology } from "@/lib/barcode";
import { cn } from "@/lib/utils";

function render(options: Parameters<typeof toSVG>[0]) {
  try {
    return toSVG(options);
  } catch {
    return null;
  }
}

/**
 * Renders a barcode as inline SVG (EAN-13 when valid, Code 128 otherwise).
 * With `heightMm`, the bars are stretched to exactly that height (labels).
 */
export function Barcode({
  value,
  height = 12,
  heightMm,
  showText = true,
  className,
}: {
  value: string;
  height?: number;
  heightMm?: number;
  showText?: boolean;
  className?: string;
}) {
  const svg = useMemo(() => {
    if (!value) return null;
    const out = render({ bcid: barcodeSymbology(value), text: value, height, scale: 2 });
    // Fill the given box instead of keeping the drawing's proportions.
    return out && heightMm ? out.replace("<svg ", '<svg preserveAspectRatio="none" ') : out;
  }, [value, height, heightMm]);

  if (!svg) return null;
  return (
    <div dir="ltr" className={cn("flex flex-col items-center gap-0.5", className)}>
      <div
        className={cn("w-full [&>svg]:w-full", heightMm ? "[&>svg]:h-full" : "[&>svg]:h-auto")}
        style={heightMm ? { height: `${heightMm}mm` } : undefined}
        // bwip-js output is generated locally from a validated barcode string.
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      {showText && (
        <span className="font-mono text-[0.8em] leading-none tracking-[0.2em] text-black">
          {value}
        </span>
      )}
    </div>
  );
}

/** A QR code (links on receipts). */
export function QrCode({ value, sizeMm = 20 }: { value: string; sizeMm?: number }) {
  const svg = useMemo(
    () => (value ? render({ bcid: "qrcode", text: value, scale: 2 }) : null),
    [value],
  );
  if (!svg) return null;
  return (
    <div
      dir="ltr"
      className="[&>svg]:h-full [&>svg]:w-full"
      style={{ width: `${sizeMm}mm`, height: `${sizeMm}mm` }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
