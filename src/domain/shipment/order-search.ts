/** Business-level order-search procedures lowered to the private SQL vocabulary. */

import type { Program } from "../../core/free.ts";
import { type Selectable, sql, type SqlExpr } from "../../dsl/sql/mod.ts";
import {
  investigation,
  type InvestigationDecision,
  type InvestigationDetail,
  type Operator,
  type OrderReference,
} from "./language.ts";

export type OrderSearch = Readonly<{
  byReference: (reference: OrderReference) => Program<void>;
  visibleTo: (operator: Operator) => Program<void>;
  include: (detail: InvestigationDetail) => Program<void>;
  onlyActiveShipments: () => Program<void>;
  takeFirst: (reference: OrderReference, operator: Operator) => Program<InvestigationDecision>;
}>;

/** Establish the joins and columns shared by every shipment investigation. */
export function* beginOrderSearch(): Program<OrderSearch> {
  const orders = yield* sql.table("orders", "o");
  const shipments = yield* sql.table("shipments", "s");
  const orderId = yield* sql.column(orders, "id", "order_id");
  const orderNumber = yield* sql.column(orders, "order_number", "order_number");
  const ownerTeam = yield* sql.column(orders, "owner_team");
  const region = yield* sql.column(orders, "region");
  const customerId = yield* sql.column(orders, "customer_id");
  const shipmentOrderId = yield* sql.column(shipments, "order_id");
  const warehouse = yield* sql.column(shipments, "warehouse_code", "warehouse");
  const status = yield* sql.column(shipments, "status", "shipment_status");
  const updatedAt = yield* sql.column(shipments, "updated_at", "updated_at");

  yield* sql.from(orders);
  yield* sql.join("INNER", shipments, yield* sql.binary("=", shipmentOrderId, orderId));

  const selected: Selectable[] = [orderId, orderNumber, warehouse, status, updatedAt];
  const included = new Set<InvestigationDetail>();

  function* byReference(reference: OrderReference): Program<void> {
    yield* sql.where(yield* sql.binary("=", orderNumber, yield* sql.param(reference.orderNumber)));
    yield* sql.where(yield* sql.binary("=", warehouse, yield* sql.param(reference.warehouse)));
  }

  function* visibleTo(operator: Operator): Program<void> {
    if (operator.role === "admin") return;
    yield* sql.where(yield* sql.binary("=", ownerTeam, yield* sql.param(operator.team)));

    const allowedRegions: SqlExpr[] = [];
    for (const value of operator.regions) {
      allowedRegions.push(yield* sql.binary("=", region, yield* sql.param(value)));
    }
    if (allowedRegions.length > 0) yield* sql.where(yield* sql.or(...allowedRegions));
  }

  function* include(detail: InvestigationDetail): Program<void> {
    if (included.has(detail)) return;
    included.add(detail);

    if (detail === "customer") {
      const customers = yield* sql.table("customers", "cu");
      const id = yield* sql.column(customers, "id");
      const email = yield* sql.column(customers, "email", "customer_email");
      yield* sql.join("LEFT", customers, yield* sql.binary("=", id, customerId));
      selected.push(email);
      return;
    }

    const risk = yield* sql.table("risk_assessments", "ra");
    const riskOrderId = yield* sql.column(risk, "order_id");
    const score = yield* sql.column(risk, "score", "risk_score");
    yield* sql.join("LEFT", risk, yield* sql.binary("=", riskOrderId, orderId));
    selected.push(score);
  }

  function* onlyActiveShipments(): Program<void> {
    yield* sql.where(yield* sql.binary("<>", status, yield* sql.param("delivered")));
  }

  function* takeFirst(
    reference: OrderReference,
    operator: Operator,
  ): Program<InvestigationDecision> {
    yield* sql.select(...selected);
    yield* sql.orderBy(updatedAt, "DESC");
    yield* sql.limit(1);
    const visibility = operator.role === "admin"
      ? "all orders"
      : `${operator.team} / ${operator.regions.join(", ") || "no region restriction"}`;
    return yield* investigation.ready(reference, visibility, [...included]);
  }

  return { byReference, visibleTo, include, onlyActiveShipments, takeFirst };
}
