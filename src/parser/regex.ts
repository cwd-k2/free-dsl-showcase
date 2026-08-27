/** Lower the regular subset of the Parser grammar into the existing Regex operation DSL. */

import type { Program } from "../free.ts";
import { regex, type RegexFragment } from "../regex/mod.ts";
import type { Parser, Pattern } from "./language.ts";

function* lowerPattern(pattern: Pattern): Program<RegexFragment> {
  switch (pattern.kind) {
    case "text":
      return yield* regex.literal(pattern.value);

    case "characters":
      return yield* regex.charSet(pattern.characters);

    case "sequence": {
      const parts: RegexFragment[] = [];
      for (const part of pattern.parts) parts.push(yield* lowerPattern(part));
      return yield* regex.seq(...parts);
    }

    case "choice": {
      const alternatives: RegexFragment[] = [];
      for (const alternative of pattern.alternatives) {
        alternatives.push(yield* lowerPattern(alternative));
      }
      return yield* regex.alt(...alternatives);
    }

    case "repeat":
      return yield* regex.repeat(
        yield* lowerPattern(pattern.pattern),
        pattern.min,
        pattern.max,
      );

    case "capture":
      return yield* regex.capture(pattern.name, yield* lowerPattern(pattern.pattern));
  }
}

/** Produce a Generator program so any Regex interpreter can consume the lowered grammar. */
export function lowerToRegex(parser: Parser<unknown>): Program<RegexFragment> {
  return lowerPattern(parser.pattern);
}
