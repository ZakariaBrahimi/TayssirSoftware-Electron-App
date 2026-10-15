import type { Metadata } from "next";
import { AdminOnly } from "@/components/admin-only";
import { ReportsScreen } from "@/features/reports/reports-screen";

export const metadata: Metadata = { title: "Reports" };

export default function ReportsPage() {
  return (
    <AdminOnly>
      <ReportsScreen />
    </AdminOnly>
  );
}
