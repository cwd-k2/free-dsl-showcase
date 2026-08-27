/** Typed parser combinators backed by a reusable grammar tree and a backtracking parser. */

export type Pattern =
  | Readonly<{ kind: "text"; value: string }>
  | Readonly<{ kind: "characters"; characters: string }>
  | Readonly<{ kind: "sequence"; parts: readonly Pattern[] }>
  | Readonly<{ kind: "choice"; alternatives: readonly Pattern[] }>
  | Readonly<{ kind: "repeat"; pattern: Pattern; min: number; max?: number }>
  | Readonly<{ kind: "capture"; name: string; pattern: Pattern }>;

export type Captures = Readonly<Record<string, string>>;

export type Candidate<A> = Readonly<{
  position: number;
  value: A;
  captures: Captures;
}>;

export type ParseContext = {
  farthest: number;
  expected: Set<string>;
};

/** A parser carries both its structural grammar and its executable parsing behavior. */
export type Parser<A> = Readonly<{
  pattern: Pattern;
  parseAt: (input: string, position: number, context: ParseContext) => Candidate<A>[];
}>;

type ParserValue<P> = P extends Parser<infer A> ? A : never;
type SequenceValues<P extends readonly Parser<unknown>[]> = {
  -readonly [K in keyof P]: ParserValue<P[K]>;
};

function candidate<A>(position: number, value: A, captures: Captures = {}): Candidate<A> {
  return { position, value, captures };
}

function failed(context: ParseContext, position: number, expected: string): void {
  if (position > context.farthest) {
    context.farthest = position;
    context.expected.clear();
  }
  if (position === context.farthest) context.expected.add(expected);
}

function mergeCaptures(left: Captures, right: Captures): Captures {
  return { ...left, ...right };
}

export function text(value: string): Parser<string> {
  return {
    pattern: { kind: "text", value },
    parseAt: (input, position, context) => {
      if (input.startsWith(value, position)) return [candidate(position + value.length, value)];
      failed(context, position, JSON.stringify(value));
      return [];
    },
  };
}

export function oneOfCharacters(characters: string): Parser<string> {
  if ([...characters].length === 0) throw new Error("oneOfCharacters must not be empty");
  const allowed = new Set([...characters]);

  return {
    pattern: { kind: "characters", characters },
    parseAt: (input, position, context) => {
      const character = [...input.slice(position)][0];
      if (character !== undefined && allowed.has(character)) {
        return [candidate(position + character.length, character)];
      }
      failed(context, position, `one of ${JSON.stringify(characters)}`);
      return [];
    },
  };
}

export function sequence<const P extends readonly Parser<unknown>[]>(
  ...parsers: P
): Parser<SequenceValues<P>> {
  return {
    pattern: { kind: "sequence", parts: parsers.map((parser) => parser.pattern) },
    parseAt: (input, position, context) => {
      let candidates: Candidate<unknown[]>[] = [candidate(position, [])];

      for (const parser of parsers) {
        const next: Candidate<unknown[]>[] = [];

        for (const current of candidates) {
          for (const parsed of parser.parseAt(input, current.position, context)) {
            next.push(candidate(
              parsed.position,
              [...current.value, parsed.value],
              mergeCaptures(current.captures, parsed.captures),
            ));
          }
        }

        candidates = next;
        if (candidates.length === 0) break;
      }

      return candidates as Candidate<SequenceValues<P>>[];
    },
  };
}

export function choice<A>(...alternatives: readonly Parser<A>[]): Parser<A> {
  if (alternatives.length === 0) throw new Error("choice must not be empty");

  return {
    pattern: { kind: "choice", alternatives: alternatives.map((parser) => parser.pattern) },
    parseAt: (input, position, context) =>
      alternatives.flatMap((parser) => parser.parseAt(input, position, context)),
  };
}

export function repeated<A>(parser: Parser<A>, min: number, max?: number): Parser<A[]> {
  if (!Number.isSafeInteger(min) || min < 0) throw new Error(`Invalid repeat min: ${min}`);
  if (max !== undefined && (!Number.isSafeInteger(max) || max < min)) {
    throw new Error(`Invalid repeat max: ${max}`);
  }

  return {
    pattern: { kind: "repeat", pattern: parser.pattern, min, max },
    parseAt: (input, position, context) => {
      const results: Candidate<A[]>[] = [];

      const visit = (current: Candidate<A[]>, count: number): void => {
        if (max === undefined || count < max) {
          for (const parsed of parser.parseAt(input, current.position, context)) {
            // A zero-width parser cannot be repeated safely.
            if (parsed.position === current.position) continue;
            visit(
              candidate(
                parsed.position,
                [...current.value, parsed.value],
                mergeCaptures(current.captures, parsed.captures),
              ),
              count + 1,
            );
          }
        }

        // Add shorter candidates after longer ones to retain familiar greedy behavior.
        if (count >= min) results.push(current);
      };

      visit(candidate(position, []), 0);
      return results;
    },
  };
}

export function zeroOrMore<A>(parser: Parser<A>): Parser<A[]> {
  return repeated(parser, 0);
}

export function oneOrMore<A>(parser: Parser<A>): Parser<A[]> {
  return repeated(parser, 1);
}

export function between<A>(parser: Parser<A>, min: number, max: number): Parser<A[]> {
  return repeated(parser, min, max);
}

export function separatedBy<A, S>(parser: Parser<A>, separator: Parser<S>): Parser<A[]> {
  const following = map(sequence(separator, parser), ([_separator, value]) => value);
  return map(sequence(parser, zeroOrMore(following)), ([first, rest]) => [first, ...rest]);
}

export function named<A>(name: string, parser: Parser<A>): Parser<A> {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw new Error(`Invalid capture name: ${name}`);

  return {
    pattern: { kind: "capture", name, pattern: parser.pattern },
    parseAt: (input, position, context) =>
      parser.parseAt(input, position, context).map((parsed) =>
        candidate(parsed.position, parsed.value, {
          ...parsed.captures,
          [name]: input.slice(position, parsed.position),
        })
      ),
  };
}

/** Change a parser's result value without changing the grammar accepted or lowered to regex. */
export function map<A, B>(parser: Parser<A>, convert: (value: A) => B): Parser<B> {
  return {
    pattern: parser.pattern,
    parseAt: (input, position, context) =>
      parser.parseAt(input, position, context).map((parsed) =>
        candidate(parsed.position, convert(parsed.value), parsed.captures)
      ),
  };
}
