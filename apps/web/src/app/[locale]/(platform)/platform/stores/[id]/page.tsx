import type { Metadata } from "next";
import { StoreDetail } from "@/features/platform/store-detail";

export const metadata: Metadata = { title: "Store" };

export default function Page() {
  return <StoreDetail />;
}
