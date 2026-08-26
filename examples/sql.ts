/**
 * Example SQL program for a cart-contents query. It describes the query with DSL operations and
 * only chooses the SQL interpreter at the executable boundary.
 *
 * @module
 */

import { type Program, run } from "../src/free.ts";
import { sql, sqlInterpreter } from "../src/sql/mod.ts";

/** A parameterized query built only from the SQL DSL operations. */
export function* cartContentsQuery(cartId: string, userId: string): Program<void> {
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

  yield* from(carts);
  yield* join("INNER", items, yield* binary("=", itemCartId, cartPk));
  yield* join("INNER", products, yield* binary("=", productPk, itemProductId));
  yield* where(yield* binary("=", cartPk, yield* param(cartId)));
  yield* where(yield* binary("=", cartOwner, yield* param(userId)));

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

if (import.meta.main) {
  // Keep query construction reusable while providing a convenient command-line demonstration.
  const [cartId = "cart-42", userId = "user-7"] = Deno.args;
  const query = run(cartContentsQuery(cartId, userId), sqlInterpreter());
  console.log(query.text);
  console.log(`\nparams: ${JSON.stringify(query.params)}`);
}
