package FreeDSL::Effects;

use strict;
use warnings;
use Exporter 'import';
use FreeDSL::Core qw(perform);

our @EXPORT_OK = qw(read_line write_line log_info state_interpreter console_interpreter);

sub read_line {
    my ($question) = @_;
    return perform('io.readLine', { question => $question });
}

sub write_line {
    my ($text) = @_;
    return perform('io.writeLine', { text => $text });
}

sub log_info {
    my ($message) = @_;
    return perform('log.info', { message => $message });
}

sub state_interpreter {
    my (@input) = @_;

    return {
        initial => sub {
            return {
                input   => [@input],
                prompts => [],
                output  => [],
                logs    => [],
            };
        },
        handlers => {
            'io.readLine' => sub {
                my ($state, $payload) = @_;
                die "State interpreter has no more input\n"
                    unless @{ $state->{input} };
                my $value = shift @{ $state->{input} };
                push @{ $state->{prompts} }, $payload->{question};
                return ($state, $value);
            },
            'io.writeLine' => sub {
                my ($state, $payload) = @_;
                push @{ $state->{output} }, $payload->{text};
                return ($state, undef);
            },
            'log.info' => sub {
                my ($state, $payload) = @_;
                push @{ $state->{logs} }, $payload->{message};
                return ($state, undef);
            },
        },
        finish => sub {
            my ($state, $value) = @_;
            return { %{$state}, value => $value };
        },
    };
}

sub console_interpreter {
    my ($console) = @_;

    $console ||= {
        read_line => sub {
            my ($question) = @_;
            print "$question ";
            my $value = <STDIN>;
            die "End of input\n" unless defined $value;
            chomp $value;
            return $value;
        },
        write_line => sub { print "$_[0]\n"; },
        info       => sub { print STDERR "$_[0]\n"; },
    };

    return {
        initial  => sub { return undef; },
        handlers => {
            'io.readLine' => sub {
                my ($state, $payload) = @_;
                return ($state, $console->{read_line}->($payload->{question}));
            },
            'io.writeLine' => sub {
                my ($state, $payload) = @_;
                $console->{write_line}->($payload->{text});
                return ($state, undef);
            },
            'log.info' => sub {
                my ($state, $payload) = @_;
                $console->{info}->($payload->{message});
                return ($state, undef);
            },
        },
        finish => sub { return $_[1]; },
    };
}

1;
