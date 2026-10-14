import type { Metadata } from "next";
import { SuppliersList } from "@/features/suppliers/suppliers-list";

export const metadata: Metadata = { title: "Suppliers" };

export default function SuppliersPage() {
  return <SuppliersList />;
}
