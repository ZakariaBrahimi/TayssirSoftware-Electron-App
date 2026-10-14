import type { Metadata } from "next";
import { AdminOnly } from "@/components/admin-only";
import { SettingsScreen } from "@/features/settings/settings-screen";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <AdminOnly>
      <SettingsScreen />
    </AdminOnly>
  );
}
