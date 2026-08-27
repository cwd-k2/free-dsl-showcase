# Perl のコンパイル時変換で書く DSL

TypeScript の Generator が保持していた「残りの計算」を Perl のクロージャとして表し、利用側では
小さな構文変換によって直接形式で書けるようにした実装です。CPAN モジュールや、言語組み込みの
Generator・限定継続は使いません。

```perl
effect greet {
    perform log_info('asking for a name');
    my $name = perform read_line('Your name?');
    my $greeting = "Hello, $name!";
    perform write_line($greeting);
    perform log_info('greeting written');
    return $greeting;
}
```

`FreeDSL::Syntax` は Perl 標準配布の `Filter::Simple` をコンパイル時フックとして使います。上の
`effect` ブロックを、概念的には次のような `and_then` の入れ子へ変換してから Perl 自身の parser
へ渡します。

```perl
sub greet {
    return and_then(log_info('asking for a name'), sub {
        return and_then(read_line('Your name?'), sub {
            my ($name) = @_;
            # 残りの計算
        });
    });
}
```

変換器は汎用的な Perl parser ではありません。次の制約を意図的に設けています。

- `effect name {` と閉じ波括弧は、それぞれ単独の行に置く
- 一つの文は一行で書く
- 中断点は `perform expression;` または `my $name = perform expression;` と書く
- `if`、`for` など、内側に `perform` を含む複合文はまだ扱わない

制約に合わない文は、曖昧に変換せずコンパイル時エラーにします。

## 実行時表現

プログラムは次のどちらかの値です。

```text
Done result
Await operation continuation
```

`perform` は一つの `Await` を作り、`and_then`（モナドの `bind`）は後続の計算をその `continuation`
へ合成します。`run` は 操作を一つずつインタプリタへ渡し、結果を引数にして継続を呼びます。

```text
TypeScript Generator                 Perl

yield operation                      Await operation continuation
interpreter.handlers[kind](...)      interpreter->{handlers}{$kind}->(...)
generator.next(value)                continuation->(value)
```

`FreeDSL::Example::greet` は TypeScript の `examples/effects.ts` と同じ IO / Log プログラムです。
State と Console の二つのインタプリタで実行できます。

```nu
prove -Iperl/lib perl/t
perl -Iperl/lib perl/examples/effects.pl
```

手書きの実行時表現では後続がコールバックとして入れ子になります。Perl 版はその機械的な変換を source
filter で補っています。一方、TypeScript Generator は同じ変換に相当する仕事を言語処理系が
担い、通常の分岐や反復を含む Perl より広いホスト言語の構文をそのまま利用できます。
