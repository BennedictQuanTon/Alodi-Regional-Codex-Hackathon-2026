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

export const HERO_STATS = [
  {
    value: "₫40,000",
    tag: "What it costs",
    text: "return shipping the seller pays on every failed order (maximum)",
    source: "Shopee Return & Refund Policy §7.1 · VTV",
  },
  {
    value: "8–12%",
    tag: "How often",
    text: "of orders are refused nationwide; up to 20% in remote areas and 25–30% in sale season",
    source: "VECOM and Tran Anh Tung (UEF), Nguoi Lao Dong",
  },
  {
    value: "0",
    tag: "Root cause",
    text: "delivery windows the buyer can choose. Time is negotiated outside the system",
    source: "Shopee Help Center, article 79559",
  },
  {
    value: "₫31–46M",
    tag: "Modelled",
    text: "lost per day at a 10,000-order depot; the sourced share alone is ≈ 31M VND",
    source: "Team model from Shopee fees, GHN courier pay, Shipsy benchmarks",
  },
];

export const BOM_RATES = [
  { label: "Nationwide", from: 8, to: 12, note: "VECOM" },
  { label: "Today (expert)", from: 10, to: 15, note: "Tran Anh Tung" },
  { label: "Remote areas", from: 12, to: 20, note: "VECOM", upTo: true },
  { label: "Sale season", from: 25, to: 30, note: "Tran Anh Tung" },
];

export const LOSS_MODEL = {
  rows: [
    { label: "Low", segs: [24, 7.2, 6], total: 37.2 },
    { label: "High", segs: [24, 9.6, 12], total: 45.6 },
  ],
  legend: ["Return fees 600 × 40K = 24M", "Redelivery 7.2–9.6M", "Hub / CS 6–12M (estimate)"],
};

export const GMV = [
  { year: "2024", value: 318.9, approx: true },
  { year: "2025", value: 429.7, approx: false },
];

export const SIDE_FACTS = [
  {
    strong: "3 failed COD orders in 90 days",
    rest: "and Shopee switches COD off for the buyer. Buyers lose too.",
    source: "Shopee Help Center, article 79196",
  },
  {
    strong: "2–3 contacts, reschedule within 5 days",
    rest: "is Shopee’s redelivery process. Alodi runs entirely inside it.",
    source: "Shopee Help Center, article 79569",
  },
  {
    strong: "Exception §7.2",
    rest: "when the carrier is at fault, the seller doesn’t pay. Structured context settles who is responsible.",
    source: "Shopee Return & Refund Policy §7.2",
  },
];

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

export const OUTPUT_METRICS = [
  {
    problem: "0 windows: context lives outside the system",
    metric: "Time-to-context",
    how: "From the tap to the card appearing for the courier and dispatcher. Chat and call paths measured separately.",
    kind: "Measured",
    target: "< 10 s",
    targetNote: "chat path, after the buyer replies",
  },
  {
    problem: "8–12% refused, context lost in phone calls",
    metric: "Extraction accuracy",
    how: "Per-field F1 across three sources: chat, call transcript, voice memo. Hand-written held-out set.",
    kind: "Measured",
    target: "F1 ≥ 0.90",
    targetNote: "goal after the Codex loop, vs. baseline v0",
  },
  {
    problem: "Scale beyond people (≈13 callers per depot)",
    metric: "Safe autonomy",
    how: "% of cases handled alone, error rate inside that group, zero high-stakes actions without approval, zero calls outside hours.",
    kind: "Measured",
    target: "0 breaches",
    targetNote: "quiet hours and autonomy boundary",
  },
  {
    problem: "40,000 VND per order, 31–46M VND per depot per day",
    metric: "Money",
    how: "Return fees avoided plus CS hours saved, against agent cost per case.",
    kind: "Projected",
    target: "VND/case",
    targetNote: "agent cost measured, extra rescue rate assumed",
  },
];

export type Tech = { name: string; note: string; icon: string };

/** `icon` is a simple-icons key (si*) or a path under /public/logos. */
export const TECH_DEMO: Tech[] = [
  { name: "Next.js", note: "Three-screen stage", icon: "siNextdotjs" },
  { name: "TypeScript", note: "Scenario engine", icon: "siTypescript" },
  { name: "Tailwind CSS", note: "Design tokens", icon: "siTailwindcss" },
  { name: "Motion", note: "Transitions", icon: "siFramer" },
  { name: "FastAPI", note: "Agent API", icon: "siFastapi" },
  { name: "SQLite", note: "Demo state", icon: "siSqlite" },
  { name: "OpenAI", note: "Structured Outputs · Realtime", icon: "siOpenai" },
  { name: "Codex", note: "Eval loop", icon: "siOpenai" },
  { name: "AssemblyAI", note: "Vietnamese ASR", icon: "/logos/assemblyai-mark.svg" },
  { name: "LangGraph", note: "State machine", icon: "siLanggraph" },
  { name: "Docker", note: "Compose, one VM", icon: "siDocker" },
];

export const TECH_PROD: Tech[] = [
  { name: "PostgreSQL", note: "Order context", icon: "siPostgresql" },
  { name: "Temporal", note: "Durable timers", icon: "siTemporal" },
  { name: "Apache Kafka", note: "CDC / queue", icon: "siApachekafka" },
  { name: "Redis", note: "Rate limits", icon: "siRedis" },
  { name: "Hugging Face", note: "Open-weight 7–14B", icon: "siHuggingface" },
  { name: "NVIDIA", note: "Regional GPU gateway", icon: "siNvidia" },
  { name: "PhoWhisper", note: "On-prem ASR", icon: "/logos/vinai-mark.png" },
  { name: "Zalo", note: "OA + ZNS", icon: "siZalo" },
  { name: "Asterisk", note: "Branded SIP trunk", icon: "siAsterisk" },
  { name: "MinIO", note: "Audio vault · 30-day TTL", icon: "siMinio" },
  { name: "Grafana", note: "Metrics dashboard", icon: "siGrafana" },
  { name: "Kubernetes", note: "Per-region deploy", icon: "siKubernetes" },
];

export const ROADMAP = [
  {
    k: "01",
    when: "31 Oct 2026",
    title: "MVP demo",
    body: "Three screens running side by side on mock data and a fast-forward clock. Accuracy and Safe autonomy measured on a held-out eval set.",
  },
  {
    k: "02",
    when: "Q4 2026",
    title: "Shadow mode at one depot",
    body: "The agent runs alongside CS without contacting real buyers. Compare its labels to human decisions to tune confidence thresholds.",
  },
  {
    k: "03",
    when: "Q1 2027",
    title: "Real channels, controlled",
    body: "In-app marketplace chat with the carrier, Zalo OA + ZNS for other carriers, a branded call line. Risky orders only.",
  },
  {
    k: "04",
    when: "Q2 2027",
    title: "Data stays in-house",
    body: "On-prem model gateway per region, ASR fine-tuned for regional accents and address vocabulary, extractor distilled to a small model.",
  },
  {
    k: "05",
    when: "Then",
    title: "More carriers, more context",
    body: "Courier call transcripts via in-app VoIP (with recording notice), and integrations with more domestic carriers.",
  },
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

/** Logos for the "built on public figures" strip. `ratio` = width / height of the artwork. */
export const SOURCE_LOGOS = [
  { name: "Shopee", src: "siShopee", ratio: 1, url: "https://help.shopee.vn" },
  { name: "VECOM", src: "/logos/vecom.svg", ratio: 3.35, url: "https://vecom.vn", mono: true },
  { name: "Metric", src: "/logos/metric.svg", ratio: 5.24, url: "https://metric.vn" },
  { name: "Giao Hang Nhanh", src: "/logos/ghn.png", ratio: 3.5, url: "https://ghn.vn" },
  { name: "Shipsy", src: "/logos/shipsy.png", ratio: 3.25, url: "https://shipsy.ai" },
  { name: "VTV", src: "/logos/vtv.svg", ratio: 4.67, url: "https://vtv.vn" },
  { name: "Nguoi Lao Dong", src: "/logos/nld.png", ratio: 6.55, url: "https://nld.com.vn" },
  { name: "AssemblyAI", src: "/logos/assemblyai.svg", ratio: 5.75, url: "https://www.assemblyai.com" },
  { name: "VinAI", src: "/logos/vinai.png", ratio: 2.95, url: "https://www.vinai.io" },
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
