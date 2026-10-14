import type { Metadata } from "next";
import { Suspense } from "react";
import { PurchaseForm } from "@/features/purchases/purchase-form";

export const metadata: Metadata = { title: "Receive goods" };

export default function NewPurchasePage() {
  return (
    <Suspense>
      <PurchaseForm />
    </Suspense>
  );
}
