# なぜ Generator で DSL を実装できるのか

このリポジトリでは、DSL のプログラムを TypeScript の Generator で記述している。

```ts
export function* greet(): Program<string> {
  yield* log.info("asking for a name");
  const name = yield* io.readLine("Your name?");
  const greeting = `Hello, ${name}!`;
  yield* io.writeLine(greeting);
  return greeting;
}
```

一見すると、Generator は値を順番に列挙するための機能にすぎない。にもかかわらず、この `greet`
はコンソール IO としても、入力と出力をメモリに記録する純粋な計算としても実行できる。
さらに同じ仕組みで Regex、SQL、VDOM、イベント処理まで記述できる。

なぜこれが可能なのだろうか。

短く答えると、DSL の実行に必要なのは次の対話だからである。

```text
プログラム ── 命令を1個要求 ──> インタプリタ
プログラム <── 命令の結果を返す ── インタプリタ
              （以下、完了まで反復）
```

Generator の `yield` / `next` は、まさにこの中断と再開を提供する。本章では、命令をデータにする
ところから自由代数、代数的エフェクト、限定継続へ進み、最後に `src/core/free.ts` の短い実装へ
戻ってくる。

## まず「命令を値にする」

普通の関数呼び出しは、その場で意味が決まる。

```haskell
getLine :: IO String
putStrLn :: String -> IO ()
```

一方、DSL では「何をするか」と「どう行うか」を分けたい。そこで、まず操作を実行せず、要求を表す
データにする。

```haskell
data Talk a where
  Ask  :: String -> Talk String
  Tell :: String -> Talk ()
```

`Talk a` の `a` は、その命令を処理したときに返す値の型である。

- `Ask question :: Talk String` は、答えとして `String` を要求する
- `Tell message :: Talk ()` は、返すべき情報がない

これは DSL の**シグネチャ**、つまり使える操作と各操作の引数・結果型の一覧である。まだ
コンソールから読むとも、テストデータから読むとも決めていない。

操作を要求する関数を、代数的エフェクトの用語に合わせて `perform` と書こう。以下の `Eff`、 `Member`
は、特定の Haskell ライブラリではなく、エフェクト集合を型で表す説明用の表記である。

```haskell
ask :: Member Talk effects => String -> Eff effects String
ask question = perform (Ask question)

tell :: Member Talk effects => String -> Eff effects ()
tell message = perform (Tell message)
```

ここで重要なのは、`perform` を通常の関数呼び出しとして読まないことである。「この操作を今ここで
実行する」ではなく、**この操作の解釈を外側のハンドラへ依頼する**という印である。

## 命令のリストだけでは足りない

操作をデータにできたなら、単なるリストに並べればよさそうに見える。戻り値の型を消去した単純な
命令型を用意すると、次のようには書ける。

```haskell
data TalkInstruction
  = AskInstruction String
  | TellInstruction String

program :: [TalkInstruction]
program =
  [ AskInstruction "Your name?"
  , TellInstruction "Hello!"
]
```

元の `Talk String` と `Talk ()` は要素型が違うため、そのまま同じ Haskell のリストには入らない。
上のように結果型を消去しても、`AskInstruction` の答えを次の `TellInstruction` で使えない。実際に
欲しいプログラムは次である。

```haskell
greet :: Member Talk effects => Eff effects String
greet = do
  name <- ask "Your name?"
  tell ("Hello, " <> name <> "!")
  pure name
```

2番目の命令は、1番目の命令の結果を受け取るまで決まらない。必要なのは静的な命令列ではなく、
次の形の繰り返しである。

```text
命令 q : Op x
結果 x
結果を受け取って残りのプログラムを決める関数 k : x -> Program a
```

この `k` が**継続**である。継続は単に「次の命令」ではない。受け取った名前による文字列の組み立て、
条件分岐、反復、早期終了を含む、**現在位置より後の残りの計算全体**である。

たとえば `name` が `"Ada"` なら、上のプログラムの残りは概念的に次のようになる。

```haskell
k "Ada"
  = do
      tell "Hello, Ada!"
      pure "Ada"
```

このため、DSL が途中の結果に依存できることと、継続を持つことは同じ問題の二つの見方になる。

## 自由代数とは何が「自由」なのか

ここでいう**自由代数**は、DSL の操作を、まだ特定の意味を与えずに合成して作る項の集まりである。
たとえば結果を返さない簡単なシグネチャだけなら、自由代数は構文木として想像しやすい。

```haskell
data ConsoleOp
  = WriteLine String
  | RingBell

data Term
  = PureTerm
  | Invoke ConsoleOp Term
```

`Invoke (WriteLine "hello") (Invoke RingBell PureTerm)` は、操作名と合成の構造しか持たない。
`WriteLine` が端末出力なのか、ログへの追加なのかは決めていない。「自由」とは何でも好き勝手に実行
できるという意味ではなく、**シグネチャと合成の規則以外の等式や意味を、まだ課していない**という
意味である。

ここでは、操作について等式を一つも指定しない最も単純な場合を考えている。たとえば非決定性の `choose`
に交換則や冪等則を指定するようなエフェクト理論では、その公理で同一視した項から自由モデルを
作る。この場合の「自由」は、公理がないという意味ではなく、**指定した公理以外の余分な関係を課さない**
という意味になる。

インタプリタは、各生成元（各操作）に具体的な意味を与える。すると、その対応は複合したプログラム
全体へ広がる。

```text
自由なプログラム                 解釈先

WriteLine "hello"  ──────────>  stdout へ書く
RingBell           ──────────>  ベル文字を送る
順次合成            ──────────>  順番に実行する
```

別の対応を選べば、同じ項をテスト用のイベント列にも変換できる。

```text
WriteLine "hello"  ──────────>  [Output "hello"] を追加
RingBell           ──────────>  [Bell] を追加
```

この「生成元の意味を選ぶと、複合項全体の意味が定まる」という性質が、DSL とインタプリタを分離
できる理由である。エフェクト理論に等式がある場合、理論上のモデルとして解釈するには、選んだ意味も
その等式を満たす必要がある。

### 戻り値を持つ操作では継続も構文になる

`Ask :: Talk String` のように操作ごとに戻り値の型が違うと、後続は固定した `Term` では表せない。
`String` を受け取って残りを選ぶ必要がある。そこで、プログラムを次の形で表す。

```haskell
data Freer op a where
  Pure :: a -> Freer op a
  Op   :: op x -> (x -> Freer op a) -> Freer op a
```

読み方はそのままである。

- `Pure a`: プログラムは完了し、最終結果は `a`
- `Op request k`: 結果型 `x` の操作を1個要求し、その結果を `k` に渡すと残りが得られる

`x` は操作ごとに異なるが、`Op` の外から具体的な型を知る必要はない。インタプリタが `request` を
処理して、その操作に正しい `x` を `k` へ渡せばよい。

```haskell
greet
  = Op (Ask "Your name?") $ \name ->
      Op (Tell ("Hello, " <> name <> "!")) $ \() ->
        Pure name
```

これが「命令 + 継続」からなる自由なエフェクトプログラムの最小の姿である。Free Monad では操作の
内部に後続を持たせるが、Freer では操作と継続を分けるので、操作シグネチャ自身に `Functor` を要求
しない。このリポジトリの実装に近いのは後者である。

なお、ここでの自由代数は操作の**構文と合成**についての話であり、一般の「エフェクトシステム」
すべてを意味しない。型と値のレベルで「このプログラムが `Talk` エフェクトを使う」と記録する部分と、
ハンドラで意味を与える部分を合わせて、代数的エフェクトのライブラリエンコーディングとして読める。

## 「残り全部」から「観測できる1ステップ」へ

`Freer` の定義で最も大事なのは、どれほど長いプログラムでも、外側からは常に次の二択として
観測できることである。

```haskell
data Step op a where
  Done  :: a -> Step op a
  Await :: op x -> (x -> Freer op a) -> Step op a
```

```text
プログラム全体
    │ 先頭を観測
    ▼
  Done result
    または
  Await request continuation
```

ここで「1ステップ」とは、継続が次の命令までしか保持しないという意味ではない。`continuation` は
プログラムの最後までの残り全部を保持している。外側が一度に**観測する単位**が、先頭の命令1個だと
いう意味である。

インタプリタはこの `Step` を反復して処理する。

```haskell
runTalk :: Freer Talk a -> State -> (a, State)
runTalk program state =
  case program of
    Pure a ->
      (a, state)

    Op (Ask question) k ->
      let (answer, state') = readAnswer question state
      in runTalk (k answer) state'

    Op (Tell message) k ->
      let state' = recordOutput message state
      in runTalk (k ()) state'
```

処理はいつも同じである。

1. 先頭の操作要求を見る
2. ハンドラが操作を解釈して結果を作る
3. 結果を継続へ渡す
4. 得られた残りのプログラムについて繰り返す

自由代数の観点では、これは自由な項を別の代数へ写す fold として読める。操作に等式を課した
エフェクト理論まで考える場合、理論上のハンドラが準同型になるには、その解釈が等式を保つ必要がある。
制御フローの観点では、これは中断された計算へ値を返して再開するステップ実行である。同じ構造を
二つの方向から見ている。

## 代数的エフェクトでは継続を誰が作るのか

`Freer` では `Op request k` というデータを組み立てることで、継続 `k` を明示的に保持した。一方、
代数的エフェクトを言語機能として持つ擬似的な Haskell を考えると、利用側はもっと直接的に書ける。

```haskell
greet = do
  name <- perform (Ask "Your name?")
  perform (Tell ("Hello, " <> name <> "!"))
  pure name
```

`perform` が起きたとき、言語ランタイムは次を行う。

1. 最も近い対応ハンドラまで制御を移す
2. `perform` より後、ハンドラ境界までの残りを継続として捕捉する
3. 操作要求と、その継続をハンドラへ渡す

ハンドラ側を概念的に書けば、次のようになる。

```haskell
handleTalk program = handle program with
  return a -> pure a

  Ask question k -> do
    answer <- obtainAnswer question
    resume k answer

  Tell message k -> do
    emit message
    resume k ()
```

`perform (Ask ...)` の式自体は `String` を返すように見える。しかし実際にはそこで一旦外側へ制御を
渡し、ハンドラが `resume k answer` したときに初めて、`perform` 式の値が `answer` になる。

この操作節へ渡される `k` は、ハンドラ境界で区切られた**限定継続**として読める。「限定」と付くのは、
捕捉する残りがプロセス全体の終了までではなく、最も近いハンドラという境界までだからである。
ただし、代数的エフェクトハンドラと汎用的な限定継続演算子の表現力や型付けが常に同一、という意味では
ない。

### shift/reset との対応

古典的な限定継続の用語なら、境界を置く操作を `reset`、その境界までの継続を捕捉する操作を `shift`
と呼ぶ。代数的エフェクトとの概念的な対応は次のようになる。

| 限定継続       | 代数的エフェクト        | 役割                                   |
| -------------- | ----------------------- | -------------------------------------- |
| `reset`        | `handle ... with`       | 継続を捕捉する範囲を区切る             |
| `shift`        | `perform operation`     | 操作を通知し、境界までの継続を捕捉する |
| 捕捉された `k` | operation clause の `k` | 操作より後の残りの計算                 |
| `k value`      | `resume k value`        | 操作の結果を返して残りを再開する       |

厳密には、shift/reset と代数的エフェクトハンドラは同じ構文でも同じ意味論でもない。ここで必要なのは、
**境界までの残りを一時停止し、要求を外へ見せ、値を与えて再開する**という共通のプロトコルである。

## Generator はこのプロトコルを組み込みで持つ

TypeScript の Generator に戻ろう。

```ts
function* perform<A>(kind: string, payload: unknown = undefined): Program<A> {
  return (yield { kind, payload }) as A;
}
```

`yield` には二つの方向がある。

```text
                       yield request
Generator の内側  ─────────────────────>  呼び出し側
Generator の内側  <─────────────────────  呼び出し側
                       next(result)
```

- `yield request` は要求を外へ返し、Generator を中断する
- `next(result)` は中断地点を再開し、`yield` 式の値を `result` にする

したがって `perform<A>` は、「`Op<A>` を要求し、ハンドラが返した `A` を呼び出し元へ返す」という
単一操作のプログラムになる。利用側の `yield*` は、その小さな Generator に制御を委譲する。

```ts
const name = yield * io.readLine("Your name?");
```

動きを展開すると次のようになる。

1. `io.readLine` が `perform<string>(...)` を返す
2. `yield*` が `perform` の `yield` を外側まで伝える
3. `run` が `io.readLine` のハンドラを呼ぶ
4. `run` が `program.next(name)` で値を返す
5. `perform` の `yield` 式が `name` になり、`return name` する
6. `yield*` 式全体も `name` になり、利用側の残りが続く

このとき「残りの計算」は TypeScript の関数値として露出していない。Generator オブジェクトの内部状態と
JavaScript ランタイムの中に保存されている。外側は継続 `k` を直接呼ぶ代わりに、同じ Generator へ
`next(value)` を呼ぶ。

```text
Freer / effect handler             Generator

Op request k                      { done: false, value: request }
handle request                    handler(request)
k result                          generator.next(result)
Pure result                       { done: true, value: result }
```

これが Generator を限定継続そのものではなく、**この DSL に必要な限定継続風の中断・再開プロトコルを
提供する one-shot coroutine** と呼ぶ理由である。

## `run` を1行ずつ対応づける

このリポジトリの同期版ランナーは本質部分だけなら次の形である。

```ts
let state = interpreter.initial();
let step = program.next();

while (!step.done) {
  const op = step.value;
  const handled = interpreter.handlers[op.kind](state, op.payload);
  state = handled.state;
  step = program.next(handled.value);
}

return interpreter.finish(state, step.value);
```

各行を先ほどの言葉へ置き換えられる。

| 実装                          | 意味                                             |
| ----------------------------- | ------------------------------------------------ |
| `program.next()`              | 最初の操作、または完了まで進める                 |
| `while (!step.done)`          | `Await request continuation` の間繰り返す        |
| `step.value`                  | 自由代数の生成元である操作要求                   |
| `handlers[op.kind](...)`      | 生成元に具体的な意味を与える                     |
| `handled.value`               | 操作の結果型に対応する値                         |
| `program.next(handled.value)` | 中断された継続を、その結果で再開する             |
| `finish(..., step.value)`     | `Pure result` とハンドラ状態を最終結果へ解釈する |

`state` は限定継続そのものに必要な状態ではなく、この汎用ランナーが State、SQL の構築、ログ収集などを
同じ形で扱うために明示しているインタプリタの状態である。

`runAsync` もプロトコルは同じで、操作の解釈を `await` するだけである。DSL プログラム側を
`async function` に変えなくてよいのは、非同期性が操作を解釈する側の事情だからである。

## 同じプログラムに複数の意味を与える

`greet` の `io.readLine` は、プログラム側では要求データにすぎない。実行時のハンドラを選ぶと意味が
決まる。

```text
                         ┌─ consoleInterpreter ──> 端末から入力
greet ── io.readLine ────┤
                         └─ stateInterpreter ────> input 配列から1件消費
```

どちらのハンドラも `readLine` の結果として `string` を返すので、プログラムの継続は違いを知らずに
再開できる。異なるのは操作の意味と、付随する状態・観測結果だけである。

同様に Regex DSL では、`rx.literal` や `rx.seq` という自由な語彙に対し、実行可能な `RegExp` を作る
解釈と、表示用の source を作る解釈を与えられる。カート検索 DSL では、同じ業務操作を監査可能な
`CartContentsPlan` にも、SQL DSL へ lower したクエリにもできる。

この差し替え可能性は Generator 自体が与えるものではない。次の三つを分けた設計の結果である。

1. `Op` が操作をデータとして表す
2. Generator が操作間の依存的な制御フローを保持する
3. Interpreter が各操作と完了結果へ意味を与える

## エフェクトシステムとして見る

ここまでの `Talk` は、「この計算は `Ask` と `Tell` を要求する可能性がある」という計算の能力を表して
いる。静的なエフェクトシステムを備えた言語やライブラリなら、その集合を型に記録できる。

```haskell
greet :: Member Talk effects => Eff effects String
```

これは「`greet` は少なくとも `Talk` エフェクトを使う」という型である。複数のエフェクトも同様に
合成できる。

```haskell
checkout :: Members '[Inventory, Payment, Audit] effects
         => Cart
         -> Eff effects Receipt
```

ハンドラは、型に残っているエフェクトを一つ解釈し、より少ないエフェクトを持つ計算や最終値へ変換する。
説明用の effect-row 風表記なら、型は次のようになる。

```haskell
runTalk :: Eff (Talk ': effects) a -> Eff effects a
```

この見方には二つの利点がある。

- 利用可能な操作を関数の型から読める
- 必要なハンドラを与え忘れると、実行前に型エラーにできる

このリポジトリは完全な静的エフェクトシステムを実装してはいない。すべての DSL は共通の
`Program<A> = Generator<Op<unknown>, A, unknown>` に消去され、操作集合は `kind: string` で動的に
ディスパッチされる。未処理の操作は型エラーではなく、`Unhandled op` という実行時エラーになる。

それでも設計上の分担はエフェクトシステムと同じように読める。

| エフェクトシステムの概念            | このリポジトリ                    |
| ----------------------------------- | --------------------------------- |
| effect signature                    | 各 `language.ts` の公開 operation |
| `perform`                           | `perform<A>(kind, payload)`       |
| effectful computation               | `Program<A>`                      |
| handler                             | `Interpreter.handlers`            |
| effect elimination / final handling | `run` / `runAsync`                |

つまり、ここで利用している本質は**操作を要求する側と意味を与える側の分離**であり、操作集合を型で
追跡する部分は小ささを優先して省略している。限定継続は前者を動かす仕組みであって、後者の静的な
型検査を自動的に与えるものではない。

## 普通の制御構文を使える理由

Generator の中では、継続がソースコード上の「残りの関数本体」である。したがって、結果を受け取った
後のプログラムを通常の TypeScript で決められる。

```ts
const reference = yield * references.read(input);

if (!reference) {
  return yield * investigation.reject("注文番号を読み取れません");
}

for (const detail of requestedDetails) {
  yield * search.include(detail);
}
```

- `if` は、操作結果に応じて別の継続を選ぶ
- `for` は、その時点で必要な操作を繰り返し発行する
- `return` は、残りの継続を終了して `done: true` の値を返す

静的 AST だけを直接組み立てる DSL では、この制御構造も `If`、`Loop`、`Return` のようなノードとして
自前で表現する必要がある。Generator 版はホスト言語の制御フローを利用しつつ、DSL 操作の境界だけを
`yield` で外へ公開する。この実装で観測できるのは完全な構文木ではなく、現在の実行経路上の操作で
ある。

## できることと、できないこと

Generator 版は小さく実用的だが、純粋な `Freer` データと同一ではない。

### 継続は one-shot

`Freer` の `k :: x -> Freer op a` は普通の純粋関数なので、同じ `k` を複数回呼べる。Generator は
`next` するたび内部状態が前へ進み、同じ中断地点へ戻れない。

そのため、同じ継続を複数の値で再開する非決定性や、継続の複製によるバックトラックは直接には
実装できない。このリポジトリの DSL は各操作を一度処理して一度再開するため、one-shot で十分である。

### プログラム全体は検査可能な木ではない

Generator から見えるのは、実際にそこまで実行して到達した次の操作だけである。未実行の分岐を含む
プログラム全体を事前に走査、シリアライズ、最適化することはできない。

ただし、実行中に現れる操作を記録することや、操作が返した値に従って構築された最終 AST を得ることは
できる。このリポジトリの Regex、SQL、VDOM インタプリタはこの方法を使う。

### 型安全性の境界がある

Haskell の GADT なら `Ask` と `String` の対応を型で保持できる。この実装では `Op<A>` の `A` は
phantom type であり、実行時の `kind` と結び付いていない。汎用ディスパッチ境界は `unknown` / `any` を
使うため、ハンドラが正しい型の値を返すという規律が必要である。

DSL の公開関数では `perform<RegexFragment>(...)` のように結果型を固定しているため利用側は型付きで
書けるが、これは Haskell の GADT と同じ強さの保証ではない。

### Generator オブジェクトは再利用できない

このリポジトリの `Program<A>` は Generator オブジェクトそのものであり、`run(greet(), ...)` のように
実行ごとに Generator 関数を呼んで新しく作る。同じプログラムを別の解釈で実行するときも、新しい
Generator が必要である。

```ts
run(greet(), stateInterpreter(["Ada"]));
run(greet(), consoleInterpreter());
```

## まとめ

Generator でこの DSL を実装できる理由は、Generator がモナドだから、という一言だけでは十分でない。
必要な部品を分けると、次のようになる。

1. DSL の操作をデータにすると、実行方法を操作の記述から分離できる
2. 操作の結果に後続が依存するため、プログラムには継続が必要になる
3. 自由なエフェクトプログラムは `Pure a` または `Op request k` の1ステップとして観測できる
4. 代数的エフェクトの `perform` / handler は、境界までの継続を中断・再開する
5. Generator の `yield` / `next` は、そのプロトコルを one-shot coroutine として提供する
6. したがって、`Op` を `yield` し、ハンドラの結果で `next` すれば、小さな Freer-style DSL
   を実装できる

```text
自由代数       操作を、意味を決めずに組み立てられるようにする
継続           操作結果に依存する残りの計算を保持する
限定継続       ハンドラ境界で残りを中断し、値を与えて再開する
Generator      その中断・再開を yield / next で one-shot に実現する
Interpreter    操作に意味を与え、結果を返して Generator を進める
```

この視点で `src/core/free.ts` を読むと、そこに大きな魔法はない。`perform` が要求を1個外へ出し、
`run` が要求を解釈して値を返す。その間の「残りの計算」を JavaScript ランタイムが Generator の
状態として保持してくれるため、Free/Freer の木や継続スタックをアプリケーション側で実装せずに
済んでいるのである。

## 次に読むコード

1. `src/core/free.ts` — `perform` と `run` の往復を確認する
2. `examples/effects.ts` — 操作結果が次の処理へ渡る最小例を見る
3. `src/dsl/effects/state.ts` と `console.ts` — 同じ操作への二つの意味を比較する
4. `src/dsl/regex/language.ts` と `interpreter.ts` — 構築系 DSL の戻り値がどう合成されるかを見る
5. `examples/shipment-investigation.ts` — 分岐、反復、早期終了を含む業務手続きを見る

本章は、このリポジトリだけで「操作要求と1ステップの中断・再開」から Generator 実装までを
追えることを目標にしている。CPS、Defunctionalization、Free Monad、Coyoneda、Freer Monad を順に
実装して比較する Haskell コードも、別リポジトリを前提にせず、このリポジトリへ追加する。

## 参考文献

- Gordon D. Plotkin, Matija Pretnar,
  [_Handling Algebraic Effects_](https://homepages.inf.ed.ac.uk/gdp/publications/handling-algebraic-effects.pdf)
  — 自由モデル、操作の結果で継続が決まるという計算の見方、ハンドラと準同型
- Andrej Bauer, Matija Pretnar,
  [_Programming with Algebraic Effects and Handlers_](https://arxiv.org/abs/1203.1539) — Eff
  における操作、ハンドラ、自由代数と限定継続的なプログラミング
- Oleg Kiselyov, Hiromi Ishii,
  [_Freer Monads, More Extensible Effects_](https://okmij.org/ftp/Haskell/extensible/more.pdf) —
  `Functor` 制約を外した Freer と、露出した継続による extensible effects
- Yannick Forster, Ohad Kammar, Sam Lindley, Matija Pretnar,
  [_On the Expressive Power of User-Defined Effects_](https://arxiv.org/abs/1610.09161) — effect
  handlers と delimited control の対応、および型付けを含めると単純な同一視ができないこと
- Ecma International,
  [_ECMAScript Language Specification: Generator Abstract Operations_](https://tc39.es/ecma262/2025/multipage/control-abstraction-objects.html#sec-generator-abstract-operations)
  と
  [_Yield Expression_](https://tc39.es/ecma262/2025/multipage/ecmascript-language-functions-and-classes.html#sec-generator-function-definitions-runtime-semantics-evaluation)
  — Generator の中断状態、`next(value)` による再開、`yield` / `yield*` の規定
