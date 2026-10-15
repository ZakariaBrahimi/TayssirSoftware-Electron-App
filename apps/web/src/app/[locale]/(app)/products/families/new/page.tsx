import type { Metadata } from "next";
import { AdminOnly } from "@/components/admin-only";
import { NewFamilyEditor } from "@/features/products/product-editor";

export const metadata: Metadata = { title: "New product with variants" };

export default function NewFamilyPage() {
  return (
    <AdminOnly>
      <NewFamilyEditor />
    </AdminOnly>
  );
}
