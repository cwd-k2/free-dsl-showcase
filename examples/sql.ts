/** A procedural cart-query use case interpreted as either a domain plan or finished SQL. */

import {
  cartQueryPlanInterpreter,
  cartQuerySqlInterpreter,
  contentsOfCart,
} from "../src/cart-query/mod.ts";
import { type Program, run } from "../src/free.ts";

export type CartQueryOptions = Readonly<{
  alphabetical?: boolean;
  limit?: number | null;
}>;

/**
 * Describe the use case with ordinary control flow. It knows neither the intermediate AST nor
 * that the production interpretation eventually becomes SQL.
 */
export function* cartContentsQuery(
  cartId: string,
  userId: string,
  options: CartQueryOptions = {},
): Program<void> {
  const contents = yield* contentsOfCart(cartId);

  yield* contents.visibleToOwner(userId);
  yield* contents.describeEachLine();

  if (options.alphabetical !== false) {
    yield* contents.orderByProductName();
  }

  if (options.limit !== null) {
    yield* contents.takeAtMost(options.limit ?? 100);
  }
}

if (import.meta.main) {
  const [cartId = "cart-42", userId = "user-7"] = Deno.args;
  const useCase = () => cartContentsQuery(cartId, userId);

  // The plan interpretation is useful for explanation and policy inspection.
  console.log("Plan");
  console.log(JSON.stringify(run(useCase(), cartQueryPlanInterpreter()), null, 2));

  // Normal execution evaluates the same use case directly to one finished query.
  const query = run(useCase(), cartQuerySqlInterpreter());
  console.log("\nSQL");
  console.log(query.text);
  console.log(`\nparams: ${JSON.stringify(query.params)}`);
}
