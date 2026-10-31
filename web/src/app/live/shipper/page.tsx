import type { Metadata, Viewport } from "next";
import { LiveShipper } from "@/components/live/shipper";

export const metadata: Metadata = { title: "Shipper · Alodi live" };
export const viewport: Viewport = { viewportFit: "cover", themeColor: "#ffffff" };

export default function LiveShipperPage() {
  return <LiveShipper />;
}
