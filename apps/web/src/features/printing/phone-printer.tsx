"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { PRINTER_DOTS, rasterJob, toBase64 } from "@/lib/escpos";
import { isNativeApp, nativePrinter, type PrinterDevice } from "@/lib/native";

/*
 * Printing from the Android app: each phone remembers its own receipt
 * printer (a paired Bluetooth printer, or "InnerPrinter" on Sunmi
 * terminals). Receipts are drawn to an image and sent as ESC/POS.
 */

const KEY = "mizan.phone-printer";
const listeners = new Set<() => void>();

function read(): PrinterDevice | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as PrinterDevice) : null;
  } catch {
    return null;
  }
}
let cache: PrinterDevice | null | undefined;

export function setPhonePrinter(device: PrinterDevice | null) {
  try {
    if (device) localStorage.setItem(KEY, JSON.stringify(device));
    else localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable: kept for this session only */
  }
  cache = device;
  listeners.forEach((l) => l());
}

/** The printer chosen on this phone (null in a browser or when none). */
export function usePhonePrinter() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => {
      if (cache === undefined) cache = isNativeApp() ? read() : null;
      return cache;
    },
    () => null,
  );
}

type Job = {
  node: React.ReactNode;
  dots: number;
  copies: number;
  address: string;
  done: (error?: unknown) => void;
};

/**
 * `printOnPhone(node, { paper, copies })` renders `node` off screen, turns it
 * into an image as wide as the paper and sends it to the phone's printer.
 */
export function usePhonePrint() {
  const printer = usePhonePrinter();
  const [job, setJob] = useState<Job | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!job) return;
    let cancelled = false;
    const run = async () => {
      try {
        // Let fonts, the logo and barcodes paint first.
        await document.fonts?.ready;
        await new Promise((r) => setTimeout(r, 120));
        const el = ref.current?.firstElementChild as HTMLElement | null;
        if (!el || cancelled) return;
        const { toCanvas } = await import("html-to-image");
        const canvas = await toCanvas(el, {
          pixelRatio: job.dots / el.offsetWidth,
          backgroundColor: "#ffffff",
        });
        const ctx = canvas.getContext("2d")!;
        const width = Math.min(canvas.width, job.dots);
        const data = rasterJob(ctx.getImageData(0, 0, width, canvas.height));
        const base64 = toBase64(data);
        for (let i = 0; i < job.copies; i++) {
          await nativePrinter()!.print({ address: job.address, data: base64 });
        }
        job.done();
      } catch (err) {
        job.done(err ?? new Error("print failed"));
      } finally {
        if (!cancelled) setJob(null);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [job]);

  const printOnPhone = useCallback(
    (node: React.ReactNode, options: { paper: "58" | "80"; copies?: number }) =>
      new Promise<void>((resolve, reject) => {
        if (!printer || !nativePrinter()) return reject(new Error("NO_PRINTER"));
        setJob({
          node,
          dots: PRINTER_DOTS[options.paper],
          copies: options.copies ?? 1,
          address: printer.address,
          done: (error) => (error ? reject(error) : resolve()),
        });
      }),
    [printer],
  );

  const phonePrintArea =
    job && typeof document !== "undefined"
      ? createPortal(
          // Off screen but laid out, so it can be drawn to an image.
          <div
            ref={ref}
            aria-hidden
            style={{ position: "fixed", left: -10000, top: 0, background: "#fff" }}
          >
            {job.node}
          </div>,
          document.body,
        )
      : null;

  return { printOnPhone, phonePrintArea, printer };
}
