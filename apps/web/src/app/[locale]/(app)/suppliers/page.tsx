import type { Metadata } from "next";
import { PlanGate } from "@/components/plan-gate";
import { SuppliersList } from "@/features/suppliers/suppliers-list";

export const metadata: Metadata = { title: "Suppliers" };

export default function SuppliersPage() {
  return (
    <PlanGate feature="suppliers">
      <SuppliersList />
    </PlanGate>
  );
}
