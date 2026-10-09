<?php
/*
 * php-runtime.php - JavaScript semantics for transpiled PHP
 * (c)2006-2025 Hawkynt
 *
 * The PHP target (codingplugins/php.js) emits the JavaScript reference output
 * as PHP. What JavaScript means by its values and operators that PHP spells
 * differently lives here, in the JS namespace:
 *   - undefined and null are null; a number is an int or a float; a BigInt is
 *     a GMP number (the gmp extension); a string is a PHP string
 *   - an Array or a typed array is a JsArray: an object, so it is shared by
 *     reference as in JavaScript; a typed array converts what is stored in it
 *     to its element type, and a view (subarray, a typed array over another's
 *     buffer, a DataView) reads and writes the storage it views
 *   - a plain object is an Obj, a Map a Map, a Set a Set
 *   - the operators whose JavaScript meaning differs from PHP's (the 32-bit
 *     bitwise operators, +, ===, truthiness, typeof, ...) are functions
 * The emitted code inlines the bitwise operators where the IL types the
 * operands as integers, and calls these where it does not.
 */

namespace JS;

// ============================================================================
// VALUES
// ============================================================================

/** JavaScript ToNumber */
function toNumber($v) {
  if (\is_int($v) || \is_float($v)) return $v;
  if ($v === null) return 0;
  if (\is_bool($v)) return $v ? 1 : 0;
  if (\is_string($v)) {
    $t = \trim($v);
    if ($t === '') return 0;
    if (\preg_match('/^[+-]?0[xX][0-9a-fA-F]+$/', $t)) return \intval(\ltrim($t, '+'), 16) * ($t[0] === '-' ? -1 : 1);
    if (\preg_match('/^0[bB][01]+$/', $t)) return \bindec(\substr($t, 2));
    if (\preg_match('/^0[oO][0-7]+$/', $t)) return \octdec(\substr($t, 2));
    if ($t === 'Infinity' || $t === '+Infinity') return \INF;
    if ($t === '-Infinity') return -\INF;
    if (\is_numeric($t)) return $t + 0;
    return \NAN;
  }
  if ($v instanceof \GMP) throw new TypeError('Cannot convert a BigInt value to a number');
  if ($v instanceof JsArray) {
    $n = $v->length();
    if ($n === 0) return 0;
    if ($n === 1) return toNumber($v->getAt(0));
    return \NAN;
  }
  return \NAN;
}

/** JavaScript ToInt32 */
function toInt32($v) {
  if (!\is_int($v)) {
    if (\is_float($v)) {
      if (\is_nan($v) || \is_infinite($v)) return 0;
      $v = \fmod($v < 0 ? \ceil($v) : \floor($v), 4294967296.0);
      $v = (int)$v;
    } else {
      $n = toNumber($v);
      return toInt32(\is_float($n) || \is_int($n) ? $n : 0);
    }
  }
  return (($v & 0xFFFFFFFF) ^ 0x80000000) - 0x80000000;
}

/** JavaScript ToUint32 */
function toUint32($v) {
  if (\is_int($v)) return $v & 0xFFFFFFFF;
  return toInt32($v) & 0xFFFFFFFF;
}

/** An integer for a bitwise operator: a PHP int as it is, anything else by ToInt32 */
function i($v) {
  return \is_int($v) ? $v : toInt32($v);
}

/** JavaScript ToString */
function toStr($v): string {
  if (\is_string($v)) return $v;
  if (\is_int($v)) return (string)$v;
  if ($v === null) return 'undefined';
  if (\is_bool($v)) return $v ? 'true' : 'false';
  if (\is_float($v)) return numberToString($v);
  if ($v instanceof \GMP) return \gmp_strval($v);
  if ($v instanceof JsArray) return $v->join(',');
  if ($v instanceof Error) return $v->name . ($v->message !== '' ? ': ' . $v->message : '');
  if ($v instanceof \Closure) return 'function () { [native code] }';
  if (\is_object($v) && \method_exists($v, 'toString')) return toStr($v->toString());
  return '[object Object]';
}

/** A JavaScript number's decimal text */
function numberToString($f, int $radix = 10): string {
  if (\is_int($f)) {
    if ($radix === 10) return (string)$f;
    $neg = $f < 0;
    $s = \base_convert((string)\abs($f), 10, $radix);
    if (\abs($f) > 0x1FFFFFFFFFFFFF) $s = \gmp_strval(\gmp_init((string)\abs($f)), $radix);
    return ($neg ? '-' : '') . $s;
  }
  if (\is_nan($f)) return 'NaN';
  if (\is_infinite($f)) return $f > 0 ? 'Infinity' : '-Infinity';
  if ($radix !== 10) {
    if ($f == \floor($f) && \abs($f) < 9.007199254740992E15) return numberToString((int)$f, $radix);
    $neg = $f < 0; $f = \abs($f);
    $int = \floor($f); $frac = $f - $int;
    $s = numberToString((int)$int, $radix) . '.';
    for ($k = 0; $k < 52 && $frac > 0; ++$k) { $frac *= $radix; $d = (int)\floor($frac); $s .= \base_convert((string)$d, 10, $radix); $frac -= $d; }
    return ($neg ? '-' : '') . $s;
  }
  if ($f == 0) return '0';
  if ($f == \floor($f) && \abs($f) < 1e21) return \sprintf('%.0f', $f);
  $s = \json_encode($f);
  // JSON's shortest round trip text, in JavaScript's spelling of the exponent
  $s = \str_replace(['E', 'e+'], ['e', 'e+'], $s);
  if (\preg_match('/^(-?\d+)\.0e(.*)$/', $s, $m)) $s = $m[1] . 'e' . $m[2];
  if (\preg_match('/e(\d)/', $s)) $s = \preg_replace('/e(\d)/', 'e+$1', $s);
  return $s;
}

/** JavaScript truthiness */
function truthy($v): bool {
  if (\is_bool($v)) return $v;
  if ($v === null) return false;
  if (\is_int($v)) return $v !== 0;
  if (\is_float($v)) return $v != 0 && !\is_nan($v);
  if (\is_string($v)) return $v !== '';
  if ($v instanceof \GMP) return \gmp_sign($v) !== 0;
  return true;
}

/** JavaScript typeof */
function typeOf($v): string {
  if ($v === null) return 'undefined';
  if (\is_bool($v)) return 'boolean';
  if (\is_int($v) || \is_float($v)) return 'number';
  if (\is_string($v)) return 'string';
  if ($v instanceof \GMP) return 'bigint';
  if ($v instanceof \Closure) return 'function';
  return 'object';
}

/** JavaScript === */
function strictEq($a, $b): bool {
  if ((\is_int($a) || \is_float($a)) && (\is_int($b) || \is_float($b))) return $a == $b;
  if ($a instanceof \GMP && $b instanceof \GMP) return \gmp_cmp($a, $b) === 0;
  return $a === $b;
}

/** JavaScript == */
function looseEq($a, $b): bool {
  if ($a === null || $b === null) return $a === $b;
  if (\is_object($a) && \is_object($b)) return $a === $b;
  if ($a instanceof \GMP || $b instanceof \GMP) {
    try { return \gmp_cmp(toBigInt($a), toBigInt($b)) === 0; } catch (\Throwable $e) { return false; }
  }
  if (\is_string($a) && \is_string($b)) return $a === $b;
  if (\is_bool($a)) $a = $a ? 1 : 0;
  if (\is_bool($b)) $b = $b ? 1 : 0;
  if (\is_object($a)) $a = toStr($a);
  if (\is_object($b)) $b = toStr($b);
  if (\is_string($a) && \is_string($b)) return $a === $b;
  return toNumber($a) == toNumber($b);
}

/** JavaScript + */
function add($a, $b) {
  if ((\is_int($a) || \is_float($a)) && (\is_int($b) || \is_float($b))) return $a + $b;
  if (\is_string($a) || \is_string($b)) return toStr($a) . toStr($b);
  if ($a instanceof \GMP && $b instanceof \GMP) return $a + $b;
  if (\is_object($a) || \is_object($b)) return toStr($a) . toStr($b);
  return toNumber($a) + toNumber($b);
}

/** JavaScript - * / % ** on numbers (a BigInt pair keeps BigInt semantics) */
function sub($a, $b) { return ($a instanceof \GMP) ? $a - $b : toNumber($a) - toNumber($b); }
function mul($a, $b) {
  if ($a instanceof \GMP) return $a * $b;
  $a = toNumber($a); $b = toNumber($b);
  $p = $a * $b;
  // Past 2^53 a JavaScript product is the double nearest, not PHP's exact integer
  if (\is_int($p) && ($p > 9007199254740992 || $p < -9007199254740992)) $p = (float)$a * (float)$b;
  return num($p);
}
function div($a, $b) {
  if ($a instanceof \GMP) return bigDiv($a, $b);
  $a = toNumber($a); $b = toNumber($b);
  if ($b == 0) {
    if ($a == 0 || \is_nan($a)) return \NAN;
    $negative = ($a < 0) !== (\is_float($b) && \fdiv(1, $b) < 0);
    return $negative ? -\INF : \INF;
  }
  $q = $a / $b;
  return $q;
}
function mod($a, $b) {
  if ($a instanceof \GMP) return bigMod($a, $b);
  $a = toNumber($a); $b = toNumber($b);
  if (\is_int($a) && \is_int($b) && $b !== 0) return $a % $b;
  if ($b == 0 || \is_nan($a) || \is_nan($b) || \is_infinite($a)) return \NAN;
  if (\is_infinite($b)) return $a;
  return num(\fmod($a, $b));
}
function pow($a, $b) {
  if ($a instanceof \GMP) return \gmp_pow($a, \gmp_intval(toBigInt($b)));
  return num(toNumber($a) ** toNumber($b));
}

/** A float that is a whole number in the safe range as an int (JavaScript does not tell them apart) */
function num($v) {
  if (\is_float($v) && $v == \floor($v) && \abs($v) <= 9007199254740992.0) return (int)$v;
  return $v;
}

/** JavaScript < > <= >= */
function lt($a, $b): bool { return compare($a, $b) === -1; }
function gt($a, $b): bool { return compare($a, $b) === 1; }
function le($a, $b): bool { $c = compare($a, $b); return $c === -1 || $c === 0; }
function ge($a, $b): bool { $c = compare($a, $b); return $c === 1 || $c === 0; }
/** -1, 0, 1, or null when either side is NaN */
function compare($a, $b) {
  if (\is_string($a) && \is_string($b)) return $a < $b ? -1 : ($a > $b ? 1 : 0);
  if ($a instanceof \GMP || $b instanceof \GMP) {
    if (\is_float($a) || \is_float($b)) { $x = \is_float($a) ? $a : (float)\gmp_strval($a); $y = \is_float($b) ? $b : (float)\gmp_strval($b); return $x < $y ? -1 : ($x > $y ? 1 : 0); }
    $c = \gmp_cmp(toBigInt($a), toBigInt($b));
    return $c < 0 ? -1 : ($c > 0 ? 1 : 0);
  }
  $x = toNumber($a); $y = toNumber($b);
  if (\is_nan($x) || \is_nan($y)) return null;
  return $x < $y ? -1 : ($x > $y ? 1 : 0);
}

/** JavaScript's 32-bit bitwise operators on any values */
function band($a, $b) { if ($a instanceof \GMP) return $a & toBigInt($b); return ((i($a) & i($b)) << 32) >> 32; }
function bor($a, $b) { if ($a instanceof \GMP) return $a | toBigInt($b); return ((i($a) | i($b)) << 32) >> 32; }
function bxor($a, $b) { if ($a instanceof \GMP) return $a ^ toBigInt($b); return ((i($a) ^ i($b)) << 32) >> 32; }
function bnot($a) { if ($a instanceof \GMP) return ~$a; return (~i($a) << 32) >> 32; }
function shl($a, $b) {
  if ($a instanceof \GMP) return bigShl($a, $b);
  return ((i($a) << (i($b) & 31)) << 32) >> 32;
}
function sar($a, $b) {
  if ($a instanceof \GMP) return bigShr($a, $b);
  return ((i($a) << 32) >> 32) >> (i($b) & 31);
}
function shr($a, $b) { return (i($a) & 0xFFFFFFFF) >> (i($b) & 31); }
function neg($a) { if ($a instanceof \GMP) return -$a; $n = toNumber($a); return $n === 0 ? -0.0 : -$n; }

// ============================================================================
// BIGINT (GMP)
// ============================================================================

/** JavaScript BigInt(x) */
function toBigInt($v) {
  if ($v instanceof \GMP) return $v;
  if (\is_int($v)) return \gmp_init($v);
  if (\is_bool($v)) return \gmp_init($v ? 1 : 0);
  if (\is_float($v)) {
    if ($v != \floor($v) || \is_infinite($v) || \is_nan($v)) throw new RangeError('The number ' . numberToString($v) . ' cannot be converted to a BigInt because it is not an integer');
    return \gmp_init(\sprintf('%.0f', $v));
  }
  if (\is_string($v)) {
    $t = \trim($v);
    if ($t === '') return \gmp_init(0);
    if (\preg_match('/^0[xX]([0-9a-fA-F]+)$/', $t, $m)) return \gmp_init($m[1], 16);
    if (\preg_match('/^0[bB]([01]+)$/', $t, $m)) return \gmp_init($m[1], 2);
    if (\preg_match('/^0[oO]([0-7]+)$/', $t, $m)) return \gmp_init($m[1], 8);
    if (\preg_match('/^[+-]?\d+$/', $t)) return \gmp_init(\ltrim($t, '+'), 10);
    throw new SyntaxError('Cannot convert ' . $v . ' to a BigInt');
  }
  throw new TypeError('Cannot convert ' . toStr($v) . ' to a BigInt');
}

/** A BigInt literal */
function big(string $digits) { return \gmp_init($digits, 10); }

/** BigInt / (truncating) and % (sign of the dividend) */
function bigDiv($a, $b) {
  $b = toBigInt($b);
  if (\gmp_sign($b) === 0) throw new RangeError('Division by zero');
  return \gmp_div_q(toBigInt($a), $b, \GMP_ROUND_ZERO);
}
function bigMod($a, $b) {
  $b = toBigInt($b);
  if (\gmp_sign($b) === 0) throw new RangeError('Division by zero');
  return \gmp_div_r(toBigInt($a), $b, \GMP_ROUND_ZERO);
}
function bigShl($a, $b) {
  $n = \gmp_intval(toBigInt($b));
  return $n >= 0 ? toBigInt($a) << $n : bigShr($a, -$n);
}
function bigShr($a, $b) {
  $n = \gmp_intval(toBigInt($b));
  if ($n < 0) return bigShl($a, -$n);
  // Floor division by 2^n, as JavaScript's >> on a BigInt
  return \gmp_div_q(toBigInt($a), \gmp_pow(2, $n), \GMP_ROUND_MINUSINF);
}

/** BigInt.asUintN / BigInt.asIntN */
function asUintN($bits, $v) {
  $bits = (int)$bits;
  return \gmp_and(toBigInt($v), \gmp_sub(\gmp_pow(2, $bits), 1));
}
function asIntN($bits, $v) {
  $bits = (int)$bits;
  if ($bits === 0) return \gmp_init(0);
  $u = asUintN($bits, $v);
  return \gmp_cmp($u, \gmp_pow(2, $bits - 1)) >= 0 ? \gmp_sub($u, \gmp_pow(2, $bits)) : $u;
}

/** Number(x) of a BigInt or anything else */
function toNumberOf($v) {
  if ($v instanceof \GMP) {
    if (\gmp_cmp(\gmp_abs($v), \gmp_init(\PHP_INT_MAX)) <= 0) {
      $i = \gmp_intval($v);
      return \abs($i) <= 9007199254740992 ? $i : (float)$i;
    }
    return (float)\gmp_strval($v);
  }
  return toNumber($v);
}

// ============================================================================
// ARRAYS
// ============================================================================

/**
 * A JavaScript Array or typed array, shared by reference. $a holds the
 * elements of an array that owns its storage; a view (JsView, ByteView)
 * reads and writes another's.
 */
class JsArray implements \ArrayAccess, \Countable, \IteratorAggregate {
  /** @var array the elements, 0..length-1 */
  public $a;
  /** @var string 'array', or the element type of a typed array */
  public $kind;
  /** @var bool whether the elements are another's (a view), not $a */
  public $view = false;

  public function __construct(array $elements = [], string $kind = 'array') {
    $this->a = $elements;
    $this->kind = $kind;
  }

  public static function of(...$elements) { return new JsArray($elements); }

  /** A typed array of that kind holding the values, each converted */
  public static function typed(string $kind, array $values) {
    $out = [];
    foreach ($values as $v) $out[] = coerce($kind, $v);
    return new JsArray($out, $kind);
  }

  public function isTyped(): bool { return $this->kind !== 'array'; }
  public function length(): int { return \count($this->a); }
  public function getAt($i) { return $this->a[$i] ?? null; }
  public function setAt($i, $v) {
    if ($this->kind === 'array') {
      $n = \count($this->a);
      if ($i > $n) for ($k = $n; $k < $i; ++$k) $this->a[$k] = null;
      $this->a[$i] = $v;
    } elseif ($i < \count($this->a)) {
      $this->a[$i] = coerce($this->kind, $v);
    }
  }
  /** @return array the elements as a PHP list */
  public function toList(): array { return $this->a; }
  public function setLength(int $n) {
    $len = $this->length();
    if ($n < $len) $this->a = \array_slice($this->a, 0, $n);
    else for ($k = $len; $k < $n; ++$k) $this->a[$k] = null;
  }

  // ArrayAccess: the emitted code indexes with $x[$i]
  public function offsetExists($i): bool { $i = index($i); return $i !== null && $i < $this->length(); }
  public function offsetGet($i): mixed {
    // The common case first: an int index into an array that owns its storage
    if (\is_int($i) && !$this->view) return $this->a[$i] ?? null;
    if (\is_int($i)) return $this->getAt($i);
    if ($i === 'length') return $this->length();
    $i = index($i);
    return $i === null ? null : $this->getAt($i);
  }
  public function offsetSet($i, $v): void {
    if (\is_int($i) && $i >= 0 && !$this->view) {
      if ($this->kind === 'array') {
        if ($i <= \count($this->a)) { $this->a[$i] = $v; return; }
      } elseif ($i < \count($this->a)) {
        $this->a[$i] = ($this->kind === 'uint8' && \is_int($v)) ? $v & 0xFF : coerce($this->kind, $v);
        return;
      } else {
        return;
      }
    }
    if ($i === null) { $this->push($v); return; }
    if (!\is_int($i)) {
      if ($i === 'length') { $this->setLength((int)$v); return; }
      $i = index($i);
      if ($i === null) return;
    }
    if ($i < 0) return;
    $this->setAt($i, $v);
  }
  public function offsetUnset($i): void { $i = index($i); if ($i !== null && $i < $this->length()) $this->setAt($i, $this->kind === 'array' ? null : 0); }
  public function count(): int { return $this->length(); }
  public function getIterator(): \Iterator { return new \ArrayIterator($this->toList()); }

  public function __get($name) {
    if ($name === 'length') return $this->length();
    if ($name === 'buffer') return new JsBuffer($this, 0, $this->length() * elementSize($this->kind));
    if ($name === 'byteLength') return $this->length() * elementSize($this->kind);
    if ($name === 'byteOffset') return 0;
    if ($name === 'BYTES_PER_ELEMENT') return elementSize($this->kind);
    return null;
  }
  public function __set($name, $v) {
    if ($name === 'length') { $this->setLength((int)$v); return; }
  }

  /** A new array of the same kind */
  protected function like(array $list) { return new JsArray($list, $this->kind); }

  public function push(...$values) {
    if ($this->kind !== 'array') throw new TypeError('push is not a function of a typed array');
    foreach ($values as $v) $this->a[] = $v;
    return \count($this->a);
  }
  public function pop() { return \count($this->a) ? \array_pop($this->a) : null; }
  public function shift() { return \count($this->a) ? \array_shift($this->a) : null; }
  public function unshift(...$values) { \array_splice($this->a, 0, 0, $values); return \count($this->a); }
  public function slice($start = null, $end = null) {
    [$s, $e] = range2($this->length(), $start, $end);
    return $this->like(\array_slice($this->toList(), $s, \max(0, $e - $s)));
  }
  public function subarray($start = null, $end = null) {
    [$s, $e] = range2($this->length(), $start, $end);
    return new JsView($this, $s, \max(0, $e - $s));
  }
  public function splice($start = null, $count = null, ...$items) {
    $len = $this->length();
    $s = relIndex($start ?? 0, $len);
    $c = $count === null && \func_num_args() < 2 ? $len - $s : \max(0, \min((int)toNumber($count ?? 0), $len - $s));
    $list = $this->toList();
    $removed = \array_splice($list, $s, $c, $items);
    $this->a = $list;
    return new JsArray($removed);
  }
  public function concat(...$others) {
    $list = $this->toList();
    foreach ($others as $o) {
      if ($o instanceof JsArray && !$o->isTyped()) foreach ($o->toList() as $v) $list[] = $v;
      else $list[] = $o;
    }
    return new JsArray($list);
  }
  public function fill($v, $start = null, $end = null) {
    [$s, $e] = range2($this->length(), $start, $end);
    for ($k = $s; $k < $e; ++$k) $this->setAt($k, $v);
    return $this;
  }
  public function map($fn) {
    $out = [];
    foreach ($this->toList() as $k => $v) $out[] = $fn($v, $k, $this);
    return $this->isTyped() ? JsArray::typed($this->kind, $out) : new JsArray($out);
  }
  public function filter($fn) {
    $out = [];
    foreach ($this->toList() as $k => $v) if (truthy($fn($v, $k, $this))) $out[] = $v;
    return $this->like($out);
  }
  public function forEach($fn) { foreach ($this->toList() as $k => $v) $fn($v, $k, $this); return null; }
  public function reduce($fn, ...$initial) {
    $list = $this->toList();
    $k = 0;
    if ($initial) $acc = $initial[0];
    else { if (!$list) throw new TypeError('Reduce of empty array with no initial value'); $acc = $list[0]; $k = 1; }
    for ($n = \count($list); $k < $n; ++$k) $acc = $fn($acc, $list[$k], $k, $this);
    return $acc;
  }
  public function reduceRight($fn, ...$initial) {
    $list = $this->toList();
    $k = \count($list) - 1;
    if ($initial) $acc = $initial[0];
    else { if (!$list) throw new TypeError('Reduce of empty array with no initial value'); $acc = $list[$k]; --$k; }
    for (; $k >= 0; --$k) $acc = $fn($acc, $list[$k], $k, $this);
    return $acc;
  }
  public function indexOf($v, $from = 0) {
    $list = $this->toList();
    for ($k = relIndex($from, \count($list)), $n = \count($list); $k < $n; ++$k) if (strictEq($list[$k], $v)) return $k;
    return -1;
  }
  public function lastIndexOf($v) {
    $list = $this->toList();
    for ($k = \count($list) - 1; $k >= 0; --$k) if (strictEq($list[$k], $v)) return $k;
    return -1;
  }
  public function includes($v) {
    foreach ($this->toList() as $x) if (strictEq($x, $v) || (\is_float($x) && \is_float($v) && \is_nan($x) && \is_nan($v))) return true;
    return false;
  }
  public function find($fn) { foreach ($this->toList() as $k => $v) if (truthy($fn($v, $k, $this))) return $v; return null; }
  public function findIndex($fn) { foreach ($this->toList() as $k => $v) if (truthy($fn($v, $k, $this))) return $k; return -1; }
  public function findLast($fn) { $l = $this->toList(); for ($k = \count($l) - 1; $k >= 0; --$k) if (truthy($fn($l[$k], $k, $this))) return $l[$k]; return null; }
  public function findLastIndex($fn) { $l = $this->toList(); for ($k = \count($l) - 1; $k >= 0; --$k) if (truthy($fn($l[$k], $k, $this))) return $k; return -1; }
  public function every($fn) { foreach ($this->toList() as $k => $v) if (!truthy($fn($v, $k, $this))) return false; return true; }
  public function some($fn) { foreach ($this->toList() as $k => $v) if (truthy($fn($v, $k, $this))) return true; return false; }
  public function join($sep = ',') {
    $sep = $sep === null ? ',' : toStr($sep);
    $parts = [];
    foreach ($this->toList() as $v) $parts[] = $v === null ? '' : toStr($v);
    return \implode($sep, $parts);
  }
  public function toString() { return $this->join(','); }
  public function reverse() {
    $list = \array_reverse($this->toList());
    foreach ($list as $k => $v) $this->setAt($k, $v);
    return $this;
  }
  public function sort($cmp = null) {
    $list = $this->toList();
    if ($cmp === null) {
      if ($this->isTyped()) \sort($list);
      else \usort($list, function ($x, $y) {
        if ($x === null) return $y === null ? 0 : 1;
        if ($y === null) return -1;
        return \strcmp(toStr($x), toStr($y));
      });
    } else {
      \usort($list, function ($x, $y) use ($cmp) { $r = toNumber($cmp($x, $y)); return $r < 0 ? -1 : ($r > 0 ? 1 : 0); });
    }
    foreach ($list as $k => $v) $this->setAt($k, $v);
    return $this;
  }
  public function at($i) { $n = $this->length(); $i = (int)toNumber($i); if ($i < 0) $i += $n; return $i >= 0 && $i < $n ? $this->getAt($i) : null; }
  public function flat($depth = 1) {
    $out = [];
    $walk = function ($list, $d) use (&$walk, &$out) { foreach ($list as $v) { if ($v instanceof JsArray && $d > 0) $walk($v->toList(), $d - 1); else $out[] = $v; } };
    $walk($this->toList(), (int)$depth);
    return new JsArray($out);
  }
  public function keys() { return new JsArray(\array_keys($this->toList())); }
  public function values() { return new JsArray($this->toList()); }
  public function entries() { $o = []; foreach ($this->toList() as $k => $v) $o[] = new JsArray([$k, $v]); return new JsArray($o); }
  /** TypedArray.prototype.set */
  public function set($source, $offset = 0) {
    $offset = (int)toNumber($offset ?? 0);
    $values = $source instanceof JsArray ? $source->toList() : (array)$source;
    if ($offset + \count($values) > $this->length()) throw new RangeError('offset is out of bounds');
    foreach ($values as $k => $v) $this->setAt($offset + $k, $v);
    return null;
  }
  public function copyWithin($target, $start = 0, $end = null) {
    $n = $this->length();
    $t = relIndex($target, $n);
    [$s, $e] = range2($n, $start, $end);
    $chunk = \array_slice($this->toList(), $s, $e - $s);
    foreach ($chunk as $k => $v) if ($t + $k < $n) $this->setAt($t + $k, $v);
    return $this;
  }
}

/** A view of part of another array's storage (subarray) */
class JsView extends JsArray {
  public $base; public $off; public $len;
  public function __construct(JsArray $base, int $offset, int $length) {
    parent::__construct([], $base->kind);
    $this->view = true;
    $this->base = $base; $this->off = $offset; $this->len = $length;
  }
  public function length(): int { return $this->len; }
  public function getAt($i) { return $i >= 0 && $i < $this->len ? $this->base->getAt($this->off + $i) : null; }
  public function setAt($i, $v) { if ($i >= 0 && $i < $this->len) $this->base->setAt($this->off + $i, $v); }
  public function toList(): array { $o = []; for ($k = 0; $k < $this->len; ++$k) $o[] = $this->base->getAt($this->off + $k); return $o; }
  public function setLength(int $n) { }
  public function __get($name) {
    if ($name === 'buffer') { $b = $this->base->__get('buffer'); return $b; }
    if ($name === 'byteOffset') return $this->off * elementSize($this->kind) + (int)$this->base->__get('byteOffset');
    return parent::__get($name);
  }
  public function subarray($start = null, $end = null) {
    [$s, $e] = range2($this->len, $start, $end);
    return new JsView($this->base, $this->off + $s, \max(0, $e - $s));
  }
}

/** An ArrayBuffer: the bytes of the typed array that owns them */
class JsBuffer {
  public $owner; public $byteOffset; public $byteLength;
  public function __construct(JsArray $owner, int $byteOffset, int $byteLength) {
    $this->owner = $owner; $this->byteOffset = $byteOffset; $this->byteLength = $byteLength;
  }
  public static function create($length) { $n = (int)toNumber($length ?? 0); return new JsBuffer(new JsArray(\array_fill(0, $n, 0), 'uint8'), 0, $n); }
  public function __get($name) { if ($name === 'length') return $this->byteLength; return null; }
  public function getByte(int $k): int {
    $o = $this->owner; $es = elementSize($o->kind); $k += $this->byteOffset;
    if ($es === 1) return $o->getAt($k) & 0xFF;
    $word = $o->getAt(\intdiv($k, $es));
    return byteOf($o->kind, $word, $k % $es);
  }
  public function setByte(int $k, int $v) {
    $o = $this->owner; $es = elementSize($o->kind); $k += $this->byteOffset;
    if ($es === 1) { $o->setAt($k, $v & 0xFF); return; }
    $index = \intdiv($k, $es);
    $o->setAt($index, withByte($o->kind, $o->getAt($index), $k % $es, $v & 0xFF));
  }
  public function slice($start = null, $end = null) {
    [$s, $e] = range2($this->byteLength, $start, $end);
    $bytes = [];
    for ($k = $s; $k < $e; ++$k) $bytes[] = $this->getByte($k);
    return new JsBuffer(new JsArray($bytes, 'uint8'), 0, \count($bytes));
  }
}

/** A typed array over a buffer's bytes, elements little-endian */
class ByteView extends JsArray {
  public $buf; public $byteOff; public $len; public $es;
  public function __construct(string $kind, JsBuffer $buffer, int $byteOffset, int $length) {
    parent::__construct([], $kind);
    $this->view = true;
    $this->buf = $buffer; $this->byteOff = $byteOffset; $this->len = $length; $this->es = elementSize($kind);
  }
  public function length(): int { return $this->len; }
  public function getAt($i) {
    if ($i < 0 || $i >= $this->len) return null;
    $bytes = [];
    for ($k = 0; $k < $this->es; ++$k) $bytes[] = $this->buf->getByte($this->byteOff + $i * $this->es + $k);
    return fromBytes($this->kind, $bytes);
  }
  public function setAt($i, $v) {
    if ($i < 0 || $i >= $this->len) return;
    $bytes = toBytes($this->kind, coerce($this->kind, $v));
    foreach ($bytes as $k => $b) $this->buf->setByte($this->byteOff + $i * $this->es + $k, $b);
  }
  public function toList(): array { $o = []; for ($k = 0; $k < $this->len; ++$k) $o[] = $this->getAt($k); return $o; }
  public function setLength(int $n) { }
  public function __get($name) {
    if ($name === 'buffer') return $this->buf;
    if ($name === 'byteOffset') return $this->byteOff;
    return parent::__get($name);
  }
}

/** DataView over a buffer */
class DataView {
  public $buffer; public $byteOffset; public $byteLength;
  public function __construct($buffer, $byteOffset = 0, $byteLength = null) {
    if ($buffer instanceof JsArray) $buffer = $buffer->__get('buffer');
    $this->buffer = $buffer;
    $this->byteOffset = (int)toNumber($byteOffset ?? 0);
    $this->byteLength = $byteLength === null ? $buffer->byteLength - $this->byteOffset : (int)toNumber($byteLength);
  }
  private function read(string $kind, $offset, $little) {
    $es = elementSize($kind); $bytes = [];
    $offset = (int)toNumber($offset);
    if ($offset < 0 || $offset + $es > $this->byteLength) throw new RangeError('Offset is outside the bounds of the DataView');
    for ($k = 0; $k < $es; ++$k) $bytes[] = $this->buffer->getByte($this->byteOffset + $offset + $k);
    if (!truthy($little)) $bytes = \array_reverse($bytes);
    return fromBytes($kind, $bytes);
  }
  private function write(string $kind, $offset, $value, $little) {
    $es = elementSize($kind);
    $offset = (int)toNumber($offset);
    if ($offset < 0 || $offset + $es > $this->byteLength) throw new RangeError('Offset is outside the bounds of the DataView');
    $bytes = toBytes($kind, coerce($kind, $value));
    if (!truthy($little)) $bytes = \array_reverse($bytes);
    foreach ($bytes as $k => $b) $this->buffer->setByte($this->byteOffset + $offset + $k, $b);
    return null;
  }
  public function getInt8($o) { return $this->read('int8', $o, true); }
  public function getUint8($o) { return $this->read('uint8', $o, true); }
  public function getInt16($o, $l = false) { return $this->read('int16', $o, $l); }
  public function getUint16($o, $l = false) { return $this->read('uint16', $o, $l); }
  public function getInt32($o, $l = false) { return $this->read('int32', $o, $l); }
  public function getUint32($o, $l = false) { return $this->read('uint32', $o, $l); }
  public function getFloat32($o, $l = false) { return $this->read('float32', $o, $l); }
  public function getFloat64($o, $l = false) { return $this->read('float64', $o, $l); }
  public function getBigInt64($o, $l = false) { return $this->read('bigint64', $o, $l); }
  public function getBigUint64($o, $l = false) { return $this->read('biguint64', $o, $l); }
  public function setInt8($o, $v) { return $this->write('int8', $o, $v, true); }
  public function setUint8($o, $v) { return $this->write('uint8', $o, $v, true); }
  public function setInt16($o, $v, $l = false) { return $this->write('int16', $o, $v, $l); }
  public function setUint16($o, $v, $l = false) { return $this->write('uint16', $o, $v, $l); }
  public function setInt32($o, $v, $l = false) { return $this->write('int32', $o, $v, $l); }
  public function setUint32($o, $v, $l = false) { return $this->write('uint32', $o, $v, $l); }
  public function setFloat32($o, $v, $l = false) { return $this->write('float32', $o, $v, $l); }
  public function setFloat64($o, $v, $l = false) { return $this->write('float64', $o, $v, $l); }
  public function setBigInt64($o, $v, $l = false) { return $this->write('bigint64', $o, $v, $l); }
  public function setBigUint64($o, $v, $l = false) { return $this->write('biguint64', $o, $v, $l); }
}

/** Bytes per element of a typed array kind */
function elementSize(string $kind): int {
  switch ($kind) {
    case 'uint16': case 'int16': return 2;
    case 'uint32': case 'int32': case 'float32': return 4;
    case 'float64': case 'bigint64': case 'biguint64': return 8;
    default: return 1;
  }
}

/** A value converted to a typed array's element type */
function coerce(string $kind, $v) {
  switch ($kind) {
    case 'uint8': return \is_int($v) ? $v & 0xFF : toInt32($v) & 0xFF;
    case 'int8': return (((\is_int($v) ? $v : toInt32($v)) & 0xFF) ^ 0x80) - 0x80;
    case 'uint8c':
      $n = toNumber($v);
      if (\is_nan($n) || $n <= 0) return 0;
      if ($n >= 255) return 255;
      $f = \floor($n); $d = $n - $f;
      return (int)($d > 0.5 || ($d == 0.5 && ((int)$f & 1)) ? $f + 1 : $f);
    case 'uint16': return \is_int($v) ? $v & 0xFFFF : toInt32($v) & 0xFFFF;
    case 'int16': return (((\is_int($v) ? $v : toInt32($v)) & 0xFFFF) ^ 0x8000) - 0x8000;
    case 'uint32': return \is_int($v) ? $v & 0xFFFFFFFF : toUint32($v);
    case 'int32': return toInt32($v);
    case 'float32': return num(\unpack('g', \pack('g', (float)toNumber($v)))[1]);
    case 'float64': return num((float)toNumber($v));
    case 'bigint64': return asIntN(64, toBigInt($v));
    case 'biguint64': return asUintN(64, toBigInt($v));
    default: return $v;
  }
}

/** Little-endian bytes of an element */
function toBytes(string $kind, $v): array {
  switch ($kind) {
    case 'float32': return \array_values(\unpack('C*', \pack('g', (float)$v)));
    case 'float64': return \array_values(\unpack('C*', \pack('e', (float)$v)));
    case 'bigint64': case 'biguint64':
      $u = asUintN(64, $v); $out = [];
      for ($k = 0; $k < 8; ++$k) { $out[] = \gmp_intval(\gmp_and($u, 0xFF)); $u = \gmp_div_q($u, 256); }
      return $out;
    default:
      $es = elementSize($kind); $out = []; $x = (int)$v;
      for ($k = 0; $k < $es; ++$k) { $out[] = $x & 0xFF; $x >>= 8; }
      return $out;
  }
}

/** An element from its little-endian bytes */
function fromBytes(string $kind, array $bytes) {
  switch ($kind) {
    case 'float32': return num(\unpack('g', \pack('C*', ...$bytes))[1]);
    case 'float64': return num(\unpack('e', \pack('C*', ...$bytes))[1]);
    case 'bigint64': case 'biguint64':
      $u = \gmp_init(0);
      for ($k = 7; $k >= 0; --$k) $u = \gmp_add(\gmp_mul($u, 256), $bytes[$k]);
      return $kind === 'bigint64' ? asIntN(64, $u) : $u;
    default:
      $x = 0;
      for ($k = \count($bytes) - 1; $k >= 0; --$k) $x = ($x << 8) | $bytes[$k];
      return coerce($kind, $x);
  }
}

/** Byte k (little-endian) of an element */
function byteOf(string $kind, $element, int $k): int { return toBytes($kind, $element ?? 0)[$k]; }

/** An element with byte k replaced */
function withByte(string $kind, $element, int $k, int $byte) {
  $bytes = toBytes($kind, $element ?? 0);
  $bytes[$k] = $byte;
  return fromBytes($kind, $bytes);
}

/** An array index from a key, or null for a key that is not one */
function index($i) {
  if (\is_int($i)) return $i >= 0 ? $i : null;
  if (\is_float($i)) return $i == \floor($i) && $i >= 0 ? (int)$i : null;
  if (\is_string($i) && \preg_match('/^(0|[1-9]\d*)$/', $i)) return (int)$i;
  if (\is_bool($i) || $i === null) return null;
  return null;
}

/** A relative index (negative counts from the end) clamped to 0..length */
function relIndex($i, int $len): int {
  $i = toNumber($i ?? 0);
  if (\is_nan($i)) return 0;
  $i = (int)($i < 0 ? \ceil($i) : \floor($i));
  if ($i < 0) return \max(0, $len + $i);
  return \min($i, $len);
}

/** [start, end) of a slice */
function range2(int $len, $start, $end): array {
  $s = $start === null ? 0 : relIndex($start, $len);
  $e = $end === null ? $len : relIndex($end, $len);
  return [$s, $e];
}

/** new Array(...) */
function newArray(...$args) {
  if (\count($args) === 1 && (\is_int($args[0]) || \is_float($args[0]))) {
    $n = $args[0];
    if ($n != \floor($n) || $n < 0) throw new RangeError('Invalid array length');
    return new JsArray($n > 0 ? \array_fill(0, (int)$n, null) : []);
  }
  return new JsArray($args);
}

/** new Uint8Array(...) and its kin */
function newTyped(string $kind, $source = null, $byteOffset = null, $length = null) {
  if ($source === null) return new JsArray([], $kind);
  if (\is_int($source) || \is_float($source)) {
    $n = (int)$source;
    if ($n < 0) throw new RangeError('Invalid typed array length: ' . $n);
    $zero = ($kind === 'bigint64' || $kind === 'biguint64') ? \gmp_init(0) : 0;
    return new JsArray($n > 0 ? \array_fill(0, $n, $zero) : [], $kind);
  }
  if ($source instanceof JsBuffer) {
    $off = (int)toNumber($byteOffset ?? 0);
    $es = elementSize($kind);
    $len = $length === null ? \intdiv($source->byteLength - $off, $es) : (int)toNumber($length);
    // A typed array over its own owner's whole storage, of the owner's kind, is the owner
    if ($source->owner->kind === $kind && $off === 0 && $source->byteOffset === 0 && $len === $source->owner->length() && !($source->owner instanceof JsView) && !($source->owner instanceof ByteView))
      return $source->owner;
    return new ByteView($kind, $source, $off, $len);
  }
  if ($source instanceof JsArray) return JsArray::typed($kind, $source->toList());
  if ($source instanceof Obj) {
    $n = (int)toNumber($source->length ?? 0);
    $out = [];
    for ($k = 0; $k < $n; ++$k) $out[] = $source[$k];
    return JsArray::typed($kind, $out);
  }
  if (\is_iterable($source)) return JsArray::typed($kind, \iterator_to_array(iterate($source), false));
  return new JsArray([], $kind);
}

/** Array.from(source, mapFn) */
function arrayFrom($source, $fn = null) {
  if ($source instanceof JsArray) $list = $source->toList();
  elseif (\is_string($source)) $list = \preg_split('//u', $source, -1, \PREG_SPLIT_NO_EMPTY);
  elseif ($source instanceof Obj && !isset($source->{'@@iterator'})) {
    $n = (int)toNumber($source->length ?? 0);
    $list = \array_fill(0, \max(0, $n), null);
    for ($k = 0; $k < $n; ++$k) if (isset($source->{(string)$k})) $list[$k] = $source->{(string)$k};
  } elseif ($source === null) throw new TypeError('Array.from requires an array-like object');
  else $list = \iterator_to_array(iterate($source), false);
  if ($fn !== null) foreach ($list as $k => $v) $list[$k] = $fn($v, $k);
  return new JsArray($list);
}

/** Array.isArray */
function isArray($v): bool { return $v instanceof JsArray && !$v->isTyped(); }

/** ArrayBuffer.isView: a typed array or a DataView */
function isView($v): bool { return ($v instanceof JsArray && $v->isTyped()) || $v instanceof DataView; }

/** What for-of iterates: an array's or string's elements, a Map's entries, a Set's values */
function iterate($v) {
  if ($v instanceof JsArray) return $v->toList();
  if (\is_string($v)) return \preg_split('//u', $v, -1, \PREG_SPLIT_NO_EMPTY);
  if ($v instanceof Map || $v instanceof Set) return $v->getIterator();
  if ($v instanceof \Traversable) return $v;
  if (\is_array($v)) return $v;
  if ($v === null) throw new TypeError('undefined is not iterable');
  throw new TypeError(typeOf($v) . ' is not iterable');
}

/** What for-in enumerates: the keys */
function keysOf($v): array {
  if ($v instanceof JsArray) return \array_map('strval', \array_keys($v->toList()));
  if (\is_string($v)) return \array_map('strval', \array_keys(\str_split($v)));
  if ($v === null) return [];
  if (\is_object($v)) return \array_map('strval', \array_keys(\get_object_vars($v)));
  return [];
}

/** a.length of anything */
function len($v) {
  if ($v instanceof JsArray) return $v->length();
  if (\is_string($v)) return strLength($v);
  if ($v === null) throw new TypeError("Cannot read properties of undefined (reading 'length')");
  if (\is_object($v)) return $v->length;
  return null;
}

// ============================================================================
// OBJECTS, MAPS, SETS
// ============================================================================

/**
 * The method of a JavaScript accessor: get_<name> / set_<name>, upper case
 * letters and underscores escaped (PHP method names ignore case: Key and key
 * are two accessors in JavaScript). PhpEmitter.js spells it the same way.
 */
function accessor(string $kind, string $name): string {
  static $cache = [];
  $key = $kind . ':' . $name;
  if (isset($cache[$key])) return $cache[$key];
  $m = \strpbrk($name, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ_') === false ? $name
    : \preg_replace_callback('/[A-Z_]/', function ($c) { return $c[0] === '_' ? '__' : '_' . \strtolower($c[0]); }, $name);
  return $cache[$key] = $kind . '_' . $m;
}

/** Objects reached by name (obj[key]) and through accessors (get x / set x) */
trait ObjectBehavior {
  public function offsetExists($k): bool { return has($this, $k); }
  public function offsetGet($k): mixed { return getProp($this, $k); }
  public function offsetSet($k, $v): void { setProp($this, $k, $v); }
  public function offsetUnset($k): void { $k = (string)toStr($k); unset($this->$k); }
  public function __get($name) {
    $m = accessor('get', $name);
    if (\method_exists($this, $m)) return $this->$m();
    return null;
  }
  public function __set($name, $value) {
    $m = accessor('set', $name);
    if (\method_exists($this, $m)) { $this->$m($value); return; }
    $this->$name = $value;
  }
  public function __isset($name) { return \method_exists($this, accessor('get', $name)); }
  public function __call($name, $args) {
    $f = $this->$name ?? null;
    if ($f instanceof \Closure) return $f(...$args);
    throw new TypeError('this.' . $name . ' is not a function');
  }
}

/** A JavaScript plain object */
#[\AllowDynamicProperties]
class Obj implements \ArrayAccess, \IteratorAggregate {
  use ObjectBehavior;
  public function __construct(array $props = []) { foreach ($props as $k => $v) $this->{(string)$k} = $v; }
  public function getIterator(): \Iterator { return new \ArrayIterator(\get_object_vars($this)); }
  public function hasOwnProperty($k) { return \property_exists($this, (string)toStr($k)); }
  public function toString() { return '[object Object]'; }
}

/** An object literal: its properties, getters and setters */
function obj(array $props = [], array $getters = [], array $setters = []) {
  if (!$getters && !$setters) return new Obj($props);
  $o = new AccessorObj($props);
  $o->getters = $getters;
  $o->setters = $setters;
  return $o;
}

/** An object literal with accessors */
#[\AllowDynamicProperties]
class AccessorObj extends Obj {
  public $getters = []; public $setters = [];
  public function __get($name) { if (isset($this->getters[$name])) return \Closure::bind($this->getters[$name], $this)(); return null; }
  public function __set($name, $value) { if (isset($this->setters[$name])) { \Closure::bind($this->setters[$name], $this)($value); return; } $this->$name = $value; }
  public function __isset($name) { return isset($this->getters[$name]); }
}

/** obj[key] */
function getProp($o, $k) {
  if ($o instanceof JsArray || $o instanceof Map) return $o[$k];
  if (\is_string($o)) {
    if ($k === 'length') return strLength($o);
    $i = index($k);
    return $i !== null && $i < \strlen($o) ? $o[$i] : null;
  }
  if ($o === null) throw new TypeError('Cannot read properties of undefined (reading \'' . toStr($k) . '\')');
  if (!\is_object($o)) return null;
  $name = toStr($k);
  return $o->$name ?? null;
}

/** obj[key] = value */
function setProp($o, $k, $v) {
  if ($o instanceof JsArray) { $o[$k] = $v; return $v; }
  if ($o === null) throw new TypeError('Cannot set properties of undefined (setting \'' . toStr($k) . '\')');
  if (!\is_object($o)) return $v;
  $name = toStr($k);
  $o->$name = $v;
  return $v;
}

/**
 * obj.name === undefined. PHP has one null for JavaScript's null and
 * undefined; a property that exists holds null, one that does not is undefined.
 */
function undefinedProp($o, $name): bool {
  if (\is_object($o) && !($o instanceof JsArray) && !($o instanceof Map)) {
    if (\property_exists($o, $name)) return false;
    return getProp($o, $name) === null;
  }
  if ($o === null) throw new TypeError("Cannot read properties of undefined (reading '" . $name . "')");
  return getProp($o, $name) === null;
}

/** key in obj */
function has($o, $k): bool {
  if ($o instanceof JsArray) { $i = index($k); return $i !== null ? $i < $o->length() : ($k === 'length' || \method_exists($o, toStr($k))); }
  if (!\is_object($o)) throw new TypeError("Cannot use 'in' operator to search for '" . toStr($k) . "'");
  $name = toStr($k);
  if (\property_exists($o, $name)) return true;
  if (\method_exists($o, $name) || \method_exists($o, accessor('get', $name)) || \method_exists($o, accessor('set', $name))) return true;
  if ($o instanceof AccessorObj) return isset($o->getters[$name]) || isset($o->setters[$name]);
  return false;
}

/** delete obj[key] */
function deleteProp($o, $k): bool {
  if ($o instanceof JsArray) { $o->offsetUnset($k); return true; }
  if ($o instanceof Map) return $o->delete($k);
  if (\is_object($o)) { $name = toStr($k); unset($o->$name); }
  return true;
}

/** A Map */
class Map implements \IteratorAggregate, \Countable, \ArrayAccess {
  private $keys = []; private $values = [];
  public function __construct($entries = null) {
    if ($entries !== null) foreach (iterate($entries) as $e) $this->setAt($e[0], $e[1]);
  }
  private static function slot($k) {
    if (\is_int($k)) return 'i' . $k;
    if (\is_float($k)) return $k == \floor($k) && \abs($k) < 9.2e18 ? 'i' . (int)$k : 'f' . numberToString($k);
    if (\is_string($k)) return 's' . $k;
    if (\is_bool($k)) return $k ? 'T' : 'F';
    if ($k === null) return 'u';
    if ($k instanceof \GMP) return 'b' . \gmp_strval($k);
    return 'o' . \spl_object_id($k);
  }
  public function get($k) { return $this->values[self::slot($k)] ?? null; }
  public function set($k, $v) { $s = self::slot($k); $this->keys[$s] = $k; $this->values[$s] = $v; return $this; }
  public function has($k) { return \array_key_exists(self::slot($k), $this->keys); }
  public function delete($k) { $s = self::slot($k); if (!\array_key_exists($s, $this->keys)) return false; unset($this->keys[$s], $this->values[$s]); return true; }
  public function clear() { $this->keys = []; $this->values = []; }
  public function __get($name) { if ($name === 'size') return \count($this->keys); return null; }
  public function count(): int { return \count($this->keys); }
  public function keys() { return new JsArray(\array_values($this->keys)); }
  public function values() { return new JsArray(\array_values($this->values)); }
  public function entries() { $o = []; foreach ($this->keys as $s => $k) $o[] = new JsArray([$k, $this->values[$s]]); return new JsArray($o); }
  public function forEach($fn) { foreach ($this->keys as $s => $k) $fn($this->values[$s], $k, $this); }
  public function getIterator(): \Iterator { return new \ArrayIterator($this->entries()->toList()); }
  public function offsetExists($k): bool { return $this->has($k); }
  public function offsetGet($k): mixed { return $this->getAt($k); }
  public function offsetSet($k, $v): void { $this->setAt($k, $v); }
  public function offsetUnset($k): void { $this->delete($k); }
}

/** A Set */
class Set implements \IteratorAggregate, \Countable {
  private $map;
  public function __construct($values = null) {
    $this->map = new Map();
    if ($values !== null) foreach (iterate($values) as $v) $this->add($v);
  }
  public function add($v) { $this->map->set($v, $v); return $this; }
  public function has($v) { return $this->map->has($v); }
  public function delete($v) { return $this->map->delete($v); }
  public function clear() { $this->map->clear(); }
  public function __get($name) { if ($name === 'size') return $this->map->count(); return null; }
  public function count(): int { return $this->map->count(); }
  public function values() { return $this->map->values(); }
  public function keys() { return $this->map->values(); }
  public function forEach($fn) { foreach ($this->map->values()->toList() as $v) $fn($v, $v, $this); }
  public function getIterator(): \Iterator { return new \ArrayIterator($this->map->values()->toList()); }
}

// ============================================================================
// ERRORS
// ============================================================================

/** JavaScript Error */
class Error extends \Exception {
  public $message = '';
  public $name = 'Error';
  public function __construct($message = null) {
    parent::__construct($message === null ? '' : toStr($message));
    $this->message = $message === null ? '' : toStr($message);
  }
  public function toString() { return $this->name . ($this->message !== '' ? ': ' . $this->message : ''); }
}
class RangeError extends Error { public $name = 'RangeError'; }
class TypeError extends Error { public $name = 'TypeError'; }
class SyntaxError extends Error { public $name = 'SyntaxError'; }
class ReferenceError extends Error { public $name = 'ReferenceError'; }
class EvalError extends Error { public $name = 'EvalError'; }
class URIError extends Error { public $name = 'URIError'; }

/** A thrown value that is not an Error (`throw 'text'`) */
class Thrown extends \Exception {
  public $value;
  public function __construct($value) { parent::__construct(toStr($value)); $this->value = $value; }
}

/** What `throw x` throws */
function throwable($v): \Throwable {
  if ($v instanceof \Throwable) return $v;
  return new Thrown($v);
}

/** What `catch (e)` binds: the thrown value; a PHP error becomes the JavaScript error it stands for */
function caught(\Throwable $e) {
  if ($e instanceof Thrown) return $e->value;
  if ($e instanceof Error) return $e;
  if ($e instanceof \DivisionByZeroError || $e instanceof \ArithmeticError) return new RangeError($e->getMessage());
  return new TypeError($e->getMessage());
}

// ============================================================================
// STRINGS
// ============================================================================

/**
 * Whether a string is ASCII (one byte a character). The last string asked
 * about is remembered: a loop over a string's characters asks about the same
 * string each time, and comparing it with itself costs nothing.
 */
function isAscii(string $s): bool {
  static $last = null, $ascii = true;
  if ($s === $last) return $ascii;
  $last = $s;
  return $ascii = !\preg_match('/[\x80-\xff]/', $s);
}

/** A string's length in characters */
function strLength(string $s): int {
  return isAscii($s) ? \strlen($s) : \preg_match_all('/./su', $s);
}

/** The characters of a string */
function chars(string $s): array {
  if (isAscii($s)) return \str_split($s) ?: [];
  return \preg_split('//u', $s, -1, \PREG_SPLIT_NO_EMPTY) ?: [];
}

/** The UTF-8 text of a code point */
function codePointToString(int $c): string {
  if ($c < 0x80) return \chr($c);
  if ($c < 0x800) return \chr(0xC0 | ($c >> 6)) . \chr(0x80 | ($c & 0x3F));
  if ($c < 0x10000) return \chr(0xE0 | ($c >> 12)) . \chr(0x80 | (($c >> 6) & 0x3F)) . \chr(0x80 | ($c & 0x3F));
  return \chr(0xF0 | ($c >> 18)) . \chr(0x80 | (($c >> 12) & 0x3F)) . \chr(0x80 | (($c >> 6) & 0x3F)) . \chr(0x80 | ($c & 0x3F));
}

/** The code point of a UTF-8 character */
function charCode(string $ch): int {
  $b = \ord($ch[0]);
  if ($b < 0x80 || \strlen($ch) === 1) return $b;
  if ($b < 0xE0) return (($b & 0x1F) << 6) | (\ord($ch[1]) & 0x3F);
  if ($b < 0xF0) return (($b & 0x0F) << 12) | ((\ord($ch[1]) & 0x3F) << 6) | (\ord($ch[2]) & 0x3F);
  return (($b & 0x07) << 18) | ((\ord($ch[1]) & 0x3F) << 12) | ((\ord($ch[2]) & 0x3F) << 6) | (\ord($ch[3]) & 0x3F);
}

/** String.prototype methods */
final class Str {
  public static function charCodeAt($s, $i = 0) {
    $i = (int)toNumber($i ?? 0);
    if (isAscii($s)) return $i >= 0 && $i < \strlen($s) ? \ord($s[$i]) : \NAN;
    $c = chars($s);
    return $i >= 0 && $i < \count($c) ? charCode($c[$i]) : \NAN;
  }
  public static function codePointAt($s, $i = 0) { $r = self::charCodeAt($s, $i); return \is_float($r) ? null : $r; }
  public static function charAt($s, $i = 0) {
    $i = (int)toNumber($i ?? 0);
    if (isAscii($s)) return $i >= 0 && $i < \strlen($s) ? $s[$i] : '';
    $c = chars($s);
    return $c[$i] ?? '';
  }
  public static function at($s, $i) { $c = chars($s); $i = (int)toNumber($i); if ($i < 0) $i += \count($c); return $c[$i] ?? null; }
  public static function substring($s, $start = 0, $end = null) {
    if (isAscii($s)) {
      $n = \strlen($s);
      $a = toNumber($start ?? 0); $a = \is_nan($a) ? 0 : \max(0, \min($n, (int)$a));
      $b = $end === null ? $n : toNumber($end); $b = \is_nan($b) ? 0 : \max(0, \min($n, (int)$b));
      if ($a > $b) [$a, $b] = [$b, $a];
      return (string)\substr($s, $a, $b - $a);
    }
    $c = chars($s); $n = \count($c);
    $a = \max(0, \min($n, (int)toNumber($start ?? 0))); $b = $end === null ? $n : \max(0, \min($n, (int)toNumber($end)));
    if ($a > $b) [$a, $b] = [$b, $a];
    return \implode('', \array_slice($c, $a, $b - $a));
  }
  public static function substr($s, $start = 0, $length = null) {
    if (isAscii($s)) {
      $n = \strlen($s);
      $a = relIndex($start ?? 0, $n); $l = $length === null ? $n - $a : \max(0, (int)toNumber($length));
      return (string)\substr($s, $a, $l);
    }
    $c = chars($s); $n = \count($c);
    $a = relIndex($start ?? 0, $n); $l = $length === null ? $n - $a : \max(0, (int)toNumber($length));
    return \implode('', \array_slice($c, $a, $l));
  }
  public static function slice($s, $start = null, $end = null) {
    if (isAscii($s)) {
      [$a, $b] = range2(\strlen($s), $start, $end);
      return $b > $a ? (string)\substr($s, $a, $b - $a) : '';
    }
    $c = chars($s);
    [$a, $b] = range2(\count($c), $start, $end);
    return $b > $a ? \implode('', \array_slice($c, $a, $b - $a)) : '';
  }
  public static function indexOf($s, $search, $from = 0) {
    $search = toStr($search);
    $p = \strpos($s, $search, \max(0, \min(\strlen($s), (int)toNumber($from ?? 0))));
    return $p === false ? -1 : $p;
  }
  public static function lastIndexOf($s, $search) { $p = \strrpos($s, toStr($search)); return $p === false ? -1 : $p; }
  public static function includes($s, $search) { return \strpos($s, toStr($search)) !== false; }
  public static function startsWith($s, $search, $pos = 0) { return \substr($s, (int)toNumber($pos ?? 0), \strlen(toStr($search))) === toStr($search); }
  public static function endsWith($s, $search) { $t = toStr($search); return $t === '' || \substr($s, -\strlen($t)) === $t; }
  public static function toUpperCase($s) { return \strtoupper($s); }
  public static function toLowerCase($s) { return \strtolower($s); }
  public static function trim($s) { return \trim($s); }
  public static function trimStart($s) { return \ltrim($s); }
  public static function trimEnd($s) { return \rtrim($s); }
  public static function padStart($s, $n, $pad = ' ') {
    $n = (int)toNumber($n); $pad = toStr($pad ?? ' '); $len = strLength($s);
    if ($n <= $len || $pad === '') return $s;
    $fill = \str_repeat($pad, (int)\ceil(($n - $len) / \strlen($pad)));
    return \substr($fill, 0, $n - $len) . $s;
  }
  public static function padEnd($s, $n, $pad = ' ') {
    $n = (int)toNumber($n); $pad = toStr($pad ?? ' '); $len = strLength($s);
    if ($n <= $len || $pad === '') return $s;
    $fill = \str_repeat($pad, (int)\ceil(($n - $len) / \strlen($pad)));
    return $s . \substr($fill, 0, $n - $len);
  }
  public static function repeat($s, $n) {
    $n = toNumber($n);
    if ($n < 0 || \is_infinite($n)) throw new RangeError('Invalid count value: ' . numberToString($n));
    return \str_repeat($s, (int)$n);
  }
  public static function concat($s, ...$parts) { foreach ($parts as $p) $s .= toStr($p); return $s; }
  public static function split($s, $sep = null, $limit = null) {
    if ($sep === null) $parts = [$s];
    elseif ($sep instanceof RegExp) $parts = \preg_split($sep->pcre(), $s);
    elseif ($sep === '') $parts = chars($s);
    else $parts = \explode(toStr($sep), $s);
    if ($limit !== null) $parts = \array_slice($parts, 0, (int)toNumber($limit));
    return new JsArray($parts);
  }
  public static function replace($s, $pattern, $replacement) {
    $fn = $replacement instanceof \Closure;
    if ($pattern instanceof RegExp) {
      $limit = $pattern->global ? -1 : 1;
      if ($fn) return \preg_replace_callback($pattern->pcre(), function ($m) use ($replacement) { return toStr($replacement(...$m)); }, $s, $limit);
      return \preg_replace($pattern->pcre(), self::pcreReplacement(toStr($replacement)), $s, $limit);
    }
    $pattern = toStr($pattern);
    $p = \strpos($s, $pattern);
    if ($p === false) return $s;
    $r = $fn ? toStr($replacement($pattern, $p, $s)) : \str_replace('$&', $pattern, toStr($replacement));
    return \substr($s, 0, $p) . $r . \substr($s, $p + \strlen($pattern));
  }
  public static function replaceAll($s, $pattern, $replacement) {
    if ($pattern instanceof RegExp) return self::replace($s, $pattern, $replacement);
    if ($replacement instanceof \Closure) {
      $parts = \explode(toStr($pattern), $s);
      $out = $parts[0];
      for ($k = 1; $k < \count($parts); ++$k) $out .= toStr($replacement(toStr($pattern))) . $parts[$k];
      return $out;
    }
    return \str_replace(toStr($pattern), toStr($replacement), $s);
  }
  private static function pcreReplacement(string $r): string { return \preg_replace('/\$(\d)/', '\\\\$1', \str_replace('$&', '\\0', $r)); }
  public static function match($s, $re) {
    if (!($re instanceof RegExp)) $re = new RegExp(\preg_quote(toStr($re), '/'));
    if ($re->global) { \preg_match_all($re->pcre(), $s, $m); return $m[0] ? new JsArray($m[0]) : null; }
    return \preg_match($re->pcre(), $s, $m) ? new JsArray($m) : null;
  }
  public static function search($s, $re) { return \preg_match($re->pcre(), $s, $m, \PREG_OFFSET_CAPTURE) ? $m[0][1] : -1; }
  public static function localeCompare($s, $t) { return \strcmp($s, toStr($t)) <=> 0; }
  public static function normalize($s) { return $s; }
  public static function toString($s) { return $s; }
  public static function valueOf($s) { return $s; }
  public static function fromCharCode(...$codes) {
    $s = '';
    foreach ($codes as $c) $s .= codePointToString(toUint32($c) & 0xFFFF);
    return $s;
  }
  public static function fromCodePoint(...$codes) { $s = ''; foreach ($codes as $c) $s .= codePointToString((int)toNumber($c)); return $s; }
}

/** A regular expression literal, kept as its pattern and flags */
class RegExp {
  public $source; public $flags; public $global; public $lastIndex = 0;
  public function __construct($source, $flags = '') { $this->source = toStr($source); $this->flags = toStr($flags ?? ''); $this->global = \strpos($this->flags, 'g') !== false; }
  public function pcre(): string {
    $mods = '';
    if (\strpos($this->flags, 'i') !== false) $mods .= 'i';
    if (\strpos($this->flags, 'm') !== false) $mods .= 'm';
    if (\strpos($this->flags, 's') !== false) $mods .= 's';
    if (\strpos($this->flags, 'u') !== false) $mods .= 'u';
    return '/' . \str_replace('/', '\/', \str_replace('\/', '/', $this->source)) . '/' . $mods;
  }
  public function test($s) { return \preg_match($this->pcre(), toStr($s)) === 1; }
  public function exec($s) { return \preg_match($this->pcre(), toStr($s), $m) ? new JsArray($m) : null; }
}

/** Number.prototype methods */
final class Num {
  public static function toString($n, $radix = 10) {
    if ($n instanceof \GMP) return \gmp_strval($n, (int)toNumber($radix ?? 10));
    return numberToString($n, (int)toNumber($radix ?? 10));
  }
  public static function toFixed($n, $digits = 0) { return \number_format((float)toNumber($n), (int)toNumber($digits ?? 0), '.', ''); }
  public static function toPrecision($n, $p = null) { return $p === null ? numberToString($n) : \sprintf('%.' . \max(0, (int)$p - 1) . 'e', $n); }
  public static function valueOf($n) { return $n; }
}

/** parseInt */
function parseInt($s, $radix = null) {
  $s = \trim(toStr($s));
  $sign = 1;
  if ($s !== '' && ($s[0] === '-' || $s[0] === '+')) { if ($s[0] === '-') $sign = -1; $s = \substr($s, 1); }
  $r = $radix === null ? 0 : toInt32($radix);
  if ($r === 0) { $r = 10; if (\preg_match('/^0[xX]/', $s)) { $r = 16; $s = \substr($s, 2); } }
  elseif ($r === 16 && \preg_match('/^0[xX]/', $s)) $s = \substr($s, 2);
  if ($r < 2 || $r > 36) return \NAN;
  $value = 0; $any = false;
  for ($k = 0, $n = \strlen($s); $k < $n; ++$k) {
    $c = \ord(\strtolower($s[$k]));
    $d = $c >= 48 && $c <= 57 ? $c - 48 : ($c >= 97 && $c <= 122 ? $c - 87 : 99);
    if ($d >= $r) break;
    $value = $value * $r + $d;
    $any = true;
  }
  if (!$any) return \NAN;
  return num($sign * $value);
}

/** parseFloat */
function parseFloat($s) {
  $s = \trim(toStr($s));
  if (\preg_match('/^[+-]?(Infinity|\d+\.?\d*(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?)/', $s, $m)) {
    if (\substr($m[0], -8) === 'Infinity') return $m[0][0] === '-' ? -\INF : \INF;
    return num((float)$m[0]);
  }
  return \NAN;
}

function isNaN($v): bool { $n = toNumber($v); return \is_float($n) && \is_nan($n); }
function isFinite($v): bool { $n = toNumber($v); return \is_int($n) || \is_finite($n); }

/** Number.isInteger and its kin */
final class Number {
  public static function isInteger($v): bool { return \is_int($v) || (\is_float($v) && \is_finite($v) && $v == \floor($v)); }
  public static function isSafeInteger($v): bool { return self::isInteger($v) && \abs($v) <= 9007199254740991; }
  public static function isFinite($v): bool { return \is_int($v) || (\is_float($v) && \is_finite($v)); }
  public static function isNaN($v): bool { return \is_float($v) && \is_nan($v); }
  public static function parseInt($s, $r = null) { return parseInt($s, $r); }
  public static function parseFloat($s) { return parseFloat($s); }
}

// ============================================================================
// MATH
// ============================================================================

final class MathJS {
  public static function floor($x) { return num(\floor((float)toNumber($x))); }
  public static function ceil($x) { return num(\ceil((float)toNumber($x))); }
  public static function round($x) { $x = (float)toNumber($x); return num(\floor($x + 0.5)); }
  public static function trunc($x) { $x = (float)toNumber($x); return num($x < 0 ? \ceil($x) : \floor($x)); }
  public static function abs($x) { $x = toNumber($x); return \abs($x); }
  public static function sign($x) { $x = toNumber($x); return \is_nan($x) ? \NAN : ($x > 0 ? 1 : ($x < 0 ? -1 : 0)); }
  public static function sqrt($x) { return num(\sqrt((float)toNumber($x))); }
  public static function cbrt($x) { $x = (float)toNumber($x); return num($x < 0 ? -\pow(-$x, 1 / 3) : \pow($x, 1 / 3)); }
  public static function pow($x, $y) { return num(toNumber($x) ** toNumber($y)); }
  public static function exp($x) { return \exp((float)toNumber($x)); }
  public static function log($x) { return \log((float)toNumber($x)); }
  public static function log2($x) { return num(\log((float)toNumber($x), 2)); }
  public static function log10($x) { return num(\log10((float)toNumber($x))); }
  public static function log1p($x) { return \log1p((float)toNumber($x)); }
  public static function sin($x) { return \sin((float)toNumber($x)); }
  public static function cos($x) { return \cos((float)toNumber($x)); }
  public static function tan($x) { return \tan((float)toNumber($x)); }
  public static function asin($x) { return \asin((float)toNumber($x)); }
  public static function acos($x) { return \acos((float)toNumber($x)); }
  public static function atan($x) { return \atan((float)toNumber($x)); }
  public static function atan2($y, $x) { return \atan2((float)toNumber($y), (float)toNumber($x)); }
  public static function sinh($x) { return \sinh((float)toNumber($x)); }
  public static function cosh($x) { return \cosh((float)toNumber($x)); }
  public static function tanh($x) { return \tanh((float)toNumber($x)); }
  public static function hypot(...$v) { $s = 0.0; foreach ($v as $x) $s += toNumber($x) ** 2; return num(\sqrt($s)); }
  public static function fround($x) { return num(\unpack('g', \pack('g', (float)toNumber($x)))[1]); }
  public static function imul($a, $b) { return toInt32(toInt32($a) * toInt32($b)); }
  public static function clz32($x) { $x = toUint32($x); if ($x === 0) return 32; $n = 0; while (!($x & 0x80000000)) { $x <<= 1; ++$n; } return $n; }
  public static function random() { return \mt_rand() / (\mt_getrandmax() + 1); }
  public static function max(...$v) {
    $m = -\INF;
    foreach ($v as $x) { $x = toNumber($x); if (\is_nan($x)) return \NAN; if ($x > $m) $m = $x; }
    return $m;
  }
  public static function min(...$v) {
    $m = \INF;
    foreach ($v as $x) { $x = toNumber($x); if (\is_nan($x)) return \NAN; if ($x < $m) $m = $x; }
    return $m;
  }
}

// ============================================================================
// GLOBAL OBJECTS
// ============================================================================

/** Object.* */
final class ObjectJS {
  public static function keys($o) { return new JsArray(keysOf($o)); }
  public static function values($o) {
    if ($o instanceof JsArray) return new JsArray($o->toList());
    return new JsArray(\array_values(\is_object($o) ? \get_object_vars($o) : []));
  }
  public static function entries($o) {
    $out = [];
    if ($o instanceof JsArray) { foreach ($o->toList() as $k => $v) $out[] = new JsArray([(string)$k, $v]); }
    elseif (\is_object($o)) foreach (\get_object_vars($o) as $k => $v) $out[] = new JsArray([(string)$k, $v]);
    return new JsArray($out);
  }
  public static function assign($target, ...$sources) {
    foreach ($sources as $s) {
      if ($s === null) continue;
      foreach (\is_object($s) ? \get_object_vars($s) : [] as $k => $v) setProp($target, $k, $v);
    }
    return $target;
  }
  public static function freeze($o) { return $o; }
  public static function seal($o) { return $o; }
  public static function isFrozen($o) { return false; }
  public static function create($proto, $props = null) { $o = new Obj(); if ($proto instanceof Obj) foreach (\get_object_vars($proto) as $k => $v) $o->$k = $v; return $o; }
  public static function fromEntries($entries) { $o = new Obj(); foreach (iterate($entries) as $e) $o->{toStr($e[0])} = $e[1]; return $o; }
  public static function getOwnPropertyNames($o) { return self::keys($o); }
  public static function hasOwn($o, $k) { return \is_object($o) && \property_exists($o, toStr($k)); }
  public static function defineProperty($o, $k, $desc) { if (isset($desc->value)) setProp($o, $k, $desc->value); return $o; }
  public static function getPrototypeOf($o) { return null; }
}

/** console */
function console_log(...$values) {
  echo \implode(' ', \array_map(function ($v) { return \is_string($v) ? $v : inspect($v); }, $values)), "\n";
}
function inspect($v) {
  if ($v instanceof JsArray) return '[ ' . \implode(', ', \array_map(__NAMESPACE__ . '\inspect', $v->toList())) . ' ]';
  if ($v instanceof \GMP) return \gmp_strval($v) . 'n';
  if (\is_string($v)) return "'" . $v . "'";
  return toStr($v);
}

/** TextEncoder / TextDecoder: a PHP string is its UTF-8 bytes */
class TextEncoder {
  public $encoding = 'utf-8';
  public function encode($s = '') { return new JsArray(\array_values(\unpack('C*', toStr($s ?? '')) ?: []), 'uint8'); }
}
class TextDecoder {
  public $encoding;
  public function __construct($label = 'utf-8', $options = null) { $this->encoding = toStr($label ?? 'utf-8'); }
  public function decode($bytes = null) {
    if ($bytes === null) return '';
    if ($bytes instanceof JsBuffer) $bytes = newTyped('uint8', $bytes);
    $list = $bytes instanceof JsArray ? $bytes->toList() : [];
    if (!$list) return '';
    $s = \pack('C*', ...\array_map(function ($b) { return toInt32($b) & 0xFF; }, $list));
    if (\strtolower($this->encoding) === 'latin1' || \strtolower($this->encoding) === 'iso-8859-1') {
      $out = ''; foreach ($list as $b) $out .= codePointToString($b & 0xFF); return $out;
    }
    return $s;
  }
}

/** JSON */
final class JSON {
  public static function stringify($v) { return \json_encode(self::plain($v)); }
  public static function parse($s) { return self::js(\json_decode(toStr($s))); }
  private static function plain($v) {
    if ($v instanceof JsArray) return \array_map([self::class, 'plain'], $v->toList());
    if ($v instanceof \GMP) throw new TypeError('Do not know how to serialize a BigInt');
    if (\is_object($v)) { $o = []; foreach (\get_object_vars($v) as $k => $x) $o[$k] = self::plain($x); return (object)$o; }
    return $v;
  }
  private static function js($v) {
    if (\is_array($v)) return new JsArray(\array_map([self::class, 'js'], $v));
    if ($v instanceof \stdClass) { $o = new Obj(); foreach (\get_object_vars($v) as $k => $x) $o->$k = self::js($x); return $o; }
    return $v;
  }
}

/** crypto.getRandomValues */
final class Crypto {
  public static function getRandomValues($array) {
    $n = $array->length();
    for ($k = 0; $k < $n; ++$k) $array->setAt($k, \random_int(0, 0x7FFFFFFF) | (\random_int(0, 1) << 31));
    return $array;
  }
  public static function randomBytes($n) { return new JsArray(\array_values(\unpack('C*', \random_bytes((int)$n))), 'uint8'); }
}

/**
 * require(name) of Node.js: its crypto module (hashes, HMACs and random
 * bytes, which PHP's hash extension provides); any other module is bundled
 * by whoever runs the file, so require gives nothing for it.
 */
function requireModule($name) {
  if ($name === 'crypto' || $name === 'node:crypto') return NodeCrypto::instance();
  return null;
}
/** require as a value (typeof require === 'function') */
function requireFunction() { return function ($name = null) { return requireModule($name); }; }

#[\AllowDynamicProperties]
final class NodeCrypto {
  public static function instance() { static $i = null; return $i ?? ($i = new NodeCrypto()); }
  public function createHash($algorithm) { return new NodeHash(nodeHashName($algorithm), null); }
  public function createHmac($algorithm, $key) { return new NodeHash(nodeHashName($algorithm), bytesToString($key)); }
  public function randomBytes($n) { return Crypto::randomBytes($n); }
  public function getRandomValues($array) { return Crypto::getRandomValues($array); }
}
#[\AllowDynamicProperties]
final class NodeHash {
  private $ctx;
  public function __construct(string $algorithm, $key) {
    $this->ctx = $key === null ? \hash_init($algorithm) : \hash_init($algorithm, \HASH_HMAC, $key);
  }
  public function update($data) { \hash_update($this->ctx, bytesToString($data)); return $this; }
  public function digest($encoding = null) {
    $raw = \hash_final($this->ctx, true);
    if ($encoding === 'hex') return \bin2hex($raw);
    return new JsArray(\array_values(\unpack('C*', $raw) ?: []), 'uint8');
  }
}
function nodeHashName($algorithm): string {
  $a = \strtolower(\str_replace('_', '-', toStr($algorithm)));
  $map = ['sha-1' => 'sha1', 'sha-224' => 'sha224', 'sha-256' => 'sha256', 'sha-384' => 'sha384', 'sha-512' => 'sha512', 'sha512-256' => 'sha512/256', 'sha512-224' => 'sha512/224'];
  return $map[$a] ?? $a;
}
/** The bytes of a JsArray, a string or a buffer, as a PHP string */
function bytesToString($v): string {
  if ($v === null) return '';
  if (\is_string($v)) return $v;
  if ($v instanceof JsBuffer) $v = newTyped('uint8', $v);
  $list = $v instanceof JsArray ? $v->toList() : (array)$v;
  return $list ? \pack('C*', ...\array_map(function ($b) { return toInt32($b) & 0xFF; }, $list)) : '';
}

/** Node.js Buffer.from / Buffer.alloc: a byte array */
final class Buffer {
  public static function from($v, $encoding = null) {
    if (\is_string($v)) {
      if ($encoding === 'hex') return new JsArray(\array_values(\unpack('C*', \hex2bin($v)) ?: []), 'uint8');
      if ($encoding === 'base64') return new JsArray(\array_values(\unpack('C*', \base64_decode($v)) ?: []), 'uint8');
      return new JsArray(\array_values(\unpack('C*', $v) ?: []), 'uint8');
    }
    return newTyped('uint8', $v);
  }
  public static function alloc($n, $fill = 0) { $a = newTyped('uint8', (int)toNumber($n)); if ($fill) $a->fill($fill); return $a; }
  public static function concat($list) { $out = []; foreach (iterate($list) as $b) foreach ($b->toList() as $x) $out[] = $x; return new JsArray($out, 'uint8'); }
  public static function isBuffer($v) { return $v instanceof JsArray && $v->kind === 'uint8'; }
}

/** globalThis: what code feature-tests for on it (crypto.getRandomValues) */
function globalThis() {
  static $global = null;
  if ($global === null) $global = obj(['crypto' => obj(['getRandomValues' => function ($array) { return Crypto::getRandomValues($array); }])]);
  return $global;
}

/** Date.now / performance.now */
function nowMs() { return num(\floor(\microtime(true) * 1000)); }
function perfNow() { return \microtime(true) * 1000; }

/** A comma expression: every operand is evaluated, the last is its value */
function seq(...$values) { return $values ? $values[\count($values) - 1] : null; }

/** The arguments of a spread call, as one PHP list */
function spread(...$parts) {
  $out = [];
  foreach ($parts as $p) foreach ($p as $v) $out[] = $v;
  return $out;
}
/**
 * What each transpiled file exports (its factory's `return { ... }`, or
 * `module.exports = ...`), by its PHP namespace; and the names a file uses
 * but does not declare (a library or loader parameter of its factory),
 * bound by whoever bundles it.
 */
final class Module {
  public static $exports = [];
  public static $externals = [];
}

/** A file's `module` object: module.exports is what it exports */
#[\AllowDynamicProperties]
final class ModuleObject {
  private $ns;
  public function __construct(string $ns) { $this->ns = $ns; if (!isset(Module::$exports[$ns])) Module::$exports[$ns] = new Obj(); }
  public function __get($name) { return $name === 'exports' ? Module::$exports[$this->ns] : null; }
  public function __set($name, $value) { if ($name === 'exports') Module::$exports[$this->ns] = $value; }
}
function module(string $ns) { return new ModuleObject($ns); }

/** A name the file does not declare: bound by the bundle, else JavaScript's ReferenceError */
function ext(string $name) {
  if (\array_key_exists($name, Module::$externals)) return Module::$externals[$name];
  throw new ReferenceError($name . ' is not defined');
}

/** obj.name(...) on a value whose type the IL leaves open: a string's, a number's or an object's method */
function invoke($obj, string $name, ...$args) {
  if (\is_string($obj)) return Str::$name($obj, ...$args);
  if (\is_int($obj) || \is_float($obj) || $obj instanceof \GMP) return Num::$name($obj, ...$args);
  if ($obj === null) throw new TypeError("Cannot read properties of undefined (reading '" . $name . "')");
  return $obj->$name(...$args);
}

/** A spread argument's elements */
function spreadOf($v): array {
  if ($v instanceof JsArray) return $v->toList();
  if (\is_string($v)) return chars($v);
  if ($v === null) throw new TypeError('Spread syntax requires an iterable');
  return \iterator_to_array(iterate($v), false);
}
