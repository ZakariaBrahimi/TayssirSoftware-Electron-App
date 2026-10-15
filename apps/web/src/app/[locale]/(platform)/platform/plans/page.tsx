import type { Metadata } from "next";
import { PlansScreen } from "@/features/platform/plans-screen";

export const metadata: Metadata = { title: "Plans" };

export default function Page() {
  return <PlansScreen />;
}
