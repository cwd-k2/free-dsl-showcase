package FreeDSL::Example;

use strict;
use warnings;
use Exporter 'import';
use FreeDSL::Effects qw(read_line write_line log_info);
use FreeDSL::Syntax;

our @EXPORT_OK = qw(greet);

# FreeDSL::Syntax rewrites this block into and_then calls at compile time.
effect greet {
    perform log_info('asking for a name');
    my $name = perform read_line('Your name?');
    my $greeting = "Hello, $name!";
    perform write_line($greeting);
    perform log_info('greeting written');
    return $greeting;
}

1;
