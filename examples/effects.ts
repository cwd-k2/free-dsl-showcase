/**
 * Small application that describes IO and logging independently of the runtime that executes it.
 * Running this file directly selects the real console interpreter.
 *
 * @module
 */

import { type Program, run } from "../src/core/free.ts";
import { consoleInterpreter, io, log } from "../src/dsl/effects/mod.ts";

/** An application program that describes effects without choosing how to execute them. */
export function* greet(): Program<string> {
  yield* log.info("asking for a name");
  const name = yield* io.readLine("Your name?");
  const greeting = `Hello, ${name}!`;
  yield* io.writeLine(greeting);
  yield* log.info("greeting written");
  return greeting;
}

if (import.meta.main) {
  // Module guards keep the same program importable by tests without starting interactive IO.
  run(greet(), consoleInterpreter<string>());
}
