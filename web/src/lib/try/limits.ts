import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// Spending and abuse limits for the public "Try it live" turn. Everything fails closed: no store, no trial.
export const LIMITS = {
  perDay: 20,
  perIp: 4,
  budgetCents: 3500, // $35 of the $40 total; the rest is margin for OpenAI's delayed spend tracking
  costCents: 1, // booked per try, above the measured cost, so the counter can only stop early
  tokenMinAgeMs: 3_000,
  tokenMaxAgeMs: 20 * 60_000,
  audioMinBytes: 1_500,
  audioMaxBytes: 300_000,
} as const;

export type TryState = "ready" | "day" | "ip" | "ended" | "off";

type Command = (string | number)[];
type Store = (commands: Command[]) => Promise<(string | number | null)[]>;

function upstash(url: string, token: string): Store {
  return async (commands) => {
    const response = await fetch(`${url.replace(/\/$/, "")}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(commands),
      signal: AbortSignal.timeout(3_000),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`store ${response.status}`);
    const rows = (await response.json()) as { result?: string | number | null; error?: string }[];
    return rows.map((row) => {
      if (row.error) throw new Error("store command failed");
      return row.result ?? null;
    });
  };
}

/** A store for `next dev` only, so production can never run on limits that vanish between instances. */
function memory(): Store {
  const shared = globalThis as unknown as { __alodiTry?: Map<string, number | string> };
  const data = (shared.__alodiTry ??= new Map());
  return async (commands) =>
    commands.map(([op, key, value]) => {
      const k = String(key);
      if (op === "GET") return data.get(k) ?? null;
      if (op === "EXPIRE") return 1;
      if (op === "SET") {
        if (data.has(k)) return null;
        data.set(k, value as string);
        return "OK";
      }
      const by = op === "INCR" ? 1 : op === "DECR" ? -1 : op === "INCRBY" ? Number(value) : op === "DECRBY" ? -Number(value) : 0;
      const next = Number(data.get(k) ?? 0) + by;
      data.set(k, next);
      return next;
    });
}

function store(): Store | null {
  const { UPSTASH_REDIS_REST_URL: url, UPSTASH_REDIS_REST_TOKEN: token } = process.env;
  if (url && token) return upstash(url, token);
  return process.env.NODE_ENV === "production" ? null : memory();
}

function secret() {
  const value = process.env.TRY_SIGNING_SECRET;
  if (value) return value;
  if (process.env.NODE_ENV === "production") return null;
  const shared = globalThis as unknown as { __alodiTrySecret?: string };
  return (shared.__alodiTrySecret ??= randomBytes(24).toString("hex"));
}

export const configured = () => !process.env.TRY_DISABLED && !!process.env.OPENAI_API_KEY && !!store() && !!secret();

/** Trial days follow the team's clock, so "come back tomorrow" means tomorrow in Vietnam. */
const today = () => new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);
const keys = (ip: string) => {
  const day = today();
  const who = createHash("sha256").update(`${secret()}:${ip}`).digest("hex").slice(0, 24); // no raw IP is stored
  return { day: `try:day:${day}`, ip: `try:ip:${day}:${who}`, spent: "try:spent", closed: "try:closed" };
};
const TWO_DAYS = 172_800;

export function clientIp(request: Request) {
  const h = request.headers;
  return (h.get("x-vercel-forwarded-for") ?? h.get("x-real-ip") ?? h.get("x-forwarded-for") ?? "local").split(",")[0].trim();
}

function judge(spent: number, day: number, ip: number, closed: boolean): TryState {
  if (closed || spent + LIMITS.costCents > LIMITS.budgetCents) return "ended";
  if (day > LIMITS.perDay) return "day";
  if (ip > LIMITS.perIp) return "ip";
  return "ready";
}

export async function readState(ip: string): Promise<{ state: TryState; left: number }> {
  const db = store();
  if (!configured() || !db) return { state: "off", left: 0 };
  try {
    const k = keys(ip);
    const [closed, spent, day, mine] = await db([["GET", k.closed], ["GET", k.spent], ["GET", k.day], ["GET", k.ip]]);
    const state = judge(Number(spent ?? 0), Number(day ?? 0) + 1, Number(mine ?? 0) + 1, !!closed);
    return { state, left: state === "ready" ? Math.min(LIMITS.perDay - Number(day ?? 0), LIMITS.perIp - Number(mine ?? 0)) : 0 };
  } catch {
    return { state: "off", left: 0 };
  }
}

/** Takes one try before any paid call. A refused try gives its counts straight back. */
export async function reserve(ip: string, nonce: string): Promise<{ state: TryState | "replay"; left: number; release: () => Promise<void> }> {
  const db = store();
  const none = async () => {};
  if (!db) return { state: "off", left: 0, release: none };
  const k = keys(ip);
  const [fresh] = await db([["SET", `try:nonce:${nonce}`, 1, "NX", "EX", 1_800]]);
  if (fresh === null) return { state: "replay", left: 0, release: none };
  const [closed, spent, day, , mine] = await db([
    ["GET", k.closed],
    ["INCRBY", k.spent, LIMITS.costCents],
    ["INCR", k.day],
    ["EXPIRE", k.day, TWO_DAYS],
    ["INCR", k.ip],
    ["EXPIRE", k.ip, TWO_DAYS],
  ]);
  const release = async () => {
    await db([["DECRBY", k.spent, LIMITS.costCents], ["DECR", k.day], ["DECR", k.ip]]);
  };
  const state = judge(Number(spent) - LIMITS.costCents, Number(day), Number(mine), !!closed);
  if (state !== "ready") {
    await release();
    return { state, left: 0, release: none };
  }
  return { state, left: Math.min(LIMITS.perDay - Number(day), LIMITS.perIp - Number(mine)), release };
}

/** OpenAI itself said the money is gone: stop for good rather than fail on every visitor. */
export async function closeTrials() {
  await store()?.([["SET", "try:closed", 1]]);
}

// A token proves this site's page asked for it. It isn't tied to an address, which can change mid-visit on private relays and mobile networks.
export function issueToken() {
  const key = secret();
  if (!key) return null;
  const body = `${Date.now()}.${randomBytes(9).toString("hex")}`;
  return `${body}.${createHmac("sha256", key).update(body).digest("hex")}`;
}

export function checkToken(token: string): { nonce: string } | null {
  const key = secret();
  const [ts, nonce, mac] = token.split(".");
  if (!key || !ts || !nonce || !mac) return null;
  const want = Buffer.from(createHmac("sha256", key).update(`${ts}.${nonce}`).digest("hex"));
  const got = Buffer.from(mac);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  const age = Date.now() - Number(ts);
  return age >= LIMITS.tokenMinAgeMs && age <= LIMITS.tokenMaxAgeMs ? { nonce } : null;
}

const BOTS = /bot|crawl|spider|curl|wget|python|httpie|postman|insomnia|axios|node-fetch|go-http|scrapy|headless/i;

/** Cheap gates that stop scripts before they reach anything that costs money. */
export function looksHuman(request: Request) {
  const h = request.headers;
  const origin = h.get("origin");
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!origin || !host || new URL(origin).host !== host) return false;
  if (h.get("sec-fetch-site") && h.get("sec-fetch-site") !== "same-origin") return false;
  const agent = h.get("user-agent") ?? "";
  return agent.length > 20 && !BOTS.test(agent);
}

export async function passesTurnstile(token: string, ip: string) {
  const key = process.env.TURNSTILE_SECRET_KEY;
  if (!key) return true;
  if (!token) return false;
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: new URLSearchParams({ secret: key, response: token, remoteip: ip }),
      signal: AbortSignal.timeout(3_000),
    });
    return ((await response.json()) as { success?: boolean }).success === true;
  } catch {
    return false;
  }
}

const SIGNATURES = [[0x1a, 0x45, 0xdf, 0xa3], [0x4f, 0x67, 0x67, 0x53], [0x52, 0x49, 0x46, 0x46]]; // webm, ogg, wav

/** Real audio only, and small enough to be ten seconds of it. */
export function validAudio(bytes: Uint8Array) {
  if (bytes.length < LIMITS.audioMinBytes || bytes.length > LIMITS.audioMaxBytes) return false;
  const mp4 = String.fromCharCode(...bytes.slice(4, 8)) === "ftyp";
  return mp4 || SIGNATURES.some((sign) => sign.every((b, i) => bytes[i] === b));
}

export const audioExtension = (bytes: Uint8Array) =>
  String.fromCharCode(...bytes.slice(4, 8)) === "ftyp" ? "mp4" : bytes[0] === 0x1a ? "webm" : bytes[0] === 0x4f ? "ogg" : "wav";
