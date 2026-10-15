import type { Metadata } from "next";
import { RequestsList } from "@/features/platform/requests-list";

export const metadata: Metadata = { title: "Payment requests" };

export default function Page() {
  return <RequestsList />;
}
