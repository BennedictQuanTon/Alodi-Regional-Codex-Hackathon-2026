import type { Metadata } from "next";
import { SingleView } from "@/components/demo/single-view";

export const metadata: Metadata = { title: "Courier app · Alodi demo" };

export default function Page() {
  return <SingleView view="shipper" />;
}
