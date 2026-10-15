import type { Metadata } from "next";
import { Suspense } from "react";
import { StoresList } from "@/features/platform/stores-list";

export const metadata: Metadata = { title: "Stores" };

export default function Page() {
  return (
    <Suspense>
      <StoresList />
    </Suspense>
  );
}
