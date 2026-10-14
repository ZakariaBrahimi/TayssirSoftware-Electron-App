"use client";

import { Camera, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { nativeScanner } from "@/lib/native";
import { cn } from "@/lib/utils";

/*
 * Scanning barcodes with the phone's camera: Google ML Kit in the Android
 * app, the browser's BarcodeDetector elsewhere (Chrome on Android). The
 * button only shows where one of them works.
 */

type Detector = { detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]> };
type DetectorClass = new (options?: { formats?: string[] }) => Detector;

const browserDetector = (): DetectorClass | null =>
  typeof window !== "undefined" && "BarcodeDetector" in window
    ? ((window as unknown as { BarcodeDetector: DetectorClass }).BarcodeDetector ?? null)
    : null;

const noop = () => () => {};

function canScan() {
  if (nativeScanner()) return true;
  return Boolean(browserDetector() && typeof navigator !== "undefined" && navigator.mediaDevices);
}

/** A camera button that reports the scanned code. */
export function CameraScanButton({
  onScan,
  className,
  size = "icon",
}: {
  onScan: (code: string) => void;
  className?: string;
  size?: "icon" | "icon-sm";
}) {
  const t = useTranslations("scanner");
  // Known only in the browser (false while rendering on the server).
  const available = useSyncExternalStore(noop, canScan, () => false);
  const [busy, setBusy] = useState(false);
  const [webOpen, setWebOpen] = useState(false);

  const scan = useCallback(async () => {
    const scanner = nativeScanner();
    if (!scanner) {
      setWebOpen(true);
      return;
    }
    setBusy(true);
    try {
      // Google's scanner module is downloaded once by Play services.
      const { available: ready } = await scanner.isGoogleBarcodeScannerModuleAvailable();
      if (!ready) {
        await scanner.installGoogleBarcodeScannerModule();
        toast.info(t("installing"));
        return;
      }
      const { barcodes } = await scanner.scan();
      const code = barcodes[0]?.rawValue?.trim();
      if (code) onScan(code);
    } catch (err) {
      // Closing the scanner is not an error.
      const message = String((err as Error)?.message ?? err);
      if (!/cancel/i.test(message)) toast.error(t("failed"));
    } finally {
      setBusy(false);
    }
  }, [onScan, t]);

  if (!available) return null;
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size={size}
        className={className}
        aria-label={t("scan")}
        title={t("scan")}
        onClick={() => void scan()}
        disabled={busy}
      >
        {busy ? <Loader2 className="animate-spin" /> : <Camera />}
      </Button>
      <WebScannerDialog
        open={webOpen}
        onClose={() => setWebOpen(false)}
        onScan={(code) => {
          setWebOpen(false);
          onScan(code);
        }}
      />
    </>
  );
}

/** Camera preview with the browser's BarcodeDetector. */
function WebScannerDialog({
  open,
  onClose,
  onScan,
}: {
  open: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
}) {
  const t = useTranslations("scanner");
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const Detector = browserDetector();
    if (!Detector) return;
    let stream: MediaStream | null = null;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const detector = new Detector();

    const loop = async () => {
      const video = videoRef.current;
      if (stopped || !video) return;
      if (video.readyState >= 2) {
        try {
          const [hit] = await detector.detect(video);
          if (hit?.rawValue && !stopped) {
            navigator.vibrate?.(60);
            onScan(hit.rawValue.trim());
            return;
          }
        } catch {
          /* keep trying */
        }
      }
      timer = setTimeout(loop, 150);
    };

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then((s) => {
        stream = s;
        if (stopped) return s.getTracks().forEach((tr) => tr.stop());
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          void videoRef.current.play();
        }
        void loop();
      })
      .catch(() => setError(t("noCamera")));

    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((tr) => tr.stop());
      setError(null);
    };
  }, [open, onScan, t]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("scan")}</DialogTitle>
        </DialogHeader>
        {error ? (
          <p className="text-destructive text-sm">{error}</p>
        ) : (
          <div className="relative overflow-hidden rounded-lg bg-black">
            <video ref={videoRef} playsInline muted className="aspect-[4/3] w-full object-cover" />
            <div
              className={cn(
                "pointer-events-none absolute inset-x-8 top-1/2 h-24 -translate-y-1/2 rounded-md border-2 border-white/80",
              )}
            />
          </div>
        )}
        <p className="text-muted-foreground text-center text-sm">{t("hint")}</p>
      </DialogContent>
    </Dialog>
  );
}
