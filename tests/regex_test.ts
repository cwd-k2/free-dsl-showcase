import { type Program, run } from "../src/free.ts";
import { regex, type RegexFragment, regexInterpreter } from "../src/regex.ts";
import { assertEquals, assertThrows } from "./assert.ts";

/**
 * A readable email addr-spec example based on RFC 5322's dot-atom form.
 *
 * It intentionally omits quoted strings, comments, domain literals, obsolete
 * syntax, and whole-address length limits. Those are better handled by a real
 * parser when complete RFC compliance is required.
 */
function* emailAddressPattern(): Program<RegexFragment> {
  const alpha = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  const digit = "0123456789";
  const atext = alpha + digit + "!#$%&'*+/=?^_`{|}~-";

  const atom = yield* regex.repeat(yield* regex.charSet(atext), 1);
  const dot = yield* regex.literal(".");
  const local = yield* regex.seq(
    atom,
    yield* regex.repeat(yield* regex.seq(dot, atom), 0),
  );
  const capturedLocal = yield* regex.capture("local", local);

  // DNS-style labels keep the example practical: no leading/trailing hyphens,
  // at most 63 characters per label, and an alphabetic final label.
  const alnum = yield* regex.charSet(alpha + digit);
  const labelMiddle = yield* regex.repeat(yield* regex.charSet(alpha + digit + "-"), 0, 61);
  const label = yield* regex.alt(yield* regex.seq(alnum, labelMiddle, alnum), alnum);
  const subdomains = yield* regex.repeat(yield* regex.seq(dot, label), 0);
  const topLevelDomain = yield* regex.repeat(yield* regex.charSet(alpha), 2, 63);
  const domain = yield* regex.seq(label, subdomains, dot, topLevelDomain);
  const capturedDomain = yield* regex.capture("domain", domain);

  return yield* regex.seq(capturedLocal, yield* regex.literal("@"), capturedDomain);
}

type ParsedEmail = { local: string; domain: string };
const EMAIL_RE = run(emailAddressPattern(), regexInterpreter("i"));

function parseEmail(input: string): ParsedEmail | null {
  const match = EMAIL_RE.exec(input);
  if (!match?.groups) return null;
  return { local: match.groups.local, domain: match.groups.domain };
}

Deno.test("email example accepts and captures dot-atom addresses", () => {
  console.log(`generated email regexp: ${EMAIL_RE.source}`);

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

Deno.test("character sets render standard ASCII runs as ranges", () => {
  function* identifierPattern(): Program<RegexFragment> {
    return yield* regex.charSet(
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_",
    );
  }

  assertEquals(run(identifierPattern(), regexInterpreter()).source, "^(?:[A-Za-z0-9_])$");
});

Deno.test("character sets preserve non-BMP characters", () => {
  function* emojiPattern(): Program<RegexFragment> {
    return yield* regex.charSet("😀😃");
  }

  const result = run(emojiPattern(), regexInterpreter("u"));
  assertEquals(result.source, "^(?:[😀😃])$");
  assertEquals(result.test("😀"), true);
});
