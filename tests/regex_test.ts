import { emailRegex, emailRegexSource, parseEmail } from "../examples/regex.ts";
import { type Program, run } from "../src/free.ts";
import {
  compactRegexSourceInterpreter,
  regex,
  type RegexFragment,
  regexInterpreter,
} from "../src/regex.ts";
import { assertEquals, assertThrows } from "./assert.ts";

const EMAIL_RE = emailRegex();
const EMAIL_SOURCE = emailRegexSource();

Deno.test("email example accepts and captures dot-atom addresses", () => {
  console.log(`generated email regexp: ${EMAIL_SOURCE}`);

  assertEquals(parseEmail("alice@example.com", EMAIL_RE), {
    local: "alice",
    domain: "example.com",
  });
  assertEquals(parseEmail("shop+tag@sub.example.co.jp", EMAIL_RE), {
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
    assertEquals(parseEmail(input, EMAIL_RE), null);
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
