/**
 * A cart-contents vocabulary lowered to the low-level SQL DSL. The example program states what
 * should be retrieved; table relationships, predicates, and projections remain in the lowering.
 *
 * @module
 */

import { type Program, run } from "../src/free.ts";
import { sql, type SqlExpr, sqlInterpreter } from "../src/sql/mod.ts";

/** Business-level operations available after choosing a cart. */
export type CartContents = Readonly<{
  forOwner: (userId: string) => Program<void>;
  describeEachLine: () => Program<void>;
  alphabeticalByProduct: () => Program<void>;
  takeAtMost: (count: number) => Program<void>;
}>;

/**
 * Establish the relational meaning of “contents of this cart”. This is the only part of the
 * example that needs to know the physical schema or the low-level SQL vocabulary.
 */
export function* contentsOfCart(cartId: string): Program<CartContents> {
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
  yield* sql.join("INNER", items, yield* equal(itemCartId, cartPk));
  yield* sql.join("INNER", products, yield* equal(productPk, itemProductId));
  yield* sql.where(yield* equal(cartPk, yield* value(cartId)));

  function* forOwner(userId: string): Program<void> {
    yield* sql.where(yield* equal(cartOwner, yield* value(userId)));
  }

  function* describeEachLine(): Program<void> {
    const subtotal = yield* productOf(quantity, unitPrice);
    yield* sql.select(
      productPk,
      productName,
      quantity,
      unitPrice,
      yield* sql.as(subtotal, "subtotal"),
    );
  }

  function* alphabeticalByProduct(): Program<void> {
    yield* sql.orderBy(productName);
  }

  function* takeAtMost(count: number): Program<void> {
    yield* sql.limit(count);
  }

  return { forOwner, describeEachLine, alphabeticalByProduct, takeAtMost };
}

// These expression helpers name meaning rather than SQL spelling. They still expand to exactly
// the operations defined by `src/sql/language.ts`.
function* value(input: unknown): Program<SqlExpr> {
  return yield* sql.param(input);
}

function* equal(left: SqlExpr, right: SqlExpr): Program<SqlExpr> {
  return yield* sql.binary("=", left, right);
}

function* productOf(left: SqlExpr, right: SqlExpr): Program<SqlExpr> {
  return yield* sql.binary("*", left, right);
}

/** A query whose body contains only the intent visible to the caller. */
export function* cartContentsQuery(cartId: string, userId: string): Program<void> {
  const contents = yield* contentsOfCart(cartId);
  yield* contents.forOwner(userId);
  yield* contents.describeEachLine();
  yield* contents.alphabeticalByProduct();
  yield* contents.takeAtMost(100);
}

if (import.meta.main) {
  // Keep query construction reusable while providing a convenient command-line demonstration.
  const [cartId = "cart-42", userId = "user-7"] = Deno.args;
  const query = run(cartContentsQuery(cartId, userId), sqlInterpreter());
  console.log(query.text);
  console.log(`\nparams: ${JSON.stringify(query.params)}`);
}
