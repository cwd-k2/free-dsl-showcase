/** Stable public entry point for the VDOM construction DSL. */

export { htmlInterpreter, vdomInterpreter } from "./interpreter.ts";
export { element, vdom } from "./language.ts";
export type { Attributes, AttributeValue, ElementConstructor, VNode } from "./language.ts";
export { renderHtml } from "./render.ts";
