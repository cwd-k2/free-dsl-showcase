import { consoleInterpreter, io, log, stateInterpreter } from "../src/effects.ts";
import { type Program, run } from "../src/free.ts";
import { assertEquals, assertThrows } from "./assert.ts";

// This application describes effects but does not choose how they are executed.
function* greet(): Program<string> {
  yield* log.info("asking for a name");
  const name = yield* io.readLine("Your name?");
  const greeting = `Hello, ${name}!`;
  yield* io.writeLine(greeting);
  yield* log.info("greeting written");
  return greeting;
}

Deno.test("ordinary effects can be interpreted as pure State", () => {
  const result = run(greet(), stateInterpreter<string>(["Ada"]));

  assertEquals(result, {
    input: [],
    prompts: ["Your name?"],
    output: ["Hello, Ada!"],
    logs: ["asking for a name", "greeting written"],
    value: "Hello, Ada!",
  });
});

Deno.test("the same program can be interpreted as console IO", () => {
  const events: string[] = [];
  const result = run(
    greet(),
    consoleInterpreter<string>({
      readLine: (question) => {
        events.push(`prompt: ${question}`);
        return "Grace";
      },
      writeLine: (text) => events.push(`stdout: ${text}`),
      info: (message) => events.push(`stderr: ${message}`),
    }),
  );

  assertEquals(result, "Hello, Grace!");
  assertEquals(events, [
    "stderr: asking for a name",
    "prompt: Your name?",
    "stdout: Hello, Grace!",
    "stderr: greeting written",
  ]);
});

Deno.test("State input exhaustion is explicit", () => {
  assertThrows(
    () => run(greet(), stateInterpreter<string>([])),
    "State interpreter has no more input",
  );
});
