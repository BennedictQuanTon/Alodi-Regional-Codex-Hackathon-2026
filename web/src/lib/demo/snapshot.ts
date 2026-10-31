import { SCENARIOS, initialState, stepsFor } from "./scenarios";
import type { DemoState, ScenarioId } from "./types";

/** Run a scenario up to and including step `untilId` (no clock) to get a static frame. */
export function snapshot(scenario: ScenarioId, untilId: string, extra?: (s: DemoState) => DemoState): DemoState {
  let s = initialState(scenario);
  const key = SCENARIOS.find((x) => x.id === scenario)?.key;
  for (const step of stepsFor(scenario)) {
    s = { ...s, clock: step.to ?? s.clock + (step.dt ?? 0) };
    if (step.apply) s = step.apply(s, step.wait?.action === "shipper:choose" ? key : undefined);
    s = { ...s, step: s.step + 1, caption: step.caption ?? s.caption };
    if (step.id === untilId) break;
  }
  return extra ? extra(s) : s;
}
