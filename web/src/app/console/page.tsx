import type { Metadata } from "next";
import { Overview } from "@/components/dash/overview";

export const metadata: Metadata = { title: "Dashboard · Alodi" };

export default function ConsolePage() {
  return <Overview />;
}
