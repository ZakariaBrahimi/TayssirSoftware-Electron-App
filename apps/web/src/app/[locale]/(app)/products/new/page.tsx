import type { Metadata } from "next";
import { AdminOnly } from "@/components/admin-only";
import { NewProductEditor } from "@/features/products/product-editor";

export const metadata: Metadata = { title: "New product" };

export default function NewProductPage() {
  return (
    <AdminOnly>
      <NewProductEditor />
    </AdminOnly>
  );
}
