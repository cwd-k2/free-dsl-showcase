package FreeDSL::Syntax;

use strict;
use warnings;
use Filter::Simple;
use FreeDSL::Core ();

# Compile a deliberately small direct-style syntax into the explicit
# Done/Await representation.  Keeping one statement per line makes the
# accepted language obvious and avoids pretending that this is a Perl parser.
sub _compile_steps {
    my ($steps, $index, $indent) = @_;

    return "${indent}return FreeDSL::Core::pure(undef);\n"
        if $index >= @{$steps};

    my $step = $steps->[$index];

    if ($step->{type} eq 'return') {
        die "return must be the last statement in an effect block\n"
            if $index + 1 < @{$steps};
        return "${indent}return FreeDSL::Core::pure($step->{expression});\n";
    }

    if ($step->{type} eq 'statement') {
        return "$indent$step->{source}\n"
            . _compile_steps($steps, $index + 1, $indent);
    }

    my $inner = $indent . '    ';
    my $compiled = "${indent}return FreeDSL::Core::and_then(\n"
        . "$inner$step->{expression},\n"
        . "${inner}sub {\n";

    if (defined $step->{binding}) {
        $compiled .= "$inner    my ($step->{binding}) = \@_;\n";
    }

    $compiled .= _compile_steps($steps, $index + 1, $inner . '    ');
    $compiled .= $inner . "}\n";
    $compiled .= $indent . ");\n";
    return $compiled;
}

sub _compile_effect {
    my ($name, $body, $indent) = @_;
    my @steps;

    for my $line (split /\n/, $body) {
        next if $line =~ /^\s*(?:#.*)?$/;

        if ($line =~ /^\s*my\s+(\$[A-Za-z_]\w*)\s*=\s*perform\s+(.+);\s*$/) {
            push @steps, { type => 'perform', binding => $1, expression => $2 };
            next;
        }

        if ($line =~ /^\s*perform\s+(.+);\s*$/) {
            push @steps, { type => 'perform', expression => $1 };
            next;
        }

        if ($line =~ /^\s*return\s+(.+);\s*$/) {
            push @steps, { type => 'return', expression => $1 };
            next;
        }

        if ($line =~ /^\s*(.+;)\s*$/) {
            push @steps, { type => 'statement', source => $1 };
            next;
        }

        die "Unsupported statement in effect $name: $line\n";
    }

    return "${indent}sub $name {\n"
        . _compile_steps(\@steps, 0, $indent . '    ')
        . "${indent}}\n";
}

sub _transform {
    my ($source) = @_;

    $source =~ s{
        ^([\x20\t]*)effect[\x20\t]+([A-Za-z_]\w*)[\x20\t]*\{[\x20\t]*\n
        (.*?)
        ^\1\}[\x20\t]*;?[\x20\t]*(?:\n|\z)
    }{_compile_effect($2, $3, $1)}egmsx;

    return $source;
}

FILTER { $_ = _transform($_); };

1;
