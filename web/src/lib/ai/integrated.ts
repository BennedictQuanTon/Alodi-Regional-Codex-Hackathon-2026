import { post, type IssuedCall, type MemoBinding } from "./protocol";

export type Order = {
  tracking_id: string; buyer_name: string; item: string; status: string;
  generation_id: string; context_version: number; route_id: string;
};
export type WorkflowCase = {
  id: number; shipper_event_id?: number; trigger: string; state: string;
  generation_id: string; closed_at: string | null; next_action_at?: string | null;
};
export type WorkflowCall = {
  id: string; case_id: number; status: string; number: number;
  provider_session_id?: string | null; ws_path?: string | null; runtime_status?: string | null;
};
export type OrderDetail = {
  order: Order; context: Record<string, unknown>; data_source: string;
  pending_event: { id: number; button: string; commit_at: string } | null;
  context_card: Record<string, unknown> | null;
  rescue_cases: WorkflowCase[]; calls: WorkflowCall[];
  provider_requests: unknown[]; rescue_messages: unknown[];
  events: { id: number; at: string; type: string; payload: Record<string, unknown>; version: number }[];
};
export type OrderPage = { items: Order[]; total: number; data_source: string };
export type BusinessClock = { generation_id: string; now: string; speed: number; paused: boolean; auto_buyer: boolean; offline: boolean };

export function currentIssuedCall(detail: OrderDetail): IssuedCall | undefined {
  const active = detail.rescue_cases.find((item) => item.id === detail.context.rescue_case_id && !item.closed_at && item.generation_id === detail.order.generation_id);
  if (!active) return;
  const call = [...detail.calls].reverse().find((item) => item.case_id === active.id && item.provider_session_id && item.ws_path && item.runtime_status === "ringing" && !["ended", "missed", "declined", "cancelled"].includes(item.status));
  if (!call) return;
  return { call_id: call.provider_session_id!, tracking_id: detail.order.tracking_id, voice_provider: "gpt_live", ws_path: call.ws_path!, status: "ringing" };
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
