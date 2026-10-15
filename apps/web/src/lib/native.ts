/*
 * Bridge to the Android app (Capacitor). The app opens this web app and
 * injects `window.Capacitor`, whose `Plugins` reach native code: camera
 * barcode scanning, Bluetooth / Sunmi printers and push notifications.
 * In a browser or the desktop app none of this exists and callers fall
 * back to the web way.
 */

type Listener = { remove: () => Promise<void> };
type CapacitorGlobal = {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  Plugins?: Record<string, unknown>;
};

function capacitor(): CapacitorGlobal | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor ?? null;
}

/** True inside the Android app. */
export function isNativeApp() {
  return Boolean(capacitor()?.isNativePlatform?.());
}

function plugin<T>(name: string): T | null {
  return isNativeApp() ? ((capacitor()?.Plugins?.[name] as T | undefined) ?? null) : null;
}

/* Camera scanning (Google ML Kit through @capacitor-mlkit/barcode-scanning). */
export type NativeScanner = {
  isGoogleBarcodeScannerModuleAvailable: () => Promise<{ available: boolean }>;
  installGoogleBarcodeScannerModule: () => Promise<void>;
  scan: () => Promise<{ barcodes: { rawValue: string }[] }>;
};
export const nativeScanner = () => plugin<NativeScanner>("BarcodeScanner");

/* Receipt printers: paired Bluetooth printers and Sunmi's built-in one (our own plugin). */
export type PrinterDevice = { name: string; address: string };
export type NativePrinter = {
  info: () => Promise<{ version: string; pushAvailable: boolean }>;
  listPrinters: () => Promise<{ devices: PrinterDevice[] }>;
  print: (options: { address: string; data: string }) => Promise<void>;
};
export const nativePrinter = () => plugin<NativePrinter>("MizanPrinter");

/* Push notifications (Firebase Cloud Messaging through @capacitor/push-notifications). */
export type NativePush = {
  requestPermissions: () => Promise<{ receive: string }>;
  register: () => Promise<void>;
  addListener: (
    event: "registration" | "registrationError" | "pushNotificationActionPerformed",
    callback: (data: { value?: string; notification?: { data?: Record<string, string> } }) => void,
  ) => Promise<Listener>;
};
export const nativePush = () => plugin<NativePush>("PushNotifications");
