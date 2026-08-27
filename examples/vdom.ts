/** A semantic component vocabulary lowered to the small VDOM construction language. */

import { type Program, run } from "../src/free.ts";
import { element, htmlInterpreter, vdom, vdomInterpreter, type VNode } from "../src/vdom/mod.ts";

export type Product = Readonly<{
  name: string;
  price: number;
  available: boolean;
}>;

// Define the small HTML vocabulary once. Components below describe structure without repeating
// raw tag names at every construction site.
const main = element("main");
const h1 = element("h1");
const h2 = element("h2");
const ul = element("ul");
const li = element("li");
const p = element("p");
const span = element("span");
const text = vdom.text;

function* availabilityBadge(available: boolean): Program<VNode> {
  const label = yield* text(available ? "In stock" : "Sold out");

  return yield* span(
    { class: `badge badge--${available ? "available" : "sold-out"}` },
    label,
  );
}

function* productCard(product: Product): Program<VNode> {
  const name = yield* h2({}, yield* text(product.name));
  const price = yield* p({ class: "price" }, yield* text(`$${product.price}`));
  const badge = yield* availabilityBadge(product.available);

  return yield* li(
    { class: "product", "data-status": product.available ? "available" : "sold-out" },
    name,
    price,
    badge,
  );
}

/** The page describes a hierarchy; it neither mutates a DOM nor commits to HTML rendering. */
export function* catalogPage(products: readonly Product[]): Program<VNode> {
  const title = yield* h1({}, yield* text("Catalog"));

  const cards: VNode[] = [];
  for (const product of products) {
    cards.push(yield* productCard(product));
  }

  const list = yield* ul({ class: "products" }, ...cards);

  return yield* main({ id: "catalog" }, title, list);
}

export const sampleProducts: readonly Product[] = [
  { name: "Mechanical keyboard", price: 120, available: true },
  { name: "USB-C dock", price: 89, available: false },
];

if (import.meta.main) {
  const program = () => catalogPage(sampleProducts);

  console.log("VDOM");
  console.log(JSON.stringify(run(program(), vdomInterpreter()), null, 2));

  console.log("\nHTML");
  console.log(run(program(), htmlInterpreter()));
}
