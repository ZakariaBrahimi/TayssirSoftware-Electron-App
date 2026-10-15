import type { Metadata } from "next";
import { Suspense } from "react";
import { PlatformShell } from "@/features/platform/platform-shell";

export const metadata: Metadata = {
  title: { default: "Platform console", template: "%s · Platform console" },
  robots: { index: false, follow: false },
};

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  // The console is rendered on the client only (it depends on the URL and the session).
  return (
    <Suspense>
      <PlatformShell>{children}</PlatformShell>
    </Suspense>
  );
}
