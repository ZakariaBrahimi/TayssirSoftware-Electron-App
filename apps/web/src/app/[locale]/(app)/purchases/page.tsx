import type { Metadata } from "next";
import { PlanGate } from "@/components/plan-gate";
import { PurchasesList } from "@/features/purchases/purchases-list";

export const metadata: Metadata = { title: "Purchases" };

export default function PurchasesPage() {
  return (
    <PlanGate feature="suppliers">
      <PurchasesList />
    </PlanGate>
  );
}
