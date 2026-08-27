/** Pure HTML renderer for trees produced by the VDOM DSL. */

import type { AttributeValue, VNode } from "./language.ts";

const voidElements = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

export function assertHtmlName(name: string, label: string): void {
  if (!/^[A-Za-z][A-Za-z0-9:_-]*$/.test(name)) throw new Error(`Invalid ${label}: ${name}`);
}

function escapeText(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function escapeAttribute(value: string): string {
  return escapeText(value).replaceAll('"', "&quot;");
}

function renderAttribute(name: string, value: AttributeValue): string {
  if (value === false || value === null || value === undefined) return "";
  if (value === true) return ` ${name}`;
  return ` ${name}="${escapeAttribute(String(value))}"`;
}

export function renderHtml(node: VNode): string {
  if (node.type === "text") return escapeText(node.value);

  const attributes = Object.entries(node.attributes)
    .map(([name, value]) => renderAttribute(name, value))
    .join("");
  const start = `<${node.tag}${attributes}>`;
  if (voidElements.has(node.tag)) return start;
  return `${start}${node.children.map(renderHtml).join("")}</${node.tag}>`;
}
