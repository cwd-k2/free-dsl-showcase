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

const ASCII_DIGITS = "0123456789";
const ASCII_WORD = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_";

function escapeCharClassChar(char: string): string {
  return char === "\\" || char === "[" || char === "]" || char === "-" || char === "^"
    ? `\\${char}`
    : char;
}

function sameCharacters(left: string, right: string): boolean {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  return leftSet.size === rightSet.size && [...leftSet].every((char) => rightSet.has(char));
}

function renderCharClass(chars: string, compact: boolean): string {
  if (!compact) return `[${[...chars].map(escapeCharClassChar).join("")}]`;
  if (sameCharacters(chars, ASCII_DIGITS)) return "\\d";
  if (sameCharacters(chars, ASCII_WORD)) return "\\w";

  const characters = [...chars];
  let source = "";

  for (let index = 0; index < characters.length;) {
    const start = characters[index];
    const category = /[A-Z]/.test(start)
      ? "upper"
      : /[a-z]/.test(start)
      ? "lower"
      : /[0-9]/.test(start)
      ? "digit"
      : undefined;
    let end = index;

    while (
      category && end + 1 < characters.length &&
      characters[end + 1].codePointAt(0) === characters[end].codePointAt(0)! + 1 &&
      (category === "upper" ? /[A-Z]/ : category === "lower" ? /[a-z]/ : /[0-9]/).test(
        characters[end + 1],
      )
    ) {
      end++;
    }

    if (end - index >= 2) {
      source += `${start}-${characters[end]}`;
      index = end + 1;
    } else {
      source += escapeCharClassChar(start);
      index++;
    }
  }

  return `[${source}]`;
}

function quantifier(min: number, max: number | undefined, compact: boolean): string {
  if (!Number.isSafeInteger(min) || min < 0) throw new Error(`Invalid repeat min: ${min}`);
  if (max !== undefined && (!Number.isSafeInteger(max) || max < min)) {
    throw new Error(`Invalid repeat max: ${max}`);
  }
  if (min === 0 && max === undefined) return "*";
  if (min === 1 && max === undefined) return "+";
  if (compact && min === 0 && max === 1) return "?";
  if (compact && min === 1 && max === 1) return "";
  if (max === undefined) return `{${min},}`;
  if (max === min) return `{${min}}`;
  return `{${min},${max}}`;
}

function sourceInterpreter<Out>(
  compact: boolean,
  finish: (source: string) => Out,
): Interpreter<RegexState, Out> {
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
          value: { tag: "regex", source: renderCharClass(chars, compact) } satisfies RegexFragment,
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
          source: compact && min === 1 && max === 1
            ? part.source
            : `(?:${part.source})${quantifier(min, max, compact)}`,
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
      return finish(compact ? `^${fragment.source}$` : `^(?:${fragment.source})$`);
    },
  };
}

/** Interprets a regex program as an executable, fully anchored JavaScript RegExp. */
export function regexInterpreter(flags = ""): Interpreter<RegexState, RegExp> {
  return sourceInterpreter(false, (source) => new RegExp(source, flags));
}

/** Interprets a regex program as a compact, fully anchored JavaScript regex source string. */
export function compactRegexSourceInterpreter(): Interpreter<RegexState, string> {
  return sourceInterpreter(true, (source) => source);
}
