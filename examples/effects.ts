import { consoleInterpreter, io, log } from "../src/effects.ts";
import { type Program, run } from "../src/free.ts";

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
  run(greet(), consoleInterpreter<string>());
}
