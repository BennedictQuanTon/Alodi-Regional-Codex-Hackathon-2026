import type {
  AuditEntry,
  CallLine,
  ChatMsg,
  ChoiceKey,
  DemoState,
  ExtractField,
  OrderContext,
  ScenarioId,
  Step,
} from "./types";

// ---------------------------------------------------------------------------
// Mock order used by the demo
// ---------------------------------------------------------------------------

export const ORDER = {
  tracking: "SPXVN0123456789",
  buyer: "Minh Hoang",
  buyerShort: "Mr. Minh",
  phone: "0912 *** 678",
  address: "Unit 12.08, Tower B, Sky Garden, 205 Nguyen Xi, Ward 26, Binh Thanh",
  item: "6L air fryer",
  cod: "1,250,000 VND",
  shipper: "Tuan Nguyen",
  route: "HCM-BT-07",
  stopIndex: 7,
  stopTotal: 24,
};

const DAY0 = { label: "31 Oct", iso: "2026-10-31", weekday: "Sat" };
const DAY1 = { label: "1 Nov", iso: "2026-11-01", weekday: "Sun" };

export const DAY_MIN = 24 * 60;

export function fmtClock(min: number) {
  const m = Math.floor(min) % DAY_MIN;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export function fmtDay(min: number) {
  return min >= DAY_MIN ? DAY1 : DAY0;
}

function iso(min: number) {
  const d = fmtDay(min);
  return `${d.iso}T${fmtClock(min)}:00+07:00`;
}

const t = (hh: number, mm: number, day = 0) => day * DAY_MIN + hh * 60 + mm;

let uid = 0;
const id = (p: string) => `${p}_${++uid}`;

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

function initialOco(): OrderContext {
  return {
    tracking_id: ORDER.tracking,
    version: 1,
    trigger: "PRE_DELIVERY",
    rescue_cycle: 0,
    delivery_attempt: 0,
    channel: null,
    contact_log: [],
    slots_offered: [],
    extracted: { time_window: null, drop_location: null, alt_receiver: null, address_correction: null },
    confidence: {},
    decision: "pending",
    consent: { recording: null, opt_out: false },
    raw_ref: null,
    updated_by: "system",
  };
}

export function initialState(scenario: ScenarioId = "A_main"): DemoState {
  return {
    scenario,
    step: 0,
    clock: t(6, 28),
    playing: false,
    auto: true,
    speed: 1,
    waitingFor: null,
    caption: "Press Play to start. The demo clock fast-forwards: 60 minutes become a few seconds.",
    shipper: { screen: "route", day: 0 },
    memo: { status: "idle", seconds: 0 },
    chat: [],
    buyerTyping: false,
    call: { status: "idle", attempt: 0, lines: [] },
    stage: "pre",
    timer: null,
    extraction: null,
    card: null,
    oco: initialOco(),
    prevOco: null,
    audit: [],
    guard: { contacts: 0, maxCalls: 2, calls: 0, consent: null, optOut: false },
    ttc: { triggerAt: null, contextAt: null, lastSignalAt: null },
    done: false,
    animTo: null,
  };
}

// ---------------------------------------------------------------------------
// Helpers: every step clones the state and edits the copy (apply stays pure)
// ---------------------------------------------------------------------------

type Mut = (n: DemoState, payload?: string) => void;
const mut =
  (fn: Mut) =>
  (s: DemoState, payload?: string): DemoState => {
    const n = structuredClone(s);
    fn(n, payload);
    return n;
  };

function log(n: DemoState, actor: AuditEntry["actor"], text: string, tone?: AuditEntry["tone"]) {
  n.audit.push({ id: id("a"), at: n.clock, actor, text, tone });
}

function chat(n: DemoState, from: ChatMsg["from"], text: string, options?: string[]) {
  n.chat.push({ id: id("m"), from, text, at: n.clock, options });
}

function say(n: DemoState, who: CallLine["who"], text: string, voice?: CallLine["voice"]) {
  n.call.lines.push({ id: id("c"), who, text, at: n.clock, voice });
}

function bumpOco(n: DemoState, by: OrderContext["updated_by"], fn: (o: OrderContext) => void) {
  n.prevOco = structuredClone(n.oco);
  fn(n.oco);
  n.oco.version += 1;
  n.oco.updated_by = by;
}

// ---------------------------------------------------------------------------
// Shared prefix: from 06:30 until the shipper taps a button
// ---------------------------------------------------------------------------

const PREFIX: Step[] = [
  {
    id: "p_fetch",
    to: t(6, 30),
    ms: 1600,
    caption: "06:30 · Alodi pulls today’s orders for Binh Thanh",
    apply: mut((n) => {
      log(n, "system", "1,284 orders today from Carrier OMS · 96 flagged risky");
      log(n, "agent", `Risk flag: COD ${ORDER.cod}, rescheduled once before`, "warn");
    }),
  },
  {
    id: "p_slots",
    dt: 2,
    ms: 2200,
    caption: "Risky order: the agent offers two windows from the route planner as quick replies",
    apply: mut((n) => {
      chat(
        n,
        "agent",
        `Hi ${ORDER.buyerShort}, your ${ORDER.item} arrives today. Which window works?`,
        ["Morning · 09:30–11:00", "Afternoon · 14:00–16:00"],
      );
      bumpOco(n, "agent", (o) => {
        o.channel = "chat_shopee";
        o.slots_offered = ["2026-10-31T09:30/11:00", "2026-10-31T14:00/16:00"];
        o.contact_log.push({ at: iso(n.clock), type: "slots_sent" });
      });
      log(n, "agent", "Sent 2 route-planner windows (buyer preference, not a promise)");
    }),
  },
  {
    id: "p_cutoff",
    to: t(8, 0),
    ms: 2600,
    caption: "08:00 route lock · no reply, so the route runs as planned",
    apply: mut((n) => {
      n.stage = "delivering";
      log(n, "system", "Route HCM-BT-07 locked · no reply, plan unchanged");
    }),
  },
  {
    id: "p_arrive",
    to: t(10, 2),
    ms: 2600,
    caption: "10:02 · The shipper arrives and calls — no answer",
    apply: mut((n) => {
      n.shipper.screen = "calling";
      bumpOco(n, "shipper", (o) => {
        o.delivery_attempt = 1;
      });
      log(n, "shipper", "At stop 7/24 · called twice, no answer");
    }),
  },
  {
    id: "p_choose",
    ms: 2400,
    caption: "No typing. The shipper taps one button",
    wait: { action: "shipper:choose", hint: "Tap a button in the shipper app", autoMs: 2600 },
    apply: mut(() => {}),
  },
];

// ---------------------------------------------------------------------------
// Branches
// ---------------------------------------------------------------------------

const onPressA = mut((n) => {
  n.shipper.screen = "waiting";
  n.stage = "chat";
  n.ttc.triggerAt = n.clock;
  bumpOco(n, "shipper", (o) => {
    o.trigger = "NO_ANSWER";
    o.rescue_cycle = 1;
  });
  log(n, "shipper", "Tapped A · No answer");
  log(n, "agent", "Case accepted · rescue cycle 1/2");
});

const sendRescueChat = mut((n) => {
  chat(
    n,
    "agent",
    `We just missed you, ${ORDER.buyerShort}. When should we come back?`,
    ["This afternoon", "Tomorrow AM", "Tomorrow PM"],
  );
  n.guard.contacts += 1;
  n.timer = { label: "AI call 1", until: n.clock + 60 };
  bumpOco(n, "agent", (o) => {
    o.contact_log.push({ at: iso(n.clock), type: "chat_sent" });
  });
  log(n, "agent", "Chat sent · waiting 60 min before calling");
});

function ring(attempt: 1 | 2): Step["apply"] {
  return mut((n) => {
    n.stage = attempt === 1 ? "call1" : "call2";
    n.timer = null;
    n.call = { status: "ringing", attempt, lines: [] };
    n.guard.calls = attempt;
    log(n, "system", `Policy guard: ${fmtClock(n.clock)} is inside 08:00–20:30 · call ${attempt}/2`, "good");
    log(n, "agent", `AI call ${attempt} · verified brand name shown`);
  });
}

const answer = mut((n) => {
  n.call.status = "connected";
});

function line(who: "ai" | "buyer", text: string, voice?: "recorded" | "tts", extra?: Mut): Step["apply"] {
  return mut((n, p) => {
    say(n, who, text, voice);
    extra?.(n, p);
  });
}

function endCall(duration: number, result = "answered"): Step["apply"] {
  return mut((n) => {
    n.call.status = "ended";
    n.call.durationS = duration;
    n.ttc.lastSignalAt = n.clock;
    bumpOco(n, "agent", (o) => {
      o.channel = "ai_call";
      o.raw_ref = "conv_8f21a";
      o.contact_log.push({ at: iso(n.clock - duration / 60), type: `call_${n.call.attempt}`, result, duration_s: duration });
    });
    chat(n, "system", `Voice call with Delivery Assistant · ${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, "0")}`);
    log(n, "agent", `Call ${n.call.attempt} · answered · ${duration}s`);
  });
}

function startExtract(source: "ai_call" | "shipper_memo" | "chat", fields: ExtractField[]): Step["apply"] {
  return mut((n) => {
    n.stage = "extract";
    n.extraction = { source, fields, revealed: 0, decision: null };
    log(n, "agent", "Context extractor: strict JSON schema");
  });
}

const revealAll = mut((n) => {
  if (n.extraction) n.extraction.revealed = n.extraction.fields.length;
});

const GOOD_FIELDS: ExtractField[] = [
  { key: "time_window", label: "Window", value: "1 Nov · 17:00–20:00", conf: 0.94 },
  { key: "drop_location", label: "Drop-off", value: "Security desk, Tower B", conf: 0.88 },
  { key: "alt_receiver", label: "Alt. receiver", value: "Wife · 0903 *** 214", conf: 0.91 },
  { key: "address_correction", label: "Address fix", value: null, conf: null },
];

function applyGood(source: "ai_call" | "shipper_memo", sourceLabel: string): Step["apply"] {
  return mut((n) => {
    n.stage = "ready";
    if (n.extraction) n.extraction.decision = "auto_applied";
    n.card = {
      window: "Sun 1 Nov, 17:00–20:00",
      drop: "Tower B security desk",
      alt: "Wife · 0903 *** 214",
      source: sourceLabel,
      by: "agent",
    };
    n.shipper.screen = "context";
    n.ttc.contextAt = n.clock;
    bumpOco(n, "agent", (o) => {
      o.channel = source;
      o.extracted = {
        time_window: { date: "2026-11-01", from: "17:00", to: "20:00" },
        drop_location: { type: "security_desk", note: "Tower B security" },
        alt_receiver: { phone: "09xxxxxxxx", relation: "wife" },
        address_correction: null,
      };
      o.confidence = { time_window: 0.94, drop_location: 0.88, alt_receiver: 0.91 };
      o.decision = "auto_applied";
    });
    log(n, "agent", "Auto-applied · every field ≥ 0.85 threshold", "good");
    log(n, "system", "Context written to shipper app backend and dispatcher queue");
  });
}

const confirmToBuyer = mut((n) => {
  chat(
    n,
    "agent",
    "Got it: Sun 1 Nov, 17:00–20:00, Tower B security. Reply “change” anytime.",
  );
});

const nextDay = mut((n) => {
  n.shipper = { screen: "route", day: 1 };
  n.stage = "delivering";
  n.call = { status: "idle", attempt: 0, lines: [] };
  log(n, "system", "Route for 1 Nov · order slotted into the evening shift per context card");
});

const delivered = mut((n) => {
  n.stage = "closed";
  n.shipper.screen = "delivered";
  n.done = true;
  bumpOco(n, "shipper", (o) => {
    o.delivery_attempt += 1;
    o.contact_log.push({ at: iso(n.clock), type: "delivered", result: "security_desk" });
  });
  chat(n, "system", "Delivered · received by Tower B security");
  log(n, "shipper", "Delivered on attempt 2 · Tower B security", "good");
});

function callScript(): Step[] {
  return [
    {
      id: "c_hello",
      ms: 2600,
      dt: 0.2,
      caption: "Pre-recorded opener: greeting, automated-assistant notice, recording consent",
      apply: line(
        "ai",
        "Hello Mr. Minh, this is the automated delivery assistant calling about your air fryer. This call is recorded so we get the delivery right — is that okay?",
        "recorded",
      ),
    },
    {
      id: "c_consent",
      ms: 2000,
      dt: 0.1,
      apply: line("buyer", "Sure, go ahead.", undefined, (n) => {
        n.guard.consent = true;
        bumpOco(n, "buyer", (o) => {
          o.consent.recording = true;
        });
        log(n, "buyer", "Recording consent given", "good");
      }),
    },
    {
      id: "c_ask",
      ms: 2800,
      dt: 0.2,
      caption: "Dynamic part via TTS · windows come from the route planner",
      apply: line(
        "ai",
        "Our shipper missed you this morning. Tomorrow we have 8 to 12, or 5 to 8 in the evening. Which works for you?",
        "tts",
      ),
    },
  ];
}

const goodCall: Step[] = [
  {
    id: "c_reply",
    ms: 3400,
    dt: 0.3,
    caption: "A real-world answer: time, drop-off and a stand-in receiver in one breath",
    apply: line(
      "buyer",
      "Tomorrow after five, please. I’m out until late, so leave it with security in Tower B. Or call my wife, 0903 xxx 214.",
    ),
  },
  {
    id: "c_confirm",
    ms: 3000,
    dt: 0.2,
    apply: line(
      "ai",
      "Confirming: Sunday 1 November, 5 to 8 pm, left with Tower B security, and your wife on 0903 xxx 214 if needed. Is that right?",
      "tts",
    ),
  },
  { id: "c_ok", ms: 1600, dt: 0.1, apply: line("buyer", "That’s right.") },
  {
    id: "c_bye",
    ms: 2000,
    dt: 0.1,
    apply: line("ai", "Thank you, Mr. Minh. Have a good afternoon.", "recorded"),
  },
  { id: "c_end", ms: 1400, dt: 0.1, caption: "Call ends after 74 seconds", apply: endCall(74) },
];

const NODE_RING_1: Step[] = [
  { id: "a_press", ms: 300, caption: "T0 · Shipper taps A. The agent takes over", apply: onPressA },
  {
    id: "a_chat",
    ms: 1600,
    caption: "Message at once: a buyer who just missed a call is watching their phone",
    apply: sendRescueChat,
  },
  {
    id: "a_wait60",
    dt: 60,
    ms: 6000,
    caption: "Fast-forward: 60 silent minutes",
    apply: ring(1),
  },
];

const BRANCHES: Record<ScenarioId, Step[]> = {
  A_main: [
    ...NODE_RING_1,
    {
      id: "a_answer",
      ms: 400,
      caption: "11:02 · AI call 1, under a verified brand name instead of a stranger’s number",
      wait: { action: "buyer:answer", hint: "Answer on the buyer’s phone", autoMs: 2400 },
      apply: answer,
    },
    ...callScript(),
    ...goodCall,
    {
      id: "a_extract",
      ms: 1200,
      caption: "Context extractor: transcript becomes JSON with per-field confidence",
      apply: startExtract("ai_call", GOOD_FIELDS),
    },
    { id: "a_reveal", ms: 2400, apply: revealAll },
    {
      id: "a_apply",
      ms: 1600,
      dt: 0.07,
      caption: "Confident enough: the context card appears for shipper and dispatcher",
      apply: applyGood("ai_call", "AI call 1 · 11:02"),
    },
    { id: "a_confirm", ms: 1800, apply: confirmToBuyer },
    {
      id: "a_nextday",
      to: t(17, 22, 1),
      ms: 4200,
      caption: "Next day · Sunday 1 Nov, evening shift",
      apply: nextDay,
    },
    {
      id: "a_deliver",
      ms: 1800,
      caption: "The shipper reads the card: right time, right place",
      wait: { action: "shipper:delivered", hint: "Tap Delivered", autoMs: 2800 },
      apply: delivered,
    },
    { id: "a_end", ms: 1200, caption: "Make the second drop land.", apply: mut(() => {}) },
  ],

  A_lowconf: [
    ...NODE_RING_1,
    {
      id: "l_answer",
      ms: 400,
      caption: "11:02 · AI call 1",
      wait: { action: "buyer:answer", hint: "Answer on the buyer’s phone", autoMs: 2400 },
      apply: answer,
    },
    ...callScript(),
    {
      id: "l_reply",
      ms: 3200,
      dt: 0.3,
      caption: "A vague answer that mentions two different times",
      apply: line("buyer", "Hmm, let me check tomorrow, maybe afternoon-ish… actually I might be home tonight, just leave it anywhere."),
    },
    {
      id: "l_bye",
      ms: 2400,
      dt: 0.2,
      apply: line("ai", "Noted. We’ll get back to you to confirm a time. Thank you.", "recorded"),
    },
    { id: "l_end", ms: 1200, dt: 0.1, apply: endCall(52) },
    {
      id: "l_extract",
      ms: 1200,
      caption: "The extractor returns low, conflicting confidence",
      apply: startExtract("ai_call", [
        { key: "time_window", label: "Window", value: "1 Nov afternoon? or 31 Oct evening?", conf: 0.52 },
        { key: "drop_location", label: "Drop-off", value: "“leave it anywhere”", conf: 0.41 },
        { key: "alt_receiver", label: "Alt. receiver", value: null, conf: null },
        { key: "address_correction", label: "Address fix", value: null, conf: null },
      ]),
    },
    { id: "l_reveal", ms: 2200, apply: revealAll },
    {
      id: "l_review",
      ms: 1600,
      caption: "Below 0.85, so the agent does not apply it: routed to a reviewer",
      apply: mut((n) => {
        n.stage = "review";
        if (n.extraction) n.extraction.decision = "needs_review";
        bumpOco(n, "agent", (o) => {
          o.decision = "needs_review";
          o.confidence = { time_window: 0.52, drop_location: 0.41 };
        });
        log(n, "agent", "Low confidence / conflict → CS review queue", "warn");
      }),
    },
    {
      id: "l_cs",
      ms: 1800,
      dt: 14,
      caption: "CS calls back to confirm, then approves in the console",
      wait: { action: "cs:approve", hint: "CS approves in the console", autoMs: 3200 },
      apply: mut((n) => {
        n.stage = "ready";
        n.card = {
          window: "Sun 1 Nov, 14:00–17:00",
          drop: "Unit 12.08, in person",
          alt: null,
          source: "Confirmed by CS via hotline",
          by: "cs",
        };
        n.shipper.screen = "context";
        n.ttc.contextAt = n.clock;
        bumpOco(n, "cs", (o) => {
          o.extracted.time_window = { date: "2026-11-01", from: "14:00", to: "17:00" };
          o.extracted.drop_location = { type: "hand_to_buyer", note: "unit 12.08" };
          o.decision = "cs_applied";
          o.confidence = { time_window: 1, drop_location: 1 };
        });
        log(n, "cs", "Lan (CS) confirmed 1 Nov 14:00–17:00 · applied", "good");
      }),
    },
    { id: "l_end2", ms: 1600, caption: "The agent knows when to stop: ambiguity goes to a person", apply: mut((n) => { n.done = true; }) },
  ],

  A_noanswer: [
    ...NODE_RING_1,
    {
      id: "n_miss1",
      ms: 5200,
      dt: 0.6,
      caption: "11:02 · AI call 1, no answer",
      apply: mut((n) => {
        n.call.status = "missed";
        n.timer = { label: "AI call 2", until: n.clock + 120 };
        bumpOco(n, "agent", (o) => {
          o.contact_log.push({ at: iso(n.clock), type: "call_1", result: "no_answer" });
        });
        chat(n, "system", `Missed call from Delivery Assistant · ${fmtClock(n.clock)}`);
        log(n, "agent", "Call 1 · no answer · call 2 scheduled in 2 hours", "warn");
      }),
    },
    {
      id: "n_wait2",
      dt: 120,
      ms: 5200,
      caption: "Fast-forward 2 hours: the second call lands in a different part of the day",
      apply: ring(2),
    },
    {
      id: "n_miss2",
      ms: 5200,
      dt: 0.6,
      caption: "13:02 · AI call 2, still no answer",
      apply: mut((n) => {
        n.call.status = "missed";
        bumpOco(n, "agent", (o) => {
          o.contact_log.push({ at: iso(n.clock), type: "call_2", result: "no_answer" });
          o.decision = "escalated_cs";
        });
        chat(n, "system", `Missed call from Delivery Assistant · ${fmtClock(n.clock)}`);
        chat(n, "agent", "Couldn’t reach you. Call back any time to reach support.");
        log(n, "agent", "Call 2 · no answer", "warn");
      }),
    },
    {
      id: "n_cs",
      ms: 1800,
      caption: "Two calls used: hand to CS; call-backs to the agent number route to the hotline",
      apply: mut((n) => {
        n.stage = "cs";
        n.shipper.screen = "handoff";
        n.shipper.banner = "Agent called twice · CS has taken over";
        log(n, "system", "Handed to CS · buyer call-backs route to hotline", "warn");
      }),
    },
    {
      id: "n_take",
      ms: 1600,
      caption: "A person takes over; the agent stops calling",
      wait: { action: "cs:approve", hint: "CS claims the case in the console", autoMs: 3000 },
      apply: mut((n) => {
        log(n, "cs", "Lan (CS) claimed the case · agent contact stopped", "good");
        n.done = true;
      }),
    },
  ],

  B_memo: [
    {
      id: "b_press",
      ms: 300,
      caption: "Shipper taps B · the buyer rescheduled on the phone",
      apply: mut((n) => {
        n.shipper.screen = "memo";
        n.stage = "chat";
        n.ttc.triggerAt = n.clock;
        bumpOco(n, "shipper", (o) => {
          o.trigger = "RESCHEDULE";
          o.rescue_cycle = 1;
        });
        log(n, "shipper", "Tapped B · Rescheduled");
      }),
    },
    {
      id: "b_rec",
      ms: 1400,
      caption: "Ten-second voice memo: the shipper repeats what the buyer said, no typing",
      wait: { action: "shipper:memo", hint: "Hold the mic button in the shipper app", autoMs: 2000 },
      apply: mut((n) => {
        n.memo = { status: "recording", seconds: 0 };
      }),
    },
    {
      id: "b_rec2",
      ms: 3800,
      dt: 0.17,
      apply: mut((n) => {
        n.memo = {
          status: "done",
          seconds: 9,
          transcript: "Buyer wants tomorrow after five, leave it with Tower B security, or call his wife on oh-nine-oh-three…",
        };
        n.ttc.lastSignalAt = n.clock;
        log(n, "shipper", "Voice memo 9s · Vietnamese ASR");
      }),
    },
    {
      id: "b_extract",
      ms: 1400,
      caption: "ASR, then the extractor: the shipper’s words become the same schema",
      apply: startExtract("shipper_memo", GOOD_FIELDS),
    },
    { id: "b_reveal", ms: 2200, apply: revealAll },
    {
      id: "b_apply",
      ms: 1400,
      dt: 0.05,
      caption: "The context card is ready seconds after the shipper finishes speaking",
      apply: applyGood("shipper_memo", "Shipper voice memo · 10:02"),
    },
    { id: "b_confirm", ms: 1800, caption: "The agent confirms back to the buyer", apply: confirmToBuyer },
    { id: "b_nextday", to: t(17, 22, 1), ms: 4000, caption: "Next day · evening shift", apply: nextDay },
    {
      id: "b_deliver",
      ms: 1800,
      wait: { action: "shipper:delivered", hint: "Tap Delivered", autoMs: 2800 },
      caption: "The second drop lands",
      apply: delivered,
    },
  ],

  REFUSE: [
    {
      id: "r_press",
      ms: 300,
      caption: "Refused at the door: no effort wasted calling a buyer who refused",
      apply: mut((n) => {
        n.shipper.screen = "handoff";
        n.shipper.banner = "Sent to CS · the agent will not contact the buyer";
        n.stage = "cs";
        bumpOco(n, "shipper", (o) => {
          o.trigger = "REFUSED";
          o.decision = "escalated_cs";
        });
        log(n, "shipper", "Tapped Refused");
        log(n, "agent", "No contact · sent to CS to cut losses", "warn");
      }),
    },
    {
      id: "r_suggest",
      ms: 1800,
      caption: "The agent only suggests a “suspected bomb” label, because it affects the buyer’s COD lock",
      apply: mut((n) => {
        log(n, "agent", "Suggested label: suspected bomb (needs approval)", "warn");
      }),
    },
    {
      id: "r_cs",
      ms: 1600,
      caption: "A reviewer decides, not the agent",
      wait: { action: "cs:approve", hint: "CS reviews the label in the console", autoMs: 3200 },
      apply: mut((n) => {
        n.stage = "closed";
        n.done = true;
        bumpOco(n, "cs", (o) => {
          o.decision = "cs_applied";
        });
        log(n, "cs", "Return to seller approved · label set by a person", "good");
      }),
    },
  ],
};

export const SCENARIOS: { id: ScenarioId; key: ChoiceKey; title: string; desc: string }[] = [
  { id: "A_main", key: "A", title: "A · No answer", desc: "Chat → AI call → context card → delivered" },
  { id: "B_memo", key: "B", title: "B · Rescheduled", desc: "Shipper’s 10-second voice memo → context card" },
  { id: "REFUSE", key: "REFUSE", title: "Refused", desc: "No buyer contact, CS cuts losses" },
  { id: "A_lowconf", key: "A", title: "A · Low confidence", desc: "Vague answer → human review" },
  { id: "A_noanswer", key: "A", title: "A · Two missed calls", desc: "2 missed calls → hand to CS" },
];

export const DEFAULT_FOR_KEY: Record<ChoiceKey, ScenarioId> = { A: "A_main", B: "B_memo", REFUSE: "REFUSE" };

export function stepsFor(scenario: ScenarioId): Step[] {
  return [...PREFIX, ...BRANCHES[scenario]];
}

export const CHOICE_STEP = PREFIX.length - 1;
