/** Public browser contract. Provider credentials never belong in this module. */
export type AiConfig = {
  mode: "live" | "stub" | "offline";
  voice_provider: "gpt_live";
  language: string;
  transport: "websocket" | "webrtc";
  ready: boolean;
  bridge_mode: "fixture" | "part1";
  missing_variables: string[];
  limits: { call_seconds: number; memo_seconds: number; memo_bytes: number };
  disclosure: { text: string; audio_url?: string };
};

export type Fixture = {
  tracking_id: string;
  context_version: number;
  demo_epoch: string | number;
  context: Record<string, unknown>;
  events?: unknown[];
};
export type IssuedCall = {
  call_id: string;
  tracking_id: string;
  voice_provider: AiConfig["voice_provider"];
  ws_path: string;
  status: string;
};
export type Connection = {
  call_id: string;
  voice_provider: AiConfig["voice_provider"];
  transport: AiConfig["transport"];
  ws_path: string;
  sdp?: string;
};
export type Caption = { speaker: "buyer" | "assistant"; text: string; final: boolean; turn_id: string };
export type Job = {
  job_id: string;
  status: string;
  transcript?: string;
  context?: unknown;
  result?: unknown;
  error?: string | { message?: string };
};
export type MemoBinding = { generation_id: string; context_version: number; shipper_event_id: number };

export function memoForm(audio: Blob, filename: string, binding?: MemoBinding, requireBinding = false) {
  if (requireBinding && !binding) throw new Error("A committed reschedule event is required before uploading this memo.");
  const data = new FormData();
  data.append("audio", audio, filename);
  if (binding) {
    if (!binding.generation_id || !Number.isInteger(binding.context_version) || binding.context_version < 0 || !Number.isInteger(binding.shipper_event_id) || binding.shipper_event_id < 1) throw new Error("The memo order binding is incomplete. Refresh the order.");
    data.append("generation_id", binding.generation_id);
    data.append("context_version", String(binding.context_version));
    data.append("shipper_event_id", String(binding.shipper_event_id));
  }
  return data;
}
export const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001").replace(/\/$/, "");
export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) { super(message); this.name = "ApiError"; }
}

export function apiUrl(path: string, base = API_URL) {
  if (/^https?:\/\//i.test(path)) return new URL(path).toString();
  // An HTTPS reverse proxy may mount the entire API under /api on a laptop.
  return new URL(path.replace(/^\/+/, ""), `${base.replace(/\/$/, "")}/`).toString();
}

export function socketUrl(path: string, base = API_URL) {
  const url = new URL(apiUrl(path, base));
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  // Only the application's socket is allowed; SDP goes through the application API.
  if (url.origin.replace(/^ws/, "http") !== new URL(base).origin) throw new Error("Unexpected call socket address.");
  return url.toString();
}

export async function request<T>(path: string, init: RequestInit = {}, base = API_URL): Promise<T> {
  const abort = new AbortController();
  const cancelled = () => abort.abort(init.signal?.reason);
  init.signal?.addEventListener("abort", cancelled, { once: true });
  if (init.signal?.aborted) cancelled();
  const timer = setTimeout(() => abort.abort(new Error("The service took too long to respond. Please try again.")), 30000);
  try {
    const response = await fetch(apiUrl(path, base), { ...init, signal: abort.signal, cache: "no-store" });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      const detail = body?.detail;
      // Backend error messages must be public-safe. Never echo arbitrary HTTP bodies/SDP.
      throw new ApiError(typeof detail === "string" ? detail : typeof detail?.message === "string" ? detail.message : typeof body?.message === "string" ? body.message : `Request failed (${response.status}).`, response.status, typeof body?.code === "string" ? body.code : undefined);
    }
    return body as T;
  } finally {
    clearTimeout(timer);
    init.signal?.removeEventListener("abort", cancelled);
  }
}

export function post<T>(path: string, body: unknown, signal?: AbortSignal, base = API_URL) {
  return request<T>(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal }, base);
}

export function errorMessage(error: unknown) {
  if (error instanceof DOMException && error.name === "NotAllowedError") return "Microphone access was denied. Allow access in your browser, then try again.";
  if (error instanceof DOMException && error.name === "NotFoundError") return "No microphone was found. Connect one and try again.";
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}
