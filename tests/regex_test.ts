import { type Program, run } from "../src/free.ts";
import {
  compactRegexSourceInterpreter,
  regex,
  type RegexFragment,
  regexInterpreter,
} from "../src/regex.ts";
import { assertEquals, assertThrows } from "./assert.ts";

/**
 * A readable email addr-spec example based on RFC 5322's dot-atom form.
 *
 * It intentionally omits quoted strings, comments, domain literals, obsolete
 * syntax, and whole-address length limits. Those are better handled by a real
 * parser when complete RFC compliance is required.
 */
function* emailAddressPattern(): Program<RegexFragment> {
  const { alt, capture, charSet, literal, repeat, seq } = regex;
  const alpha = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  const digit = "0123456789";
  const atext = alpha + digit + "!#$%&'*+/=?^_`{|}~-";

  // Character sets and literals used by the grammar below.
  const atomChars = yield* charSet(atext);
  const alnum = yield* charSet(alpha + digit);
  const labelMiddleChars = yield* charSet(alpha + digit + "-");
  const alphaChars = yield* charSet(alpha);
  const dot = yield* literal(".");
  const at = yield* literal("@");

  const local = yield* (function* (): Program<RegexFragment> {
    // local-part = atom *("." atom)
    const atom = yield* repeat(atomChars, 1);
    const dottedAtom = yield* seq(dot, atom);
    const remainingAtoms = yield* repeat(dottedAtom, 0);
    return yield* seq(atom, remainingAtoms);
  })();
  const capturedLocal = yield* capture("local", local);

  const domain = yield* (function* (): Program<RegexFragment> {
    // DNS-style labels keep the example practical: no leading/trailing hyphens,
    // at most 63 characters per label, and an alphabetic final label.
    const labelMiddle = yield* repeat(labelMiddleChars, 0, 61);
    const longLabel = yield* seq(alnum, labelMiddle, alnum);
    const label = yield* alt(longLabel, alnum);
    const dottedLabel = yield* seq(dot, label);
    const subdomains = yield* repeat(dottedLabel, 0);
    const topLevelDomain = yield* repeat(alphaChars, 2, 63);
    return yield* seq(label, subdomains, dot, topLevelDomain);
  })();
  const capturedDomain = yield* capture("domain", domain);

  return yield* seq(capturedLocal, at, capturedDomain);
}

type ParsedEmail = { local: string; domain: string };
const EMAIL_RE = run(emailAddressPattern(), regexInterpreter("i"));
const EMAIL_SOURCE = run(emailAddressPattern(), compactRegexSourceInterpreter());

function parseEmail(input: string): ParsedEmail | null {
  const match = EMAIL_RE.exec(input);
  if (!match?.groups) return null;
  return { local: match.groups.local, domain: match.groups.domain };
}

Deno.test("email example accepts and captures dot-atom addresses", () => {
  console.log(`generated email regexp: ${EMAIL_SOURCE}`);

  assertEquals(parseEmail("alice@example.com"), { local: "alice", domain: "example.com" });
  assertEquals(parseEmail("shop+tag@sub.example.co.jp"), {
    local: "shop+tag",
    domain: "sub.example.co.jp",
  });
});

Deno.test("email example rejects forms outside its documented subset", () => {
  for (
    const input of [
      ".alice@example.com",
      "alice..bob@example.com",
      "alice@example",
      "alice@-example.com",
      '"alice"@example.com',
      "alice@[127.0.0.1]",
      "prefix alice@example.com suffix",
    ]
  ) {
    assertEquals(parseEmail(input), null);
  }
});

Deno.test("regex repeat validates its bounds", () => {
  function* invalidPattern() {
    const value = yield* regex.literal("x");
    return yield* regex.repeat(value, 2, 1);
  }

  assertThrows(
    () => run(invalidPattern(), regexInterpreter()),
    "Invalid repeat max: 1",
  );
});

Deno.test("RegExp interpreter preserves explicitly listed character sets", () => {
  function* identifierPattern(): Program<RegexFragment> {
    return yield* regex.charSet(
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_",
    );
  }

  assertEquals(
    run(identifierPattern(), regexInterpreter()).source,
    "^(?:[ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_])$",
  );
});

Deno.test("compact source interpreter uses JavaScript shorthand classes and ranges", () => {
  function* identifierPattern(): Program<RegexFragment> {
    const identifier = yield* regex.charSet(
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_",
    );
    const digit = yield* regex.charSet("0123456789");
    const hexadecimal = yield* regex.charSet("ABCDEFabcdef0123456789");
    return yield* regex.seq(identifier, digit, hexadecimal);
  }

  assertEquals(
    run(identifierPattern(), compactRegexSourceInterpreter()),
    "^\\w\\d[A-Fa-f0-9]$",
  );
});

Deno.test("compact source interpreter uses optional and elides exact-one quantifiers", () => {
  function* optionalPattern(): Program<RegexFragment> {
    const x = yield* regex.literal("x");
    return yield* regex.seq(yield* regex.repeat(x, 0, 1), yield* regex.repeat(x, 1, 1));
  }

  assertEquals(run(optionalPattern(), compactRegexSourceInterpreter()), "^(?:x)?x$");
});

Deno.test("character sets preserve non-BMP characters", () => {
  function* emojiPattern(): Program<RegexFragment> {
    return yield* regex.charSet("😀😃");
  }

  const result = run(emojiPattern(), regexInterpreter("u"));
  assertEquals(result.source, "^(?:[😀😃])$");
  assertEquals(result.test("😀"), true);
});
