import type { Metadata } from "next";
import { PosScreen } from "@/features/pos/pos-screen";

export const metadata: Metadata = { title: "Point of sale" };

export default function PosPage() {
  return <PosScreen />;
}
