use strict;
use warnings;
use FindBin qw($Bin);
use lib "$Bin/../lib";

use FreeDSL::Core qw(run);
use FreeDSL::Effects qw(console_interpreter);
use FreeDSL::Example qw(greet);

run(greet(), console_interpreter());
