# Free Generator DSL Showcase

Deno の Generator をエフェクト列として使い、同じ小さなインタープリタ基盤から SQL と 正規表現の DSL
を構築するショーケースです。

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
- `src/effects.ts`: `IO` / `Log` エフェクトと、純粋な State・実コンソールのインタープリタ
- `src/sql.ts`: パラメータ化 SQL の DSL とインタープリタ
- `src/regex.ts`: 正規表現 DSL、実行可能な `RegExp` と簡潔な source 文字列へのインタープリタ
- `tests/effects_test.ts`: 同じ対話プログラムの State 実行とコンソール IO 実行
- `tests/sql_test.ts`: SQL DSL を利用するカート検索プログラムの例
- `tests/regex_test.ts`: RFC 5322 の dot-atom を意識したメールアドレスパターンの例

メールアドレス例は読みやすさを優先したサブセットです。quoted-string、コメント、domain-literal、
obsolete syntax、アドレス全体の長さ制約まで含む完全な RFC 5322 検証には、正規表現ではなく専用の
パーサーが適しています。

正規表現の例は同じ Generator プログラムを `regexInterpreter()` で実行用の `RegExp` に、
`compactRegexSourceInterpreter()` で `\w`、`\d`、文字範囲などを使った表示用の source 文字列に
解釈します。

## 通常の計算効果: IO と Log

`tests/effects_test.ts` の `greet` は、実行方法を決めずに `IO` と `Log` の効果だけを記述します。

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
