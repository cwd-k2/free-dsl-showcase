/**
 * IO and logging effects with two interpretations: a deterministic in-memory State runtime and
 * real console IO. Keeping both here makes their behavior straightforward to compare.
 *
 * @module
 */

import { type Interpreter, perform } from "../../core/free.ts";

/** Ordinary console I/O operations available to an application program. */
export const io = {
  readLine: (question: string) => perform<string>("io.readLine", { question }),
  writeLine: (text: string) => perform<void>("io.writeLine", { text }),
};

/** Logging is a separate effect, even though the real interpreter also uses the console. */
export const log = {
  info: (message: string) => perform<void>("log.info", { message }),
};

/** All inputs and observable events captured by the pure interpreter. */
export type EffectState = {
  input: string[];
  prompts: string[];
  output: string[];
  logs: string[];
};

export type StateResult<A> = EffectState & { value: A };

/**
 * A pure interpreter useful for tests: input is consumed from State and every observable
 * output is accumulated in State.
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

/** Injectable console boundary; tests can substitute it without touching global IO. */
export type ConsoleRuntime = {
  readLine: (question: string) => string | null;
  writeLine: (text: string) => void;
  info: (message: string) => void;
};

const realConsole: ConsoleRuntime = {
  readLine: (question) => globalThis.prompt(question),
  writeLine: (text) => console.log(text),
  info: (message) => console.error(`[info] ${message}`),
};

/** Interpret the same effects as real terminal IO, using an injectable runtime when supplied. */
export function consoleInterpreter<A>(
  runtime: ConsoleRuntime = realConsole,
): Interpreter<null, A> {
  return {
    initial: () => null,
    handlers: {
      "io.readLine": (state, { question }) => {
        const value = runtime.readLine(question);
        if (value === null) throw new Error("Console input ended");
        return { state, value };
      },
      "io.writeLine": (state, { text }) => {
        runtime.writeLine(text);
        return { state, value: undefined };
      },
      "log.info": (state, { message }) => {
        runtime.info(message);
        return { state, value: undefined };
      },
    },
    finish: (_state, value) => value as A,
  };
}
