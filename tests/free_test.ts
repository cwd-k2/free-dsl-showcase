/** Behavioral tests for operation dispatch, state threading, and missing-handler failures. */

import { perform, type Program, run } from "../src/free.ts";
import { assertEquals, assertThrows } from "./assert.ts";

Deno.test("run threads state and operation results through a program", () => {
  function* program(): Program<number> {
    const first = yield* perform<number>("add", 2);
    const second = yield* perform<number>("add", 3);
    return first + second;
  }

  const result = run(program(), {
    initial: () => 0,
    handlers: {
      add: (state, amount) => ({ state: state + amount, value: state + amount }),
    },
    finish: (state, returnValue) => ({ state, returnValue }),
  });

  assertEquals(result, { state: 5, returnValue: 7 });
});

Deno.test("run rejects operations missing from an interpreter", () => {
  function* program(): Program<void> {
    yield* perform("missing");
  }

  assertThrows(
    () => run(program(), { initial: () => null, handlers: {}, finish: () => undefined }),
    "Unhandled op: missing",
  );
});
