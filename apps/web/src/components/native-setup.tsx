"use client";

import { useEffect } from "react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useMe } from "@/hooks/use-me";
import { useRouter } from "@/i18n/navigation";
import { api } from "@/lib/api-client";
import { isNativeApp, nativePrinter, nativePush } from "@/lib/native";

/**
 * Android app only: registers the phone for push notifications (shop
 * owners/admins, cloud stores) and opens the page a notification points to.
 */
export function NativeSetup() {
  const { isAdmin } = useCurrentUser();
  const { data: me } = useMe();
  const router = useRouter();
  const cloud = me?.mode === "cloud";

  useEffect(() => {
    const push = nativePush();
    if (!isNativeApp() || !push || !isAdmin || !cloud) return;
    const listeners: Promise<{ remove: () => Promise<void> }>[] = [];
    let cancelled = false;

    void (async () => {
      // Builds without Firebase have no push: don't ask for the permission.
      const info = await nativePrinter()
        ?.info()
        .catch(() => null);
      if (!info?.pushAvailable || cancelled) return;
      listeners.push(
        push.addListener("registration", ({ value }) => {
          if (value) void api.push.devices.$post({ json: { token: value, platform: "android" } });
        }),
        push.addListener("pushNotificationActionPerformed", ({ notification }) => {
          const url = notification?.data?.url;
          // Only pages of this app (e.g. "/fr/reorder").
          if (url?.startsWith("/")) router.push(url.replace(/^\/(en|fr|ar)(?=\/)/, ""));
        }),
      );
      const { receive } = await push.requestPermissions();
      if (receive === "granted" && !cancelled) await push.register();
    })().catch(() => {});

    return () => {
      cancelled = true;
      listeners.forEach((l) => void l.then((x) => x.remove()));
    };
  }, [isAdmin, cloud, router]);

  return null;
}
