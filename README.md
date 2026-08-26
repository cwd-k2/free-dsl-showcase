# Free Generator DSL Showcase

Deno の Generator をエフェクト列として使い、同じ小さなインタープリタ基盤から IO / Log、SQL、
正規表現の DSL を構築するショーケースです。プリミティブを直接組み立てる例に加えて、通常の `if` /
`for` / 早期 `return` で書いた業務手続きを regex と SQL へ落とす高度な例も含みます。

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

- `src/free.ts`: Generator エフェクトの共通モデルとインタープリタ実行系
- `src/effects.ts`: `IO` / `Log` エフェクトと、比較しやすく並べた State・Console インタープリタ
- `src/sql/language.ts`: SQL DSL の語彙と、解釈中に構築されるクエリモデル
- `src/sql/interpreter.ts`: SQL operation をクエリモデルへ畳み込むインタープリタ
- `src/sql/render.ts`: クエリモデルをパラメータ化 SQL へ変換する純粋なレンダラ
- `src/regex/language.ts`: 正規表現 DSL の語彙
- `src/regex/interpreter.ts`: Regex operation に意味を与えるインタープリタ
- `src/regex/render.ts`: エスケープ、文字クラス、量指定子のレンダリング規則
- `src/shipment/`: 配送調査の業務語彙と、Regex / SQL DSL への展開
- `examples/`: 各 DSL のサンプルプログラム兼 CLI エントリポイント
- `tests/effects_test.ts`: 同じ対話プログラムの State 実行とコンソール IO 実行
- `tests/sql_test.ts`: SQL DSL を利用するカート検索プログラムの例
- `tests/regex_test.ts`: RFC 5322 の dot-atom を意識したメールアドレスパターンの例
- `tests/shipment_test.ts`: 分岐、反復、早期終了を含む配送調査手続きの例

メールアドレス例は読みやすさを優先したサブセットです。quoted-string、コメント、domain-literal、
obsolete syntax、アドレス全体の長さ制約まで含む完全な RFC 5322 検証には、正規表現ではなく専用の
パーサーが適しています。

正規表現の例は同じ Generator プログラムを `regexInterpreter()` で実行用の `RegExp` に、
`compactRegexSourceInterpreter()` で `\w`、`\d`、文字範囲などを使った表示用の source 文字列に
解釈します。

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

# Advanced: SQL / Regex を隠した配送調査手続き
deno task showcase:investigation --explain --fraud --detail=customer TYO/ORD-2026-00421
```

`showcase:sql` は生成したパラメータ化 SQL とパラメータ配列を表示します。`showcase:regex` は生成した
正規表現に加えて、各入力の match 結果とキャプチャした `local` / `domain` を表示します。
`showcase:investigation` は通常は業務上の調査方針だけを表示し、`--explain` 指定時に限って下位の
Regex / SQL 表現を表示します。
