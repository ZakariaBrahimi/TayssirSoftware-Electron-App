"use client";

import { useCallback, useEffect, useState } from "react";
import { PrintArea } from "@/components/print-area";

/**
 * `print(node)` renders `node` into the print-only area and opens the
 * browser print dialog. Works with thermal receipt printers and label
 * printers configured as system printers.
 */
export function usePrint() {
  const [job, setJob] = useState<React.ReactNode | null>(null);

  useEffect(() => {
    if (!job) return;
    const done = () => setJob(null);
    window.addEventListener("afterprint", done, { once: true });
    // Wait for the portal to paint before printing.
    const frame = requestAnimationFrame(() => setTimeout(() => window.print(), 50));
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("afterprint", done);
    };
  }, [job]);

  const print = useCallback((node: React.ReactNode) => setJob(node), []);
  const printArea = job ? <PrintArea>{job}</PrintArea> : null;
  return { print, printArea };
}
