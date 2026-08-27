/** Direct parser execution tests, including backtracking that a naive parser would miss. */

import { between, map, oneOfCharacters, parse, sequence, text } from "@/dsl/parser/mod.ts";
import { assertEquals } from "./assert.ts";

Deno.test("repeat backtracks when a following parser needs an earlier character", () => {
  const letters = map(between(oneOfCharacters("ab"), 1, 3), (value) => value.join(""));
  const parser = sequence(letters, text("b"));

  assertEquals(parse(parser, "aab"), {
    ok: true,
    value: ["aa", "b"],
    captures: {},
  });
});

Deno.test("parser failures identify the farthest position and expectation", () => {
  const parser = sequence(text("hello"), text("!"));

  assertEquals(parse(parser, "hello?"), {
    ok: false,
    position: 5,
    expected: ['"!"'],
  });
});

Deno.test("a terminal failure at position zero retains its expectation", () => {
  assertEquals(parse(text("yes"), "no"), {
    ok: false,
    position: 0,
    expected: ['"yes"'],
  });
});

Deno.test("character parsers handle non-BMP characters as one input unit", () => {
  assertEquals(parse(oneOfCharacters("😀😃"), "😃"), {
    ok: true,
    value: "😃",
    captures: {},
  });
});
