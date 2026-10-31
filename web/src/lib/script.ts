// Demo script for 31 October, rendered at /script. Keep in sync with prep/01-pitch/1-LIVE-DEMO.md.

export type Shot = { tc: string; screen: string; action: string; vo: string; onScreen?: string };

export const TRAILER: Shot[] = [
  {
    tc: "0:00–0:06",
    screen: "Logo motion",
    action: "Orange dot blinks on navy → the ring expands → orange fills the frame, cut (variant A from the branding sheet).",
    vo: "Every day, an area of 4,000 orders sees about 320 deliveries fail on the first try.",
    onScreen: "320 / 4,000",
  },
  {
    tc: "0:06–0:18",
    screen: "Landing · The problem",
    action: "Slow scroll across the four hero numbers; hold on 40,000 VND and 0 windows.",
    vo: "Sellers pay up to forty thousand dong to ship each one back. And the delivery time — the thing that decides whether a buyer accepts — is negotiated outside the system.",
    onScreen: "40,000 VND · 8–12% · 0 windows",
  },
  {
    tc: "0:18–0:26",
    screen: "/demo/shipper",
    action: "10:02, the shipper calls, no answer. Close-up of the thumb tapping “A · No answer”.",
    vo: "With Alodi, the shipper taps one button.",
  },
  {
    tc: "0:26–0:36",
    screen: "/demo/buyer",
    action: "The message lands in chat with quick replies. The clock fast-forwards 10:02 → 11:02.",
    vo: "The agent messages at once, while the buyer is watching their phone. Sixty silent minutes later, it calls.",
    onScreen: "10:02 → 11:02",
  },
  {
    tc: "0:36–0:56",
    screen: "/demo/buyer · call",
    action: "Incoming call under a verified name. Answer, let the call audio run with live captions.",
    vo: "(Call audio) “Tomorrow after five, please. Leave it with security in Tower B — or call my wife.”",
  },
  {
    tc: "0:56–1:08",
    screen: "/demo/console",
    action: "Fields appear one by one with confidence bars; the JSON bumps a version and the changed block lights up.",
    vo: "The answer becomes structured data, each field with its own confidence. Confident enough, it applies itself. Ambiguous, it goes to a person.",
    onScreen: "0.94 · 0.88 · 0.91",
  },
  {
    tc: "1:08–1:20",
    screen: "/demo/shipper",
    action: "The context card slides in. Cut to the next day, 17:22, tap Delivered.",
    vo: "Seconds later the context card is in the shipper’s app. The next day, the parcel reaches the right person, at the right time.",
    onScreen: "Time-to-context: 4 seconds",
  },
  {
    tc: "1:20–1:30",
    screen: "Landing · Team → logo",
    action: "Glide past Team Develarper, end on the logo and tagline.",
    vo: "Alodi. Make the second drop land.",
  },
];

export type Beat = { time: string; who: string; say: string; do: string };

export const LIVE: Beat[] = [
  {
    time: "0:00",
    who: "Nomura Yoshio",
    say: "An area handling 4,000 orders a day sees about 320 fail on the first attempt. Each return costs the seller up to forty thousand dong. And Shopee still doesn’t let buyers choose a delivery time.",
    do: "Problem slide (or landing · The problem).",
  },
  {
    time: "0:30",
    who: "Nomura Yoshio",
    say: "Three screens: the shipper app, the buyer’s phone, and the customer-service console. The demo clock fast-forwards: sixty minutes become six seconds.",
    do: "Open /demo, scenario “A · No answer”, turn Auto-tap off, press Play.",
  },
  {
    time: "0:45",
    who: "Long Quan Ton",
    say: "The shipper arrives, calls, no answer. Instead of typing a note, he taps one button.",
    do: "Tap A in the shipper app.",
  },
  {
    time: "1:00",
    who: "Long Quan Ton",
    say: "The agent messages right away. The buyer stays silent, so exactly sixty minutes later it calls — after the policy guard checks the time.",
    do: "Point at the “Call hours 08:00–20:30 · inside” chip.",
  },
  {
    time: "1:15",
    who: "Khanh Tuong Huynh",
    say: "The buyer answers like people really do: time, drop-off and a stand-in receiver in one breath. The extractor splits it into fields, each with a confidence score.",
    do: "Tap Answer on the buyer’s phone and let the call run.",
  },
  {
    time: "1:50",
    who: "Thanh Loi Tran",
    say: "Everything is above 0.85, so the agent applies it. The Order Context Object gets a new version, and the audit log shows who changed what.",
    do: "Point at the highlighted JSON block and the audit log.",
  },
  {
    time: "2:05",
    who: "Long Quan Ton",
    say: "Four seconds after hang-up, the context card is in the shipper’s app. The next day, delivered.",
    do: "Let it run to Delivered (or press →).",
  },
  {
    time: "2:20",
    who: "Khanh Tuong Huynh",
    say: "And when a buyer refuses at the door, the agent doesn’t call. It only suggests a label; a person decides.",
    do: "Pick “Refused”, speed 2x, press Play.",
  },
  {
    time: "2:40",
    who: "Nomura Yoshio",
    say: "Two numbers are measured: accuracy and safe autonomy. Savings are always projected. Alodi — make the second drop land.",
    do: "Open /metrics.",
  },
];

export const CALL_CAST = [
  { role: "Assistant (AI)", voice: "Warm female voice via TTS. The greeting and recording consent are pre-recorded." },
  { role: "Mr. Minh (buyer)", voice: "A real person voicing it, natural and a little rushed." },
];

export const CHECKLIST = [
  "Test the browser’s English TTS voice on the recording machine.",
  "Open /demo/shipper, /demo/buyer and /demo/console in three 1080p windows; they stay in sync. Press H to hide the controls.",
  "Turn Auto-tap on for the trailer, off for the live demo so the presenter taps.",
  "Silence OS notifications, set speed to 1x, press R before every take.",
  "Record a backup video of the full main flow in case the venue machine fails.",
  "Know the answers to the five questions in the landing FAQ by heart.",
];
