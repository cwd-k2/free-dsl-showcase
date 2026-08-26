import { type Program, run } from "../src/free.ts";
import { sql, sqlInterpreter } from "../src/sql.ts";
import { assertEquals, assertThrows } from "./assert.ts";

// The application program is a consumer of the SQL DSL, so it lives with its example test.
function* cartContentsQuery(cartId: string, userId: string): Program<void> {
  const {
    as: selectAs,
    binary,
    column,
    from,
    join,
    limit,
    orderBy,
    param,
    select,
    table,
    where,
  } = sql;

  const carts = yield* table("carts", "c");
  const items = yield* table("cart_items", "ci");
  const products = yield* table("products", "p");

  const cartPk = yield* column(carts, "id");
  const cartOwner = yield* column(carts, "user_id");
  const itemCartId = yield* column(items, "cart_id");
  const itemProductId = yield* column(items, "product_id");
  const quantity = yield* column(items, "quantity", "quantity");
  const productPk = yield* column(products, "id", "product_id");
  const productName = yield* column(products, "name", "product_name");
  const unitPrice = yield* column(products, "unit_price", "unit_price");

  const itemsInCart = yield* binary("=", itemCartId, cartPk);
  const itemProducts = yield* binary("=", productPk, itemProductId);
  yield* from(carts);
  yield* join("INNER", items, itemsInCart);
  yield* join("INNER", products, itemProducts);

  const requestedCart = yield* binary("=", cartPk, yield* param(cartId));
  const ownedByUser = yield* binary("=", cartOwner, yield* param(userId));
  yield* where(requestedCart);
  yield* where(ownedByUser);

  const subtotal = yield* binary("*", quantity, unitPrice);
  yield* select(
    productPk,
    productName,
    quantity,
    unitPrice,
    yield* selectAs(subtotal, "subtotal"),
  );
  yield* orderBy(productName);
  yield* limit(100);
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
