/**
 * Stable public entry point for the regex DSL and its two output interpretations.
 *
 * @module
 */

export { regex } from "./language.ts";
export type { RegexFragment } from "./language.ts";
export { compactRegexSourceInterpreter, regexInterpreter } from "./interpreter.ts";
