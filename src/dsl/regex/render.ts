/**
 * Rendering helpers shared by regex interpreters. This module owns escaping, safe quantifiers,
 * and the optional source compaction rules; it has no generator or interpreter concerns.
 *
 * @module
 */

const ASCII_DIGITS = "0123456789";
const ASCII_WORD = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_";

/** Escape characters that would otherwise have syntax-level meaning outside a character class. */
export function escapeRegex(text: string): string {
  return text.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
}

function escapeCharClassChar(char: string): string {
  return char === "\\" || char === "[" || char === "]" || char === "-" || char === "^"
    ? `\\${char}`
    : char;
}

function sameCharacters(left: string, right: string): boolean {
  // Set comparison permits callers to list the known shorthand characters in any order.
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  return leftSet.size === rightSet.size && [...leftSet].every((char) => rightSet.has(char));
}

/** Render a character set, optionally using shorthand classes and ASCII ranges. */
export function renderCharClass(chars: string, compact: boolean): string {
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

    // A range only shortens runs of at least three characters: `A-C` versus `ABC`.
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

/** Validate repeat bounds and render their regular-expression quantifier. */
export function quantifier(min: number, max: number | undefined, compact: boolean): string {
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
