import type { Metadata } from "next";
import { DemoTour } from "@/components/demo/tour";

export const metadata: Metadata = { title: "Watch the demo · Alodi" };

export default function TourPage() {
  return <DemoTour />;
}
