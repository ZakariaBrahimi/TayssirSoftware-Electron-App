import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminOnly } from "@/components/admin-only";
import { SettingsScreen } from "@/features/settings/settings-screen";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <AdminOnly>
      <Suspense>
        <SettingsScreen />
      </Suspense>
    </AdminOnly>
  );
}
