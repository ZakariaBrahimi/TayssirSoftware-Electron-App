import type { Metadata } from "next";
import { OverviewScreen } from "@/features/platform/overview-screen";

export const metadata: Metadata = { title: "Overview" };

export default function Page() {
  return <OverviewScreen />;
}
