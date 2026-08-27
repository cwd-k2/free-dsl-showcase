/**
 * Pure rendering and identifier-validation rules for the SQL query model. Values become numbered
 * placeholders here so user data is never interpolated into the SQL text.
 *
 * @module
 */

import type { QueryState, Sql, SqlExpr, TableRef } from "./language.ts";

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Reject identifiers outside the intentionally small portable subset accepted by this DSL. */
export function assertIdent(value: string, label = "identifier"): void {
  if (!IDENT.test(value)) throw new Error(`Invalid SQL ${label}: ${value}`);
}

function quoteIdent(value: string): string {
  assertIdent(value);
  return `"${value}"`;
}

function quoteQualified(value: string): string {
  // Dots separate schema/table components; each component must be quoted independently.
  return value.split(".").map(quoteIdent).join(".");
}

/** Render a completed query model as parameterized PostgreSQL-style SQL. */
export function renderSql(state: QueryState): Sql {
  if (!state.from) throw new Error("SQL query has no FROM");
  if (state.select.length === 0) throw new Error("SQL query has no SELECT list");

  // Parameters are collected in render traversal order, which also determines $1, $2, ... labels.
  const params: unknown[] = [];
  const table = (value: TableRef) => `${quoteQualified(value.name)} AS ${quoteIdent(value.alias)}`;
  const expr = (value: SqlExpr): string => {
    switch (value.tag) {
      case "column":
        return `${quoteIdent(value.table.alias)}.${quoteIdent(value.name)}`;
      case "param":
        params.push(value.value);
        return `$${params.length}`;
      case "binary":
        return `(${expr(value.left)} ${value.op} ${expr(value.right)})`;
      case "logical":
        if (value.parts.length === 0) throw new Error(`${value.op} requires at least one operand`);
        return `(${value.parts.map(expr).join(` ${value.op} `)})`;
    }
  };

  const select = state.select
    .map((item) => `${expr(item.expr)}${item.alias ? ` AS ${quoteIdent(item.alias)}` : ""}`)
    .join(",\n  ");
  const lines = [
    `SELECT\n  ${select}`,
    `FROM ${table(state.from)}`,
    ...state.joins.map((join) => `${join.type} JOIN ${table(join.table)} ON ${expr(join.on)}`),
  ];

  if (state.where.length) lines.push(`WHERE ${state.where.map(expr).join(" AND ")}`);
  if (state.orderBy.length) {
    lines.push(
      `ORDER BY ${
        state.orderBy.map((order) => `${expr(order.expr)} ${order.direction}`).join(", ")
      }`,
    );
  }
  if (state.limit !== undefined) lines.push(`LIMIT ${state.limit}`);

  return { text: lines.join("\n"), params };
}
