/** Construction, alternate interpretation, escaping, and validation tests for the VDOM DSL. */

import { catalogPage, sampleProducts } from "../examples/vdom.ts";
import { run } from "../src/free.ts";
import { htmlInterpreter, vdom, vdomInterpreter } from "../src/vdom/mod.ts";
import { assertEquals, assertThrows } from "./assert.ts";

Deno.test("one construction program produces both VDOM and HTML", () => {
  const tree = run(catalogPage(sampleProducts), vdomInterpreter());
  const html = run(catalogPage(sampleProducts), htmlInterpreter());

  assertEquals(tree.type, "element");
  assertEquals(
    html,
    '<main id="catalog"><h1>Catalog</h1><ul class="products">' +
      '<li class="product" data-status="available"><h2>Mechanical keyboard</h2>' +
      '<p class="price">$120</p><span class="badge badge--available">In stock</span></li>' +
      '<li class="product" data-status="sold-out"><h2>USB-C dock</h2><p class="price">$89</p>' +
      '<span class="badge badge--sold-out">Sold out</span></li></ul></main>',
  );
});

Deno.test("HTML interpretation escapes text and attributes", () => {
  function* unsafePage() {
    const text = yield* vdom.text("<script>alert('no')</script>");
    return yield* vdom.element("p", { title: 'a & "b"' }, text);
  }
  assertEquals(
    run(unsafePage(), htmlInterpreter()),
    "<p title=\"a &amp; &quot;b&quot;\">&lt;script&gt;alert('no')&lt;/script&gt;</p>",
  );
});

Deno.test("VDOM names cannot inject markup", () => {
  function* invalidPage() {
    return yield* vdom.element("p><script", {});
  }
  assertThrows(() => run(invalidPage(), vdomInterpreter()), "Invalid element name");
});
