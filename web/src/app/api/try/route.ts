import {
  audioExtension,
  checkToken,
  clientIp,
  closeTrials,
  issueToken,
  looksHuman,
  passesTurnstile,
  readState,
  reserve,
  validAudio,
} from "@/lib/try/limits";
import { OpenAiError, decide, extract, transcribe } from "@/lib/try/understand";

// The public "Try it live" turn. Gates run cheapest first and nothing paid happens until a try is reserved.

const reply = (body: object, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function GET(request: Request) {
  const ip = clientIp(request);
  const { state, left } = await readState(ip);
  return reply({ state, left, token: state === "ready" ? issueToken(ip) : null });
}

export async function POST(request: Request) {
  if (!looksHuman(request)) return reply({ state: "blocked" }, 403);
  const ip = clientIp(request);
  const form = await request.formData().catch(() => null);
  const audio = form?.get("audio");
  const token = checkToken(String(form?.get("token") ?? ""), ip);
  if (!form || !(audio instanceof Blob) || !token) return reply({ state: "blocked" }, 403);
  const bytes = new Uint8Array(await audio.arrayBuffer());
  if (!validAudio(bytes)) return reply({ state: "bad_audio" }, 400);
  if (!(await passesTurnstile(String(form.get("turnstile") ?? ""), ip))) return reply({ state: "blocked" }, 403);

  let slot;
  try {
    slot = await reserve(ip, token.nonce);
  } catch {
    return reply({ state: "off" }, 503);
  }
  if (slot.state === "replay") return reply({ state: "blocked" }, 403);
  if (slot.state !== "ready") return reply({ state: slot.state }, 429);

  const started = Date.now();
  let heard = false;
  try {
    const transcript = await transcribe(bytes, audioExtension(bytes));
    heard = true;
    const stt = Date.now() - started;
    if (transcript.length < 4) {
      await slot.release(); // silence is not a try
      return reply({ state: "retry", left: slot.left + 1, token: issueToken(ip) });
    }
    const answer = decide(transcript, await extract(transcript));
    return reply({ state: "done", left: slot.left, token: issueToken(ip), answer, ms: { stt, total: Date.now() - started } });
  } catch (error) {
    if (!heard) await slot.release().catch(() => {});
    if (error instanceof OpenAiError && (error.code === "project_spend_limit_exceeded" || error.code === "insufficient_quota" || error.code === "credit_balance_exhausted")) {
      await closeTrials().catch(() => {});
      return reply({ state: "ended" }, 429);
    }
    console.error("try failed:", error instanceof OpenAiError ? error.message : error instanceof Error ? error.name : "unknown"); // never the audio or the words
    return reply({ state: "failed" }, 502);
  }
}
