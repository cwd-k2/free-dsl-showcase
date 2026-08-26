/** Compile accepted business reference formats through the lower-level regex DSL. */

import { type Program, run } from "../free.ts";
import {
  compactRegexSourceInterpreter,
  regex,
  type RegexFragment,
  regexInterpreter,
} from "../regex/mod.ts";
import type { OrderReference, ReferenceFormat, Warehouse } from "./language.ts";

export type ReferencePolicy = Readonly<{
  warehouses: Warehouse[];
  acceptOrderFirst: boolean;
  acceptLegacy: boolean;
}>;

export const defaultReferencePolicy: ReferencePolicy = {
  warehouses: ["TYO", "OSA", "FUK"],
  acceptOrderFirst: true,
  acceptLegacy: true,
};

export type CompiledReferencePattern = Readonly<{
  format: ReferenceFormat;
  source: string;
  regexp: RegExp;
}>;

function* oneOf(values: readonly string[]): Program<RegexFragment> {
  const choices: RegexFragment[] = [];
  for (const value of values) choices.push(yield* regex.literal(value));
  return yield* regex.alt(...choices);
}

/** The format branch and warehouse loop are ordinary TypeScript control flow. */
export function* orderReferencePattern(
  format: ReferenceFormat,
  warehouses: readonly Warehouse[],
): Program<RegexFragment> {
  const digits = yield* regex.charSet("0123456789");
  const warehouse = yield* regex.capture("warehouse", yield* oneOf(warehouses));

  if (format === "legacy") {
    const serial = yield* regex.capture("serial", yield* regex.repeat(digits, 5, 5));
    return yield* regex.seq(serial, yield* regex.literal("-"), warehouse);
  }

  const year = yield* regex.repeat(digits, 4, 4);
  const serial = yield* regex.repeat(digits, 5, 5);
  const order = yield* regex.capture(
    "order",
    yield* regex.seq(yield* regex.literal("ORD-"), year, yield* regex.literal("-"), serial),
  );

  if (format === "warehouse-first") {
    return yield* regex.seq(warehouse, yield* regex.literal("/"), order);
  }
  return yield* regex.seq(order, yield* regex.literal("@"), warehouse);
}

/** Compile only the formats enabled by policy, retaining sources for explain output. */
export function compileReferencePatterns(
  policy: ReferencePolicy = defaultReferencePolicy,
): CompiledReferencePattern[] {
  const formats: ReferenceFormat[] = ["warehouse-first"];
  if (policy.acceptOrderFirst) formats.push("order-first");
  if (policy.acceptLegacy) formats.push("legacy");

  return formats.map((format) => ({
    format,
    source: run(
      orderReferencePattern(format, policy.warehouses),
      compactRegexSourceInterpreter(),
    ),
    regexp: run(orderReferencePattern(format, policy.warehouses), regexInterpreter()),
  }));
}

/** Try each accepted format and normalize its captures into one domain value. */
export function readOrderReference(
  input: string,
  patterns = compileReferencePatterns(),
): OrderReference | null {
  for (const pattern of patterns) {
    const groups = pattern.regexp.exec(input)?.groups;
    if (!groups) continue;

    const warehouse = groups.warehouse as Warehouse;
    const orderNumber = pattern.format === "legacy" ? `ORD-${groups.serial}` : groups.order;
    return { orderNumber, warehouse, format: pattern.format };
  }
  return null;
}
