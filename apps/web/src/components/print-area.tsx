"use client";

import { createPortal } from "react-dom";

/**
 * Renders children into a hidden container that is the only thing visible
 * when the page is printed (see the print styles in globals.css).
 * Only rendered client-side, after a user action (see `usePrint`).
 */
export function PrintArea({ children }: { children: React.ReactNode }) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <div id="print-root" className="hidden print:block">
      {children}
    </div>,
    document.body,
  );
}
