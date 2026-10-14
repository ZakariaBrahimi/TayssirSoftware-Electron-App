import type { Metadata } from "next";
import { PlanGate } from "@/components/plan-gate";
import { ShiftsScreen } from "@/features/shifts/shifts-screen";

export const metadata: Metadata = { title: "Cash register" };

export default function ShiftsPage() {
  return (
    <PlanGate feature="shifts">
      <ShiftsScreen />
    </PlanGate>
  );
}
