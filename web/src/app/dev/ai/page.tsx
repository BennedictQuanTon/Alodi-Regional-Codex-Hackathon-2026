import { notFound } from "next/navigation";
import { DevAiHarness } from "@/components/ai/dev-harness";

export default function DevAiPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <DevAiHarness />;
}
