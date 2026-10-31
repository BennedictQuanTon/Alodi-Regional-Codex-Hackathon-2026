export type LiveTurn = {
  generation_id: string;
  turn_id: number;
  phase: "greeting" | "collecting" | "confirming" | "notes" | "closing";
  input_allowed: boolean;
  playback_revision?: number;
};

/** GPT Live has no utterance-ended event. Require measured output, then a conservative
 * quiet window after BOTH audio and transcript activity. Silence alone never opens input. */
export class LivePlaybackGate {
  turn?: LiveTurn;
  heard = false;
  drained = false;
  blocked = false;
  revision = 0;
  private lastActivity = 0;
  private started = 0;
  constructor(readonly quietMs = 1800, readonly noAudioMs = 25000) {}

  begin(turn: LiveTurn, now: number) {
    if (this.turn && this.turn.generation_id !== turn.generation_id) return false;
    if (this.turn?.generation_id === turn.generation_id && turn.turn_id < this.turn.turn_id) return false;
    const fresh = this.turn?.generation_id !== turn.generation_id || this.turn?.turn_id !== turn.turn_id;
    if (fresh) {
      this.revision = 0;
      this.heard = false;
      this.drained = false;
      this.lastActivity = this.started = now;
    }
    this.turn = { ...turn, input_allowed: turn.input_allowed && turn.playback_revision === this.revision };
    return true;
  }
  private revoke() { this.revision++; if (this.turn) this.turn = { ...this.turn, input_allowed: false }; }
  transcript(now: number) { const reopen = this.drained; if (reopen) this.revoke(); this.drained = false; this.lastActivity = now; return reopen; }
  setBlocked(blocked: boolean, now: number) {
    if (blocked && !this.blocked) this.revoke();
    this.blocked = blocked;
    // Allow the full no-output deadline after a user resolves autoplay.
    this.started = now;
    this.lastActivity = now;
  }
  sample(level: number, playable: boolean, now: number): "playing" | "drained" | "failed" | undefined {
    if (!this.turn || this.blocked || !playable) return;
    if (level >= 0.003) {
      const started = !this.heard || this.drained;
      this.heard = true;
      this.drained = false;
      this.lastActivity = now;
      if (started) this.revoke();
      return started ? "playing" : undefined;
    }
    if (!this.heard && now - this.started >= this.noAudioMs) return "failed";
    if (this.heard && !this.drained && now - this.lastActivity >= this.quietMs) {
      this.drained = true;
      return "drained";
    }
  }
  get inputAllowed() { return !!this.turn?.input_allowed && this.drained && !this.blocked; }
  expired(now: number) { return !!this.turn && !this.heard && !this.blocked && now - this.started >= this.noAudioMs; }
}
