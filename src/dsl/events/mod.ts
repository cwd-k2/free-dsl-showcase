/** Stable public entry point for the event-processing DSL. */

export {
  asyncEventRuntimeInterpreter,
  eventRuntimeInterpreter,
  replayInterpreter,
} from "./interpreter.ts";
export type { AsyncEventRuntime, EventRuntime, ReplayResult, ReplayState } from "./interpreter.ts";
export { events } from "./language.ts";
export type { Event } from "./language.ts";
