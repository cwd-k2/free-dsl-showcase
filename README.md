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
- `src/sql.ts`: パラメータ化 SQL の DSL とインタープリタ
- `src/regex.ts`: 正規表現 DSL、実行可能な `RegExp` と簡潔な source 文字列へのインタープリタ
- `tests/sql_test.ts`: SQL DSL を利用するカート検索プログラムの例
- `tests/regex_test.ts`: RFC 5322 の dot-atom を意識したメールアドレスパターンの例

メールアドレス例は読みやすさを優先したサブセットです。quoted-string、コメント、domain-literal、
obsolete syntax、アドレス全体の長さ制約まで含む完全な RFC 5322 検証には、正規表現ではなく専用の
パーサーが適しています。

正規表現の例は同じ Generator プログラムを `regexInterpreter()` で実行用の `RegExp` に、
`compactRegexSourceInterpreter()` で `\w`、`\d`、文字範囲などを使った表示用の source 文字列に
解釈します。
