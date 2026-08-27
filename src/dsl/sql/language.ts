/**
 * Public vocabulary and intermediate model for the SQL DSL. Functions in `sql` only describe
 * operations; the interpreter decides how those requests build a query.
 *
 * @module
 */

import { perform } from "../../core/free.ts";

/** A validated table reference used by column expressions and query clauses. */
export type TableRef = Readonly<{ tag: "table"; name: string; alias: string }>;

/** Expression nodes are data, allowing rendering to remain separate from program execution. */
export type SqlExpr =
  | Readonly<{ tag: "column"; table: TableRef; name: string; alias?: string }>
  | Readonly<{ tag: "param"; value: unknown }>
  | Readonly<{ tag: "binary"; op: SqlBinaryOp; left: SqlExpr; right: SqlExpr }>
  | Readonly<{ tag: "logical"; op: "AND" | "OR"; parts: SqlExpr[] }>;

export type SqlBinaryOp =
  | "="
  | "<>"
  | ">"
  | ">="
  | "<"
  | "<="
  | "+"
  | "-"
  | "*"
  | "/";
export type SelectItem = Readonly<{ expr: SqlExpr; alias?: string }>;
export type Selectable = SqlExpr | SelectItem;
export type Join = Readonly<{ type: "INNER" | "LEFT"; table: TableRef; on: SqlExpr }>;
export type OrderBy = Readonly<{ expr: SqlExpr; direction: "ASC" | "DESC" }>;

/** The query model accumulated while SQL operations are interpreted. */
export type QueryState = {
  from?: TableRef;
  joins: Join[];
  where: SqlExpr[];
  select: SelectItem[];
  orderBy: OrderBy[];
  limit?: number;
};

/** Rendered SQL plus its separately bound values. */
export type Sql = { text: string; params: unknown[] };

/** Operations available inside a SQL generator program. */
export const sql = {
  table: (name: string, alias: string) => perform<TableRef>("sql.table", { name, alias }),
  column: (table: TableRef, name: string, alias?: string) =>
    perform<SqlExpr>("sql.column", { table, name, alias }),
  param: <A>(value: A) => perform<SqlExpr>("sql.param", { value }),
  binary: (op: SqlBinaryOp, left: SqlExpr, right: SqlExpr) =>
    perform<SqlExpr>("sql.binary", { op, left, right }),
  and: (...parts: SqlExpr[]) => perform<SqlExpr>("sql.logical", { op: "AND", parts }),
  or: (...parts: SqlExpr[]) => perform<SqlExpr>("sql.logical", { op: "OR", parts }),
  as: (expr: SqlExpr, alias?: string) => perform<SelectItem>("sql.as", { expr, alias }),
  from: (table: TableRef) => perform<void>("sql.from", { table }),
  join: (type: "INNER" | "LEFT", table: TableRef, on: SqlExpr) =>
    perform<void>("sql.join", { type, table, on }),
  where: (expr: SqlExpr) => perform<void>("sql.where", { expr }),
  select: (...items: Selectable[]) => perform<void>("sql.select", { items }),
  orderBy: (expr: SqlExpr, direction: "ASC" | "DESC" = "ASC") =>
    perform<void>("sql.orderBy", { expr, direction }),
  limit: (count: number) => perform<void>("sql.limit", { count }),
};
