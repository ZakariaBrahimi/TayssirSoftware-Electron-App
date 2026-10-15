"use client";

import { useCallback, useEffect, useState } from "react";
import { PrintArea } from "@/components/print-area";

type Job = { node: React.ReactNode; page?: string };

/**
 * `print(node, { page })` renders `node` into the print-only area and opens
 * the browser print dialog. Works with thermal receipt printers and label
 * printers configured as system printers; `page` sets the paper size.
 */
export function usePrint() {
  const [job, setJob] = useState<Job | null>(null);

  useEffect(() => {
    if (!job) return;
    const done = () => setJob(null);
    window.addEventListener("afterprint", done, { once: true });
    // Wait for the portal (and its barcodes) to paint before printing.
    const frame = requestAnimationFrame(() => setTimeout(() => window.print(), 80));
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("afterprint", done);
    };
  }, [job]);

  const print = useCallback(
    (node: React.ReactNode, options: { page?: string } = {}) =>
      setJob({ node, page: options.page }),
    [],
  );
  const printArea = job ? <PrintArea page={job.page}>{job.node}</PrintArea> : null;
  return { print, printArea };
}
