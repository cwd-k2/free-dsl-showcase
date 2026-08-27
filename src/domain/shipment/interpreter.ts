/** Interpreter combining domain operations with an embedded SQL interpreter. */

import type { Handler, Interpreter } from "@/core/free.ts";
import { emptyQueryState, sqlHandlers } from "@/dsl/sql/interpreter.ts";
import type { QueryState, Sql } from "@/dsl/sql/mod.ts";
import { renderSql } from "@/dsl/sql/render.ts";
import type { InvestigationDecision } from "./language.ts";
import {
  type CompiledReferencePattern,
  compileReferencePatterns,
  readOrderReference,
} from "./reference.ts";

type InvestigationState = {
  query: QueryState;
  trace: string[];
  patterns: CompiledReferencePattern[];
};

export type InvestigationOutput = Readonly<{
  decision: InvestigationDecision;
  trace: string[];
  regex: ReadonlyArray<Readonly<{ format: string; source: string }>>;
  sql?: Sql;
}>;

function embeddedSqlHandlers(): Record<string, Handler<InvestigationState>> {
  return Object.fromEntries(
    Object.entries(sqlHandlers()).map(([kind, handler]) => [
      kind,
      (state: InvestigationState, payload: unknown) => {
        const step = handler(state.query, payload);
        return { state: { ...state, query: step.state }, value: step.value };
      },
    ]),
  );
}

/** Execute parsing and query construction while preserving both compiler products for inspection. */
export function investigationInterpreter(): Interpreter<InvestigationState, InvestigationOutput> {
  return {
    initial: () => ({ query: emptyQueryState(), trace: [], patterns: compileReferencePatterns() }),
    handlers: {
      ...embeddedSqlHandlers(),
      "shipment.reference.read": (state, { input }) => {
        const reference = readOrderReference(input, state.patterns);
        const message = reference
          ? `reference accepted as ${reference.format}`
          : "reference rejected";
        return { state: { ...state, trace: [...state.trace, message] }, value: reference };
      },
      "shipment.investigation.note": (state, { message }) => ({
        state: { ...state, trace: [...state.trace, message] },
        value: undefined,
      }),
      "shipment.investigation.reject": (state, { reason }) => ({
        state: { ...state, trace: [...state.trace, `stopped: ${reason}`] },
        value: { tag: "rejected", reason } satisfies InvestigationDecision,
      }),
      "shipment.investigation.ready": (state, { reference, visibility, details }) => ({
        state: { ...state, trace: [...state.trace, "order search compiled"] },
        value: {
          tag: "ready",
          reference,
          visibility,
          details,
        } satisfies InvestigationDecision,
      }),
    },
    finish: (state, returnValue) => {
      const decision = returnValue as InvestigationDecision;
      if (!decision || (decision.tag !== "ready" && decision.tag !== "rejected")) {
        throw new Error("Investigation program must return a decision");
      }
      return {
        decision,
        trace: state.trace,
        regex: state.patterns.map(({ format, source }) => ({ format, source })),
        sql: decision.tag === "ready" ? renderSql(state.query) : undefined,
      };
    },
  };
}
