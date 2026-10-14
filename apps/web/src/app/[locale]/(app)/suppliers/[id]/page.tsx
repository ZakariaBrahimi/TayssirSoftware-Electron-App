import type { Metadata } from "next";
import { SupplierDetail } from "@/features/suppliers/supplier-detail";

export const metadata: Metadata = { title: "Supplier" };

export default function SupplierPage() {
  return <SupplierDetail />;
}
