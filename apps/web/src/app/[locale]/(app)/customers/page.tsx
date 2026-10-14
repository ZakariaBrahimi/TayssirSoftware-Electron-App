import type { Metadata } from "next";
import { CustomersList } from "@/features/customers/customers-list";

export const metadata: Metadata = { title: "Customers" };

export default function CustomersPage() {
  return <CustomersList />;
}
