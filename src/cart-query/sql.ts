/** Lower the cart-query domain AST into operations from the existing SQL DSL. */

import type { Program } from "../free.ts";
import { sql, type SqlExpr } from "../sql/mod.ts";
import type { CartContentsPlan } from "./language.ts";

/** The only layer that knows how cart concepts map to the physical relational schema. */
export function* lowerCartContentsToSql(plan: CartContentsPlan): Program<void> {
  // Tables and relationships
  const carts = yield* sql.table("carts", "c");
  const items = yield* sql.table("cart_items", "ci");
  const products = yield* sql.table("products", "p");

  const cartPk = yield* sql.column(carts, "id");
  const cartOwner = yield* sql.column(carts, "user_id");
  const itemCartId = yield* sql.column(items, "cart_id");
  const itemProductId = yield* sql.column(items, "product_id");
  const productPk = yield* sql.column(products, "id", "product_id");

  yield* sql.from(carts);
  yield* sql.join("INNER", items, yield* equal(itemCartId, cartPk));
  yield* sql.join("INNER", products, yield* equal(productPk, itemProductId));

  // Identity and visibility
  yield* sql.where(yield* equal(cartPk, yield* value(plan.cartId)));

  switch (plan.visibility.kind) {
    case "owner":
      yield* sql.where(yield* equal(cartOwner, yield* value(plan.visibility.userId)));
      break;
  }

  // Result presentation
  const quantity = yield* sql.column(items, "quantity", "quantity");
  const productName = yield* sql.column(products, "name", "product_name");
  const unitPrice = yield* sql.column(products, "unit_price", "unit_price");

  switch (plan.presentation.kind) {
    case "line-summary":
      yield* sql.select(
        productPk,
        productName,
        quantity,
        unitPrice,
        yield* sql.as(yield* productOf(quantity, unitPrice), "subtotal"),
      );
      break;
  }

  // Ordering and result size
  if (plan.ordering) {
    switch (plan.ordering.kind) {
      case "product-name":
        yield* sql.orderBy(productName, "ASC");
        break;
    }
  }

  if (plan.limit !== undefined) yield* sql.limit(plan.limit);
}

function* value(input: unknown): Program<SqlExpr> {
  return yield* sql.param(input);
}

function* equal(left: SqlExpr, right: SqlExpr): Program<SqlExpr> {
  return yield* sql.binary("=", left, right);
}

function* productOf(left: SqlExpr, right: SqlExpr): Program<SqlExpr> {
  return yield* sql.binary("*", left, right);
}
