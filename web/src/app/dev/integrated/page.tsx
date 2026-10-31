import { notFound } from "next/navigation";
import { IntegratedHarness } from "@/components/ai/integrated-harness";

export default function IntegratedPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <IntegratedHarness />;
}
