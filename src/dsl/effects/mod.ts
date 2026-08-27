/** Stable public entry point for IO and logging effects and their runtimes. */

export { consoleInterpreter } from "./console.ts";
export type { ConsoleRuntime } from "./console.ts";
export { io, log } from "./language.ts";
export { stateInterpreter } from "./state.ts";
export type { EffectState, StateResult } from "./state.ts";
