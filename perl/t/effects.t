use strict;
use warnings;
use FindBin qw($Bin);
use lib "$Bin/../lib";
use Test::More;

use FreeDSL::Core qw(run);
use FreeDSL::Effects qw(console_interpreter state_interpreter);
use FreeDSL::Example qw(greet);

my $state_result = run(greet(), state_interpreter('Ada'));
is_deeply(
    $state_result,
    {
        input   => [],
        prompts => ['Your name?'],
        output  => ['Hello, Ada!'],
        logs    => ['asking for a name', 'greeting written'],
        value   => 'Hello, Ada!',
    },
    'ordinary effects can be interpreted as pure State',
);

my @events;
my $console_result = run(
    greet(),
    console_interpreter({
        read_line => sub {
            push @events, "prompt: $_[0]";
            return 'Grace';
        },
        write_line => sub { push @events, "stdout: $_[0]"; },
        info       => sub { push @events, "stderr: $_[0]"; },
    }),
);

is($console_result, 'Hello, Grace!', 'the console interpretation returns the program value');
is_deeply(
    \@events,
    [
        'stderr: asking for a name',
        'prompt: Your name?',
        'stdout: Hello, Grace!',
        'stderr: greeting written',
    ],
    'the same program can be interpreted as console IO',
);

eval { run(greet(), state_interpreter()); };
like($@, qr/State interpreter has no more input/, 'State input exhaustion is explicit');

done_testing();
