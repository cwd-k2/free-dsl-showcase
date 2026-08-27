/** Deterministic in-memory runtime for IO and logging effects. */

import type { Interpreter } from "@/core/free.ts";

/** All inputs and observable events captured by the pure interpreter. */
export type EffectState = {
  input: string[];
  prompts: string[];
  output: string[];
  logs: string[];
};

export type StateResult<A> = EffectState & { value: A };

/**
 * Consume input from State and accumulate every observable output, without performing external IO.
 */
export function stateInterpreter<A>(
  input: readonly string[],
): Interpreter<EffectState, StateResult<A>> {
  return {
    initial: () => ({ input: [...input], prompts: [], output: [], logs: [] }),
    handlers: {
      "io.readLine": (state, { question }) => {
        const [value, ...remaining] = state.input;
        if (value === undefined) throw new Error("State interpreter has no more input");
        return {
          state: { ...state, input: remaining, prompts: [...state.prompts, question] },
          value,
        };
      },
      "io.writeLine": (state, { text }) => ({
        state: { ...state, output: [...state.output, text] },
        value: undefined,
      }),
      "log.info": (state, { message }) => ({
        state: { ...state, logs: [...state.logs, message] },
        value: undefined,
      }),
    },
    finish: (state, value) => ({ ...state, value: value as A }),
  };
}
