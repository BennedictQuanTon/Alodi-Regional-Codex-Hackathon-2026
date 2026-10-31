import type { Metadata } from "next";
import { MetricsDash } from "@/components/dash/metrics";

export const metadata: Metadata = { title: "Metrics · Alodi" };

export default function Page() {
  return <MetricsDash />;
}
