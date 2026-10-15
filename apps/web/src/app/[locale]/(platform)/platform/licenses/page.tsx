import type { Metadata } from "next";
import { Suspense } from "react";
import { LicensesList } from "@/features/platform/licenses-list";

export const metadata: Metadata = { title: "Licenses" };

export default function Page() {
  return (
    <Suspense>
      <LicensesList />
    </Suspense>
  );
}
