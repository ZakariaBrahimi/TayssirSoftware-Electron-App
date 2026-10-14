import type { Metadata } from "next";
import { AdminOnly } from "@/components/admin-only";
import { EditProductEditor } from "@/features/products/product-editor";

export const metadata: Metadata = { title: "Edit product" };

export default function EditProductPage() {
  return (
    <AdminOnly>
      <EditProductEditor />
    </AdminOnly>
  );
}
