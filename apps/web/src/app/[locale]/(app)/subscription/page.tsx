import type { Metadata } from "next";
import { SubscriptionScreen } from "@/features/subscription/subscription-screen";

export const metadata: Metadata = { title: "Subscription" };

export default function SubscriptionPage() {
  return <SubscriptionScreen />;
}
