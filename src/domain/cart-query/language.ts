/** Domain operations for a procedural cart-query use case, independent of SQL and schema. */

import { perform, type Program } from "@/core/free.ts";

export type CartVisibility = Readonly<{
  kind: "owner";
  userId: string;
}>;

export type CartPresentation = Readonly<{
  kind: "line-summary";
}>;

export type CartOrdering = Readonly<{
  kind: "product-name";
  direction: "ascending";
}>;

/** The high-level AST accumulated by interpreting domain operations. */
export type CartContentsPlan = Readonly<{
  kind: "cart-contents";
  cartId: string;
  visibility: CartVisibility;
  presentation: CartPresentation;
  ordering?: CartOrdering;
  limit?: number;
}>;

/** Operations available after a use case chooses the cart it wants to inspect. */
export type CartContents = Readonly<{
  visibleToOwner: (userId: string) => Program<void>;
  describeEachLine: () => Program<void>;
  orderByProductName: () => Program<void>;
  takeAtMost: (count: number) => Program<void>;
}>;

/** Start describing one query and return its scoped, domain-level operation vocabulary. */
export function* contentsOfCart(cartId: string): Program<CartContents> {
  if (cartId.length === 0) throw new Error("Cart ID must not be empty");
  yield* perform<void>("cart.contents", { cartId });

  return {
    visibleToOwner: (userId) => {
      if (userId.length === 0) throw new Error("Owner ID must not be empty");
      return perform<void>("cart.visibility.owner", { userId });
    },

    describeEachLine: () => perform<void>("cart.presentation.line-summary"),
    orderByProductName: () => perform<void>("cart.ordering.product-name"),

    takeAtMost: (count) => {
      if (!Number.isSafeInteger(count) || count < 0) {
        throw new Error(`Invalid result limit: ${count}`);
      }
      return perform<void>("cart.limit", { count });
    },
  };
}
