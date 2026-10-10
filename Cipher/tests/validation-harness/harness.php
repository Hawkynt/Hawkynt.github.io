namespace {
/*
 * Vector harness appended to a transpiled PHP algorithm by
 * tests/TranspilerValidation.js (the VALIDATION category).
 * (c)2006-2025 Hawkynt
 *
 * The spec placeholder below is replaced by the harness spec the reference
 * run produced: the algorithms the file registers, and per vector the fields
 * to apply, in TestEngine order, and the checks the reference passed. Each
 * vector is applied with the semantics of TestEngine.ConfigureInstance: a
 * field that reaches no setter or property, or whose setter throws, fails the
 * vector. The transpiled code keeps JavaScript's values (php-runtime.php): an
 * array is a \JS\JsArray, a vector a \JS\Obj or a TestCase.
 *
 * Output protocol (one line each, parsed by the validation):
 *   @@ALGO <a> MISSING <message>
 *   @@ALGO <a> COUNT <n>
 *   @@VEC <a> <v> PASS
 *   @@VEC <a> <v> FAIL <message>
 *   @@DONE
 */

/** The identity cipher of tests/DummyBlockCipher.js, for mode vectors naming no cipher */
#[\AllowDynamicProperties]
final class VhDummyCipher implements \ArrayAccess {
  use \JS\ObjectBehavior;
  public $algorithm; public $BlockSize = 16; public $isInverse = false; private $_key = null; public $inputBuffer = [];
  public function __construct() {
    $this->algorithm = \JS\obj(['name' => 'DummyBlockCipher', 'BlockSize' => 16, 'CreateInstance' => function ($isInverse = false) { return new VhDummyCipher(); }]);
  }
  public function set_key($bytes) { $this->_key = $bytes ? vh_list($bytes) : null; }
  public function get_key() { return $this->_key === null ? null : new \JS\JsArray($this->_key); }
  public function Feed($data) { if ($data) foreach (vh_list($data) as $b) $this->inputBuffer[] = $b; }
  public function Result() {
    if (!$this->_key) throw new \JS\Error('Key not set');
    $out = [];
    for ($i = 0; $i < \count($this->inputBuffer); $i += 16) {
      $block = \array_slice($this->inputBuffer, $i, 16);
      while (\count($block) < 16) $block[] = 0;
      for ($j = 0; $j < 16; ++$j) $out[] = $block[$j] ^ $this->_key[$j % \count($this->_key)];
    }
    $this->inputBuffer = [];
    return new \JS\JsArray($out);
  }
}

function vh_line($text) { return \preg_replace('/\s*[\r\n]+\s*/', ' | ', (string)$text); }

function vh_describe(\Throwable $e) {
  $v = \JS\caught($e);
  if ($v instanceof \JS\Error) return $v->name . ': ' . $v->message;
  return 'thrown: ' . \JS\toStr($v);
}

function vh_list($v) {
  if ($v instanceof \JS\JsArray) return $v->toList();
  if (\is_array($v)) return $v;
  return null;
}

function vh_same($a, $b) {
  $a = vh_list($a); $b = vh_list($b);
  if ($a === null || $b === null || \count($a) !== \count($b)) return false;
  foreach ($a as $k => $x) {
    $y = $b[$k];
    if (!(\is_int($x) || \is_float($x)) || !(\is_int($y) || \is_float($y)) || $x != $y) return false;
  }
  return true;
}

function vh_hex($v) {
  $list = vh_list($v);
  if ($list === null) return \JS\toStr($v);
  $s = '';
  foreach ($list as $b) $s .= (\is_int($b) && $b >= 0 && $b < 256) ? \sprintf('%02x', $b) : '<' . \JS\toStr($b) . '>';
  return $s;
}

/** The last registration of that name (bundled dependencies register first) */
function vh_find($name) {
  $all = \AlgorithmFramework\M::$Algorithms;
  if (!$all) return null;
  for ($i = \count($all) - 1; $i >= 0; --$i) {
    $a = $all[$i];
    if ($a !== null && $a->name === $name) return $a;
  }
  return null;
}

function vh_set_field($field, callable $apply) {
  try {
    $apply();
  } catch (\Throwable $e) {
    throw new \JS\Error("Setting vector field '" . $field . "' failed: " . vh_describe($e));
  }
}

/** A setter method of that name, else a property of the field's name */
function vh_apply($instance, $field, $setter, $value) {
  if ($setter !== null && \method_exists($instance, $setter)) {
    vh_set_field($field, function () use ($instance, $setter, $value) { $instance->$setter($value); });
    return true;
  }
  if (\JS\has($instance, $field)) {
    vh_set_field($field, function () use ($instance, $field, $value) { \JS\setProp($instance, $field, $value); });
    return true;
  }
  return false;
}

function vh_configure($spec, $plan, $instance, $vector) {
  $applied = [];
  if ($spec['isMode']) {
    $mode = $plan['mode'];
    $cipher = null;
    if ($mode['cipher'] !== null) {
      $names = ['AES' => 'Rijndael (AES)', 'Rijndael' => 'Rijndael (AES)', 'DES' => 'DES', '3DES' => '3DES (Triple DES)', 'Blowfish' => 'Blowfish', 'Camellia' => 'Camellia', 'ARIA' => 'ARIA'];
      $found = vh_find($names[$mode['cipher']] ?? $mode['cipher']) ?? vh_find($mode['cipher']);
      if ($found !== null) $cipher = $found->CreateInstance(false);
      if ($cipher === null) throw new \JS\Error("Vector field 'cipher' is not applied: no block cipher named '" . $mode['cipher'] . "' is registered");
    } else {
      $cipher = new VhDummyCipher();
    }
    if (!$spec['multiKey']) $cipher->key = $mode['keyTruthy'] ? \JS\getProp($vector, 'key') : new \JS\JsArray(\range(0, 15));
    if (\in_array('cipher', $plan['fields'], true)) $applied['cipher'] = true;
    if (\in_array('key', $plan['fields'], true) && !$spec['multiKey']) $applied['key'] = true;
    if (\method_exists($instance, 'setBlockCipher')) $instance->setBlockCipher($cipher);
    if (\method_exists($instance, 'setIV')) {
      if ($mode['ivTruthy']) {
        $iv = \JS\getProp($vector, 'iv');
        vh_set_field('iv', function () use ($instance, $iv) { $instance->setIV($iv); });
        $applied['iv'] = true;
      } else {
        $instance->setIV(new \JS\JsArray(\range(0, 15)));
      }
    }
  }

  foreach ($plan['steps'] as $step) {
    $field = $step['field'];
    $value = \JS\getProp($vector, $field);
    if (($step['kind'] ?? null) === 'kek') {
      $asKek = vh_apply($instance, 'kek', 'setKEK', $value);
      $asKey = !\method_exists($instance, 'setKEK') && \method_exists($instance, 'setKey') && vh_apply($instance, 'key', 'setKey', $value);
      if ($asKek || $asKey) $applied['kek'] = true;
    } elseif (vh_apply($instance, $field, $step['setter'] ?? null, $value)) {
      $applied[$field] = true;
    }
  }

  foreach ($plan['fields'] as $field)
    if (!isset($applied[$field]))
      throw new \JS\Error("Vector field '" . $field . "' is not applied: " . $spec['name'] . ' has no setter or property of that name');
}

function vh_run($algorithm, $spec, $plan, $vector, $inverse, $input) {
  $instance = $algorithm->CreateInstance($inverse);
  if ($instance === null) throw new \JS\Error('Failed to create algorithm instance (inverse=' . ($inverse ? 'true' : 'false') . ')');
  vh_configure($spec, $plan, $instance, $vector);
  $instance->Feed($input);
  return $instance->Result();
}

function vh_check($algorithm, $spec, $plan, $vector) {
  $input = \JS\getProp($vector, 'input');
  $output = vh_run($algorithm, $spec, $plan, $vector, $plan['inverse'], $input);
  $expected = \JS\getProp($vector, 'expected');
  if ($plan['expect'] && !vh_same($output, $expected))
    return 'output ' . vh_hex($output) . ' expected ' . vh_hex($expected);
  if ($plan['rt'] === 'decode') {
    $back = vh_run($algorithm, $spec, $plan, $vector, !$plan['inverse'], $output);
    if (!vh_same($back, $input)) return 'round trip gave ' . vh_hex($back) . ' expected the input ' . vh_hex($input);
  } elseif ($plan['rt'] === 'stability') {
    $decoded = vh_run($algorithm, $spec, $plan, $vector, true, $output);
    $again = vh_run($algorithm, $spec, $plan, $vector, false, $decoded);
    if (!vh_same($again, $output)) return 'encoding is not stable: re-encoding gave ' . vh_hex($again) . ' expected ' . vh_hex($output);
  }
  return null;
}

function vh_main($spec) {
  foreach ($spec['algorithms'] as $a => $algo) {
    try {
      $algorithm = vh_find($algo['name']);
    } catch (\Throwable $e) {
      echo '@@ALGO ', $a, ' MISSING ', vh_line(vh_describe($e)), "\n";
      continue;
    }
    if ($algorithm === null) {
      echo '@@ALGO ', $a, " MISSING no algorithm named '", vh_line($algo['name']), "' is registered\n";
      continue;
    }
    $tests = $algorithm->tests ? vh_list($algorithm->tests) : [];
    if (\count($tests) !== \count($algo['vectors'])) echo '@@ALGO ', $a, ' COUNT ', \count($tests), "\n";
    foreach ($algo['vectors'] as $v => $plan) {
      try {
        $failure = $v < \count($tests) ? vh_check($algorithm, $algo, $plan, $tests[$v]) : 'vector missing';
      } catch (\Throwable $e) {
        $failure = vh_describe($e);
      }
      echo '@@VEC ', $a, ' ', $v, $failure === null ? ' PASS' : ' FAIL ' . vh_line($failure), "\n";
    }
  }
  echo "@@DONE\n";
}

vh_main(\json_decode(__SPEC_JSON__, true));
}
