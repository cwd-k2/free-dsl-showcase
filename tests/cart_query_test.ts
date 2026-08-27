/** Integration and validation tests for the SQL language, interpreter, and renderer. */

import { cartContentsQuery } from "../examples/cart/query.ts";
import { primitiveCartContentsQuery } from "../examples/cart/sql-primitives.ts";
import {
  cartQueryPlanInterpreter,
  cartQuerySqlInterpreter,
  contentsOfCart,
} from "../src/domain/cart-query/mod.ts";
import { run } from "../src/core/free.ts";
import { sql, sqlInterpreter } from "../src/dsl/sql/mod.ts";
import { assertEquals, assertThrows } from "./assert.ts";

Deno.test("one use-case interpretation returns parameterized SQL", () => {
  const result = run(cartContentsQuery("cart-42", "user-7"), cartQuerySqlInterpreter());

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

Deno.test("cart contents query is inspectable before SQL lowering", () => {
  const plan = run(cartContentsQuery("cart-42", "user-7"), cartQueryPlanInterpreter());

  assertEquals(plan, {
    kind: "cart-contents",
    cartId: "cart-42",
    visibility: { kind: "owner", userId: "user-7" },
    presentation: { kind: "line-summary" },
    ordering: { kind: "product-name", direction: "ascending" },
    limit: 100,
  });
});

Deno.test("ordinary conditionals change the accumulated query plan", () => {
  const plan = run(
    cartContentsQuery("cart-42", "user-7", { alphabetical: false, limit: null }),
    cartQueryPlanInterpreter(),
  );

  assertEquals(plan, {
    kind: "cart-contents",
    cartId: "cart-42",
    visibility: { kind: "owner", userId: "user-7" },
    presentation: { kind: "line-summary" },
  });
});

Deno.test("domain plan and raw primitives lower to the same query", () => {
  const semantic = run(cartContentsQuery("cart-42", "user-7"), cartQuerySqlInterpreter());
  const primitive = run(primitiveCartContentsQuery("cart-42", "user-7"), sqlInterpreter());

  assertEquals(semantic, primitive);
});

Deno.test("cart use cases require visibility before they can be lowered", () => {
  function* insecureQuery() {
    const contents = yield* contentsOfCart("cart-42");
    yield* contents.describeEachLine();
  }

  assertThrows(
    () => run(insecureQuery(), cartQuerySqlInterpreter()),
    "Cart contents plan requires visibility",
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
