import type { Metadata } from "next";
import { DevicesList } from "@/features/platform/devices-list";

export const metadata: Metadata = { title: "Devices" };

export default function Page() {
  return <DevicesList />;
}
