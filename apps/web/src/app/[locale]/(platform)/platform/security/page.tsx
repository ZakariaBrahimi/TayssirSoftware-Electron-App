import type { Metadata } from "next";
import { SecurityScreen } from "@/features/platform/security-screen";

export const metadata: Metadata = { title: "Security" };

export default function Page() {
  return <SecurityScreen />;
}
