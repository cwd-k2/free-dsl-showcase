/** Interpreters that expose a constructed VDOM tree or immediately render it as HTML. */

import type { Interpreter } from "../free.ts";
import type { VNode } from "./language.ts";
import { assertHtmlName, renderHtml } from "./render.ts";

type VDomState = null;

function treeInterpreter<Out>(finish: (node: VNode) => Out): Interpreter<VDomState, Out> {
  return {
    initial: () => null,
    handlers: {
      "vdom.text": (state, { value }) => ({
        state,
        value: { type: "text", value } satisfies VNode,
      }),
      "vdom.element": (state, { tag, attributes, children }) => {
        assertHtmlName(tag, "element name");
        for (const name of Object.keys(attributes)) assertHtmlName(name, "attribute name");
        if (children.some((child: VNode) => !child || !["text", "element"].includes(child.type))) {
          throw new Error(`Invalid child of <${tag}>`);
        }
        return {
          state,
          value: {
            type: "element",
            tag,
            attributes: { ...attributes },
            children: [...children],
          } satisfies VNode,
        };
      },
    },
    finish: (_state, value) => {
      const node = value as VNode;
      if (!node || !["text", "element"].includes(node.type)) {
        throw new Error("VDOM program must return a VNode");
      }
      return finish(node);
    },
  };
}

/** Preserve the tree so another renderer or a diffing runtime can consume it. */
export function vdomInterpreter(): Interpreter<VDomState, VNode> {
  return treeInterpreter((node) => node);
}

/** Give the same construction program a server-rendering interpretation. */
export function htmlInterpreter(): Interpreter<VDomState, string> {
  return treeInterpreter(renderHtml);
}
