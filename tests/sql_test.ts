import { type Program, run } from "../src/free.ts";
import { sql, sqlInterpreter } from "../src/sql.ts";
import { assertEquals, assertThrows } from "./assert.ts";

// The application program is a consumer of the SQL DSL, so it lives with its example test.
function* cartContentsQuery(cartId: string, userId: string): Program<void> {
  const carts = yield* sql.table("carts", "c");
  const items = yield* sql.table("cart_items", "ci");
  const products = yield* sql.table("products", "p");

  const cartPk = yield* sql.column(carts, "id");
  const cartOwner = yield* sql.column(carts, "user_id");
  const itemCartId = yield* sql.column(items, "cart_id");
  const itemProductId = yield* sql.column(items, "product_id");
  const quantity = yield* sql.column(items, "quantity");
  const productPk = yield* sql.column(products, "id");
  const productName = yield* sql.column(products, "name");
  const unitPrice = yield* sql.column(products, "unit_price");

  yield* sql.from(carts);
  yield* sql.join("INNER", items, yield* sql.binary("=", itemCartId, cartPk));
  yield* sql.join("INNER", products, yield* sql.binary("=", productPk, itemProductId));
  yield* sql.where(yield* sql.binary("=", cartPk, yield* sql.param(cartId)));
  yield* sql.where(yield* sql.binary("=", cartOwner, yield* sql.param(userId)));

  const subtotal = yield* sql.binary("*", quantity, unitPrice);
  yield* sql.select(
    yield* sql.as(productPk, "product_id"),
    yield* sql.as(productName, "product_name"),
    yield* sql.as(quantity, "quantity"),
    yield* sql.as(unitPrice, "unit_price"),
    yield* sql.as(subtotal, "subtotal"),
  );
  yield* sql.orderBy(productName);
  yield* sql.limit(100);
}

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

Deno.test("SQL limit must be a non-negative safe integer", () => {
  function* invalidQuery() {
    yield* sql.limit(-1);
  }

  assertThrows(() => run(invalidQuery(), sqlInterpreter()), "Invalid LIMIT: -1");
});
