/** Execute Parser values directly, independently of JavaScript's regular-expression engine. */

import type { Captures, ParseContext, Parser } from "./language.ts";

export type ParseSuccess<A> = Readonly<{
  ok: true;
  value: A;
  captures: Captures;
}>;

export type ParseFailure = Readonly<{
  ok: false;
  position: number;
  expected: readonly string[];
}>;

export type ParseResult<A> = ParseSuccess<A> | ParseFailure;

/** Parse the complete input and report the farthest useful failure when no parse succeeds. */
export function parse<A>(parser: Parser<A>, input: string): ParseResult<A> {
  const context: ParseContext = { farthest: 0, expected: new Set() };
  const candidates = parser.parseAt(input, 0, context);
  const complete = candidates.find((candidate) => candidate.position === input.length);

  if (complete) return { ok: true, value: complete.value, captures: complete.captures };

  const farthestCandidate = candidates.reduce(
    (farthest, candidate) => Math.max(farthest, candidate.position),
    0,
  );

  if (candidates.length > 0 && farthestCandidate >= context.farthest) {
    return { ok: false, position: farthestCandidate, expected: ["end of input"] };
  }

  return {
    ok: false,
    position: context.farthest,
    expected: [...context.expected].sort(),
  };
}
