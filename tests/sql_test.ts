/** Integration and validation tests for the SQL language, interpreter, and renderer. */

import { cartContentsQuery } from "../examples/sql.ts";
import { run } from "../src/free.ts";
import { sql, sqlInterpreter } from "../src/sql/mod.ts";
import { assertEquals, assertThrows } from "./assert.ts";

Deno.test("cart contents program renders parameterized SQL", () => {
  const result = run(cartContentsQuery("cart-42", "user-7"), sqlInterpreter());

  assertEquals(result.params, ["cart-42", "user-7"]);
  assertEquals(
    result.text,
    `SELECT
  "p"."id" AS "product_id",
  "p"."name" AS "product_name",
  "ci"."quantity" AS "quantity",
  "p"."unit_price" AS "unit_price",
  ("ci"."quantity" * "p"."unit_price") AS "subtotal"
FROM "carts" AS "c"
INNER JOIN "cart_items" AS "ci" ON ("ci"."cart_id" = "c"."id")
INNER JOIN "products" AS "p" ON ("p"."id" = "ci"."product_id")
WHERE ("c"."id" = $1) AND ("c"."user_id" = $2)
ORDER BY "p"."name" ASC
LIMIT 100`,
  );
});

Deno.test("SQL identifiers cannot inject raw SQL", () => {
  function* invalidQuery() {
    yield* sql.table("users; DROP TABLE users", "u");
  }

  assertThrows(
    () => run(invalidQuery(), sqlInterpreter()),
    "Invalid SQL table name",
  );
});

Deno.test("SQL column aliases cannot inject raw SQL", () => {
  function* invalidQuery() {
    const users = yield* sql.table("users", "u");
    yield* sql.column(users, "name", 'name" FROM secrets; --');
  }

  assertThrows(
    () => run(invalidQuery(), sqlInterpreter()),
    "Invalid SQL column alias",
  );
});

Deno.test("SQL limit must be a non-negative safe integer", () => {
  function* invalidQuery() {
    yield* sql.limit(-1);
  }

  assertThrows(() => run(invalidQuery(), sqlInterpreter()), "Invalid LIMIT: -1");
});
