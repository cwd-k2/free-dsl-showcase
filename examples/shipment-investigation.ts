/**
 * Advanced example: a business procedure whose regex and SQL implementation stays below the API.
 *
 * @module
 */

import { type Program, run } from "@/core/free.ts";
import {
  beginOrderSearch,
  investigation,
  type InvestigationDecision,
  type InvestigationDetail,
  investigationInterpreter,
  type InvestigationOutput,
  type Operator,
  references,
} from "@/domain/shipment/mod.ts";

/**
 * Describe the investigation with normal control flow and domain words. Neither SQL nor regular
 * expressions are part of the procedure's vocabulary.
 */
export function* investigateShipment(
  input: string,
  operator: Operator,
  requestedDetails: InvestigationDetail[] = [],
): Program<InvestigationDecision> {
  const reference = yield* references.read(input);

  if (!reference) {
    return yield* investigation.reject("注文番号を読み取れません");
  }

  yield* investigation.note(
    `${reference.orderNumber} at ${reference.warehouse} に正規化`,
  );

  const search = yield* beginOrderSearch();
  yield* search.byReference(reference);
  yield* search.visibleTo(operator);

  // Business policy is expressed as an ordinary branch.
  if (operator.team === "fraud") {
    yield* investigation.note("fraud team のためリスク情報を追加");
    yield* search.include("risk");
  }

  // Callers can extend the projection without knowing which tables are needed.
  for (const detail of requestedDetails) {
    yield* search.include(detail);
  }

  if (reference.format === "legacy") {
    yield* investigation.note("旧形式の参照番号を使用");
  }

  yield* search.onlyActiveShipments();
  return yield* search.takeFirst(reference, operator);
}

export function formatInvestigation(result: InvestigationOutput, explain = false): string {
  const lines: string[] = [];

  if (result.decision.tag === "rejected") {
    lines.push("Investigation rejected", `  reason: ${result.decision.reason}`);
  } else {
    const { reference, visibility, details } = result.decision;
    lines.push(
      "Reference accepted",
      `  order:      ${reference.orderNumber}`,
      `  warehouse:  ${reference.warehouse}`,
      `  format:     ${reference.format}`,
      "",
      "Investigation plan",
      `  visibility: ${visibility}`,
      "  shipment:   active only",
      `  details:    ${details.join(", ") || "standard"}`,
      "  result:     newest match",
    );
  }

  if (!explain) return lines.join("\n");

  lines.push("", "Procedure");
  for (const entry of result.trace) lines.push(`  ✓ ${entry}`);
  lines.push("", "Compiled regex");
  for (const pattern of result.regex) lines.push(`  ${pattern.format}: ${pattern.source}`);

  if (result.sql) {
    lines.push("", "Compiled SQL", result.sql.text, "", "Parameters");
    lines.push(`  ${JSON.stringify(result.sql.params)}`);
  } else {
    lines.push("", "Compiled SQL", "  (not built: procedure returned early)");
  }

  return lines.join("\n");
}

if (import.meta.main) {
  const explain = Deno.args.includes("--explain");
  const role = Deno.args.includes("--admin") ? "admin" : "support";
  const team = Deno.args.includes("--fraud") ? "fraud" : "fulfillment";
  const input = Deno.args.find((arg) => !arg.startsWith("--")) ?? "TYO/ORD-2026-00421";
  const details = Deno.args
    .filter((arg) => arg.startsWith("--detail="))
    .map((arg) => arg.slice("--detail=".length))
    .filter((detail): detail is InvestigationDetail => detail === "customer" || detail === "risk");
  const operator: Operator = { role, team, regions: ["APAC", "JP"] };
  const result = run(investigateShipment(input, operator, details), investigationInterpreter());
  console.log(formatInvestigation(result, explain));
}
