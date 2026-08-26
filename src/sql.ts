import { type Interpreter, perform } from "./free.ts";

export type TableRef = Readonly<{ tag: "table"; name: string; alias: string }>;
export type SqlExpr =
  | Readonly<{ tag: "column"; table: TableRef; name: string }>
  | Readonly<{ tag: "param"; value: unknown }>
  | Readonly<{ tag: "binary"; op: SqlBinaryOp; left: SqlExpr; right: SqlExpr }>;

export type SqlBinaryOp = "=" | "<>" | ">" | ">=" | "<" | "<=" | "+" | "-" | "*" | "/";
export type SelectItem = Readonly<{ expr: SqlExpr; alias?: string }>;
type Join = Readonly<{ type: "INNER" | "LEFT"; table: TableRef; on: SqlExpr }>;
type OrderBy = Readonly<{ expr: SqlExpr; direction: "ASC" | "DESC" }>;

export type QueryState = {
  from?: TableRef;
  joins: Join[];
  where: SqlExpr[];
  select: SelectItem[];
  orderBy: OrderBy[];
  limit?: number;
};

export type Sql = { text: string; params: unknown[] };

/** Operations available inside a SQL generator program. */
export const sql = {
  table: (name: string, alias: string) => perform<TableRef>("sql.table", { name, alias }),
  column: (table: TableRef, name: string) => perform<SqlExpr>("sql.column", { table, name }),
  param: <A>(value: A) => perform<SqlExpr>("sql.param", { value }),
  binary: (op: SqlBinaryOp, left: SqlExpr, right: SqlExpr) =>
    perform<SqlExpr>("sql.binary", { op, left, right }),
  as: (expr: SqlExpr, alias?: string) => perform<SelectItem>("sql.as", { expr, alias }),
  from: (table: TableRef) => perform<void>("sql.from", { table }),
  join: (type: "INNER" | "LEFT", table: TableRef, on: SqlExpr) =>
    perform<void>("sql.join", { type, table, on }),
  where: (expr: SqlExpr) => perform<void>("sql.where", { expr }),
  select: (...items: SelectItem[]) => perform<void>("sql.select", { items }),
  orderBy: (expr: SqlExpr, direction: "ASC" | "DESC" = "ASC") =>
    perform<void>("sql.orderBy", { expr, direction }),
  limit: (count: number) => perform<void>("sql.limit", { count }),
};

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;

function assertIdent(value: string, label = "identifier"): void {
  if (!IDENT.test(value)) throw new Error(`Invalid SQL ${label}: ${value}`);
}

function quoteIdent(value: string): string {
  assertIdent(value);
  return `"${value}"`;
}

function quoteQualified(value: string): string {
  return value.split(".").map(quoteIdent).join(".");
}

function renderSql(state: QueryState): Sql {
  if (!state.from) throw new Error("SQL query has no FROM");
  if (state.select.length === 0) throw new Error("SQL query has no SELECT list");

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

export function sqlInterpreter(): Interpreter<QueryState, Sql> {
  return {
    initial: () => ({ joins: [], where: [], select: [], orderBy: [] }),
    handlers: {
      "sql.table": (state, { name, alias }) => {
        name.split(".").forEach((part: string) => assertIdent(part, "table name"));
        assertIdent(alias, "table alias");
        return { state, value: { tag: "table", name, alias } satisfies TableRef };
      },
      "sql.column": (state, { table, name }) => {
        assertIdent(name, "column name");
        return { state, value: { tag: "column", table, name } satisfies SqlExpr };
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
        state: { ...state, select: items },
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
