import type { Metadata } from "next";
import { SiteSettings } from "@/features/platform/site-settings";

export const metadata: Metadata = { title: "Website" };

export default function Page() {
  return <SiteSettings />;
}
