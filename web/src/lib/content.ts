// Landing page content. Problem figures come from the team’s architecture doc and carry a plain-text
// `source` line. Never add numbered citation markers (see /CLAUDE.md).

export type Source = { label: string; detail: string; url: string };

export const SOURCES: Source[] = [
  {
    label: "Shopee Return & Refund Policy §7.1–7.2",
    detail: "Effective 11 Mar 2026. Sellers pay up to 40,000 VND return shipping per failed order; exception when the carrier is at fault.",
    url: "https://help.shopee.vn/portal/4/article/77251",
  },
  {
    label: "VTV, 25 Mar 2025",
    detail: "Shopee revises its new fee packages after a Ministry of Industry and Trade request (40,000 / 20,000 VND express).",
    url: "https://vtv.vn/kinh-te/shopee-ha-goi-dich-vu-phi-moi-sau-yeu-cau-bao-cao-cua-bo-cong-thuong-20250325160554152.htm",
  },
  {
    label: "Shopee Help Center, article 79559",
    detail: "“Shopee does not yet support choosing a specific delivery time.”",
    url: "https://help.shopee.vn/portal/4/article/79559",
  },
  {
    label: "Nguoi Lao Dong, 19 Jul 2025",
    detail: "VECOM: 8–12% nationwide, up to 20% in remote areas. Tran Anh Tung (UEF): 10–15% today, 25–30% in sale season.",
    url: "https://tuoitre.vn/nld/nhuc-nhoi-nan-bom-hang-19625071822023801.htm",
  },
  {
    label: "GHN, courier earnings per order",
    detail: "6,000–8,000 VND per order (not an official Shopee figure).",
    url: "https://ghn.vn/blogs/tip-ban-hang/mot-don-hang-shipper-shopee-duoc-bao-nhieu-tien",
  },
  {
    label: "Metric via Brands Vietnam, E-commerce Report 2025",
    detail: "429.7 trillion VND across 4 marketplaces (Shopee, TikTok Shop, Lazada, Tiki), up 34.75%.",
    url: "https://www.brandsvietnam.com/congdong/topic/thi-truong-tmdt-viet-nam-nam-2025-nhung-chuyen-dich-dang-chu",
  },
  {
    label: "Shipsy, What is NDR management",
    detail: "Industry-average rescue rate 20–30%, best-in-class 50–65% (vendor figures).",
    url: "https://shipsy.ai/insights/what-is-ndr-non-delivery-report-management",
  },
  {
    label: "Shopee Help Center, article 79196",
    detail: "Three failed COD orders within 90 days disables COD for the buyer.",
    url: "https://help.shopee.vn/portal/4/article/79196",
  },
  {
    label: "Shopee Help Center, article 79569",
    detail: "Redelivery process: 2–3 contact attempts, rescheduling within 5 days.",
    url: "https://help.shopee.vn/portal/4/article/79569",
  },
  {
    label: "ClickPost, NDR Management",
    detail: "Automated buyer outreach over SMS, email, WhatsApp and IVR; responses become reattempt or return instructions.",
    url: "https://www.clickpost.ai/ndr-management",
  },
  {
    label: "Angel One, ClickPost Parth",
    detail: "Brands using the Parth voice agent report 15–20% lower RTO; MyMuse resolves 80% of NDRs within a day.",
    url: "https://www.angelone.in/news/economy/logistics-firms-deploy-ai-to-reduce-failed-deliveries-and-rtos-by-up-to-20-for-d2c-businesses",
  },
  {
    label: "Shipsy, Last-mile delivery",
    detail: "Proactive delivery windows, geofencing, CX Agent rescues NDRs before a return is triggered.",
    url: "https://www.shipsy.ai/last-mile-delivery",
  },
  {
    label: "AfterShip, Exception handling agent",
    detail: "Gathers exception context and drafts a fix for approval; customer Dr. Squatch reports 58% faster resolution.",
    url: "https://www.aftership.com/blog/exception-handling-agent",
  },
  {
    label: "Ringg AI, Failed delivery recovery",
    detail: "Voice agent calls after a failed attempt, classifies the cause and confirms a reattempt.",
    url: "https://www.ringg.ai/use-cases/failed-delivery-recovery",
  },
  {
    label: "Shiprocket, Contact buyer / IVR",
    detail: "Automated SMS + IVR when the courier marks the buyer unreachable; IVR on Advanced/Pro plans only.",
    url: "https://support.shiprocket.in/support/solutions/articles/43000664217-how-does-the-contact-buyer-functionality-work-",
  },
  {
    label: "GHTK, Scheduled delivery",
    detail: "Recipients pick a date and a morning/afternoon window in the app; no exact hour yet.",
    url: "https://ghtk.vn/blog/hen-gio-giao/",
  },
  {
    label: "AssemblyAI, Vietnamese",
    detail: "Vietnamese supported for batch and streaming transcription.",
    url: "https://www.assemblyai.com/languages/vietnamese",
  },
  {
    label: "VinAI, PhoWhisper",
    detail: "Open-source Vietnamese speech recognition.",
    url: "https://github.com/VinAIResearch/PhoWhisper",
  },
];

/** TL;DR: what Alodi is, in one sentence and five lines. Sits right above "How Alodi works". */
export const TLDR = {
  headline: "Alodi is the AI agent that rescues failed deliveries.",
  body: "When a courier can’t reach the buyer, they tap one button. Alodi messages the buyer, calls if there’s silence, and hands the next courier a card with when, where and who to deliver to.",
  facts: [
    { k: "For", v: "Carriers like SPX, their couriers and buyers" },
    { k: "Starts with", v: "One tap: No answer · Rescheduled · Refused" },
    { k: "Does", v: "Chats now, calls if silent, extracts a context card" },
    { k: "Never", v: "Labels or returns an order without a person" },
    { k: "Built on", v: "OpenAI Agents SDK and gpt-oss-20b, shipped with Codex" },
  ],
};

/**
 * Demo video under the TL;DR. Drop the file in web/public/video/ and set `src` (and optionally `poster`).
 * Leave `src` empty to show the placeholder frame.
 */
export const DEMO_VIDEO = { src: "", poster: "", length: "2:00", caption: "The full rescue, from the courier’s tap to the second drop" };

export const HERO_STATS = [
  { value: "₫40,000", text: "return fee the seller pays on each failed order", source: "Shopee Return & Refund Policy §7.1, Mar 2026" },
  { value: "8–12%", text: "of orders refused at the door, nationwide", source: "VECOM, Nguoi Lao Dong, 19 Jul 2025" },
  { value: "0", text: "delivery windows a Shopee buyer can choose", source: "Shopee Help Center, article 79559" },
  { value: "₫473M", text: "lost a month in one area of 4,000 orders a day", source: "Team cost model, PRD §18.8 (modelled)" },
];

/** Open-licence photography (CC0, Wikimedia Commons). Shown with a plain credit line. */
export const PHOTOS = {
  street: {
    src: "/photos/hcmc-street.webp",
    alt: "A rider carrying goods on a motorbike down a tree-lined street in Ho Chi Minh City",
    credit: "Lemic302, CC0",
  },
  phone: {
    src: "/photos/approach-phone.webp",
    alt: "A hand holding a smartphone",
    credit: "Samson Vowles, CC0",
  },
  laptop: {
    src: "/photos/approach-laptop.webp",
    alt: "A developer working on code on a laptop",
    credit: "Tirza van Dijk, CC0",
  },
};

/**
 * Photo slot in the problem section, reserved for the team’s own field-survey photos.
 * Drop files in web/public/photos/survey/ and list them here; empty shows a placeholder frame.
 */
export const SURVEY_PHOTOS: { src: string; alt: string; caption?: string }[] = [
  { src: "/photos/survey/spx-hub.webp", alt: "An SPX Express hub on Bui Minh Truc street, Ho Chi Minh City", caption: "Field visit · SPX Express hub, Ho Chi Minh City" },
];

/**
 * Survey headline numbers (prep/06-survey/summary_MOCK.csv). `status` mirrors the files’ data_status:
 * while it is "MOCK" the section labels the numbers as placeholders; switch to "REAL" once the
 * interview export replaces the CSVs and these values.
 */
export const SURVEY = {
  status: "MOCK" as "MOCK" | "REAL",
  buyers: {
    n: 100,
    stats: [
      { value: "86%", text: "want to choose a delivery window" },
      { value: "66%", text: "called the courier back and couldn’t reach them" },
    ],
  },
  couriers: {
    n: 12,
    from: "6 carriers",
    stats: [
      { value: "27%", text: "of their calls to buyers go unanswered" },
      { value: "83%", text: "would use an Alodi-like system" },
    ],
  },
};

export const FEATURES = [
  {
    k: "01",
    title: "One tap instead of an error code",
    body: "The courier picks No answer, Rescheduled, or Refused. The agent does the rest.",
    tint: "rgba(240,90,0,0.35)",
  },
  {
    k: "02",
    title: "Ask for a window before delivery",
    body: "Send two or more slots from the route planner as quick replies. Only for risky orders: high COD, past failures.",
    tint: "rgba(160,181,235,0.8)",
  },
  {
    k: "03",
    title: "Message first, call if silent",
    body: "Chat goes out the moment the courier taps. 60 minutes of silence triggers call one, two hours later call two. Calls only 08:00–20:30.",
    tint: "rgba(236,218,152,0.9)",
  },
  {
    k: "04",
    title: "A ten-second voice memo",
    body: "Buyer rescheduled on the phone? The courier repeats it aloud; speech-to-text turns it into structured data.",
    tint: "rgba(255,148,115,0.6)",
  },
  {
    k: "05",
    title: "Extraction with confidence",
    body: "Window, drop-off, alternate receiver, address fix: each field is JSON with a confidence score. Low confidence goes to a person.",
    tint: "rgba(167,252,205,0.8)",
  },
  {
    k: "06",
    title: "Policy guard",
    body: "Quiet hours, contact caps, “stop” means stop, recording consent before every call.",
    tint: "rgba(160,181,235,0.8)",
  },
  {
    k: "07",
    title: "Order Context Object",
    body: "Versioned context with an audit log: who changed what, and when, across agent, buyer, courier and CS.",
    tint: "rgba(236,218,152,0.9)",
  },
  {
    k: "08",
    title: "Refusals go straight to CS",
    body: "Never spend effort calling a buyer who refused at the door. A “suspected bomb” label is only a suggestion; a person approves it.",
    tint: "rgba(240,90,0,0.35)",
  },
];

/** Output metrics from PRD §2.3 and §23: measured on stage from the event log and the eval set. */
export const OUTPUT_METRICS = [
  { metric: "Time-to-context", target: "< 10 s", how: "Buyer’s answer to the card on the courier’s phone, median" },
  { metric: "Extraction F1", target: "≥ 0.90", how: "Per field, on a held-out set of chat, call and memo samples" },
  { metric: "Wrong auto-applies", target: "< 2%", how: "Of the cases the agent closes on its own" },
  { metric: "Without a person", target: "0", how: "Labels, returns or calls out of hours" },
];

/** What one area gets back each day (PRD §18.8 best-in-class case, SLIDES §3.4). Projected. */
export const AREA_GAINS = [
  { value: "416", label: "CS calls handled by the agent", note: "≈ 28 staff-hours" },
  { value: "96", label: "fewer wasted courier trips", note: "320 × 0.3 attempts" },
  { value: "24 min", label: "back per courier", note: "96 trips × 5 min ÷ 20" },
];

/** Downloadable proof of every number: formulas, inputs, sources (generated from prep/02-technical/cost-model). */
export const NUMBERS_PDF = "/alodi-numbers.pdf";

/** `icon` is a simple-icons key (si*) or a path under /public/logos; `mono` is a two-letter fallback. */
export type Tech = { name: string; note: string; icon?: string; mono?: string };

// Demo day (PRD §16.3, §16.5): one VM, Docker Compose, cloud APIs, mock data.
export const TECH_DEMO: Tech[] = [
  { name: "Next.js", note: "Courier, ops and buyer screens", icon: "siNextdotjs" },
  { name: "TypeScript", note: "Scenario engine", icon: "siTypescript" },
  { name: "Tailwind CSS", note: "Design tokens", icon: "siTailwindcss" },
  { name: "Motion", note: "Transitions", icon: "siFramer" },
  { name: "FastAPI", note: "REST + WebSocket hub", icon: "siFastapi" },
  { name: "Pydantic", note: "Extraction schema", icon: "siPydantic" },
  { name: "OpenAI API", note: "Tool calling · Structured Outputs", icon: "siOpenai" },
  { name: "AssemblyAI", note: "Speech to text", icon: "/logos/assemblyai-mark.svg" },
  { name: "Presidio", note: "PII masking", mono: "Pr" },
  { name: "SQLite", note: "Demo database", icon: "siSqlite" },
  { name: "Caddy", note: "HTTPS / WSS", icon: "siCaddy" },
  { name: "Docker", note: "Compose, one VM", icon: "siDocker" },
];

// Production, local-first per area (PRD §18.8.2): one GPU workstation, OpenAI only as a masked fallback.
export const TECH_PROD: Tech[] = [
  { name: "gpt-oss-20b", note: "OpenAI open-weight, on the area server", icon: "siOpenai" },
  { name: "Ollama / vLLM", note: "Model serving", icon: "siOllama" },
  { name: "PhoWhisper", note: "Vietnamese ASR", icon: "/logos/vinai-mark.png" },
  { name: "Piper TTS", note: "Dynamic voice lines", mono: "Pi" },
  { name: "NVIDIA RTX", note: "2 × 16 GB GPUs", icon: "siNvidia" },
  { name: "PostgreSQL", note: "Order context", icon: "siPostgresql" },
  { name: "Redis", note: "Queue · rate limits", icon: "siRedis" },
  { name: "Temporal", note: "Durable 60′ / 2 h timers", icon: "siTemporal" },
  { name: "MinIO", note: "Audio vault · 30-day TTL", icon: "siMinio" },
  { name: "Zalo ZNS", note: "Risky orders only", icon: "siZalo" },
  { name: "Asterisk", note: "Branded SIP trunk", icon: "siAsterisk" },
  { name: "Grafana", note: "Ops metrics", icon: "siGrafana" },
];

export const COMPETITORS = {
  columns: ["Alodi", "ClickPost", "Shipsy", "AfterShip Agent", "Ringg AI", "Shiprocket", "GHTK"],
  rows: [
    {
      label: "Main market",
      cells: ["Vietnam", "India", "India", "Global", "India", "India", "Vietnam"],
    },
    {
      label: "Trigger",
      cells: [
        "Courier taps one meaningful button",
        "NDR code from carrier API",
        "NDR event",
        "Tracking exception",
        "NDR from carrier",
        "Courier marks NDR",
        "Recipient books a slot",
      ],
    },
    {
      label: "Reaching the buyer",
      cells: [
        "Marketplace chat → AI call",
        "SMS, email, WhatsApp, IVR, voice agent",
        "Automated CX Agent",
        "Drafts a message for approval",
        "Voice agent",
        "SMS + IVR (Advanced/Pro)",
        "App, hotline",
      ],
    },
    {
      label: "Asks for a window before delivery",
      cells: ["Yes, from the route planner", "Not disclosed", "Yes", "Not disclosed", "Not disclosed", "Not disclosed", "Yes, by half-day"],
    },
    {
      label: "Context for the next attempt",
      cells: [
        "JSON with confidence, versions, audit",
        "Reattempt / return instruction",
        "Not disclosed",
        "Suggested fix",
        "Disposition + instructions",
        "Reattempt / return instruction",
        "Time-window note",
      ],
    },
    {
      label: "Human approval for high-stakes calls",
      cells: ["Required; the agent only suggests", "Not disclosed", "Not disclosed", "Yes", "Not disclosed", "Seller handles it", "Call-centre agent"],
    },
    {
      label: "Published results",
      cells: [
        "Measured at the 31 Oct demo",
        "RTO −15–20% (Parth)",
        "Industry rescue 20–30%",
        "−58% resolution time (one customer)",
        "No independent figures",
        "Not disclosed",
        "Not disclosed",
      ],
    },
  ],
};

export const TEAM = [
  { name: "Nomura Yoshio", role: "Team Lead", role2: "Project Presenter", focus: "Product, demo script, pitch", photo: "/team/nomura-yoshio.jpg", pos: "50% 30%" },
  { name: "Long Quan Ton", role: "AI Engineer", role2: "Solution Architect", focus: "Orchestrator, voice agent, eval loop", photo: "/team/long-quan-ton.jpg", pos: "53% 22%" },
  { name: "Khanh Tuong Huynh", role: "AI Engineer", role2: "Deployment Engineer", focus: "Context extractor, ASR, policy guard", photo: "/team/khanh-tuong-huynh.jpg", pos: "50% 30%" },
  { name: "Thanh Loi Tran", role: "Data Engineer", role2: "Backend Developer", focus: "Order Context Object, APIs, metrics log", photo: "/team/thanh-loi-tran.jpg", pos: "50% 30%" },
];

/** Couriers whose riders the team interviewed (prep/06-survey). Logos from each company’s site or Wikimedia Commons. */
export const COURIER_LOGOS = [
  { name: "SPX Express", src: "/logos/couriers/spx.svg", ratio: 2.5, url: "https://spx.vn" },
  { name: "Giao Hang Nhanh", src: "/logos/couriers/ghn.png", ratio: 3.5, url: "https://ghn.vn" },
  { name: "J&T Express", src: "/logos/couriers/jt.svg", ratio: 4.78, url: "https://jtexpress.vn" },
  { name: "Giao Hang Tiet Kiem", src: "/logos/couriers/ghtk.svg", ratio: 3.88, url: "https://ghtk.vn" },
  { name: "Viettel Post", src: "/logos/couriers/viettel-post.svg", ratio: 2.58, url: "https://viettelpost.com.vn" },
];

export const FAQ = [
  {
    q: "Does the demo call real phone numbers?",
    a: "No. The AI call runs in the browser. In production it uses a branded call line: fixed phrases are pre-recorded, dynamic parts use TTS, and calls stay under about 90 seconds.",
  },
  {
    q: "Why doesn’t the agent label “suspected bomb” orders itself?",
    a: "That label counts toward the buyer’s 3-orders-in-90-days COD lock. The agent suggests; a person decides. That is the autonomy boundary.",
  },
  {
    q: "How is personal data handled?",
    a: "Raw audio and transcripts stay inside a trusted zone with a deletion window. Only extracted JSON leaves it. Phone numbers and addresses are masked before any cloud model call.",
  },
  {
    q: "Do you need to fine-tune a model?",
    a: "Not for the hackathon: Structured Outputs, good prompts and a Codex-run eval loop are enough. In production, fine-tune ASR for regional accents and address vocabulary first, then distill the extractor.",
  },
  {
    q: "Does Alodi replace the courier app or route planner?",
    a: "No. Alodi reads orders and events, talks to the buyer, and writes structured context back into the carrier’s own systems.",
  },
];
