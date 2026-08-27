/**
 * Minimal machinery for describing effectful programs as generators and running them with
 * pluggable interpreters. DSL modules build their operations on this deliberately small core.
 *
 * @module
 */

/** An operation whose result type is carried only at the type level. */
export type Op<A = unknown> = Readonly<{
  kind: string;
  payload: unknown;
  // This phantom field connects perform<A>() to its resume value without existing at runtime.
  readonly __result?: A;
}>;

/** A generator program that suspends at each operation. */
export type Program<A> = Generator<Op<unknown>, A, unknown>;

/**
 * Suspend the current program with an operation request.
 * The interpreter's handler result becomes the value returned by `yield* perform(...)`.
 */
export function* perform<A>(kind: string, payload: unknown = undefined): Program<A> {
  return (yield { kind, payload } as Op<unknown>) as A;
}

/** The new interpreter state and the value used to resume a suspended program. */
export type Step<S> = { state: S; value: unknown };

// Payload types are owned by each DSL and checked at its public construction API.
// The generic runner therefore keeps this dynamic dispatch boundary intentionally open.
// deno-lint-ignore no-explicit-any
export type Handler<S> = (state: S, payload: any) => Step<S>;

export type Awaitable<A> = A | PromiseLike<A>;

// deno-lint-ignore no-explicit-any
export type AsyncHandler<S> = (state: S, payload: any) => Awaitable<Step<S>>;

/** Everything needed to give operations meaning and turn a finished program into output. */
export type Interpreter<S, Out> = {
  initial: () => S;
  handlers: Record<string, Handler<S>>;
  finish: (state: S, returnValue: unknown) => Out;
};

/** An interpreter whose setup, handlers, and finalization may cross async I/O boundaries. */
export type AsyncInterpreter<S, Out> = {
  initial: () => Awaitable<S>;
  handlers: Record<string, AsyncHandler<S>>;
  finish: (state: S, returnValue: unknown) => Awaitable<Out>;
};

/** Interpret a generator program by dispatching operations and feeding handler values back in. */
export function run<A, S, Out>(program: Program<A>, interpreter: Interpreter<S, Out>): Out {
  let state = interpreter.initial();
  let step = program.next();

  while (!step.done) {
    const op = step.value;
    const handler = interpreter.handlers[op.kind];
    if (!handler) throw new Error(`Unhandled op: ${op.kind}`);

    const handled = handler(state, op.payload);
    state = handled.state;
    // next(value) makes the suspended `yield` expression evaluate to the handler result.
    step = program.next(handled.value);
  }

  return interpreter.finish(state, step.value);
}

/**
 * Run the same Generator program while awaiting asynchronous interpreter boundaries. The DSL
 * remains synchronous-looking; the selected interpreter decides whether an operation needs I/O.
 */
export async function runAsync<A, S, Out>(
  program: Program<A>,
  interpreter: AsyncInterpreter<S, Out>,
): Promise<Out> {
  let state = (await interpreter.initial()) as S;
  let step = program.next();

  while (!step.done) {
    const op = step.value;
    const handler = interpreter.handlers[op.kind];
    if (!handler) throw new Error(`Unhandled op: ${op.kind}`);

    const handled = await handler(state, op.payload);
    state = handled.state;
    step = program.next(handled.value);
  }

  return await interpreter.finish(state, step.value);
}
