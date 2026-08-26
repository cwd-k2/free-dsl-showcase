/**
 * A small parser vocabulary built as aliases over the low-level regex DSL. Writing an email
 * parser with that vocabulary produces both an executable RegExp and a compact source string.
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

/** A parser is only a readable name for the fragment produced by the regex DSL. */
type Parser = RegexFragment;

// These helpers add no new operations. Each one expands directly to the low-level vocabulary in
// `src/regex/language.ts`; they merely let the grammar below read like a parser definition.
function* text(value: string): Program<Parser> {
  return yield* regex.literal(value);
}

function* oneOfCharacters(characters: string): Program<Parser> {
  return yield* regex.charSet(characters);
}

function* sequence(...parsers: Parser[]): Program<Parser> {
  return yield* regex.seq(...parsers);
}

function* choice(...parsers: Parser[]): Program<Parser> {
  return yield* regex.alt(...parsers);
}

function* repeated(parser: Parser, min: number, max?: number): Program<Parser> {
  return yield* regex.repeat(parser, min, max);
}

function* zeroOrMore(parser: Parser): Program<Parser> {
  return yield* repeated(parser, 0);
}

function* oneOrMore(parser: Parser): Program<Parser> {
  return yield* repeated(parser, 1);
}

function* between(min: number, max: number, parser: Parser): Program<Parser> {
  return yield* repeated(parser, min, max);
}

function* named(name: string, parser: Parser): Program<Parser> {
  return yield* regex.capture(name, parser);
}

function* separatedBy(parser: Parser, separator: Parser): Program<Parser> {
  const followingItem = yield* sequence(separator, parser);
  return yield* sequence(parser, yield* zeroOrMore(followingItem));
}

/**
 * A readable email addr-spec parser based on RFC 5322's dot-atom form.
 *
 * It intentionally omits quoted strings, comments, domain literals, obsolete
 * syntax, and whole-address length limits. Those are better handled by a real
 * parser when complete RFC compliance is required.
 */
export function* emailAddressParser(): Program<Parser> {
  const alpha = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  const digit = "0123456789";
  const atext = alpha + digit + "!#$%&'*+/=?^_`{|}~-";

  const dot = yield* text(".");
  const atomCharacter = yield* oneOfCharacters(atext);
  const atom = yield* oneOrMore(atomCharacter);
  const localPart = yield* named("local", yield* separatedBy(atom, dot));

  const alphaNumeric = yield* oneOfCharacters(alpha + digit);
  const labelMiddleCharacter = yield* oneOfCharacters(alpha + digit + "-");
  const longLabel = yield* sequence(
    alphaNumeric,
    yield* between(0, 61, labelMiddleCharacter),
    alphaNumeric,
  );
  const label = yield* choice(longLabel, alphaNumeric);
  const subdomains = yield* separatedBy(label, dot);
  const topLevelDomain = yield* between(2, 63, yield* oneOfCharacters(alpha));
  const domain = yield* named(
    "domain",
    yield* sequence(subdomains, dot, topLevelDomain),
  );

  return yield* sequence(localPart, yield* text("@"), domain);
}

/** Backwards-compatible name emphasizing the compiled representation rather than its source. */
export function emailAddressPattern(): Program<RegexFragment> {
  return emailAddressParser();
}

export type ParsedEmail = { local: string; domain: string };

/** Compile the example program into an anchored, case-insensitive executable pattern. */
export function emailRegex(): RegExp {
  return run(emailAddressParser(), regexInterpreter("i"));
}

/** Render the example program in the compact form intended for display and inspection. */
export function emailRegexSource(): string {
  return run(emailAddressParser(), compactRegexSourceInterpreter());
}

/** Match an entire input and expose the two named captures as a small domain value. */
export function parseEmail(input: string, pattern = emailRegex()): ParsedEmail | null {
  const match = pattern.exec(input);
  // Named groups make the parse result independent of capture ordering in the generated pattern.
  if (!match?.groups) return null;
  return { local: match.groups.local, domain: match.groups.domain };
}

if (import.meta.main) {
  // Supplying no arguments still demonstrates both successful and unsuccessful matches.
  const inputs = Deno.args.length > 0
    ? Deno.args
    : ["alice@example.com", "shop+tag@sub.example.co.jp", "not-an-email"];
  const pattern = emailRegex();

  console.log(`regex: ${emailRegexSource()}`);
  for (const input of inputs) {
    const parsed = parseEmail(input, pattern);
    console.log(
      `${parsed ? "match" : "no match"}: ${input}${parsed ? ` ${JSON.stringify(parsed)}` : ""}`,
    );
  }
}
