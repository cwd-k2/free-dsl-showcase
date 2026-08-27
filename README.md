# Free Generator DSL Showcase

Deno の Generator を operation 列として使い、同じ小さなインタープリタ基盤から IO / Log、SQL、
正規表現、VDOM、イベント処理の DSL を構築するショーケースです。プリミティブを直接組み立てる例に
加えて、通常の `if` / `for` / 早期 `return` で書いた業務手続きを regex と SQL へ落とす高度な例も
含みます。

## 開発環境

```nu
nix develop
deno task check
deno task test
```

Nix だけで全チェックを再現する場合は次を実行します。

```nu
nix flake check
```

## 構成

- `src/free.ts`: Generator operation の共通モデルと同期 / 非同期インタープリタ実行系
- `src/effects.ts`: `IO` / `Log` エフェクトと、比較しやすく並べた State・Console インタープリタ
- `src/parser/`: 型付き Parser、直接実行するインタープリタ、Regex DSL への lowering
- `src/cart-query/`: カート検索の高級operation、AST interpreter、SQL DSL への lowering
- `src/sql/language.ts`: SQL DSL の語彙と、解釈中に構築されるクエリモデル
- `src/sql/interpreter.ts`: SQL operation をクエリモデルへ畳み込むインタープリタ
- `src/sql/render.ts`: クエリモデルをパラメータ化 SQL へ変換する純粋なレンダラ
- `src/regex/language.ts`: 正規表現 DSL の語彙
- `src/regex/interpreter.ts`: Regex operation に意味を与えるインタープリタ
- `src/regex/render.ts`: エスケープ、文字クラス、量指定子のレンダリング規則
- `src/vdom/`: UI の木を構築し、VDOM または HTML として取り出す構築系 DSL
- `src/events/`: イベントの受信と発行を記述し、履歴または外部ランタイム上で動かす処理系 DSL
- `src/shipment/`: 配送調査の業務語彙と、Regex / SQL DSL への展開
- `examples/sql.ts`: 通常の制御構文で書いたカート検索usecaseをPlanまたはSQLに解釈する例
- `examples/sql-primitives.ts`: 同じクエリを低レベル SQL primitive だけで組み立てる比較例
- `examples/regex.ts`: 型付き Parser でメールアドレスを記述し、直接実行または Regex へ lower する例
- `examples/regex-primitives.ts`: 同じパターンを低レベル Regex primitive だけで組み立てる比較例
- `examples/`: その他の DSL サンプルプログラム兼 CLI エントリポイント
- `tests/effects_test.ts`: 同じ対話プログラムの State 実行とコンソール IO 実行
- `tests/parser_test.ts`: 直接Parser実行のバックトラック、失敗位置、Unicode文字単位
- `tests/sql_test.ts`: SQL DSL を利用するカート検索プログラムの例
- `tests/regex_test.ts`: RFC 5322 の dot-atom を意識したメールアドレスパターンの例
- `tests/vdom_test.ts`: 同じ UI 構築プログラムの VDOM / HTML 解釈
- `tests/events_test.ts`: カート処理の決定的リプレイと外部イベントランタイム解釈
- `tests/shipment_test.ts`: 分岐、反復、早期終了を含む配送調査手続きの例

メールアドレス例は読みやすさを優先したサブセットです。quoted-string、コメント、domain-literal、
obsolete syntax、アドレス全体の長さ制約まで含む完全な RFC 5322 検証には、正規表現ではなく専用の
パーサーが適しています。

メールアドレス例は、`text`、`sequence`、`oneOrMore`、`separatedBy`、`map` などから構成する独立した
`Parser<A>` です。入力位置を進めながらバックトラックでき、`parse(emailAddressParser, input)` は
JavaScript の `RegExp` を使わずに入力全体を解析して、型付きの `{ local, domain }` を返します。

```ts
export const emailAddressParser = map(
  sequence(
    named("local", dotAtom(ATEXT)),
    text("@"),
    named("domain", domainName()),
  ),
  ([local, _at, domain]) => ({ local, domain }),
);
```

Parser は受理する構造を AST としても保持します。その正規言語部分を `lowerToRegex()` で既存 Regex DSL
へ落とすと、`regexInterpreter()` から実行用 `RegExp`、`compactRegexSourceInterpreter()` から表示用
source 文字列を得られます。値への `map` は直接Parser実行だけに意味を持ち、Regex lowering
では受理する構造だけが使われます。

```text
                    ┌─ parse ──────────→ ParsedEmail / ParseFailure
メール Parser AST ─┤
                    └─ lowerToRegex ───→ Regex DSL ──→ RegExp / source
```

`examples/regex-primitives.ts` には同じメールパターンを
`regex.literal`、`regex.charSet`、`regex.seq`、 `regex.repeat`
などだけで構築した比較例があります。Parser AST から lower した正規言語と、raw primitive から生成した
compact source / `RegExp` が一致することをテストしています。

SQL の例では、usecaseが高級ASTを直接組み立てるのではなく、高級operationを手続き的に発行します。
扱う語彙は `contentsOfCart`、`visibleToOwner`、`describeEachLine`、`orderByProductName`、
`takeAtMost` です。

```ts
const contents = yield * contentsOfCart(cartId);

yield * contents.visibleToOwner(userId);
yield * contents.describeEachLine();

if (options.alphabetical !== false) {
  yield * contents.orderByProductName();
}

if (options.limit !== null) {
  yield * contents.takeAtMost(options.limit ?? 100);
}
```

usecaseはSQL、schema、AST、loweringを知りません。通常の `if` / `for` / 早期 `return`
をそのまま使えることが、Generatorで手続きを記述する利点です。

高級operationを `cartQueryPlanInterpreter()` で解釈すると、認可と提示方法を明示した
`CartContentsPlan` を観察できます。visibilityやpresentationの欠けた手続きは、解釈の完了時に
拒否されます。

```ts
const plan = run(cartContentsQuery(cartId, userId), cartQueryPlanInterpreter());
```

通常実行では `cartQuerySqlInterpreter()` に差し替えるだけです。interpreterの完了処理が内部でASTを
確定し、SQL DSLへlowerするため、一回の評価から完成したクエリが返ります。

```ts
const query = run(cartContentsQuery(cartId, userId), cartQuerySqlInterpreter());
```

テーブル、カラム、JOIN、比較式、射影は `src/cart-query/sql.ts` のloweringにだけ現れます。

```text
cart usecase
  ├─ cartQueryPlanInterpreter ──→ CartContentsPlan
  └─ cartQuerySqlInterpreter
       └─ CartContentsPlan ──→ lowering ──→ SQL DSL ──→ parameterized SQL
```

対比のため、`examples/sql-primitives.ts` には同じクエリを `sql.table`、`sql.column`、`sql.join`、
`sql.binary` などだけで構築した例を分離して置いています。こちらでは実装上の手順を追えますが、
「カート内容を誰の権限で、どのように提示するか」という意図は読み取りにくくなります。テストでは
高級ASTからlowerした結果とraw primitive版のSQL・パラメータが完全に一致することを確認しています。

```text
推奨:  usecase → 高級operation → interpreter内でAST / lowering → SQL
対比:  SQL primitive の直接列挙 ─────────────────────────→ SQL
```

各 DSL は、利用できる語彙を定義する `language.ts`、operation を処理する `interpreter.ts`、最終表現を
組み立てる `render.ts` の順に読むと、記述・解釈・表示という処理の流れを追えます。外部からは各
ディレクトリの `mod.ts` を公開 API として利用します。

## 業務手続きから Regex と SQL へ

`examples/shipment-investigation.ts` は、入力された配送参照番号を正規化し、操作者に見える注文を
検索する手続きを記述します。サンプル本体は SQL / Regex DSL を import せず、業務語彙と通常の
TypeScript 制御構文だけを使います。

```ts
export function* investigateShipment(input, operator, requestedDetails = []) {
  const reference = yield* references.read(input);

  if (!reference) {
    return yield* investigation.reject("注文番号を読み取れません");
  }

  const search = yield* beginOrderSearch();
  yield* search.byReference(reference);
  yield* search.visibleTo(operator);

  if (operator.team === "fraud") {
    yield* search.include("risk");
  }

  for (const detail of requestedDetails) {
    yield* search.include(detail);
  }

  yield* search.onlyActiveShipments();
  return yield* search.takeFirst(reference, operator);
}
```

ここでは Generator が単なるビルダーではなく、途中の値を受け取り、分岐、反復、早期終了を行う
手続きとして働きます。利用側が扱うのは `OrderReference` や `Operator` であり、キャプチャグループ、
JOIN、カラム名、パラメータ位置は下位層に隠れます。

```text
業務手続き
  ├─ references.read ──> Regex DSL ──> 3形式のパターンと OrderReference
  └─ OrderSearch      ──> SQL DSL   ──> 権限で絞られたパラメータ化SQL
```

通常の CLI 出力もドメインの判断だけを表示します。

```nu
deno task showcase:investigation TYO/ORD-2026-00421
```

```text
Reference accepted
  order:      ORD-2026-00421
  warehouse:  TYO
  format:     warehouse-first

Investigation plan
  visibility: fulfillment / APAC, JP
  shipment:   active only
  details:    standard
  result:     newest match
```

`--explain` を付けると、同じ実行から手続きのトレース、コンパイルされた Regex、SQL、パラメータを
確認できます。`--fraud` は条件分岐を、`--detail=customer` は反復による射影の追加を発生させます。

```nu
deno task showcase:investigation --explain --fraud --detail=customer TYO/ORD-2026-00421
```

不正な参照番号では早期 `return` が起き、SQL 自体が構築されません。

```nu
deno task showcase:investigation --explain invalid
```

この例の下位層を確認するときは、参照番号を Regex DSL へ展開する
`src/shipment/reference.ts`、業務上の検索操作を SQL DSL へ展開する
`src/shipment/order-search.ts`、両方を一度に扱う `src/shipment/interpreter.ts`
の順に読むと流れを追えます。

## 構築系 DSL: VDOM

`examples/vdom.ts` は、まず利用する element を小さな HTML 語彙として定義します。

```ts
const main = element("main");
const h1 = element("h1");
const ul = element("ul");
const li = element("li");
```

`availabilityBadge`、`productCard`、`catalogPage` はこの語彙を再利用します。各 operation
の結果を次へ渡し、最後に不変な木を一つ作ります。

```ts
const title = yield * h1({}, yield * text("Catalog"));
const list = yield * ul({ class: "products" }, ...cards);

return yield * main({ id: "catalog" }, title, list);
```

同じ `catalogPage(...)` を `vdomInterpreter()` で解釈すると、diffing や別レンダラへ渡せる `VNode`
になります。`htmlInterpreter()` で解釈すると、エスケープ済み HTML になります。

ここで Generator は時間方向の処理ではなく、子から親へ値を組み上げる構築記述として働きます。

```text
意味のある UI 部品 → VDOM primitive → VNode
                                   └──→ HTML
```

## 処理系 DSL: イベントシステム

`examples/events.ts` の `cartProcess` は、イベントを一件受け取るたびに Generator が再開します。
ローカルなカート状態を更新し、派生イベントを発行します。

イベント種別ごとの分岐、入力検証、処理継続、checkout 後の早期 `return` は普通の TypeScript
制御構文です。

```ts
while (true) {
  const event = yield * events.next<CartEvent>();
  if (event === null) return snapshot(items, "open");

  switch (event.type) {
    // 状態更新と yield* events.publish(...)
  }
}
```

`replayInterpreter(history)` は入力、消費済みイベント、未消費イベント、発行イベント、戻り値をすべて
データとして返すため、障害調査や単体テストを決定的に行えます。`eventRuntimeInterpreter(runtime)` に
差し替えると、同じ処理プログラムを同期的なキューアダプタ上で動かせます。

Promise ベースのキューやブローカーでは `runAsync` と `asyncEventRuntimeInterpreter(runtime)` を
組み合わせます。`cartProcess` 自体は書き換えず、`receive` と `publish` の完了だけを runner
が待ちます。

この例では 「イベントハンドラを組み立てる」のではなく、外部から届く値によって継続する処理そのものが
DSL 上の プログラムです。

```text
イベント履歴 ──→ cartProcess ──→ 派生イベント + 最終状態
同期ランタイム ──────┤
非同期ランタイム ────┘
```

## 通常の計算効果: IO と Log

`examples/effects.ts` の `greet` は、実行方法を決めずに `IO` と `Log` の効果だけを記述します。

```ts
function* greet(): Program<string> {
  yield* log.info("asking for a name");
  const name = yield* io.readLine("Your name?");
  const greeting = `Hello, ${name}!`;
  yield* io.writeLine(greeting);
  return greeting;
}
```

このプログラムを `stateInterpreter(["Ada"])` で実行すると、外部 IO を行わず、戻り値・出力・ ログが
State として得られます。テストではすべての観測結果を値として比較できます。

```ts
const result = run(greet(), stateInterpreter<string>(["Ada"]));
// { input: [], prompts: ["Your name?"], output: ["Hello, Ada!"], logs: [...], value: ... }
```

一方、`consoleInterpreter()` に差し替えると、同じ記述が `prompt`、標準出力、標準エラーを使う
実際の対話 IO として動きます。Generator は一度実行すると消費されるため、解釈ごとに `greet()`
を呼んで新しいプログラムを作ります。

```ts
const greeting = run(greet(), consoleInterpreter<string>());
```

## CLI で実行する

各サンプルは Deno task から直接実行できます。

```nu
# IO / Log: 名前を対話入力する
deno task showcase:effects

# SQL: cart ID と user ID は省略可能
deno task showcase:sql cart-42 user-7

# Regex: 引数を省略すると組み込みの3例を使う
deno task showcase:regex alice@example.com invalid-address

# 比較用: 同じ出力を素の DSL primitive から生成する
deno task showcase:sql-primitives cart-42 user-7
deno task showcase:regex-primitives

# Advanced: SQL / Regex を隠した配送調査手続き
deno task showcase:investigation --explain --fraud --detail=customer TYO/ORD-2026-00421

# Construction: 同じ UI を VDOM と HTML に解釈する
deno task showcase:vdom

# Processing: カートのイベント履歴をリプレイする
deno task showcase:events
```

`showcase:sql` はlowering前の高級AST、生成したパラメータ化SQL、パラメータ配列を表示します。
`showcase:regex` はlowerした正規表現に加えて、直接Parser実行による各入力の解析結果または失敗位置を
表示します。 `*-primitives` の2つは、対応する推奨例と同じ最終表現を低レベル語彙から直接生成します。
`showcase:investigation` は通常は業務上の調査方針だけを表示し、`--explain` 指定時に限って下位の
Regex / SQL 表現を表示します。

`showcase:vdom` は構築した木と HTML を並べます。`showcase:events`
は消費・発行イベントと最終状態を含むリプレイ結果を表示します。
