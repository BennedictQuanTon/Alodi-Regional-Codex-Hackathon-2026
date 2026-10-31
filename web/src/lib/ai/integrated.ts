import { post, type IssuedCall, type MemoBinding } from "./protocol";

export type Order = {
  tracking_id: string; buyer_name: string; item: string; status: string;
  generation_id: string; context_version: number; route_id: string;
  delivery_date?: string; original_delivery_date?: string; attempt_count?: number;
};
export type WorkflowCase = {
  id: number; shipper_event_id?: number; trigger: string; state: string;
  generation_id: string; closed_at: string | null; next_action_at?: string | null;
};
export type WorkflowCall = {
  id: string; case_id: number; status: string; number: number;
  provider_session_id?: string | null; ws_path?: string | null; runtime_status?: string | null;
  answer_deadline_at?: string | null;
};
export type OrderDetail = {
  order: Order; context: Record<string, unknown>; data_source: string;
  pending_event: { id: number; button: string; commit_at: string } | null;
  context_card: Record<string, unknown> | null;
  rescue_cases: WorkflowCase[]; calls: WorkflowCall[];
  provider_requests: unknown[]; rescue_messages: unknown[];
  messages?: Record<string, unknown>[];
  events: { id: number; at: string; type: string; payload: Record<string, unknown>; version: number }[];
  action_guard?: { can_tap: boolean; reason: string | null; next_action: string; pending_commit_at?: string | null; next_action_at?: string | null };
};
export type OrderPage = { items: Order[]; total: number; data_source: string };
export type BusinessClock = { generation_id: string; now: string; speed: number; paused: boolean; auto_buyer: boolean; offline: boolean; reset_job?: { status: string; stage: string; message?: string } | null };

export function currentIssuedCall(detail: OrderDetail, now = Date.now()): IssuedCall | undefined {
  const active = detail.rescue_cases.find((item) => item.id === detail.context.rescue_case_id && !item.closed_at && item.generation_id === detail.order.generation_id);
  if (!active) return;
  const call = [...detail.calls].reverse().find((item) => item.case_id === active.id && item.provider_session_id && item.ws_path && item.runtime_status === "ringing" && (!item.answer_deadline_at || Date.parse(item.answer_deadline_at) > now) && !["ended", "missed", "declined", "cancelled"].includes(item.status));
  if (!call) return;
  return { call_id: call.provider_session_id!, tracking_id: detail.order.tracking_id, voice_provider: "gpt_live", ws_path: call.ws_path!, status: "ringing" };
}

export function courierEligibility(detail: OrderDetail, clock?: BusinessClock) {
  if (clock?.reset_job?.status === "processing") return { allowed: false, reason: "Session reset is preparing fresh orders. Wait for the ready state." };
  if (detail.action_guard) return { allowed: detail.action_guard.can_tap, reason: detail.action_guard.reason || "The current workflow determines the next action." };
  if (["delivered", "labelled", "with_cs", "cancelled", "returned"].includes(detail.order.status)) return { allowed: false, reason: "This order cannot accept another courier outcome." };
  if (detail.pending_event) return { allowed: false, reason: "An outcome is pending. Keep it or undo before its deadline." };
  if (detail.rescue_cases.some((item) => !item.closed_at && item.generation_id === detail.order.generation_id && !["rescheduled", "out_for_delivery"].includes(item.state))) return { allowed: false, reason: "A rescue is already active. Follow its next action instead of starting another outcome." };
  if (!clock || clock.generation_id !== detail.order.generation_id) return { allowed: false, reason: "Wait for the current session clock." };
  if (detail.order.delivery_date && (detail.order.delivery_date !== clock.now.slice(0, 10) || clock.now.slice(11, 16) < "08:00")) return { allowed: false, reason: "This order is outside today's active route. Use the correct delivery day after route cutoff." };
  if ((detail.order.attempt_count || 0) >= 3) return { allowed: false, reason: "The delivery attempt limit has been reached." };
  return { allowed: true, reason: "Choose the outcome observed by the courier." };
}

export function workflowNextAction(detail: OrderDetail) {
  if (detail.action_guard?.next_action) return detail.action_guard.next_action;
  if (detail.pending_event) return `Keep or undo ${detail.pending_event.button}; commit is due at ${detail.pending_event.commit_at}.`;
  const active = detail.rescue_cases.find((item) => item.id === detail.context.rescue_case_id && !item.closed_at);
  const state = active?.state || String(detail.context.workflow_state || detail.order.status);
  const messages: Record<string, string> = {
    memo: "Record the courier's short reschedule memo.", chat_pending: "Run the due workflow job to send the buyer message.",
    call_1_due: "Wait for the first call timer, then run due jobs.", call_2_due: "Wait for the second call timer, then run due jobs.",
    calling: "The buyer phone should answer the issued call.", confirm_in_chat: "Wait for the buyer's confirmation.",
    needs_review: "Customer service must review the proposed context.", with_cs: "Customer service owns this case.",
    rescheduled: "Follow the updated delivery date and context card.", moved: "Follow the updated delivery date and context card.",
    delivered: "Delivery is complete.", labelled: "This order has a final disposition.", out_for_delivery: "Courier can report A · No answer or B · Rescheduled.",
  };
  return messages[state] || `Current workflow: ${state.replaceAll("_", " ")}. Refresh or inspect the latest event.`;
}

export function currentMemoBinding(detail: OrderDetail): MemoBinding | undefined {
  if (detail.pending_event) return;
  const active = detail.rescue_cases.find((item) => item.id === detail.context.rescue_case_id && !item.closed_at && item.generation_id === detail.order.generation_id && item.trigger === "RESCHEDULE" && item.state === "memo");
  if (!active) return;
  const eventId = active.shipper_event_id;
  if (typeof eventId !== "number" || !Number.isInteger(eventId) || eventId < 1) return;
  return { generation_id: detail.order.generation_id, context_version: detail.order.context_version, shipper_event_id: eventId };
}

export function orderCommand(order: Order, idempotencyKey: string) {
  return { generation_id: order.generation_id, context_version: order.context_version, idempotency_key: idempotencyKey };
}
export function tapOrder(order: Order, button: "A" | "B", idempotencyKey: string, signal?: AbortSignal, base?: string) {
  return post(`/orders/${encodeURIComponent(order.tracking_id)}/events`, { ...orderCommand(order, idempotencyKey), button }, signal, base);
}
export function undoOrder(detail: OrderDetail, idempotencyKey: string, signal?: AbortSignal, base?: string) {
  if (!detail.pending_event) throw new Error("No pending event is available to undo. Refresh the order.");
  return post(`/events/${detail.pending_event.id}/undo`, orderCommand(detail.order, idempotencyKey), signal, base);
}
