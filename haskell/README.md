# Haskell theory companion

Generator DSL の背景にある構造を、実行可能な Haskell として段階的に示します。TypeScript 実装を
Haskell へ移植することが目的ではなく、「残りの計算」を明示し、操作と継続を分けるまでの変化を
型とデータで観察するための小さな比較実装です。

```text
Continuation
    ↓ 継続を関数値として明示
Defunctionalization
    ↓ 関数値を命令データへ置換
Free
    ↓ 操作の内部に後続を持つ（Functor が必要）
Coyoneda
    ↓ fmap を関数合成として遅延
Freer
    ↓ 操作と継続を分離（Functor は不要）
Step = Done result | Await operation continuation
```

## 実行

リポジトリルートで `nix develop` に入ると、GHC と cabal が利用できます。

```nu
cd haskell
cabal test
cabal run theory-example
```

Nix だけで TypeScript と Haskell の全チェックを実行する場合は、ルートで次を実行します。

```nu
nix flake check
```

## モジュール

- `Dsl.Continuation` — 直接スタイルと CPS、`bindCont`
- `Dsl.Defunctionalization` — 継続関数を有限な frame の列へ置換
- `Dsl.Free` — `TalkF next` と `Free TalkF`
- `Dsl.Coyoneda` — 任意の `f` を Functor にする構成と `Free (Coyoneda f)` / `Freer f` の変換
- `Dsl.Freer` — GADT の操作、明示的な継続、`Done` / `Await` によるステップ実行
- `Dsl.Talk` — Free と Freer の純粋インタプリタが共有する実行結果

`test/Main.hs` は Free と Freer の解釈結果が一致すること、Coyoneda を経由した往復、`Await` へ
操作結果を渡すステップ実行を検証します。
