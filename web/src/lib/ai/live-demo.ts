import { post, request, type AiConfig } from "./protocol";
import { type BusinessClock, type OrderDetail } from "./integrated";
import type { RouteARoomState } from "./route-a-controller";

export const DEMO_ORDER = "SPXVN0123456789";
export type RouteAView = "display" | "phone";
/** Public demo links always stay on the current deployment's API gateway. */
export function routeAEntryRoute(address: string) {
  const page = new URL(address);
  if (!["http:", "https:"].includes(page.protocol) || ["room", "session", "api", "client_id"].some((key) => page.searchParams.has(key))) return;
  if (page.searchParams.getAll("view").length > 1 || page.searchParams.getAll("mode").length > 1) return;
  if (page.searchParams.has("mode") && !["dev", "official"].includes(page.searchParams.get("mode")!)) return;
  if (page.searchParams.has("order") && page.searchParams.get("order") !== DEMO_ORDER) return;
  const legacy = page.searchParams.get("view") || "display";
  const view: RouteAView | undefined = ["phone", "driver", "buyer"].includes(legacy) ? "phone" : ["display", "monitor"].includes(legacy) ? "display" : undefined;
  if (!view) return;
  return { base: `${page.origin}/api`, order: DEMO_ORDER, view, phoneLink: `${page.origin}/demo/live?view=phone` };
}
export const DEV_VIEWS = ["phone", "monitor"] as const;
export const OFFICIAL_VIEWS = ["driver", "buyer", "monitor"] as const;
export type DemoMode = "dev" | "official";
export type LiveView = "phone" | "monitor" | "driver" | "buyer";
export function liveDemoRoute(address: string) {
  const page = new URL(address);
  if (!["http:", "https:"].includes(page.protocol) || ["room", "session", "api", "client_id"].some((key) => page.searchParams.has(key))) return;
  const mode = page.searchParams.get("mode") || "dev";
  const view = page.searchParams.get("view") || (mode === "official" ? "monitor" : "phone");
  if (!["dev", "official"].includes(mode) || page.searchParams.getAll("mode").length > 1 || page.searchParams.getAll("view").length > 1) return;
  const devices: readonly string[] = mode === "dev" ? DEV_VIEWS : OFFICIAL_VIEWS;
  if (!devices.includes(view)) return;
  if (page.searchParams.has("order") && page.searchParams.get("order") !== DEMO_ORDER) return;
  return { base: `${page.origin}/api`, order: DEMO_ORDER, view: view as LiveView, mode: mode as DemoMode };
}
export function liveViewLink(mode: DemoMode, view: LiveView) {
  return `/demo/live?${new URLSearchParams({ mode, view }).toString()}`;
}
export type LiveRecord = { seq: number; at: string; type: string; call_id?: string; payload: Record<string, unknown> };
export type LiveFeed = { generation_id: string; stream_id: string; latest_seq: number; next_seq?: number; has_more?: boolean; records: LiveRecord[]; truncated: boolean };
export type MonitorState = { config?: AiConfig; detail?: OrderDetail; clock?: BusinessClock; room?: RouteARoomState; generation?: string; records: LiveRecord[]; transcripts?: LiveRecord[]; truncated?: boolean; apiError?: string; refreshedAt?: number };

type TranscriptSegment = { record: LiveRecord; parts: TranscriptPart[] };
type TranscriptPart = { offset: number; text: string; segment: TranscriptSegment };
/** Control turns can span several spoken utterances, or change mid-utterance.
 * Reconstruct observed speaker segments from cumulative application transcripts. */
export class LiveTranscriptTimeline {
  private segments: TranscriptSegment[] = [];
  private sources = new Map<string, { text: string; parts: TranscriptPart[] }>();
  clear() { this.segments = []; this.sources.clear(); }
  snapshot() { return this.segments.map((segment) => segment.record); }
  accept(record: LiveRecord) {
    const speaker = record.payload.speaker, next = record.payload.text;
    if (record.type !== "transcript" || !["assistant", "buyer"].includes(String(speaker)) || typeof next !== "string") return;
    const key = `${record.call_id || "call"}:${speaker}:${record.payload.turn_id ?? record.seq}`;
    const source = this.sources.get(key) || { text: "", parts: [] };
    this.sources.set(key, source);
    const previous = source.text;
    const lastPart = source.parts.at(-1);
    const current = this.segments.at(-1);
    const refresh = (segment: TranscriptSegment) => {
      const utterance = segment.record.payload.utterance_id;
      segment.record = { ...record, seq: segment.record.seq, at: segment.record.at, payload: { ...record.payload, speaker: segment.record.payload.speaker, text: segment.parts.map((part) => part.text).join(""), utterance_id: utterance } };
    };
    source.text = next;
    if (next === previous) {
      if (lastPart) refresh(lastPart.segment);
      return;
    }
    if (!next.startsWith(previous)) {
      // Corrections replace the source's existing contribution, without moving
      // the utterance behind later speakers or duplicating the corrected text.
      source.parts.forEach((part, index) => {
        part.text = next.slice(part.offset, source.parts[index + 1]?.offset);
        refresh(part.segment);
      });
      if (source.parts.length) return;
    }
    if (lastPart && current && lastPart.segment === current) {
      lastPart.text = next.slice(lastPart.offset);
      refresh(current);
      return;
    }
    const offset = next.startsWith(previous) ? previous.length : 0;
    if (!next.slice(offset)) return;
    let segment = current;
    if (!segment || segment.record.call_id !== record.call_id || segment.record.payload.speaker !== speaker) {
      segment = { record: { ...record, payload: { ...record.payload, text: "", utterance_id: `${record.call_id || "call"}:${speaker}:${record.seq}` } }, parts: [] };
      this.segments.push(segment);
    }
    const part = { offset, text: next.slice(offset), segment };
    source.parts.push(part); segment.parts.push(part); refresh(segment);
  }
}

/** HTTP-only observer. It never creates, answers, or closes a buyer session. */
export class LiveOrderMonitor {
  state: MonitorState = { records: [] };
  private listeners = new Set<() => void>();
  private abort?: AbortController;
  private timer?: ReturnType<typeof setTimeout>;
  private running = false;
  private stream?: string;
  private seq = 0;
  private epoch = 0;
  private transcriptTimeline = new LiveTranscriptTimeline();
  constructor(readonly base: string, readonly order: string, readonly observe: boolean, readonly observeRoom = false) {}
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  snapshot = () => this.state;
  private patch(patch: Partial<MonitorState>) { this.state = { ...this.state, ...patch }; this.listeners.forEach((listener) => listener()); }
  clear() { this.epoch++; this.seq = 0; this.stream = undefined; this.transcriptTimeline.clear(); this.patch({ detail: undefined, room: undefined, records: [], transcripts: [], apiError: undefined }); }
  async pollOnce(signal?: AbortSignal) {
    const epoch = ++this.epoch;
    const stale = () => signal?.aborted || epoch !== this.epoch;
    try {
      const config = this.state.config || await request<AiConfig>("/ai/config", { signal }, this.base);
      if (stale()) return;
      if (config.bridge_mode !== "part1") throw new Error("The shared demo backend is not ready. Return to the demo entry or wait for startup to finish.");
      const [detail, clock, room] = await Promise.all([
        request<OrderDetail>(`/orders/${encodeURIComponent(this.order)}`, { signal }, this.base),
        request<BusinessClock>("/demo/clock", { signal }, this.base),
        this.observeRoom ? request<RouteARoomState>("/demo/route-a", { signal }, this.base) : undefined,
      ]);
      if (stale()) return;
      if (this.state.generation !== clock.generation_id) {
        this.seq = 0; this.stream = undefined;
        this.transcriptTimeline.clear();
        this.patch({ generation: clock.generation_id, detail: undefined, records: [], transcripts: [], clock, config });
      }
      if (detail.order.generation_id !== clock.generation_id) { this.patch({ apiError: "Session reset is in progress. Waiting for the new order generation…" }); return; }
      this.patch({ config, detail, clock, room, apiError: undefined, refreshedAt: Date.now() });
      if (this.observe) {
        let feed = await request<LiveFeed>(`/orders/${encodeURIComponent(this.order)}/live?after_seq=${this.seq}&limit=100`, { signal }, this.base);
        if (stale() || feed.generation_id !== this.state.generation) return;
        if (this.stream && feed.stream_id !== this.stream) {
          this.seq = 0; this.transcriptTimeline.clear(); this.patch({ records: [], transcripts: [] });
          feed = await request<LiveFeed>(`/orders/${encodeURIComponent(this.order)}/live?after_seq=0&limit=100`, { signal }, this.base);
          if (stale() || feed.generation_id !== this.state.generation) return;
        }
        this.stream = feed.stream_id;
        // latest_seq is the global high-water mark, not the end of this page.
        // Continue from the returned page boundary on the next 1-second poll.
        this.seq = feed.next_seq ?? feed.records.at(-1)?.seq ?? this.seq;
        const records = [...new Map([...this.state.records, ...feed.records].map((record) => [record.seq, record])).values()].slice(-250);
        // Partial word updates must not evict earlier utterances from the visible conversation.
        // Keep stable observed speaker utterances, including control-turn reuse and
        // mid-utterance turn changes, separately from the bounded diagnostic log.
        // Reset both on a new stream or generation.
        for (const record of feed.records) this.transcriptTimeline.accept(record);
        this.patch({ records, transcripts: this.transcriptTimeline.snapshot(), truncated: feed.truncated });
      }
    } catch (error) { if (!stale()) this.patch({ apiError: `Live updates are unavailable. ${error instanceof Error ? error.message : "Check the demo backend."} Keeping the last loaded state; mutations are paused. Retry or wait for startup/reset to finish.` }); }
  }

  start() {
    this.stop(); this.running = true; this.abort = new AbortController();
    const signal = this.abort.signal;
    const poll = async () => { await this.pollOnce(signal); if (this.running && !signal.aborted) this.timer = setTimeout(poll, 1000); };
    void poll();
  }
  stop() { this.epoch++; this.running = false; clearTimeout(this.timer); this.abort?.abort(); }
}

export function deliverySchedulePreview(detail: OrderDetail) {
  const original = `${detail.order.original_delivery_date || detail.order.delivery_date || "Original day"}, 10:00 (illustrative slot)`;
  const saved = typeof detail.context_card?.window === "string" ? detail.context_card.window : undefined;
  return { original, current: saved || original, applied: !!saved, drop: typeof detail.context_card?.drop === "string" ? detail.context_card.drop : undefined };
}

export type ResetJob = { job_id: string; status: "processing" | "completed" | "failed" | "cancelled"; stage: string; message?: string; generation_id?: string };
export function waitForPoll(signal: AbortSignal, ms = 250) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException("Cancelled", "AbortError")); return; }
    const aborted = () => { clearTimeout(timer); reject(new DOMException("Cancelled", "AbortError")); };
    const timer = setTimeout(() => { signal.removeEventListener("abort", aborted); resolve(); }, ms);
    signal.addEventListener("abort", aborted, { once: true });
  });
}
export async function resetWorkflow(base: string, generation: string, progress: (job: ResetJob) => void, signal: AbortSignal, wait = waitForPoll) {
  const accepted = await post<ResetJob>("/demo/workflow-reset", { generation_id: generation }, signal, base);
  if (!accepted.job_id) throw new Error("The reset service did not return a job. Refresh this session before retrying.");
  progress(accepted);
  const deadline = Date.now() + 300000;
  for (;;) {
    await wait(signal);
    const job = await request<ResetJob>(`/demo/workflow-reset/${encodeURIComponent(accepted.job_id)}`, { signal }, base);
    if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
    progress(job);
    if (job.status === "completed") return job;
    if (job.status === "failed" || job.status === "cancelled") throw new Error(job.message || "Session reset did not complete. Refresh this session before retrying.");
    if (Date.now() > deadline) throw new Error("Reset preparation is taking longer than expected. Refresh the session to check progress before retrying.");
  }
}
