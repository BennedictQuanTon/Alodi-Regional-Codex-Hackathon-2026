"use client";

import { AnimatePresence, motion } from "motion/react";
import type { DemoState } from "@/lib/demo/types";

// The people in the demo, with faces and lines that follow the story.
// Illustrations: Notionists by Zoish (CC0), web/public/people.

type Role = { name: string; face: string; say: string };

function shipper(s: DemoState): Role {
  const name = "Tuan · Shipper";
  switch (s.shipper.screen) {
    case "calling":
      return { name, face: "shipper-grim", say: "Come on, pick up…" };
    case "choose":
      return { name, face: "shipper-sad", say: "No answer again." };
    case "waiting":
      return { name, face: "shipper-joy", say: "One tap. Next stop!" };
    case "memo":
      return { name, face: "shipper", say: "Let me say what they told me." };
    case "context":
      return { name, face: "shipper-joy", say: "Now I know where to go." };
    case "delivered":
      return { name, face: "shipper-joy", say: "Delivered!" };
    case "handoff":
      return { name, face: "shipper-sad", say: "Over to a person." };
    default:
      return { name, face: "shipper", say: "Stop 8 of 24." };
  }
}

function buyer(s: DemoState): Role {
  const name = "Minh · Buyer";
  const last = s.call.lines[s.call.lines.length - 1];
  if (s.shipper.screen === "delivered") return { name, face: "buyer-joy", say: "It actually arrived!" };
  if (s.call.status === "ringing") return { name, face: "buyer-oh", say: "Oh! Who’s calling?" };
  if (s.call.status === "connected") return last?.who === "buyer" ? { name, face: "buyer-joy", say: "Happy to help." } : { name, face: "buyer-oh", say: "Listening…" };
  if (s.call.status === "ended") return { name, face: "buyer-joy", say: "That was easy." };
  if (s.call.status === "missed") return { name, face: "buyer-grim", say: "Still in that meeting…" };
  if (s.chat.some((m) => m.from === "agent")) return { name, face: "buyer-grim", say: "In a meeting. Phone’s on silent." };
  return { name, face: "buyer", say: "In a meeting." };
}

function ops(s: DemoState): Role {
  if (s.shipper.screen === "handoff") return { name: "Customer service", face: "cs-joy", say: "I’ll take this one." };
  if (s.card) return { name: "Hub ops", face: "ops", say: "Rescued. No call from me." };
  if (s.call.status === "connected" || s.call.status === "ringing") return { name: "Hub ops", face: "ops", say: "Alodi’s on the call." };
  if (s.chat.length) return { name: "Hub ops", face: "ops", say: "Alodi is handling it." };
  return { name: "Hub ops", face: "ops", say: "Watching today’s routes." };
}

const WHO = { shipper, buyer, ops };

export function Person({ who, state }: { who: keyof typeof WHO; state: DemoState }) {
  const r = WHO[who](state);
  return (
    <div className="mb-3 flex h-[64px] items-center justify-center gap-3">
      <AnimatePresence mode="wait" initial={false}>
        <motion.img
          key={r.face}
          src={`/people/${r.face}.svg`}
          alt=""
          width={60}
          height={60}
          className="shrink-0 rounded-full bg-white shadow-[0_0_0_2px_#fff,0_6px_16px_-8px_rgba(18,26,44,0.5)]"
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.85, opacity: 0 }}
          transition={{ type: "spring", stiffness: 420, damping: 22 }}
        />
      </AnimatePresence>
      <div className="min-w-0 text-left">
        <div className="text-[13px] font-medium text-[var(--ui-muted)]">{r.name}</div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={r.say}
            className="whitespace-nowrap text-[17px] font-medium leading-tight text-[var(--ui-ink)]"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.22 }}
          >
            {r.say}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
