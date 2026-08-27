/** A typed email parser that can also be lowered into the regular-expression DSL. */

import { type Program, run } from "../src/free.ts";
import {
  between,
  choice,
  lowerToRegex,
  map,
  named,
  oneOfCharacters,
  oneOrMore,
  parse,
  type Parser,
  separatedBy,
  sequence,
  text,
} from "../src/parser/mod.ts";
import {
  compactRegexSourceInterpreter,
  type RegexFragment,
  regexInterpreter,
} from "../src/regex/mod.ts";

const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const DIGIT = "0123456789";
const ATEXT = ALPHA + DIGIT + "!#$%&'*+/=?^_`{|}~-";

const joinCharacters = (characters: readonly string[]): string => characters.join("");

/** One or more atoms separated by dots, with no leading, trailing, or consecutive dot. */
function dotAtom(characters: string): Parser<string> {
  const atom = map(oneOrMore(oneOfCharacters(characters)), joinCharacters);
  return map(separatedBy(atom, text(".")), (parts) => parts.join("."));
}

/** An RFC-style domain label: one alphanumeric, or 2–63 chars bounded by alphanumerics. */
function domainLabel(): Parser<string> {
  const alphaNumeric = oneOfCharacters(ALPHA + DIGIT);
  const middle = map(
    between(oneOfCharacters(ALPHA + DIGIT + "-"), 0, 61),
    joinCharacters,
  );

  const longLabel = map(
    sequence(alphaNumeric, middle, alphaNumeric),
    ([first, rest, last]) => first + rest + last,
  );

  return choice(longLabel, alphaNumeric);
}

/** A dotted sequence of labels followed by a 2–63 letter top-level domain. */
function domainName(): Parser<string> {
  const labels = separatedBy(domainLabel(), text("."));
  const topLevelDomain = map(between(oneOfCharacters(ALPHA), 2, 63), joinCharacters);

  return map(
    sequence(labels, text("."), topLevelDomain),
    ([parts, dot, topLevel]) => parts.join(".") + dot + topLevel,
  );
}

export type ParsedEmail = Readonly<{ local: string; domain: string }>;

/**
 * A real Parser value for the readable RFC 5322 dot-atom subset. It directly produces a domain
 * value; its structural grammar can independently be lowered into the Regex DSL.
 */
export const emailAddressParser: Parser<ParsedEmail> = map(
  sequence(
    named("local", dotAtom(ATEXT)),
    text("@"),
    named("domain", domainName()),
  ),
  ([local, _at, domain]) => ({ local, domain }),
);

/** Lower the parser grammar into the Regex DSL for either regex interpretation. */
export function emailAddressPattern(): Program<RegexFragment> {
  return lowerToRegex(emailAddressParser);
}

export function emailRegex(): RegExp {
  return run(emailAddressPattern(), regexInterpreter("i"));
}

export function emailRegexSource(): string {
  return run(emailAddressPattern(), compactRegexSourceInterpreter());
}

/** Parse without RegExp: the parser interpreter consumes the complete input and returns a value. */
export function parseEmail(input: string): ParsedEmail | null {
  const result = parse(emailAddressParser, input);
  return result.ok ? result.value : null;
}

if (import.meta.main) {
  const inputs = Deno.args.length > 0
    ? Deno.args
    : ["alice@example.com", "shop+tag@sub.example.co.jp", "not-an-email"];

  console.log(`lowered regex: ${emailRegexSource()}`);

  for (const input of inputs) {
    const result = parse(emailAddressParser, input);

    if (result.ok) {
      console.log(`match: ${input} ${JSON.stringify(result.value)}`);
    } else {
      console.log(
        `no match: ${input} at ${result.position}, expected ${result.expected.join(" or ")}`,
      );
    }
  }
}
