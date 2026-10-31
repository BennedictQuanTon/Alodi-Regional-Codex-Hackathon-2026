import type { Metadata } from "next";
import { DemoStage } from "@/components/demo/stage";

export const metadata: Metadata = { title: "Demo stage · Alodi" };

export default function DemoPage() {
  return <DemoStage />;
}
