/**
 * The dot-atom email pattern built directly from the low-level regex DSL. This intentionally
 * structural version is a comparison point for the parser-oriented program in `regex.ts`.
 *
 * @module
 */

import { type Program, run } from "../src/free.ts";
import {
  compactRegexSourceInterpreter,
  regex,
  type RegexFragment,
  regexInterpreter,
} from "../src/regex/mod.ts";

/** Build the same regular language as the email Parser AST, using raw Regex DSL primitives. */
export function* primitiveEmailAddressPattern(): Program<RegexFragment> {
  const alpha = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  const digit = "0123456789";
  const atext = alpha + digit + "!#$%&'*+/=?^_`{|}~-";

  const atomCharacters = yield* regex.charSet(atext);
  const alphaNumeric = yield* regex.charSet(alpha + digit);
  const labelMiddleCharacters = yield* regex.charSet(alpha + digit + "-");
  const alphaCharacters = yield* regex.charSet(alpha);
  const dot = yield* regex.literal(".");

  const atom = yield* regex.repeat(atomCharacters, 1);
  const followingAtom = yield* regex.seq(dot, atom);
  const localPart = yield* regex.capture(
    "local",
    yield* regex.seq(atom, yield* regex.repeat(followingAtom, 0)),
  );

  const labelMiddle = yield* regex.repeat(labelMiddleCharacters, 0, 61);
  const longLabel = yield* regex.seq(alphaNumeric, labelMiddle, alphaNumeric);
  const label = yield* regex.alt(longLabel, alphaNumeric);
  const followingLabel = yield* regex.seq(dot, label);
  const subdomains = yield* regex.seq(label, yield* regex.repeat(followingLabel, 0));
  const topLevelDomain = yield* regex.repeat(alphaCharacters, 2, 63);
  const domain = yield* regex.capture(
    "domain",
    yield* regex.seq(subdomains, dot, topLevelDomain),
  );

  return yield* regex.seq(localPart, yield* regex.literal("@"), domain);
}

export function primitiveEmailRegex(): RegExp {
  return run(primitiveEmailAddressPattern(), regexInterpreter("i"));
}

export function primitiveEmailRegexSource(): string {
  return run(primitiveEmailAddressPattern(), compactRegexSourceInterpreter());
}

if (import.meta.main) {
  console.log(`regex: ${primitiveEmailRegexSource()}`);
}
