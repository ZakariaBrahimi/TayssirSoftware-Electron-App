import type { Metadata } from "next";
import { ShiftsScreen } from "@/features/shifts/shifts-screen";

export const metadata: Metadata = { title: "Cash register" };

export default function ShiftsPage() {
  return <ShiftsScreen />;
}
