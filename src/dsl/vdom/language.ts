/** Public vocabulary and immutable tree model for the VDOM construction DSL. */

import { perform, type Program } from "../../core/free.ts";

export type AttributeValue = string | number | boolean | null | undefined;
export type Attributes = Readonly<Record<string, AttributeValue>>;

export type VNode =
  | Readonly<{ type: "text"; value: string }>
  | Readonly<{
    type: "element";
    tag: string;
    attributes: Attributes;
    children: readonly VNode[];
  }>;

/** Operations construct values; unlike an effect DSL they do not perform work in the outside world. */
export const vdom = {
  text: (value: string) => perform<VNode>("vdom.text", { value }),
  element: (tag: string, attributes: Attributes = {}, ...children: VNode[]) =>
    perform<VNode>("vdom.element", { tag, attributes, children }),
};

export type ElementConstructor = (
  attributes?: Attributes,
  ...children: VNode[]
) => Program<VNode>;

/** Define a reusable element constructor once instead of repeating its tag at every use. */
export function element(tag: string): ElementConstructor {
  return (attributes: Attributes = {}, ...children: VNode[]) =>
    vdom.element(tag, attributes, ...children);
}
