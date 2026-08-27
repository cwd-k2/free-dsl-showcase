/** Integration tests for the high-level procedural shipment example. */

import { investigateShipment } from "../examples/shipment-investigation.ts";
import { run } from "../src/core/free.ts";
import { investigationInterpreter, type Operator } from "../src/domain/shipment/mod.ts";
import { assert, assertEquals } from "./assert.ts";

const SUPPORT: Operator = {
  role: "support",
  team: "fraud",
  regions: ["APAC", "JP"],
};

Deno.test("business procedure compiles reference policy and scoped order search", () => {
  const result = run(
    investigateShipment("TYO/ORD-2026-00421", SUPPORT, ["customer"]),
    investigationInterpreter(),
  );

  assertEquals(result.decision, {
    tag: "ready",
    reference: {
      orderNumber: "ORD-2026-00421",
      warehouse: "TYO",
      format: "warehouse-first",
    },
    visibility: "fraud / APAC, JP",
    details: ["risk", "customer"],
  });
  assert(result.sql);
  assertEquals(result.sql.params, [
    "ORD-2026-00421",
    "TYO",
    "fraud",
    "APAC",
    "JP",
    "delivered",
  ]);
  assert(result.sql.text.includes('LEFT JOIN "risk_assessments" AS "ra"'));
  assert(result.sql.text.includes('LEFT JOIN "customers" AS "cu"'));
  assert(result.sql.text.includes('("o"."region" = $4) OR ("o"."region" = $5)'));
});

Deno.test("invalid reference returns early without constructing SQL", () => {
  const result = run(investigateShipment("not-an-order", SUPPORT), investigationInterpreter());

  assertEquals(result.decision, {
    tag: "rejected",
    reason: "注文番号を読み取れません",
  });
  assertEquals(result.sql, undefined);
  assertEquals(result.trace, [
    "reference rejected",
    "stopped: 注文番号を読み取れません",
  ]);
});

Deno.test("alternate and legacy formats normalize into the same domain type", () => {
  const orderFirst = run(
    investigateShipment("ORD-2026-00421@OSA", { ...SUPPORT, team: "fulfillment" }),
    investigationInterpreter(),
  );
  const legacy = run(
    investigateShipment("00421-FUK", { ...SUPPORT, team: "fulfillment" }),
    investigationInterpreter(),
  );

  assertEquals(
    orderFirst.decision.tag === "ready" ? orderFirst.decision.reference : null,
    { orderNumber: "ORD-2026-00421", warehouse: "OSA", format: "order-first" },
  );
  assertEquals(
    legacy.decision.tag === "ready" ? legacy.decision.reference : null,
    { orderNumber: "ORD-00421", warehouse: "FUK", format: "legacy" },
  );
  assert(legacy.trace.includes("旧形式の参照番号を使用"));
});

Deno.test("admin branch omits team and region restrictions", () => {
  const result = run(
    investigateShipment("TYO/ORD-2026-00421", { ...SUPPORT, role: "admin", team: "ops" }),
    investigationInterpreter(),
  );

  assert(result.sql);
  assertEquals(result.sql.params, ["ORD-2026-00421", "TYO", "delivered"]);
  assertEquals(result.sql.text.includes('"o"."owner_team"'), false);
  assertEquals(result.decision.tag === "ready" ? result.decision.visibility : null, "all orders");
});
