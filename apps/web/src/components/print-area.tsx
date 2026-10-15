"use client";

import { createPortal } from "react-dom";

/**
 * Renders children into a hidden container that is the only thing visible
 * when the page is printed (see the print styles in globals.css).
 * `page` sets the paper for this job (e.g. "size: 50mm 30mm; margin: 0").
 * Only rendered client-side, after a user action (see `usePrint`).
 */
export function PrintArea({ children, page }: { children: React.ReactNode; page?: string }) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <div id="print-root" className="hidden print:block">
      {page && <style>{`@media print { @page { ${page} } }`}</style>}
      {children}
    </div>,
    document.body,
  );
}
