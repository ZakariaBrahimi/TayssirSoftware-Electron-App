import type { Metadata } from "next";
import { ReorderScreen } from "@/features/stock/reorder-screen";

export const metadata: Metadata = { title: "Reorder" };

export default function ReorderPage() {
  return <ReorderScreen />;
}
