/**
 * Interpreter for the SQL language. Value-producing operations create model nodes, while clause
 * operations accumulate those nodes in QueryState; rendering is delegated to `render.ts`.
 *
 * @module
 */

import type { Interpreter } from "../free.ts";
import type { QueryState, Selectable, SelectItem, Sql, SqlExpr, TableRef } from "./language.ts";
import { assertIdent, renderSql } from "./render.ts";

/** Interpret SQL operations by accumulating a query model, then render it. */
export function sqlInterpreter(): Interpreter<QueryState, Sql> {
  return {
    initial: () => ({ joins: [], where: [], select: [], orderBy: [] }),
    handlers: {
      // These handlers return references or expression nodes to the suspended generator.
      "sql.table": (state, { name, alias }) => {
        name.split(".").forEach((part: string) => assertIdent(part, "table name"));
        assertIdent(alias, "table alias");
        return { state, value: { tag: "table", name, alias } satisfies TableRef };
      },
      "sql.column": (state, { table, name, alias }) => {
        assertIdent(name, "column name");
        if (alias !== undefined) assertIdent(alias, "column alias");
        return { state, value: { tag: "column", table, name, alias } satisfies SqlExpr };
      },
      "sql.param": (state, { value }) => ({
        state,
        value: { tag: "param", value } satisfies SqlExpr,
      }),
      "sql.binary": (state, { op, left, right }) => ({
        state,
        value: { tag: "binary", op, left, right } satisfies SqlExpr,
      }),
      "sql.as": (state, { expr, alias }) => {
        if (alias !== undefined) assertIdent(alias, "select alias");
        return { state, value: { expr, alias } satisfies SelectItem };
      },

      // Clause operations return no useful value; their meaning is the QueryState transition.
      "sql.from": (state, { table }) => {
        if (state.from) throw new Error("FROM is already set");
        return { state: { ...state, from: table }, value: undefined };
      },
      "sql.join": (state, join) => ({
        state: { ...state, joins: [...state.joins, join] },
        value: undefined,
      }),
      "sql.where": (state, { expr }) => ({
        state: { ...state, where: [...state.where, expr] },
        value: undefined,
      }),
      "sql.select": (state, { items }) => ({
        state: {
          ...state,
          // Plain column expressions carry a convenient default alias; `sql.as` stays explicit.
          select: items.map((item: Selectable) =>
            "expr" in item
              ? item
              : { expr: item, alias: item.tag === "column" ? item.alias : undefined }
          ),
        },
        value: undefined,
      }),
      "sql.orderBy": (state, order) => ({
        state: { ...state, orderBy: [...state.orderBy, order] },
        value: undefined,
      }),
      "sql.limit": (state, { count }) => {
        if (!Number.isSafeInteger(count) || count < 0) throw new Error(`Invalid LIMIT: ${count}`);
        return { state: { ...state, limit: count }, value: undefined };
      },
    },
    finish: (state) => renderSql(state),
  };
}
