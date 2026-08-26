/**
 * Stable public entry point for the SQL DSL; internal responsibilities remain in separate modules.
 *
 * @module
 */

export { sql } from "./language.ts";
export type {
  QueryState,
  Selectable,
  SelectItem,
  Sql,
  SqlBinaryOp,
  SqlExpr,
  TableRef,
} from "./language.ts";
export { sqlInterpreter } from "./interpreter.ts";
