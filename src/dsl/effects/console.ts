/** External console runtime for IO and logging effects. */

import type { Interpreter } from "@/core/free.ts";

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

/** Interpret the effects as real terminal IO, using an injectable runtime when supplied. */
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
