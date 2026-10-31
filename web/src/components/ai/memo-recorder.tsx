"use client";

import { useEffect, useRef, useState } from "react";
import { errorMessage, request, type Job } from "@/lib/ai/protocol";
import "./voice.css";

type Recording = { recorder: MediaRecorder; stream: MediaStream; timer: ReturnType<typeof setTimeout>; ticker: ReturnType<typeof setInterval>; discard: boolean };
type Clip = { blob: Blob; url: string; seconds: number };

function preferredMime() {
  return ["audio/webm;codecs=opus", "audio/mp4", "audio/webm", "audio/ogg;codecs=opus"].find((type) => MediaRecorder.isTypeSupported(type));
}

/** Real short recording, preview, upload and server-job polling; no local decision logic. */
export function MemoRecorder({ trackingId, maxSeconds = 10, maxBytes = 5242880, disabled = false, onCompleted }: { trackingId: string; maxSeconds?: number; maxBytes?: number; disabled?: boolean; onCompleted?: (job: Job) => void }) {
  const [status, setStatus] = useState<"idle" | "permission" | "recording" | "preview" | "uploading" | "processing" | "completed" | "failed">("idle");
  const [seconds, setSeconds] = useState(0);
  const [clip, setClip] = useState<Clip>();
  const [message, setMessage] = useState("");
  const [job, setJob] = useState<Job>();
  const active = useRef<Recording | undefined>(undefined);
  const pendingStream = useRef<MediaStream | undefined>(undefined);
  const holding = useRef(false);
  const alive = useRef(true);
  const uploading = useRef<AbortController | undefined>(undefined);
  const callback = useRef(onCompleted);
  const duration = Math.min(10, maxSeconds);
  const byteLimit = Math.min(5242880, maxBytes);

  useEffect(() => { callback.current = onCompleted; }, [onCompleted]);
  useEffect(() => {
    alive.current = true;
    const cancel = () => {
      holding.current = false;
      pendingStream.current?.getTracks().forEach((track) => track.stop());
      pendingStream.current = undefined;
      const recording = active.current;
      if (recording) {
        recording.discard = true;
        clearTimeout(recording.timer);
        clearInterval(recording.ticker);
        if (recording.recorder.state !== "inactive") recording.recorder.stop();
        recording.stream.getTracks().forEach((track) => { track.onended = null; track.stop(); });
      }
      uploading.current?.abort();
    };
    window.addEventListener("pagehide", cancel);
    return () => { alive.current = false; cancel(); window.removeEventListener("pagehide", cancel); };
  }, []);
  useEffect(() => () => { if (clip) URL.revokeObjectURL(clip.url); }, [clip]);
  useEffect(() => {
    if (!disabled) return;
    holding.current = false;
    const recording = active.current;
    if (recording) {
      recording.discard = true;
      clearTimeout(recording.timer); clearInterval(recording.ticker);
      if (recording.recorder.state !== "inactive") recording.recorder.stop();
      recording.stream.getTracks().forEach((track) => { track.onended = null; track.stop(); });
    }
  }, [disabled]);

  function stop(discard = false) {
    holding.current = false;
    const recording = active.current;
    if (!recording) return;
    recording.discard ||= discard;
    clearTimeout(recording.timer);
    clearInterval(recording.ticker);
    if (recording.recorder.state !== "inactive") recording.recorder.stop();
    recording.stream.getTracks().forEach((track) => { track.onended = null; track.stop(); });
  }

  async function start() {
    if (disabled || active.current || holding.current || ["uploading", "processing"].includes(status)) return;
    holding.current = true;
    setMessage(""); setJob(undefined); setStatus("permission"); setClip(undefined); setSeconds(0);
    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") throw new Error("Voice memos need HTTPS or localhost and a browser with MediaRecorder support.");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, channelCount: 1 }, video: false });
      pendingStream.current = stream;
      // A release/cancel while the permission prompt was open must never start recording.
      if (!holding.current || !alive.current) { stream.getTracks().forEach((track) => track.stop()); pendingStream.current = undefined; if (alive.current) setStatus("idle"); return; }
      const mime = preferredMime();
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      const chunks: Blob[] = [];
      let bytes = 0;
      const started = Date.now();
      const recording: Recording = {
        recorder, stream, discard: false,
        // Leave room for recorder/encoder scheduling; backend normalizes <=10.25s.
        timer: setTimeout(() => stop(), Math.max(100, duration * 1000 - 75)),
        ticker: setInterval(() => { if (alive.current) setSeconds(Math.min(duration, (Date.now() - started) / 1000)); }, 100),
      };
      active.current = recording;
      pendingStream.current = undefined;
      recorder.ondataavailable = (event) => {
        bytes += event.data.size;
        if (bytes > byteLimit) { recording.discard = true; stop(true); if (alive.current) setMessage("Recording exceeds the 5 MB limit. Try a shorter memo."); return; }
        if (event.data.size) chunks.push(event.data);
      };
      recorder.onerror = () => { stop(true); if (alive.current) { setStatus("failed"); setMessage("The browser could not record this memo. Try again."); } };
      recorder.onstop = () => {
        clearTimeout(recording.timer); clearInterval(recording.ticker);
        stream.getTracks().forEach((track) => { track.onended = null; track.stop(); });
        if (active.current === recording) active.current = undefined;
        if (!alive.current) return;
        if (recording.discard) { setStatus("idle"); return; }
        const blob = new Blob(chunks, { type: recorder.mimeType || mime || "application/octet-stream" });
        if (!blob.size) { setMessage("No audio was captured. Hold the button and speak, then release."); setStatus("failed"); return; }
        const elapsed = Math.min(duration, (Date.now() - started) / 1000);
        setSeconds(elapsed); setClip({ blob, url: URL.createObjectURL(blob), seconds: elapsed }); setStatus("preview");
      };
      stream.getTracks().forEach((track) => { track.onended = () => { stop(true); if (alive.current) setMessage("Microphone disconnected. Record the memo again."); }; });
      recorder.start(200);
      setStatus("recording");
    } catch (error) {
      holding.current = false;
      stop(true);
      pendingStream.current?.getTracks().forEach((track) => track.stop());
      pendingStream.current = undefined;
      if (alive.current) { setMessage(errorMessage(error)); setStatus("failed"); }
    }
  }

  async function upload() {
    if (!clip || disabled) return;
    const abort = new AbortController();
    uploading.current?.abort(); uploading.current = abort;
    setStatus("uploading"); setMessage("");
    try {
      const data = new FormData();
      const extension = clip.blob.type.includes("mp4") ? "m4a" : clip.blob.type.includes("ogg") ? "ogg" : "webm";
      data.append("audio", clip.blob, `memo.${extension}`);
      const accepted = await request<Job>(`/orders/${encodeURIComponent(trackingId)}/memo`, { method: "POST", body: data, signal: abort.signal });
      if (!accepted.job_id) throw new Error("The service did not return a memo job.");
      setStatus("processing"); setJob(accepted);
      const deadline = Date.now() + 120000;
      while (!abort.signal.aborted) {
        const result = await request<Job>(`/ai/jobs/${encodeURIComponent(accepted.job_id)}`, { signal: abort.signal });
        if (!alive.current || abort.signal.aborted) return;
        setJob(result);
        if (result.status === "completed") { setStatus("completed"); callback.current?.(result); return; }
        if (["failed", "cancelled"].includes(result.status)) throw new Error(typeof result.error === "string" ? result.error : result.error?.message || `Memo ${result.status}.`);
        if (Date.now() > deadline) throw new Error("Memo processing is taking longer than expected. Check the server before retrying.");
        await new Promise<void>((resolve, reject) => {
          const cancelled = () => { clearTimeout(timer); reject(new DOMException("Cancelled", "AbortError")); };
          const timer = setTimeout(() => { abort.signal.removeEventListener("abort", cancelled); resolve(); }, 800);
          abort.signal.addEventListener("abort", cancelled, { once: true });
        });
      }
    } catch (error) {
      if (!abort.signal.aborted && alive.current) { setStatus("failed"); setMessage(errorMessage(error)); }
    }
  }

  return (
    <section className="ai-card" aria-label="Shipper voice memo">
      <div className="ai-row"><h2>Shipper memo</h2><span className="ai-pill">{status}</span></div>
      <p className="ai-muted">Hold to record what the buyer said. Release to stop. Up to {duration} seconds · 5 MB.</p>
      <button className="ai-record" disabled={disabled || ["uploading", "processing"].includes(status)}
        onPointerDown={(event) => { if (event.button !== 0) return; event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); void start(); }}
        onPointerUp={() => stop()} onPointerCancel={() => stop(true)} onLostPointerCapture={() => { if (holding.current) stop(true); }}
        onKeyDown={(event) => { if ([" ", "Enter"].includes(event.key)) { event.preventDefault(); if (!event.repeat) void start(); } if (event.key === "Escape") stop(true); }}
        onKeyUp={(event) => { if ([" ", "Enter"].includes(event.key)) { event.preventDefault(); stop(); } }}
        onBlur={() => { if (holding.current) stop(true); }} aria-label="Hold to record memo" aria-pressed={status === "recording"}>
        {status === "recording" ? "Recording… release to stop" : status === "permission" ? "Allow microphone, then hold again" : "Hold to record"}
      </button>
      <p className="ai-muted" aria-live="off">{seconds.toFixed(1)} / {duration}s</p>
      {status === "recording" && <button onClick={() => stop(true)}>Cancel recording</button>}
      {clip && <div className="ai-memo-preview"><audio controls src={clip.url} /><p className="ai-muted">Real recording · {clip.seconds.toFixed(1)}s · {Math.ceil(clip.blob.size / 1024)} KB</p><button className="ai-primary" onClick={() => void upload()} disabled={disabled || ["uploading", "processing", "completed"].includes(status)}>Upload memo</button></div>}
      {["uploading", "processing"].includes(status) && <p role="status">{status === "uploading" ? "Uploading recording…" : "Processing on the server…"}</p>}
      {message && <p role="alert">{message}</p>}
      {job?.transcript && <p><strong>Transcript</strong> {job.transcript}</p>}
      {status === "completed" && <p role="status">Server job completed. Review the current fixture context above.</p>}
      {job && <details><summary>Memo job response</summary><pre>{JSON.stringify(job, null, 2)}</pre></details>}
    </section>
  );
}
