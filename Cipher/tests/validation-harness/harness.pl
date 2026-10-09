
# ---------------------------------------------------------------------------
# Vector harness appended to a transpiled Perl algorithm by
# tests/TranspilerValidation.js (the VALIDATION category). (c)2006-2025 Hawkynt
#
# The spec placeholder below is replaced by the harness spec of the reference run: the
# algorithms the file registers and, per vector, the fields to apply in
# TestEngine order and the checks the reference passed. Fields are applied with
# the semantics of TestEngine.ConfigureInstance: a field that reaches no setter
# or property, or whose setter dies, fails the vector.
#
# Output protocol: @@ALGO <a> MISSING <msg> | @@ALGO <a> COUNT <n> |
#                  @@VEC <a> <v> PASS | @@VEC <a> <v> FAIL <msg> | @@DONE
# ---------------------------------------------------------------------------
package _ValidationHarness;
use strict;
use warnings;
use JSON::PP ();
use Scalar::Util ();

$| = 1;

my $SPEC = JSON::PP->new->decode(__SPEC_JSON__);
my @DEFAULT_BYTES = (0 .. 15);
my %CIPHER_NAMES = ('AES' => 'Rijndael (AES)', 'Rijndael' => 'Rijndael (AES)', 'DES' => 'DES',
    '3DES' => '3DES (Triple DES)', 'Blowfish' => 'Blowfish', 'Camellia' => 'Camellia', 'ARIA' => 'ARIA');

sub one_line {
    my ($text) = @_;
    $text = defined $text ? "$text" : 'undef';
    $text =~ s/\s*[\r\n]+\s*/ | /g;
    $text =~ s/\s+\|\s*$//;
    return $text;
}

sub is_hash { my ($v) = @_; return ref($v) && Scalar::Util::reftype($v) eq 'HASH'; }

sub registry {
    my @all = @main::_registered_algorithms;
    push @all, $main::algorithmInstance
        if defined $main::algorithmInstance && !grep { $_ == $main::algorithmInstance } @all;
    return @all;
}

sub find_algorithm {
    my ($name) = @_;
    my $hit;
    for my $algo (registry()) {
        $hit = $algo if is_hash($algo) && defined $algo->{name} && $algo->{name} eq $name;
    }
    return $hit;
}

sub field_exists { my ($vector, $name) = @_; return is_hash($vector) && exists $vector->{$name}; }
sub field { my ($vector, $name) = @_; return is_hash($vector) ? $vector->{$name} : undef; }

sub as_list {
    my ($v) = @_;
    return $v;
}

sub same_bytes {
    my ($l, $r) = @_;
    return 0 unless ref($l) eq 'ARRAY' && ref($r) eq 'ARRAY' && scalar(@$l) == scalar(@$r);
    for my $i (0 .. $#$l) {
        my ($x, $y) = ($l->[$i], $r->[$i]);
        return 0 unless defined $x && defined $y && !ref($x) && !ref($y);
        return 0 unless Scalar::Util::looks_like_number($x) && Scalar::Util::looks_like_number($y) && $x == $y;
    }
    return 1;
}

sub hex_of {
    my ($v) = @_;
    return defined $v ? "<$v>" : '<undef>' unless ref($v) eq 'ARRAY';
    return join('', map {
        (defined $_ && !ref($_) && Scalar::Util::looks_like_number($_) && $_ == int($_) && $_ >= 0 && $_ < 256)
            ? sprintf('%02x', $_) : '<' . (defined $_ ? $_ : 'undef') . '>'
    } @$v);
}

sub set_field {
    my ($field, $apply) = @_;
    eval { $apply->(); 1 } or do {
        my $error = $@;
        die "Setting vector field '$field' failed: " . one_line($error) . "\n";
    };
}

# A setter method of that name, else a property (an accessor or a hash entry) of the field's name
sub apply_property {
    my ($instance, $field, $setter, $value) = @_;
    if (defined $setter && $instance->can($setter)) {
        set_field($field, sub { $instance->$setter($value) });
        return 1;
    }
    if ($instance->can($field)) {
        set_field($field, sub { $instance->$field($value) });
        return 1;
    }
    if (exists $instance->{$field}) {
        set_field($field, sub { $instance->{$field} = $value });
        return 1;
    }
    return 0;
}

sub configure {
    my ($spec, $plan, $instance, $vector) = @_;
    my %applied;
    my %fields = map { $_ => 1 } @{$plan->{fields}};
    if ($spec->{isMode}) {
        my $mode = $plan->{mode};
        my $cipher;
        if (defined $mode->{cipher}) {
            my $found = find_algorithm($CIPHER_NAMES{$mode->{cipher}} // $mode->{cipher}) // find_algorithm($mode->{cipher});
            $cipher = $found->CreateInstance(0) if $found;
            die "Vector field 'cipher' is not applied: no block cipher named '$mode->{cipher}' is registered\n" unless $cipher;
        } else {
            $cipher = _ValidationHarness::DummyInstance->new(_ValidationHarness::DummyAlgorithm->new());
        }
        if (!$spec->{multiKey}) {
            my $key = $mode->{keyTruthy} ? field($vector, 'key') : [@DEFAULT_BYTES];
            if ($cipher->can('key')) { $cipher->key($key); } else { $cipher->{key} = $key; }
        }
        $applied{cipher} = 1 if $fields{cipher};
        $applied{key} = 1 if $fields{key} && !$spec->{multiKey};
        $instance->setBlockCipher($cipher) if $instance->can('setBlockCipher');
        if ($instance->can('setIV')) {
            if ($mode->{ivTruthy}) {
                my $iv = field($vector, 'iv');
                set_field('iv', sub { $instance->setIV($iv) });
                $applied{iv} = 1;
            } else {
                $instance->setIV([@DEFAULT_BYTES]);
            }
        }
    }

    for my $step (@{$plan->{steps}}) {
        my $name = $step->{field};
        die "Vector field '$name' is missing from the transpiled vector\n" unless field_exists($vector, $name);
        my $value = field($vector, $name);
        if (defined $step->{kind} && $step->{kind} eq 'kek') {
            my $as_kek = apply_property($instance, 'kek', 'setKEK', $value);
            my $as_key = !$instance->can('setKEK') && $instance->can('setKey')
                && apply_property($instance, 'key', 'setKey', $value);
            $applied{kek} = 1 if $as_kek || $as_key;
        } elsif (apply_property($instance, $name, $step->{setter}, $value)) {
            $applied{$name} = 1;
        }
    }

    for my $name (@{$plan->{fields}}) {
        die "Vector field '$name' is not applied: $spec->{name} has no setter or property of that name\n"
            unless $applied{$name};
    }
}

sub run_once {
    my ($algorithm, $spec, $plan, $vector, $inverse, $data) = @_;
    my $instance = $algorithm->CreateInstance($inverse ? 1 : 0);
    die 'Failed to create algorithm instance (inverse=' . ($inverse ? 1 : 0) . ")\n" unless defined $instance;
    configure($spec, $plan, $instance, $vector);
    $instance->Feed($data);
    return as_list($instance->Result());
}

sub check_vector {
    my ($algorithm, $spec, $plan, $vector) = @_;
    my $data = field($vector, 'input');
    my $output = run_once($algorithm, $spec, $plan, $vector, $plan->{inverse}, $data);
    if ($plan->{expect}) {
        my $expected = field($vector, 'expected');
        return 'output ' . hex_of($output) . ' expected ' . hex_of($expected) unless same_bytes($output, $expected);
    }
    my $rt = $plan->{rt} // '';
    if ($rt eq 'decode') {
        my $back = run_once($algorithm, $spec, $plan, $vector, !$plan->{inverse}, $output);
        return 'round trip gave ' . hex_of($back) . ' expected the input ' . hex_of($data) unless same_bytes($back, $data);
    } elsif ($rt eq 'stability') {
        my $decoded = run_once($algorithm, $spec, $plan, $vector, 1, $output);
        my $again = run_once($algorithm, $spec, $plan, $vector, 0, $decoded);
        return 'encoding is not stable: re-encoding gave ' . hex_of($again) . ' expected ' . hex_of($output)
            unless same_bytes($again, $output);
    }
    return undef;
}

sub main {
    my $algorithms = $SPEC->{algorithms};
    for my $ai (0 .. $#$algorithms) {
        my $spec = $algorithms->[$ai];
        my $algorithm = eval { find_algorithm($spec->{name}) };
        if ($@) { print "\@\@ALGO $ai MISSING " . one_line($@) . "\n"; next; }
        if (!$algorithm) { print "\@\@ALGO $ai MISSING no algorithm named '" . one_line($spec->{name}) . "' is registered\n"; next; }
        my $tests = ref($algorithm->{tests}) eq 'ARRAY' ? $algorithm->{tests} : [];
        my $count = scalar(@{$spec->{vectors}});
        print "\@\@ALGO $ai COUNT " . scalar(@$tests) . "\n" if scalar(@$tests) != $count;
        for my $v (0 .. $count - 1) {
            my $failure = eval {
                $v < scalar(@$tests) ? check_vector($algorithm, $spec, $spec->{vectors}->[$v], $tests->[$v]) : 'vector missing';
            };
            $failure = one_line($@) if !defined $failure && $@;
            print "\@\@VEC $ai $v " . (defined $failure ? 'FAIL ' . one_line($failure) : 'PASS') . "\n";
        }
    }
    print "\@\@DONE\n";
}

# The identity cipher of tests/DummyBlockCipher.js, for mode vectors naming no cipher
package _ValidationHarness::DummyAlgorithm;
sub new { return bless { name => 'DummyBlockCipher', BlockSize => 16 }, shift; }
sub CreateInstance { my ($self) = @_; return _ValidationHarness::DummyInstance->new($self); }

package _ValidationHarness::DummyInstance;
sub new {
    my ($class, $algorithm) = @_;
    return bless { algorithm => $algorithm, BlockSize => 16, isInverse => 0, _key => undef, inputBuffer => [] }, $class;
}
sub key {
    my $self = shift;
    if (@_) { my $k = shift; $self->{_key} = $k ? [@$k] : undef; }
    return $self->{_key} ? [@{$self->{_key}}] : undef;
}
sub Feed { my ($self, $data) = @_; push @{$self->{inputBuffer}}, @$data if ref($data) eq 'ARRAY'; }
sub Result {
    my ($self) = @_;
    die "Key not set\n" unless $self->{_key};
    my @buffer = @{$self->{inputBuffer}};
    my @key = @{$self->{_key}};
    my @out;
    for (my $i = 0; $i < scalar(@buffer); $i += 16) {
        for my $j (0 .. 15) {
            my $byte = $i + $j < scalar(@buffer) ? $buffer[$i + $j] : 0;
            push @out, $byte ^ $key[$j % scalar(@key)];
        }
    }
    $self->{inputBuffer} = [];
    return \@out;
}

package main;
_ValidationHarness::main();
