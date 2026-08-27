/** Domain vocabulary for the shipment-investigation program. */

import { perform } from "../../core/free.ts";

export type Warehouse = "TYO" | "OSA" | "FUK";
export type ReferenceFormat = "warehouse-first" | "order-first" | "legacy";

export type OrderReference = Readonly<{
  orderNumber: string;
  warehouse: Warehouse;
  format: ReferenceFormat;
}>;

export type Operator = Readonly<{
  role: "support" | "admin";
  team: string;
  regions: string[];
}>;

export type InvestigationDetail = "customer" | "risk";

export type InvestigationDecision =
  | Readonly<{ tag: "rejected"; reason: string }>
  | Readonly<{
    tag: "ready";
    reference: OrderReference;
    visibility: string;
    details: InvestigationDetail[];
  }>;

/** Operations that need interpretation rather than merely constructing SQL. */
export const references = {
  read: (input: string) => perform<OrderReference | null>("shipment.reference.read", { input }),
};

export const investigation = {
  note: (message: string) => perform<void>("shipment.investigation.note", { message }),
  reject: (reason: string) =>
    perform<InvestigationDecision>("shipment.investigation.reject", { reason }),
  ready: (
    reference: OrderReference,
    visibility: string,
    details: InvestigationDetail[],
  ) =>
    perform<InvestigationDecision>("shipment.investigation.ready", {
      reference,
      visibility,
      details,
    }),
};
