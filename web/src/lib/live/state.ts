"use client";

import { useState } from "react";

// The single connection point for the live demo. The shipper's phone (/live/shipper) and the stage (/live) both read
// useLiveState, so both stay in sync once it reads from the backend. Nothing here is scripted: until the hook is
// connected, every screen shows its empty state. web/src/lib/ai/integrated.ts already holds an API client.

export type Outcome = "A" | "B" | "C";
export type StepStatus = "waiting" | "running" | "done" | "person";

export type LiveState = {
  connected: boolean;
  shipperOnline: boolean;
  order: { id: string; buyer: string; item: string; cod: string; address: string } | null;
  messages: { from: "agent" | "buyer"; text: string }[];
  call: { status: "idle" | "ringing" | "connected"; caption: string };
  steps: Record<string, { status: StepStatus; at?: string; detail?: string }>;
  card: { when: string; where: string; who: string; confidence: number } | null;
};

export const AGENT_STEPS = [
  { id: "tap", label: "Shipper tap", tool: "Shipper event" },
  { id: "policy", label: "Policy check", tool: "Hours, contact limits" },
  { id: "chat", label: "Chat to buyer", tool: "Workflow message" },
  { id: "call", label: "Call the buyer", tool: "GPT-Live-1" },
  { id: "memo", label: "Shipper memo", tool: "GPT Transcribe" },
  { id: "extract", label: "Extract fields", tool: "GPT-6.1 Terra" },
  { id: "decide", label: "Apply or hand to a person", tool: "Confidence ≥ 0.85" },
  { id: "card", label: "Context card to the next shipper", tool: "Order context" },
];

const EMPTY: LiveState = {
  connected: false,
  shipperOnline: false,
  order: null,
  messages: [],
  call: { status: "idle", caption: "" },
  steps: {},
  card: null,
};

export function useLiveState() {
  const [state] = useState<LiveState>(EMPTY);
  // Send the shipper's tap to the backend here; the new state then reaches every screen.
  const sendOutcome = (outcome: Outcome) => void outcome;
  return { state, sendOutcome };
}
