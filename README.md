# Free Generator DSL Showcase

Deno の Generator をエフェクト列として使い、同じ小さなインタープリタ基盤から IO / Log、SQL、
正規表現の DSL を構築するショーケースです。

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
- `examples/`: 各 DSL のサンプルプログラム兼 CLI エントリポイント
- `tests/effects_test.ts`: 同じ対話プログラムの State 実行とコンソール IO 実行
- `tests/sql_test.ts`: SQL DSL を利用するカート検索プログラムの例
- `tests/regex_test.ts`: RFC 5322 の dot-atom を意識したメールアドレスパターンの例

メールアドレス例は読みやすさを優先したサブセットです。quoted-string、コメント、domain-literal、
obsolete syntax、アドレス全体の長さ制約まで含む完全な RFC 5322 検証には、正規表現ではなく専用の
パーサーが適しています。

正規表現の例は同じ Generator プログラムを `regexInterpreter()` で実行用の `RegExp` に、
`compactRegexSourceInterpreter()` で `\w`、`\d`、文字範囲などを使った表示用の source 文字列に
解釈します。

各 DSL は、利用できる語彙を定義する `language.ts`、operation を処理する `interpreter.ts`、最終表現を
組み立てる `render.ts` の順に読むと、記述・解釈・表示という処理の流れを追えます。外部からは各
ディレクトリの `mod.ts` を公開 API として利用します。

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
```

`showcase:sql` は生成したパラメータ化 SQL とパラメータ配列を表示します。`showcase:regex` は生成した
正規表現に加えて、各入力の match 結果とキャプチャした `local` / `domain` を表示します。
