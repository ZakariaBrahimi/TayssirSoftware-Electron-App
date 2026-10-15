import type { Metadata } from "next";
import { AdminOnly } from "@/components/admin-only";
import { DashboardScreen } from "@/features/dashboard/dashboard-screen";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <AdminOnly>
      <DashboardScreen />
    </AdminOnly>
  );
}
