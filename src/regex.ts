import { type Interpreter, perform } from "./free.ts";

export type RegexFragment = Readonly<{ tag: "regex"; source: string }>;
type RegexState = null;

/** Operations available inside a regular-expression generator program. */
export const regex = {
  literal: (text: string) => perform<RegexFragment>("rx.literal", { text }),
  charSet: (chars: string) => perform<RegexFragment>("rx.charSet", { chars }),
  seq: (...parts: RegexFragment[]) => perform<RegexFragment>("rx.seq", { parts }),
  alt: (...parts: RegexFragment[]) => perform<RegexFragment>("rx.alt", { parts }),
  repeat: (part: RegexFragment, min: number, max?: number) =>
    perform<RegexFragment>("rx.repeat", { part, min, max }),
  capture: (name: string, part: RegexFragment) =>
    perform<RegexFragment>("rx.capture", { name, part }),
};

function escapeRegex(text: string): string {
  return text.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
}

const ASCII_RANGES = [
  ["ABCDEFGHIJKLMNOPQRSTUVWXYZ", "A-Z"],
  ["abcdefghijklmnopqrstuvwxyz", "a-z"],
  ["0123456789", "0-9"],
] as const;

function escapeCharClassChar(char: string): string {
  return char === "\\" || char === "]" || char === "-" || char === "^" ? `\\${char}` : char;
}

function renderCharClass(chars: string): string {
  let source = "";

  for (let index = 0; index < chars.length;) {
    const range = ASCII_RANGES.find(([characters]) => chars.startsWith(characters, index));
    if (range) {
      source += range[1];
      index += range[0].length;
    } else {
      const char = String.fromCodePoint(chars.codePointAt(index)!);
      source += escapeCharClassChar(char);
      index += char.length;
    }
  }

  return `[${source}]`;
}

function quantifier(min: number, max?: number): string {
  if (!Number.isSafeInteger(min) || min < 0) throw new Error(`Invalid repeat min: ${min}`);
  if (max !== undefined && (!Number.isSafeInteger(max) || max < min)) {
    throw new Error(`Invalid repeat max: ${max}`);
  }
  if (min === 0 && max === undefined) return "*";
  if (min === 1 && max === undefined) return "+";
  if (max === undefined) return `{${min},}`;
  if (max === min) return `{${min}}`;
  return `{${min},${max}}`;
}

export function regexInterpreter(flags = ""): Interpreter<RegexState, RegExp> {
  return {
    initial: () => null,
    handlers: {
      "rx.literal": (state, { text }) => ({
        state,
        value: { tag: "regex", source: escapeRegex(text) } satisfies RegexFragment,
      }),
      "rx.charSet": (state, { chars }) => {
        if (chars.length === 0) throw new Error("charSet must not be empty");
        return {
          state,
          value: { tag: "regex", source: renderCharClass(chars) } satisfies RegexFragment,
        };
      },
      "rx.seq": (state, { parts }) => ({
        state,
        value: {
          tag: "regex",
          source: parts.map((part: RegexFragment) => part.source).join(""),
        } satisfies RegexFragment,
      }),
      "rx.alt": (state, { parts }) => {
        if (parts.length === 0) throw new Error("alt must not be empty");
        return {
          state,
          value: {
            tag: "regex",
            source: `(?:${parts.map((part: RegexFragment) => part.source).join("|")})`,
          } satisfies RegexFragment,
        };
      },
      "rx.repeat": (state, { part, min, max }) => ({
        state,
        value: {
          tag: "regex",
          source: `(?:${part.source})${quantifier(min, max)}`,
        } satisfies RegexFragment,
      }),
      "rx.capture": (state, { name, part }) => {
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
          throw new Error(`Invalid capture name: ${name}`);
        }
        return {
          state,
          value: {
            tag: "regex",
            source: `(?<${name}>${part.source})`,
          } satisfies RegexFragment,
        };
      },
    },
    finish: (_state, value) => {
      const fragment = value as RegexFragment;
      if (!fragment || fragment.tag !== "regex") {
        throw new Error("Regex program must return a RegexFragment");
      }
      return new RegExp(`^(?:${fragment.source})$`, flags);
    },
  };
}
