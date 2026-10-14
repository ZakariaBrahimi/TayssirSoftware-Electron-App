import type { Metadata } from "next";
import { SetupForm } from "@/features/auth/setup-form";

export const metadata: Metadata = { title: "Create your store" };

export default function SignupPage() {
  return <SetupForm mode="signup" />;
}
