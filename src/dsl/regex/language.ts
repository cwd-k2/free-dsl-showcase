/**
 * Public vocabulary for generator programs that describe regular expressions. Operations return
 * interpreter-produced fragments so programs can compose patterns incrementally.
 *
 * @module
 */

import { perform } from "@/core/free.ts";

/** Interpreter-produced fragment passed between regex operations inside a program. */
export type RegexFragment = Readonly<{ tag: "regex"; source: string }>;

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
