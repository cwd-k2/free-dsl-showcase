/** Event replay, process control flow, and runtime-boundary tests. */

import {
  type CartEvent,
  type CartOutput,
  cartProcess,
  type CartSnapshot,
  runOnAsyncQueue,
} from "../examples/events.ts";
import { run } from "@/core/free.ts";
import { eventRuntimeInterpreter, replayInterpreter } from "@/dsl/events/mod.ts";
import { assertEquals } from "./assert.ts";

Deno.test("cart process deterministically replays an event history", () => {
  const input: CartEvent[] = [
    { type: "item-added", sku: "keyboard", quantity: 1 },
    { type: "item-added", sku: "cable", quantity: 2 },
    { type: "item-removed", sku: "keyboard" },
    { type: "checkout-requested" },
    { type: "item-added", sku: "ignored-after-checkout", quantity: 1 },
  ];
  const result = run(
    cartProcess(),
    replayInterpreter<CartEvent, CartOutput, CartSnapshot>(input),
  );

  assertEquals(result.value, {
    status: "checked-out",
    lines: [{ sku: "cable", quantity: 2 }],
  });
  assertEquals(result.pending, [{
    type: "item-added",
    sku: "ignored-after-checkout",
    quantity: 1,
  }]);
  assertEquals(result.published, [
    { type: "cart-changed", totalItems: 1 },
    { type: "cart-changed", totalItems: 3 },
    { type: "cart-changed", totalItems: 2 },
    { type: "checkout-accepted", lines: [{ sku: "cable", quantity: 2 }] },
  ]);
});

Deno.test("invalid input is an event outcome rather than an interpreter error", () => {
  const result = run(
    cartProcess(),
    replayInterpreter<CartEvent, CartOutput, CartSnapshot>([
      { type: "item-added", sku: "cable", quantity: 0 },
    ]),
  );
  assertEquals(result.value, { status: "open", lines: [] });
  assertEquals(result.published, [
    { type: "item-rejected", sku: "cable", reason: "quantity must be a positive integer" },
  ]);
});

Deno.test("the same processor can run behind an event runtime boundary", () => {
  const input: CartEvent[] = [
    { type: "item-added", sku: "dock", quantity: 1 },
    { type: "checkout-requested" },
  ];
  const output: CartOutput[] = [];
  const result = run(
    cartProcess(),
    eventRuntimeInterpreter<CartEvent, CartOutput, CartSnapshot>({
      receive: () => input.shift() ?? null,
      publish: (event) => output.push(event),
    }),
  );

  assertEquals(result, { status: "checked-out", lines: [{ sku: "dock", quantity: 1 }] });
  assertEquals(output, [
    { type: "cart-changed", totalItems: 1 },
    { type: "checkout-accepted", lines: [{ sku: "dock", quantity: 1 }] },
  ]);
});

Deno.test("the unchanged processor can await an asynchronous queue boundary", async () => {
  const result = await runOnAsyncQueue([
    { type: "item-added", sku: "keyboard", quantity: 2 },
    { type: "checkout-requested" },
  ]);

  assertEquals(result, {
    value: {
      status: "checked-out",
      lines: [{ sku: "keyboard", quantity: 2 }],
    },
    published: [
      { type: "cart-changed", totalItems: 2 },
      { type: "checkout-accepted", lines: [{ sku: "keyboard", quantity: 2 }] },
    ],
  });
});
