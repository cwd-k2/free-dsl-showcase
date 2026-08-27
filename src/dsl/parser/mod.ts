/** Stable public entry point for typed parsers, direct execution, and Regex lowering. */

export { parse } from "./interpreter.ts";
export type { ParseFailure, ParseResult, ParseSuccess } from "./interpreter.ts";
export {
  between,
  choice,
  map,
  named,
  oneOfCharacters,
  oneOrMore,
  Parser,
  repeated,
  separatedBy,
  sequence,
  text,
  zeroOrMore,
} from "./language.ts";
export type { Captures, Pattern } from "./language.ts";
export { lowerToRegex } from "./lowering.ts";
