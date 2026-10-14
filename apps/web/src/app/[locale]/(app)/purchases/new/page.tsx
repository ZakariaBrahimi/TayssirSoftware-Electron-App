import type { Metadata } from "next";
import { PlanGate } from "@/components/plan-gate";
import { Suspense } from "react";
import { PurchaseForm } from "@/features/purchases/purchase-form";

export const metadata: Metadata = { title: "Receive goods" };

export default function NewPurchasePage() {
  return (
    <PlanGate feature="suppliers">
      <Suspense>
        <PurchaseForm />
      </Suspense>
    </PlanGate>
  );
}
