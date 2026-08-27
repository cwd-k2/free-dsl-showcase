/** Tests that one effect program has equivalent pure-State and console interpretations. */

import { greet } from "../examples/effects.ts";
import { run } from "@/core/free.ts";
import { consoleInterpreter, stateInterpreter } from "@/dsl/effects/mod.ts";
import { assertEquals, assertThrows } from "./assert.ts";

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
