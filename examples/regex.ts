import { type Program, run } from "../src/free.ts";
import {
  compactRegexSourceInterpreter,
  regex,
  type RegexFragment,
  regexInterpreter,
} from "../src/regex.ts";

/**
 * A readable email addr-spec example based on RFC 5322's dot-atom form.
 *
 * It intentionally omits quoted strings, comments, domain literals, obsolete
 * syntax, and whole-address length limits. Those are better handled by a real
 * parser when complete RFC compliance is required.
 */
export function* emailAddressPattern(): Program<RegexFragment> {
  const { alt, capture, charSet, literal, repeat, seq } = regex;
  const alpha = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  const digit = "0123456789";
  const atext = alpha + digit + "!#$%&'*+/=?^_`{|}~-";

  const atomChars = yield* charSet(atext);
  const alnum = yield* charSet(alpha + digit);
  const labelMiddleChars = yield* charSet(alpha + digit + "-");
  const alphaChars = yield* charSet(alpha);
  const dot = yield* literal(".");
  const at = yield* literal("@");

  const local = yield* (function* (): Program<RegexFragment> {
    const atom = yield* repeat(atomChars, 1);
    const dottedAtom = yield* seq(dot, atom);
    return yield* seq(atom, yield* repeat(dottedAtom, 0));
  })();
  const capturedLocal = yield* capture("local", local);

  const domain = yield* (function* (): Program<RegexFragment> {
    const labelMiddle = yield* repeat(labelMiddleChars, 0, 61);
    const longLabel = yield* seq(alnum, labelMiddle, alnum);
    const label = yield* alt(longLabel, alnum);
    const dottedLabel = yield* seq(dot, label);
    const subdomains = yield* repeat(dottedLabel, 0);
    const topLevelDomain = yield* repeat(alphaChars, 2, 63);
    return yield* seq(label, subdomains, dot, topLevelDomain);
  })();

  return yield* seq(capturedLocal, at, yield* capture("domain", domain));
}

export type ParsedEmail = { local: string; domain: string };

export function emailRegex(): RegExp {
  return run(emailAddressPattern(), regexInterpreter("i"));
}

export function emailRegexSource(): string {
  return run(emailAddressPattern(), compactRegexSourceInterpreter());
}

export function parseEmail(input: string, pattern = emailRegex()): ParsedEmail | null {
  const match = pattern.exec(input);
  if (!match?.groups) return null;
  return { local: match.groups.local, domain: match.groups.domain };
}

if (import.meta.main) {
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
