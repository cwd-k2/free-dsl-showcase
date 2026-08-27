use strict;
use warnings;
use FindBin qw($Bin);
use lib "$Bin/../lib";
use Test::More;

use FreeDSL::Core qw(run);
use FreeDSL::Effects qw(read_line write_line state_interpreter);
use FreeDSL::Syntax;

effect join_two_inputs {
    my $left = perform read_line('Left?');
    my $right = perform read_line('Right?');
    my $joined = "$left/$right";
    perform write_line($joined);
    return $joined;
}

effect write_only {
    perform write_line('finished');
}

my $joined = run(join_two_inputs(), state_interpreter('A', 'B'));
is_deeply(
    $joined,
    {
        input   => [],
        prompts => ['Left?', 'Right?'],
        output  => ['A/B'],
        logs    => [],
        value   => 'A/B',
    },
    'direct-style bindings are threaded through generated continuations',
);

my $written = run(write_only(), state_interpreter());
is_deeply(
    $written,
    {
        input   => [],
        prompts => [],
        output  => ['finished'],
        logs    => [],
        value   => undef,
    },
    'an effect block without return completes with undef',
);

done_testing();
