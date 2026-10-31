import type { Metadata } from "next";
import { DemoGate } from "@/components/live/gate";

export const metadata: Metadata = { title: "Choose a demo · Alodi" };

export default function StartPage() {
  return <DemoGate />;
}
