/**
 * The cart-contents query built directly from the low-level SQL DSL. This intentionally verbose
 * version is a comparison point for the domain-oriented program in `sql.ts`, not the recommended
 * style for application code.
 *
 * @module
 */

import { type Program, run } from "../src/free.ts";
import { sql, sqlInterpreter } from "../src/sql/mod.ts";

/** Build the same query as `cartContentsQuery`, using only raw SQL DSL primitives. */
export function* primitiveCartContentsQuery(cartId: string, userId: string): Program<void> {
  const carts = yield* sql.table("carts", "c");
  const items = yield* sql.table("cart_items", "ci");
  const products = yield* sql.table("products", "p");

  const cartPk = yield* sql.column(carts, "id");
  const cartOwner = yield* sql.column(carts, "user_id");
  const itemCartId = yield* sql.column(items, "cart_id");
  const itemProductId = yield* sql.column(items, "product_id");
  const quantity = yield* sql.column(items, "quantity", "quantity");
  const productPk = yield* sql.column(products, "id", "product_id");
  const productName = yield* sql.column(products, "name", "product_name");
  const unitPrice = yield* sql.column(products, "unit_price", "unit_price");

  yield* sql.from(carts);
  yield* sql.join("INNER", items, yield* sql.binary("=", itemCartId, cartPk));
  yield* sql.join("INNER", products, yield* sql.binary("=", productPk, itemProductId));
  yield* sql.where(yield* sql.binary("=", cartPk, yield* sql.param(cartId)));
  yield* sql.where(yield* sql.binary("=", cartOwner, yield* sql.param(userId)));

  const subtotal = yield* sql.binary("*", quantity, unitPrice);
  yield* sql.select(
    productPk,
    productName,
    quantity,
    unitPrice,
    yield* sql.as(subtotal, "subtotal"),
  );
  yield* sql.orderBy(productName);
  yield* sql.limit(100);
}

if (import.meta.main) {
  const [cartId = "cart-42", userId = "user-7"] = Deno.args;
  const query = run(primitiveCartContentsQuery(cartId, userId), sqlInterpreter());
  console.log(query.text);
  console.log(`\nparams: ${JSON.stringify(query.params)}`);
}
