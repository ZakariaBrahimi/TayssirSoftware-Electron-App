import type { Metadata } from "next";
import { AdminOnly } from "@/components/admin-only";
import { EditFamilyEditor } from "@/features/products/product-editor";

export const metadata: Metadata = { title: "Edit variants" };

export default function EditFamilyPage() {
  return (
    <AdminOnly>
      <EditFamilyEditor />
    </AdminOnly>
  );
}
