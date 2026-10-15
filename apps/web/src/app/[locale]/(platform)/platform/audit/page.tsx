import type { Metadata } from "next";
import { AuditList } from "@/features/platform/audit-list";

export const metadata: Metadata = { title: "Audit log" };

export default function Page() {
  return <AuditList />;
}
