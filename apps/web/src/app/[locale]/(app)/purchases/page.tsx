import type { Metadata } from "next";
import { PurchasesList } from "@/features/purchases/purchases-list";

export const metadata: Metadata = { title: "Purchases" };

export default function PurchasesPage() {
  return <PurchasesList />;
}
