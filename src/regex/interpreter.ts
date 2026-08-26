/**
 * Interpreters for the regex language. Both modes share operation semantics and differ only in
 * rendering policy and final output, preventing the executable and display forms from drifting.
 *
 * @module
 */

import type { Interpreter } from "../free.ts";
import type { RegexFragment } from "./language.ts";
import { escapeRegex, quantifier, renderCharClass } from "./render.ts";

type RegexState = null;

/** Build a source-producing interpreter parameterized by formatting and final conversion. */
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
          // Exact-one needs no group in compact output; the verbose form stays structurally clear.
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
      // Every produced pattern matches the whole input so callers cannot accidentally match a slice.
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
