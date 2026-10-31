import type { Metadata } from "next";
import { LiveStage } from "@/components/live/stage";

export const metadata: Metadata = { title: "Live demo · Alodi" };

export default function LivePage() {
  return <LiveStage />;
}
