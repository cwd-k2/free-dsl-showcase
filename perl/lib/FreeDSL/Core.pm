package FreeDSL::Core;

use strict;
use warnings;
use Exporter 'import';

our @EXPORT_OK = qw(pure perform and_then run);

# A completed program.  The hash representation keeps the two cases visible
# when stepping through the example in a debugger.
sub pure {
    my ($value) = @_;
    return { tag => 'done', value => $value };
}

# Suspend with one operation.  The identity continuation turns the value
# supplied by the interpreter into a completed one-operation program.
sub perform {
    my ($kind, $payload) = @_;
    return {
        tag          => 'await',
        operation    => { kind => $kind, payload => $payload },
        continuation => sub { return pure($_[0]); },
    };
}

# Compose a program with the computation that uses its result.  In the Await
# case the current operation stays at the front and the rest is attached to
# its explicit continuation.
sub and_then {
    my ($program, $next) = @_;

    if ($program->{tag} eq 'done') {
        return $next->($program->{value});
    }

    die "Unknown program tag: $program->{tag}\n"
        unless $program->{tag} eq 'await';

    my $continuation = $program->{continuation};
    return {
        tag          => 'await',
        operation    => $program->{operation},
        continuation => sub {
            my ($value) = @_;
            return and_then($continuation->($value), $next);
        },
    };
}

# Repeatedly expose one operation, interpret it, then invoke the explicit
# continuation with the handler result.
sub run {
    my ($program, $interpreter) = @_;
    my $state = $interpreter->{initial}->();

    while ($program->{tag} eq 'await') {
        my $operation = $program->{operation};
        my $handler = $interpreter->{handlers}{ $operation->{kind} };
        die "Unhandled op: $operation->{kind}\n" unless $handler;

        my ($next_state, $value) = $handler->($state, $operation->{payload});
        $state = $next_state;
        $program = $program->{continuation}->($value);
    }

    die "Unknown program tag: $program->{tag}\n"
        unless $program->{tag} eq 'done';

    return $interpreter->{finish}->($state, $program->{value});
}

1;
