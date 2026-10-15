import type { Metadata } from "next";
import { AdminOnly } from "@/components/admin-only";
import { StockCountScreen } from "@/features/stock/stock-count-screen";

export const metadata: Metadata = { title: "Stock count" };

export default function StockCountPage() {
  return (
    <AdminOnly>
      <StockCountScreen />
    </AdminOnly>
  );
}
