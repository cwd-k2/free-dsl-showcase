/** A cart process whose control flow is hosted by the event-system DSL. */

import { asyncEventRuntimeInterpreter, events, replayInterpreter } from "../src/events/mod.ts";
import { type Program, run, runAsync } from "../src/free.ts";

export type CartEvent =
  | Readonly<{ type: "item-added"; sku: string; quantity: number }>
  | Readonly<{ type: "item-removed"; sku: string }>
  | Readonly<{ type: "checkout-requested" }>;

export type CartOutput =
  | Readonly<{ type: "cart-changed"; totalItems: number }>
  | Readonly<{ type: "item-rejected"; sku: string; reason: string }>
  | Readonly<{ type: "checkout-accepted"; lines: readonly CartLine[] }>
  | Readonly<{ type: "checkout-rejected"; reason: string }>;

export type CartLine = Readonly<{ sku: string; quantity: number }>;
export type CartSnapshot = Readonly<{ status: "open" | "checked-out"; lines: readonly CartLine[] }>;

function snapshot(
  items: ReadonlyMap<string, number>,
  status: CartSnapshot["status"],
): CartSnapshot {
  return {
    status,
    lines: [...items].map(([sku, quantity]) => ({ sku, quantity })),
  };
}

function totalItems(items: ReadonlyMap<string, number>): number {
  return [...items.values()].reduce((sum, quantity) => sum + quantity, 0);
}

/**
 * Wait for events, update local process state, and publish facts. Branches, a loop, and early
 * completion are ordinary TypeScript rather than concepts baked into the interpreter.
 */
export function* cartProcess(): Program<CartSnapshot> {
  const items = new Map<string, number>();

  while (true) {
    const event = yield* events.next<CartEvent>();
    if (event === null) return snapshot(items, "open");

    switch (event.type) {
      case "item-added": {
        // Invalid domain input produces a fact; it does not crash the event runtime.
        if (!Number.isSafeInteger(event.quantity) || event.quantity <= 0) {
          yield* events.publish<CartOutput>({
            type: "item-rejected",
            sku: event.sku,
            reason: "quantity must be a positive integer",
          });
          break;
        }

        // Apply the transition, then announce the new observable state.
        items.set(event.sku, (items.get(event.sku) ?? 0) + event.quantity);

        yield* events.publish<CartOutput>({
          type: "cart-changed",
          totalItems: totalItems(items),
        });
        break;
      }

      case "item-removed": {
        items.delete(event.sku);

        yield* events.publish<CartOutput>({
          type: "cart-changed",
          totalItems: totalItems(items),
        });
        break;
      }

      case "checkout-requested": {
        if (items.size === 0) {
          yield* events.publish<CartOutput>({ type: "checkout-rejected", reason: "cart is empty" });
          break;
        }

        const result = snapshot(items, "checked-out");
        yield* events.publish<CartOutput>({ type: "checkout-accepted", lines: result.lines });

        return result;
      }
    }
  }
}

export const sampleEvents: readonly CartEvent[] = [
  { type: "item-added", sku: "keyboard", quantity: 1 },
  { type: "item-added", sku: "cable", quantity: 2 },
  { type: "checkout-requested" },
];

/** A tiny Promise-based adapter standing in for an async queue or broker client. */
export async function runOnAsyncQueue(input: readonly CartEvent[]): Promise<{
  value: CartSnapshot;
  published: CartOutput[];
}> {
  const pending = [...input];
  const published: CartOutput[] = [];

  const value = await runAsync(
    cartProcess(),
    asyncEventRuntimeInterpreter<CartEvent, CartOutput, CartSnapshot>({
      receive: () => Promise.resolve(pending.shift() ?? null),
      publish: (event) => {
        published.push(event);
        return Promise.resolve();
      },
    }),
  );

  return { value, published };
}

if (import.meta.main) {
  const replay = run(
    cartProcess(),
    replayInterpreter<CartEvent, CartOutput, CartSnapshot>(sampleEvents),
  );

  console.log("Replay interpreter");
  console.log(JSON.stringify(replay, null, 2));

  console.log("\nAsync runtime interpreter");
  console.log(JSON.stringify(await runOnAsyncQueue(sampleEvents), null, 2));
}
