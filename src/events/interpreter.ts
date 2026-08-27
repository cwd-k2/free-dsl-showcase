/** Deterministic replay and runtime-backed interpreters for event-processing programs. */

import type { AsyncInterpreter, Awaitable, Interpreter } from "../free.ts";
import type { Event } from "./language.ts";

export type ReplayState<EIn extends Event, EOut extends Event> = {
  pending: EIn[];
  consumed: EIn[];
  published: EOut[];
};

export type ReplayResult<EIn extends Event, EOut extends Event, A> = ReplayState<EIn, EOut> & {
  value: A;
};

/** Run a finite event history and retain every observation as testable data. */
export function replayInterpreter<EIn extends Event, EOut extends Event, A>(
  input: readonly EIn[],
): Interpreter<ReplayState<EIn, EOut>, ReplayResult<EIn, EOut, A>> {
  return {
    initial: () => ({ pending: [...input], consumed: [], published: [] }),
    handlers: {
      "events.next": (state) => {
        const [event, ...pending] = state.pending;
        return event === undefined ? { state, value: null } : {
          state: { ...state, pending, consumed: [...state.consumed, event] },
          value: event,
        };
      },
      "events.publish": (state, { event }) => ({
        state: { ...state, published: [...state.published, event as EOut] },
        value: undefined,
      }),
    },
    finish: (state, value) => ({ ...state, value: value as A }),
  };
}

/** Minimal synchronous boundary that a queue, broker adapter, or test double can implement. */
export type EventRuntime<EIn extends Event, EOut extends Event> = {
  receive: () => EIn | null;
  publish: (event: EOut) => void;
};

/** Host the same processor on an external event runtime. */
export function eventRuntimeInterpreter<EIn extends Event, EOut extends Event, A>(
  runtime: EventRuntime<EIn, EOut>,
): Interpreter<null, A> {
  return {
    initial: () => null,
    handlers: {
      "events.next": (state) => ({ state, value: runtime.receive() }),
      "events.publish": (state, { event }) => {
        runtime.publish(event as EOut);
        return { state, value: undefined };
      },
    },
    finish: (_state, value) => value as A,
  };
}

/** Promise-based boundary for queues and brokers whose receive/publish operations perform I/O. */
export type AsyncEventRuntime<EIn extends Event, EOut extends Event> = {
  receive: () => Awaitable<EIn | null>;
  publish: (event: EOut) => Awaitable<void>;
};

/** Host an unchanged event processor on an asynchronous queue or broker adapter. */
export function asyncEventRuntimeInterpreter<EIn extends Event, EOut extends Event, A>(
  runtime: AsyncEventRuntime<EIn, EOut>,
): AsyncInterpreter<null, A> {
  return {
    initial: () => null,
    handlers: {
      "events.next": async (state) => ({ state, value: await runtime.receive() }),
      "events.publish": async (state, { event }) => {
        await runtime.publish(event as EOut);
        return { state, value: undefined };
      },
    },
    finish: (_state, value) => value as A,
  };
}
