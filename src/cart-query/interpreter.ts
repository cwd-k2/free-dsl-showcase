/** Interpret one procedural use case as an inspectable plan or a fully lowered SQL query. */

import { type Handler, type Interpreter, run } from "../free.ts";
import { type Sql, sqlInterpreter } from "../sql/mod.ts";
import type {
  CartContentsPlan,
  CartOrdering,
  CartPresentation,
  CartVisibility,
} from "./language.ts";
import { lowerCartContentsToSql } from "./sql.ts";

export type CartQueryState = {
  cartId?: string;
  visibility?: CartVisibility;
  presentation?: CartPresentation;
  ordering?: CartOrdering;
  limit?: number;
};

function emptyCartQueryState(): CartQueryState {
  return {};
}

function cartQueryHandlers(): Record<string, Handler<CartQueryState>> {
  return {
    "cart.contents": (state, { cartId }) => {
      if (state.cartId !== undefined) throw new Error("Cart contents query is already started");
      return { state: { ...state, cartId }, value: undefined };
    },

    "cart.visibility.owner": (state, { userId }) => ({
      state: { ...state, visibility: { kind: "owner", userId } },
      value: undefined,
    }),

    "cart.presentation.line-summary": (state) => ({
      state: { ...state, presentation: { kind: "line-summary" } },
      value: undefined,
    }),

    "cart.ordering.product-name": (state) => ({
      state: {
        ...state,
        ordering: { kind: "product-name", direction: "ascending" },
      },
      value: undefined,
    }),

    "cart.limit": (state, { count }) => ({
      state: { ...state, limit: count },
      value: undefined,
    }),
  };
}

function finishPlan(state: CartQueryState): CartContentsPlan {
  if (state.cartId === undefined) throw new Error("Cart contents plan requires a cart");
  if (!state.visibility) throw new Error("Cart contents plan requires visibility");
  if (!state.presentation) throw new Error("Cart contents plan requires presentation");

  return {
    kind: "cart-contents",
    cartId: state.cartId,
    visibility: state.visibility,
    presentation: state.presentation,
    ...(state.ordering ? { ordering: state.ordering } : {}),
    ...(state.limit !== undefined ? { limit: state.limit } : {}),
  };
}

/** Expose the high-level AST for tests, explanations, policy checks, or audit tooling. */
export function cartQueryPlanInterpreter(): Interpreter<CartQueryState, CartContentsPlan> {
  return {
    initial: emptyCartQueryState,
    handlers: cartQueryHandlers(),
    finish: finishPlan,
  };
}

/** Hide planning and lowering behind one interpretation that returns a finished SQL value. */
export function cartQuerySqlInterpreter(): Interpreter<CartQueryState, Sql> {
  return {
    initial: emptyCartQueryState,
    handlers: cartQueryHandlers(),
    finish: (state) => run(lowerCartContentsToSql(finishPlan(state)), sqlInterpreter()),
  };
}
