/** An operation whose result type is carried only at the type level. */
export type Op<A = unknown> = Readonly<{
  kind: string;
  payload: unknown;
  readonly __result?: A;
}>;

/** A generator program that suspends at each operation. */
export type Program<A> = Generator<Op<unknown>, A, unknown>;

/** Request an operation from the interpreter running the program. */
export function* perform<A>(kind: string, payload: unknown = undefined): Program<A> {
  return (yield { kind, payload } as Op<unknown>) as A;
}

export type Step<S> = { state: S; value: unknown };
// Payload types are owned by each DSL and checked at its public construction API.
// deno-lint-ignore no-explicit-any
export type Handler<S> = (state: S, payload: any) => Step<S>;

export type Interpreter<S, Out> = {
  initial: () => S;
  handlers: Record<string, Handler<S>>;
  finish: (state: S, returnValue: unknown) => Out;
};

/** Interpret a generator program by feeding each handler result back into it. */
export function run<A, S, Out>(program: Program<A>, interpreter: Interpreter<S, Out>): Out {
  let state = interpreter.initial();
  let step = program.next();

  while (!step.done) {
    const op = step.value;
    const handler = interpreter.handlers[op.kind];
    if (!handler) throw new Error(`Unhandled op: ${op.kind}`);

    const handled = handler(state, op.payload);
    state = handled.state;
    step = program.next(handled.value);
  }

  return interpreter.finish(state, step.value);
}
