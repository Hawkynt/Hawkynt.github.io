/**
 * Kotlin Language Plugin for Multi-Language Code Generation
 * (c)2006-2025 Hawkynt
 *
 * IL AST -> JavaTransformer (typed JVM IR, shared with Java) -> KotlinEmitter -> Kotlin source.
 *
 * The generated code runs on a small runtime emitted with it, the Kotlin
 * twin of the Java runtime member for member: JavaScript value semantics
 * (Js), growable and typed arrays (U8Array ... JsArray<T>), plain objects,
 * maps and functions, the AlgorithmFramework classes, and the OpCodes
 * helpers the IL does not inline. It needs only the Kotlin standard library
 * and the JDK, so a file plus the runtime compiles on its own with kotlinc.
 */

(function () {
  let LanguagePlugin, LanguagePlugins, KotlinEmitter, KotlinTransformer, parseKotlinSignatures;

  if (typeof require !== 'undefined') {
    const framework = require('./LanguagePlugin.js');
    LanguagePlugin = framework.LanguagePlugin;
    LanguagePlugins = framework.LanguagePlugins;
    const emitter = require('./KotlinEmitter.js');
    KotlinEmitter = emitter.KotlinEmitter;
    parseKotlinSignatures = emitter.parseKotlinSignatures;
    KotlinTransformer = require('./KotlinTransformer.js').KotlinTransformer;
  } else {
    LanguagePlugin = window.LanguagePlugin;
    LanguagePlugins = window.LanguagePlugins;
    KotlinEmitter = window.KotlinEmitter;
    parseKotlinSignatures = window.KotlinSignatures;
    KotlinTransformer = window.KotlinTransformer;
  }

  // =================================================================
  // The Kotlin runtime
  // =================================================================

  // The array classes (mirrors java.js ARRAY_KINDS/arrayClass member for member)
  // [name, storage, value type, read(x), write(v), zero, kind, storage zero]
  const KT_ARRAY_KINDS = [
    ['U8Array', 'ByteArray', 'Int', 'x.toInt() and 0xFF', 'v.toByte()', '0', 'int', '0.toByte()'],
    ['I8Array', 'ByteArray', 'Int', 'x.toInt()', 'v.toByte()', '0', 'int', '0.toByte()'],
    ['U16Array', 'ShortArray', 'Int', 'x.toInt() and 0xFFFF', 'v.toShort()', '0', 'int', '0.toShort()'],
    ['I16Array', 'ShortArray', 'Int', 'x.toInt()', 'v.toShort()', '0', 'int', '0.toShort()'],
    ['U32Array', 'IntArray', 'Long', 'x.toLong() and 0xFFFFFFFFL', 'v.toInt()', '0L', 'long', '0'],
    ['I32Array', 'IntArray', 'Int', 'x', 'v', '0', 'int', '0'],
    ['I64Array', 'LongArray', 'Long', 'x', 'v', '0L', 'long', '0L'],
    ['F64Array', 'DoubleArray', 'Double', 'x', 'v', 'Double.NaN', 'double', '0.0'],
    ['F32Array', 'FloatArray', 'Double', 'x.toDouble()', 'v.toFloat()', 'Double.NaN', 'double', '0.0f'],
    ['BoolArray', 'BooleanArray', 'Boolean', 'x', 'v', 'false', 'boolean', 'false']
  ];

  function ktArrayClass([name, st, vt, rd, wr, zero, kind, szero]) {
    const read = x => rd.replace(/\bx\b/g, x);
    const write = v => wr.replace(/\bv\b/g, v);
    const box = kind === 'int' ? 'Js.toInt' : kind === 'long' ? 'Js.toLong' : kind === 'double' ? 'Js.toNum' : 'Js.truthy';
    const parse = kind === 'int' ? 'java.lang.Long.parseLong(p[i]).toInt()' : kind === 'long' ? 'java.lang.Long.parseLong(p[i])' : kind === 'double' ? 'java.lang.Double.parseDouble(p[i])' : 'java.lang.Boolean.parseBoolean(p[i])';
    const cmp = kind === 'boolean' ? 'java.lang.Boolean.compare(a, b)' : kind === 'int' ? 'Integer.compare(a, b)' : kind === 'long' ? 'java.lang.Long.compare(a, b)' : 'java.lang.Double.compare(a, b)';
    const one = kind === 'long' ? '1L' : kind === 'double' ? '1.0' : '1';
    const incs = kind === 'boolean' ? '' : `
      fun postInc(i: Double): ${vt} { val old = get(i); set(i, old + ${one}); return old }
      fun postDec(i: Double): ${vt} { val old = get(i); set(i, old - ${one}); return old }
      fun preInc(i: Double): ${vt} = set(i, get(i) + ${one})
      fun preDec(i: Double): ${vt} = set(i, get(i) - ${one})`;
    return `
  class ${name} : JsArrayLike {
      @JvmField var a: ${st}
      @JvmField var off: Int = 0
      constructor() { a = ${st}(8) }
      constructor(n: Int) { if (n < 0) throw JsError("Invalid array length"); a = ${st}(Math.max(n, 4)); len = n }
      private constructor(data: ${st}, off: Int, len: Int, fixed: Boolean) { this.a = data; this.off = off; this.len = len; this.fixed = fixed }
      companion object {
          @JvmStatic fun typed(n: Int): ${name} { val r = ${name}(n); r.fixed = true; return r }
          @JvmStatic fun typed(n: Double): ${name} = typed(n.toInt())
          @JvmStatic fun of(vararg v: ${vt}): ${name} { val r = ${name}(v.size); for (i in v.indices) r.a[i] = ${write('v[i]')}; return r }
          @JvmStatic fun typedOf(vararg v: ${vt}): ${name} { val r = of(*v); r.fixed = true; return r }
          /** A long literal table, comma-separated (keeps the class file small). */
          @JvmStatic fun parse(csv: String?): ${name} {
              val p = csv!!.split(",")
              val r = ${name}(p.size)
              for (i in p.indices) r.a[i] = ${write(parse)}
              return r
          }
          @JvmStatic fun typedParse(csv: String?): ${name} { val r = parse(csv); r.fixed = true; return r }
          @JvmStatic fun from(src: Any?): ${name} {
              if (src == null) throw JsError("TypeError: cannot convert null to an array")
              if (src is String) { val r = ${name}(src.length); for (i in 0 until src.length) r.setBoxed(i, src[i].toString()); return r }
              if (src is Number) return ${name}(0)
              val s = src as JsArrayLike; val n = s.length(); val r = ${name}(n)
              if (s is ${name}) { System.arraycopy(s.a, s.off, r.a, 0, n); return r }
              for (i in 0 until n) r.a[i] = ${write(box + '(s.getBoxed(i))')}
              return r
          }
          @JvmStatic fun typedFrom(src: Any?): ${name} {
              if (src is Number) return typed(Js.toInt(src))
              val r = from(src); r.fixed = true; return r
          }
      }
      fun get(i: Int): ${vt} { if (i < 0 || i >= len) return ${zero}; val x = a[off + i]; return ${read('x')} }
      fun get(i: Long): ${vt} = if (i < 0 || i >= len) ${zero} else get(i.toInt())
      fun get(i: Double): ${vt} = if (i != Math.floor(i) || i < 0 || i >= len) ${zero} else get(i.toInt())
      fun set(i: Int, v: ${vt}): ${vt} {
          if (i < 0) return v
          if (i >= len) { if (fixed) return v; setLength(i + 1) }
          a[off + i] = ${write('v')}
          return v
      }
      fun set(i: Long, v: ${vt}): ${vt} = if (i < 0 || i > Int.MAX_VALUE) v else set(i.toInt(), v)${incs}
      fun set(i: Double, v: ${vt}): ${vt} = if (i != Math.floor(i) || i < 0) v else set(i.toInt(), v)
      private fun ensure(n: Int) {
          if (off + n <= a.size) return
          val b = ${st}(Math.max(n, a.size * 2 + 4))
          System.arraycopy(a, off, b, 0, len)
          a = b; off = 0
      }
      override fun setLength(n: Int) {
          if (n < 0) throw JsError("Invalid array length")
          if (fixed) return
          if (n > len) { ensure(n); java.util.Arrays.fill(a, off + len, off + n, ${szero}) }
          len = n
      }
      override fun getBoxed(i: Int): Any? = if (i < 0 || i >= len) null else get(i)
      override fun setBoxed(i: Int, v: Any?) { set(i, ${box}(v)) }
      override fun pushBoxed(v: Any?): Int = push(${box}(v))
      fun push(v: ${vt}): Int { if (fixed) throw JsError("TypeError: push on a typed array"); ensure(len + 1); a[off + len++] = ${write('v')}; return len }
      fun push(v: ${vt}, w: ${vt}): Int { push(v); return push(w) }
      fun push(v: ${vt}, w: ${vt}, x: ${vt}): Int { push(v); push(w); return push(x) }
      fun push(v: ${vt}, w: ${vt}, x: ${vt}, y: ${vt}): Int { push(v); push(w); push(x); return push(y) }
      fun pushAll(src: Any?): Int {
          if (src is ${name}) { val n = src.len; ensure(len + n); System.arraycopy(src.a, src.off, a, off + len, n); len += n; return len }
          val s = src as JsArrayLike; val n = s.length()
          for (i in 0 until n) pushBoxed(s.getBoxed(i))
          return len
      }
      fun pop(): ${vt} { if (len == 0) return ${zero}; val v = get(len - 1); len--; return v }
      fun shift(): ${vt} { if (len == 0) return ${zero}; val v = get(0); off++; len--; return v }
      fun unshift(v: ${vt}): Int { ensure(len + 1); System.arraycopy(a, off, a, off + 1, len); a[off] = ${write('v')}; len++; return len }
      fun unshiftAll(src: Any?): Int { val t = from(src); t.pushAll(this); a = t.a; off = t.off; len = t.len; return len }
      fun slice(): ${name} = slice(0.0, len.toDouble())
      fun slice(s: Double): ${name} = slice(s, len.toDouble())
      fun slice(s: Double, e: Double): ${name} {
          val b = Js.relIndex(s, len); val f = Js.relIndex(e, len)
          val n = Math.max(0, f - b)
          val r = ${name}(n); System.arraycopy(a, off + b, r.a, 0, n); r.fixed = fixed; return r
      }
      fun subarray(): ${name} = subarray(0.0, len.toDouble())
      fun subarray(s: Double): ${name} = subarray(s, len.toDouble())
      fun subarray(s: Double, e: Double): ${name} {
          val b = Js.relIndex(s, len); val f = Js.relIndex(e, len)
          return ${name}(a, off + b, Math.max(0, f - b), true)
      }
      fun concat(vararg others: Any?): ${name} {
          val r = slice(); r.fixed = false
          for (o in others) { if (o is JsArrayLike) r.pushAll(o) else r.pushBoxed(o) }
          return r
      }
      fun splice(start: Double): ${name} = splice(start, len.toDouble())
      fun splice(start: Double, deleteCount: Double, vararg items: Any?): ${name} {
          val s = Js.relIndex(start, len)
          val d = Math.max(0L, Math.min(Js.toIntegerOrZero(deleteCount), (len - s).toLong())).toInt()
          val removed = ${name}(d); System.arraycopy(a, off + s, removed.a, 0, d)
          val n = items.size; val tail = len - s - d
          ensure(len - d + n)
          System.arraycopy(a, off + s + d, a, off + s + n, tail)
          for (i in 0 until n) a[off + s + i] = ${write(box + '(items[i])')}
          len = len - d + n
          return removed
      }
      fun indexOf(v: ${vt}): Int = indexOf(v, 0.0)
      fun indexOf(v: ${vt}, from: Double): Int { var i = Js.relIndex(from, len); while (i < len) { if (get(i) == v) return i; ++i }; return -1 }
      fun lastIndexOf(v: ${vt}): Int { var i = len - 1; while (i >= 0) { if (get(i) == v) return i; --i }; return -1 }
      fun includes(v: ${vt}): Boolean = indexOf(v) >= 0
      override fun indexOfBoxed(v: Any?): Int { if (!Js.isNumberLike(v, ${kind === 'boolean'})) return -1; return indexOf(${box}(v)) }
      fun fill(v: ${vt}): ${name} = fill(v, 0.0, len.toDouble())
      fun fill(v: ${vt}, s: Double): ${name} = fill(v, s, len.toDouble())
      fun fill(v: ${vt}, s: Double, e: Double): ${name} { val b = Js.relIndex(s, len); val f = Js.relIndex(e, len); for (i in b until f) a[off + i] = ${write('v')}; return this }
      fun reverse(): ${name} { var i = 0; var j = len - 1; while (i < j) { val t = a[off + i]; a[off + i] = a[off + j]; a[off + j] = t; ++i; --j }; return this }
      fun sort(): ${name} {
          val boxed = arrayOfNulls<Any?>(len)
          for (i in 0 until len) boxed[i] = get(i)
          if (fixed) java.util.Arrays.sort(boxed) { x, y -> val a = ${box}(x); val b = ${box}(y); ${cmp} }
          else java.util.Arrays.sort(boxed) { x, y -> Js.str(x).compareTo(Js.str(y)) }
          for (i in 0 until len) setBoxed(i, boxed[i])
          return this
      }
      fun sort(cmp: JsFn?): ${name} {
          if (cmp == null) return sort()
          val boxed = arrayOfNulls<Any?>(len)
          for (i in 0 until len) boxed[i] = get(i)
          java.util.Arrays.sort(boxed) { x, y -> val d = Js.toNum(cmp.call(x, y)); if (d < 0) -1 else if (d > 0) 1 else 0 }
          for (i in 0 until len) setBoxed(i, boxed[i])
          return this
      }
      fun set(src: Any?) { set(src, 0.0) }
      fun set(src: Any?, offset: Double) {
          val o = offset.toInt()
          if (src is ${name}) { if (o + src.len > len) throw JsError("RangeError: offset is out of bounds"); System.arraycopy(src.a, src.off, a, off + o, src.len); return }
          val s = src as JsArrayLike; val n = s.length()
          if (o + n > len) throw JsError("RangeError: offset is out of bounds")
          for (i in 0 until n) setBoxed(o + i, s.getBoxed(i))
      }
      fun copy(): ${name} = slice()
      fun map(fn: JsFn?): ${name} { val r = ${name}(len); r.fixed = fixed; for (i in 0 until len) r.setBoxed(i, fn!!.call(get(i), i, this)); return r }
      fun filter(fn: JsFn?): ${name} { val r = ${name}(); for (i in 0 until len) if (Js.truthy(fn!!.call(get(i), i, this))) r.push(get(i)); r.fixed = fixed; return r }
  }
  `;
  }

  const RUNTIME_CORE = String.raw`// ===================================================================
// JavaScript value semantics for the transpiled code (runtime support)
// ===================================================================

/** A JavaScript exception: an Error with a message, or a thrown value. */
class JsError : RuntimeException {
    @JvmField val value: Any?
    @JvmField var name: String = "Error"
    constructor(message: String?) : super(message) { this.value = null }
    constructor(name: String?, message: String?) : super(message) { this.value = null; this.name = name ?: "Error" }
    private constructor(value: Any?, thrown: Boolean) : super(Js.str(value)) { this.value = value }
    fun getMessageText(): String? = message
    companion object {
        @JvmStatic fun thrown(value: Any?): JsError = if (value is JsError) value else JsError(value, true)
    }
}

/** A JavaScript function value. */
fun interface JsFn { fun call(vararg args: Any?): Any? }

/** Objects carrying JavaScript properties beyond their declared fields. */
interface JsDynamic { fun props(): JsObject? }

/** Base of every array: a JavaScript Array (growable) or TypedArray (fixed). */
abstract class JsArrayLike {
    @JvmField var len: Int = 0
    @JvmField var fixed: Boolean = false
    fun length(): Int = len
    abstract fun setLength(n: Int)
    fun setLength(n: Long) { setLength(n.toInt()) }
    fun setLength(n: Double) { setLength(n.toInt()) }
    fun isFixed(): Boolean = fixed
    abstract fun getBoxed(i: Int): Any?
    abstract fun setBoxed(i: Int, v: Any?)
    abstract fun pushBoxed(v: Any?): Int
    abstract fun indexOfBoxed(v: Any?): Int
    fun join(): String = join(",")
    fun join(sep: String?): String {
        val sb = StringBuilder()
        for (i in 0 until len) { if (i > 0) sb.append(sep); val v = getBoxed(i); if (v != null) sb.append(Js.str(v)) }
        return sb.toString()
    }
    override fun toString(): String = join(",")
    fun forEach(fn: JsFn?) { for (i in 0 until len) fn!!.call(getBoxed(i), i, this) }
    fun some(fn: JsFn?): Boolean { for (i in 0 until len) if (Js.truthy(fn!!.call(getBoxed(i), i, this))) return true; return false }
    fun every(fn: JsFn?): Boolean { for (i in 0 until len) if (!Js.truthy(fn!!.call(getBoxed(i), i, this))) return false; return true }
    fun find(fn: JsFn?): Any? { for (i in 0 until len) if (Js.truthy(fn!!.call(getBoxed(i), i, this))) return getBoxed(i); return null }
    fun findIndex(fn: JsFn?): Int { for (i in 0 until len) if (Js.truthy(fn!!.call(getBoxed(i), i, this))) return i; return -1 }
    fun reduce(fn: JsFn?, init: Any?): Any? { var acc = init; for (i in 0 until len) acc = fn!!.call(acc, getBoxed(i), i, this); return acc }
    fun reduce(fn: JsFn?): Any? { if (len == 0) throw JsError("TypeError: Reduce of empty array with no initial value"); var acc = getBoxed(0); for (i in 1 until len) acc = fn!!.call(acc, getBoxed(i), i, this); return acc }
    fun mapToObjects(fn: JsFn?): JsArray<Any?> { val r = JsArray<Any?>(len); for (i in 0 until len) r.set(i, fn!!.call(getBoxed(i), i, this)); return r }
}

/** An array of references (strings, objects, nested arrays, BigInts). */
@Suppress("UNCHECKED_CAST")
class JsArray<T> : JsArrayLike {
    @JvmField var a: Array<Any?>
    constructor() { a = arrayOfNulls(8) }
    constructor(n: Int) { if (n < 0) throw JsError("Invalid array length"); a = arrayOfNulls(Math.max(n, 4)); len = n }
    companion object {
        @JvmStatic fun <T> of(vararg v: T): JsArray<T> { val r = JsArray<T>(v.size); System.arraycopy(v, 0, r.a, 0, v.size); return r }
        @JvmStatic fun <T> from(src: Any?): JsArray<T> {
            val r = JsArray<T>()
            if (src == null) throw JsError("TypeError: cannot convert null to an array")
            if (src is String) { for (i in 0 until src.length) r.pushBoxed(src[i].toString()); return r }
            if (src is JsSet) { for (o in src.s) r.pushBoxed(o); return r }
            if (src is JsMap) return src.entries() as JsArray<T>
            if (src is Number) { r.setLength(0); return r }
            val s = src as JsArrayLike
            for (i in 0 until s.length()) r.pushBoxed(s.getBoxed(i))
            return r
        }
        @JvmStatic fun <T> filled(n: Int, v: T): JsArray<T> { val r = JsArray<T>(n); java.util.Arrays.fill(r.a, 0, n, v); return r }
    }
    fun get(i: Int): T? = if (i < 0 || i >= len) null else a[i] as T?
    fun get(i: Long): T? = if (i < 0 || i >= len) null else get(i.toInt())
    fun get(i: Double): T? = if (i != Math.floor(i) || i < 0 || i >= len) null else get(i.toInt())
    fun set(i: Int, v: T?): T? { if (i < 0) return v; if (i >= len) setLength(i + 1); a[i] = v; return v }
    fun set(i: Long, v: T?): T? = set(i.toInt(), v)
    fun set(i: Double, v: T?): T? = set(i.toInt(), v)
    private fun ensure(n: Int) { if (n <= a.size) return; a = java.util.Arrays.copyOf(a, Math.max(n, a.size * 2 + 4)) }
    override fun setLength(n: Int) { if (n < 0) throw JsError("Invalid array length"); if (n > len) ensure(n) else java.util.Arrays.fill(a, n, len, null); len = n }
    override fun getBoxed(i: Int): Any? = get(i)
    override fun setBoxed(i: Int, v: Any?) { set(i, v as T?) }
    override fun pushBoxed(v: Any?): Int = push(v as T?)
    fun push(v: T?): Int { ensure(len + 1); a[len++] = v; return len }
    fun push(v: T?, vararg more: T?): Int { push(v); for (m in more) push(m); return len }
    fun pushAll(src: Any?): Int { val s = src as JsArrayLike; val n = s.length(); for (i in 0 until n) pushBoxed(s.getBoxed(i)); return len }
    fun pop(): T? { if (len == 0) return null; val v = get(len - 1); a[--len] = null; return v }
    fun shift(): T? { if (len == 0) return null; val v = get(0); System.arraycopy(a, 1, a, 0, len - 1); a[--len] = null; return v }
    fun unshift(v: T?): Int { ensure(len + 1); System.arraycopy(a, 0, a, 1, len); a[0] = v; return ++len }
    fun slice(): JsArray<T> = slice(0.0, len.toDouble())
    fun slice(s: Double): JsArray<T> = slice(s, len.toDouble())
    fun slice(s: Double, e: Double): JsArray<T> { val b = Js.relIndex(s, len); val f = Js.relIndex(e, len); val n = Math.max(0, f - b); val r = JsArray<T>(n); System.arraycopy(a, b, r.a, 0, n); return r }
    fun concat(vararg others: Any?): JsArray<T> { val r = slice(); for (o in others) { if (o is JsArrayLike) r.pushAll(o) else r.pushBoxed(o) }; return r }
    fun splice(start: Double): JsArray<T> = splice(start, len.toDouble())
    fun splice(start: Double, deleteCount: Double, vararg items: Any?): JsArray<T> {
        val s = Js.relIndex(start, len)
        val d = Math.max(0L, Math.min(Js.toIntegerOrZero(deleteCount), (len - s).toLong())).toInt()
        val removed = JsArray<T>(d); System.arraycopy(a, s, removed.a, 0, d)
        val n = items.size; val tail = len - s - d
        ensure(len - d + n)
        System.arraycopy(a, s + d, a, s + n, tail)
        for (i in 0 until n) a[s + i] = items[i]
        val newLen = len - d + n
        if (newLen < len) java.util.Arrays.fill(a, newLen, len, null)
        len = newLen
        return removed
    }
    fun indexOf(v: Any?): Int = indexOf(v, 0.0)
    fun indexOf(v: Any?, from: Double): Int { var i = Js.relIndex(from, len); while (i < len) { if (Js.strictEq(a[i], v)) return i; ++i }; return -1 }
    fun lastIndexOf(v: Any?): Int { var i = len - 1; while (i >= 0) { if (Js.strictEq(a[i], v)) return i; --i }; return -1 }
    fun includes(v: Any?): Boolean { for (i in 0 until len) if (Js.sameValueZero(a[i], v)) return true; return false }
    override fun indexOfBoxed(v: Any?): Int = indexOf(v)
    fun fill(v: T?): JsArray<T> = fill(v, 0.0, len.toDouble())
    fun fill(v: T?, s: Double): JsArray<T> = fill(v, s, len.toDouble())
    fun fill(v: T?, s: Double, e: Double): JsArray<T> { val b = Js.relIndex(s, len); val f = Js.relIndex(e, len); for (i in b until f) a[i] = v; return this }
    fun reverse(): JsArray<T> { var i = 0; var j = len - 1; while (i < j) { val t = a[i]; a[i] = a[j]; a[j] = t; ++i; --j }; return this }
    fun sort(): JsArray<T> { java.util.Arrays.sort(a, 0, len) { x, y -> if (x == null) (if (y == null) 0 else 1) else if (y == null) -1 else Js.str(x).compareTo(Js.str(y)) }; return this }
    fun sort(cmp: JsFn?): JsArray<T> {
        if (cmp == null) return sort()
        java.util.Arrays.sort(a, 0, len) { x, y -> val d = Js.toNum(cmp.call(x, y)); if (d < 0) -1 else if (d > 0) 1 else 0 }
        return this
    }
    fun copy(): JsArray<T> = slice()
    fun map(fn: JsFn?): JsArray<T> { val r = JsArray<T>(len); for (i in 0 until len) r.a[i] = fn!!.call(get(i), i, this); return r }
    fun filter(fn: JsFn?): JsArray<T> { val r = JsArray<T>(); for (i in 0 until len) if (Js.truthy(fn!!.call(get(i), i, this))) r.push(get(i)); return r }
}

/** A plain JavaScript object: string keys, integer-like keys first in ascending order. */
class JsObject : JsDynamic {
    @JvmField val m = java.util.LinkedHashMap<String, Any?>()
    override fun props(): JsObject? = this
    companion object {
        @JvmStatic fun of(vararg kv: Any?): JsObject { val o = JsObject(); var i = 0; while (i + 1 < kv.size) { o.put(Js.propKey(kv[i]), kv[i + 1]); i += 2 }; return o }
    }
    fun get(k: String?): Any? = m[k]
    fun get(k: Any?): Any? = m[Js.propKey(k)]
    fun put(k: String?, v: Any?): Any? { m[k ?: "undefined"] = v; return v }
    fun put(k: Any?, v: Any?): Any? { m[Js.propKey(k)] = v; return v }
    fun has(k: Any?): Boolean = m.containsKey(Js.propKey(k))
    fun delete(k: Any?): Boolean { m.remove(Js.propKey(k)); return true }
    fun keys(): JsArray<String?> {
        val ints = java.util.ArrayList<String>(); val others = java.util.ArrayList<String>()
        for (k in m.keys) { if (Js.isArrayIndex(k)) ints.add(k) else others.add(k) }
        ints.sortWith { x, y -> java.lang.Long.compare(java.lang.Long.parseLong(x), java.lang.Long.parseLong(y)) }
        val r = JsArray<String?>()
        for (k in ints) r.push(k)
        for (k in others) r.push(k)
        return r
    }
    fun values(): JsArray<Any?> { val k = keys(); val r = JsArray<Any?>(); for (i in 0 until k.length()) r.push(m[k.get(i)]); return r }
    fun entries(): JsArray<Any?> { val k = keys(); val r = JsArray<Any?>(); for (i in 0 until k.length()) r.push(JsArray.of<Any?>(k.get(i), m[k.get(i)])); return r }
    override fun toString(): String = "[object " + "Object]"
}

/** A JavaScript Map: SameValueZero keys, insertion order. */
class JsMap {
    @JvmField val m = java.util.LinkedHashMap<Any?, Any?>()
    constructor()
    constructor(entries: Any?) { if (entries != null) { val e = entries as JsArrayLike; for (i in 0 until e.length()) { val kv = e.getBoxed(i) as JsArrayLike; set(kv.getBoxed(0), kv.getBoxed(1)) } } }
    fun get(k: Any?): Any? = m[Js.mapKey(k)]
    fun set(k: Any?, v: Any?): JsMap { m[Js.mapKey(k)] = v; return this }
    fun has(k: Any?): Boolean = m.containsKey(Js.mapKey(k))
    fun delete(k: Any?): Boolean { val key = Js.mapKey(k); val had = m.containsKey(key); m.remove(key); return had }
    fun size(): Int = m.size
    fun clear() { m.clear() }
    fun keys(): JsArray<Any?> { val r = JsArray<Any?>(); for (k in m.keys) r.push(Js.unMapKey(k)); return r }
    fun values(): JsArray<Any?> { val r = JsArray<Any?>(); for (v in m.values) r.push(v); return r }
    fun entries(): JsArray<Any?> { val r = JsArray<Any?>(); for (e in m.entries) r.push(JsArray.of<Any?>(Js.unMapKey(e.key), e.value)); return r }
    fun forEach(fn: JsFn?) { for (e in java.util.ArrayList(m.entries)) fn!!.call(e.value, Js.unMapKey(e.key), this) }
}

/** A JavaScript Set: SameValueZero values, insertion order. */
class JsSet {
    @JvmField val s = java.util.LinkedHashSet<Any?>()
    constructor()
    constructor(values: Any?) { if (values != null) { val e: JsArrayLike = if (values is String) JsArray.from<Any?>(values) else values as JsArrayLike; for (i in 0 until e.length()) add(e.getBoxed(i)) } }
    fun add(v: Any?): JsSet { s.add(Js.mapKey(v)); return this }
    fun has(v: Any?): Boolean = s.contains(Js.mapKey(v))
    fun delete(v: Any?): Boolean = s.remove(Js.mapKey(v))
    fun size(): Int = s.size
    fun clear() { s.clear() }
    fun values(): JsArray<Any?> { val r = JsArray<Any?>(); for (v in s) r.push(Js.unMapKey(v)); return r }
    fun forEach(fn: JsFn?) { for (v in java.util.ArrayList(s)) fn!!.call(Js.unMapKey(v), Js.unMapKey(v), this) }
}
`;

  const RUNTIME_JS = String.raw`/** JavaScript operators and builtins over JVM values. */
@Suppress("UNCHECKED_CAST", "NAME_SHADOWING")
object Js {
    @JvmField val MASK64: java.math.BigInteger = java.math.BigInteger.ONE.shiftLeft(64).subtract(java.math.BigInteger.ONE)
    /** The global object module-level code sees as this. */
    @JvmField val GLOBAL = JsObject()
    @JvmField val TWO64: java.math.BigInteger = java.math.BigInteger.ONE.shiftLeft(64)

    // ---------------------------------------------------------------- numbers
    @JvmStatic fun toInt32(d: Double): Int {
        if (java.lang.Double.isNaN(d) || java.lang.Double.isInfinite(d)) return 0
        if (d >= -2147483648.0 && d <= 2147483647.0) return d.toInt()
        val t = if (d < 0) Math.ceil(d) else Math.floor(d)
        val m = t % 4294967296.0
        return m.toLong().toInt()
    }
    @JvmStatic fun toInt32(v: Long): Int = v.toInt()
    @JvmStatic fun toInt32(v: Int): Int = v
    @JvmStatic fun toInt32(o: Any?): Int = if (o is Int) o else if (o is Long) o.toInt() else toInt32(toNum(o))
    @JvmStatic fun toUint32(d: Double): Long = toInt32(d).toLong() and 0xFFFFFFFFL
    @JvmStatic fun toUint32(v: Long): Long = v and 0xFFFFFFFFL
    @JvmStatic fun toUint32(v: Int): Long = v.toLong() and 0xFFFFFFFFL
    @JvmStatic fun toUint32(o: Any?): Long = toInt32(o).toLong() and 0xFFFFFFFFL
    /** JavaScript ToNumber, then exact integral conversion (the value is integral by the IL type). */
    @JvmStatic fun toInt(o: Any?): Int {
        if (o is Int) return o
        if (o is Long) return o.toInt()
        if (o is java.math.BigInteger) return o.toInt()
        if (o is Number) { val d = o.toDouble(); return if (java.lang.Double.isNaN(d)) 0 else d.toLong().toInt() }
        val d = toNum(o); return if (java.lang.Double.isNaN(d)) 0 else d.toLong().toInt()
    }
    @JvmStatic fun toLong(o: Any?): Long {
        if (o is Long) return o
        if (o is Int) return o.toLong()
        if (o is java.math.BigInteger) return o.toLong()
        val d = toNum(o); return if (java.lang.Double.isNaN(d)) 0L else d.toLong()
    }
    @JvmStatic fun toLong(d: Double): Long = if (java.lang.Double.isNaN(d)) 0L else d.toLong()
    @JvmStatic fun toInt(d: Double): Int = if (java.lang.Double.isNaN(d)) 0 else d.toLong().toInt()
    @JvmStatic fun toNum(o: Any?): Double {
        if (o == null) return Double.NaN
        if (o is Number) return o.toDouble()
        if (o is Boolean) return if (o) 1.0 else 0.0
        if (o is String) {
            val s = o.trim()
            if (s.isEmpty()) return 0.0
            try {
                if (s.startsWith("0x") || s.startsWith("0X")) return java.lang.Long.parseLong(s.substring(2), 16).toDouble()
                if (s == "Infinity" || s == "+Infinity") return Double.POSITIVE_INFINITY
                if (s == "-Infinity") return Double.NEGATIVE_INFINITY
                if (!s.matches(Regex("[+-]?(\\d+\\.?\\d*([eE][+-]?\\d+)?|\\.\\d+([eE][+-]?\\d+)?)"))) return Double.NaN
                return java.lang.Double.parseDouble(s)
            } catch (e: NumberFormatException) { return Double.NaN }
        }
        if (o is JsArrayLike) { if (o.length() == 0) return 0.0; if (o.length() == 1) return toNum(o.getBoxed(0)); return Double.NaN }
        return Double.NaN
    }
    @JvmStatic fun toNum(d: Double): Double = d
    @JvmStatic fun toBig(o: Any?): java.math.BigInteger {
        if (o is java.math.BigInteger) return o
        if (o is Int || o is Long) return java.math.BigInteger.valueOf((o as Number).toLong())
        if (o is Number) return big(o.toDouble())
        if (o is Boolean) return if (o) java.math.BigInteger.ONE else java.math.BigInteger.ZERO
        if (o is String) return bigOf(o)
        if (o is JsArrayLike) return bigOf(str(o))
        throw JsError("TypeError", "Cannot convert " + str(o) + " to a BigInt")
    }
    /** BigInt(number): the number must be an integer. */
    @JvmStatic fun big(d: Double): java.math.BigInteger {
        if (java.lang.Double.isNaN(d) || java.lang.Double.isInfinite(d) || d != Math.floor(d)) throw JsError("RangeError", "The number " + str(d) + " cannot be converted to a BigInt because it is not an integer")
        return java.math.BigDecimal(d).toBigInteger()
    }
    @JvmStatic fun big(v: Long): java.math.BigInteger = java.math.BigInteger.valueOf(v)
    @JvmStatic fun big(v: Int): java.math.BigInteger = java.math.BigInteger.valueOf(v.toLong())
    @JvmStatic fun big(v: Boolean): java.math.BigInteger = if (v) java.math.BigInteger.ONE else java.math.BigInteger.ZERO
    @JvmStatic fun big(v: java.math.BigInteger?): java.math.BigInteger? = v
    @JvmStatic fun big(s: String?): java.math.BigInteger = bigOf(s)
    @JvmStatic fun big(o: Any?): java.math.BigInteger = toBig(o)
    @JvmStatic fun bigOf(s: String?): java.math.BigInteger {
        val s = s!!.trim()
        if (s.isEmpty()) return java.math.BigInteger.ZERO
        try {
            if (s.startsWith("0x") || s.startsWith("0X")) return java.math.BigInteger(s.substring(2), 16)
            if (s.startsWith("0b") || s.startsWith("0B")) return java.math.BigInteger(s.substring(2), 2)
            if (s.startsWith("0o") || s.startsWith("0O")) return java.math.BigInteger(s.substring(2), 8)
            return java.math.BigInteger(s)
        } catch (e: NumberFormatException) { throw JsError("SyntaxError", "Cannot convert " + s + " to a BigInt") }
    }
    /** BigInt.asUintN(64, x) as a JVM long (two's complement bits). */
    @JvmStatic fun u64(v: java.math.BigInteger?): Long = v!!.toLong()
    @JvmStatic fun bigU64(v: Long): java.math.BigInteger { val b = java.math.BigInteger.valueOf(v); return if (v < 0) b.add(TWO64) else b }
    @JvmStatic fun asUintN(bits: Int, v: java.math.BigInteger?): java.math.BigInteger { val m = java.math.BigInteger.ONE.shiftLeft(bits); return v!!.mod(m) }
    @JvmStatic fun asIntN(bits: Int, v: java.math.BigInteger?): java.math.BigInteger { val r = asUintN(bits, v); return if (r.testBit(bits - 1)) r.subtract(java.math.BigInteger.ONE.shiftLeft(bits)) else r }
    @JvmStatic fun num(v: java.math.BigInteger?): Double = v!!.toDouble()
    @JvmStatic fun isNumberLike(v: Any?, bool: Boolean): Boolean = if (bool) v is Boolean else v is Number && v !is java.math.BigInteger
    @JvmStatic fun toIntegerOrZero(d: Double): Long = if (java.lang.Double.isNaN(d)) 0L else d.toLong()
    /** A relative index (negative counts from the end) clamped to [0, len]. */
    @JvmStatic fun relIndex(d: Double, len: Int): Int {
        if (java.lang.Double.isNaN(d)) return 0
        val t = if (d < 0) Math.ceil(d) else Math.floor(d)
        if (t < 0) return Math.max(0.0, len + t).toInt()
        return Math.min(t, len.toDouble()).toInt()
    }
    @JvmStatic fun isArrayIndex(k: String?): Boolean {
        if (k == null || k.isEmpty() || k.length > 10) return false
        for (i in 0 until k.length) if (k[i] < '0' || k[i] > '9') return false
        return k == "0" || k[0] != '0'
    }

    // ---------------------------------------------------------------- operators
    @JvmStatic fun truthy(o: Any?): Boolean {
        if (o == null) return false
        if (o is Boolean) return o
        if (o is String) return !o.isEmpty()
        if (o is java.math.BigInteger) return o.signum() != 0
        if (o is Number) { val d = o.toDouble(); return d != 0.0 && !java.lang.Double.isNaN(d) }
        return true
    }
    @JvmStatic fun truthy(d: Double): Boolean = d != 0.0 && !java.lang.Double.isNaN(d)
    @JvmStatic fun truthy(v: Long): Boolean = v != 0L
    @JvmStatic fun truthy(v: Int): Boolean = v != 0
    @JvmStatic fun truthy(v: Boolean): Boolean = v
    @JvmStatic fun truthy(s: String?): Boolean = s != null && !s.isEmpty()
    @JvmStatic fun truthy(v: java.math.BigInteger?): Boolean = v != null && v.signum() != 0
    /** JavaScript ===. */
    @JvmStatic fun strictEq(a: Any?, b: Any?): Boolean {
        if (a === b) return a == null || a !is Double || !a.isNaN()
        if (a == null || b == null) return false
        if (a is java.math.BigInteger || b is java.math.BigInteger) return a is java.math.BigInteger && b is java.math.BigInteger && a == b
        if (a is Number && b is Number) return a.toDouble() == b.toDouble()
        if (a is String && b is String) return a == b
        if (a is Boolean && b is Boolean) return a == b
        return false
    }
    /** JavaScript ==. */
    @JvmStatic fun looseEq(a: Any?, b: Any?): Boolean {
        if (a == null || b == null) return a == null && b == null
        if (a is java.math.BigInteger && b is Number) return if (b is java.math.BigInteger) a == b else (if (java.lang.Double.isNaN(b.toDouble())) false else java.math.BigDecimal(b.toDouble()).compareTo(java.math.BigDecimal(a)) == 0)
        if (b is java.math.BigInteger && a is Number) return looseEq(b, a)
        if (a.javaClass == b.javaClass || (a is Number && b is Number)) return strictEq(a, b)
        if (a is Number || a is Boolean || b is Number || b is Boolean) {
            if ((a is String || a is Number || a is Boolean) && (b is String || b is Number || b is Boolean)) return toNum(a) == toNum(b)
        }
        if (a is String && b is JsArrayLike) return a == str(b)
        if (b is String && a is JsArrayLike) return b == str(a)
        return false
    }
    @JvmStatic fun sameValueZero(a: Any?, b: Any?): Boolean {
        if (a is Double && b is Double && a.isNaN() && b.isNaN()) return true
        return strictEq(a, b)
    }
    /** BigInt and Number compared by mathematical value (BigInt < Number etc.). */
    @JvmStatic fun cmpBigNum(a: java.math.BigInteger, b: Double): Int {
        if (java.lang.Double.isNaN(b)) return 2
        if (java.lang.Double.isInfinite(b)) return if (b > 0) -1 else 1
        return java.math.BigDecimal(a).compareTo(java.math.BigDecimal(b))
    }
    /** a < b etc. on dynamic values (numbers, strings, BigInts); NaN compares false. */
    @JvmStatic fun compare(a: Any?, b: Any?): Int {
        if (a is String && b is String) { val c = a.compareTo(b); return if (c < 0) -1 else if (c > 0) 1 else 0 }
        if (a is java.math.BigInteger && b is java.math.BigInteger) return a.compareTo(b)
        if (a is java.math.BigInteger) return cmpBigNum(a, toNum(b))
        if (b is java.math.BigInteger) { val c = cmpBigNum(b, toNum(a)); return if (c == 2) 2 else -c }
        val x = toNum(a); val y = toNum(b)
        if (java.lang.Double.isNaN(x) || java.lang.Double.isNaN(y)) return 2
        return if (x < y) -1 else if (x > y) 1 else 0
    }
    @JvmStatic fun lt(a: Any?, b: Any?): Boolean = compare(a, b) == -1
    @JvmStatic fun le(a: Any?, b: Any?): Boolean { val c = compare(a, b); return c == -1 || c == 0 }
    @JvmStatic fun gt(a: Any?, b: Any?): Boolean = compare(a, b) == 1
    @JvmStatic fun ge(a: Any?, b: Any?): Boolean { val c = compare(a, b); return c == 1 || c == 0 }
    /** JavaScript + on dynamic values. */
    @JvmStatic fun add(a: Any?, b: Any?): Any? {
        val pa: Any? = if (a is JsArrayLike || a is JsObject) str(a) else a
        val pb: Any? = if (b is JsArrayLike || b is JsObject) str(b) else b
        if (pa is String || pb is String) return str(pa) + str(pb)
        if (pa is java.math.BigInteger && pb is java.math.BigInteger) return pa.add(pb)
        if (pa is java.math.BigInteger || pb is java.math.BigInteger) throw JsError("TypeError", "Cannot mix BigInt and other types, use explicit conversions")
        return toNum(pa) + toNum(pb)
    }
    @JvmStatic fun sub(a: Any?, b: Any?): Double = toNum(a) - toNum(b)
    @JvmStatic fun mul(a: Any?, b: Any?): Double = toNum(a) * toNum(b)
    @JvmStatic fun div(a: Any?, b: Any?): Double = toNum(a) / toNum(b)
    @JvmStatic fun mod(a: Any?, b: Any?): Double = toNum(a) % toNum(b)
    @JvmStatic fun mod(a: Double, b: Double): Double = a % b
    /** JavaScript ** (Math.pow with its NaN rule for 1 ** Infinity). */
    @JvmStatic fun pow(a: Double, b: Double): Double { if (java.lang.Double.isNaN(b)) return Double.NaN; if (Math.abs(a) == 1.0 && java.lang.Double.isInfinite(b)) return Double.NaN; return Math.pow(a, b) }
    @JvmStatic fun pow(a: java.math.BigInteger?, b: java.math.BigInteger?): java.math.BigInteger {
        if (b!!.signum() < 0) throw JsError("RangeError", "Exponent must be non-negative")
        return a!!.pow(b.intValueExact())
    }
    @JvmStatic fun imul(a: Long, b: Long): Int = a.toInt() * b.toInt()
    @JvmStatic fun imul(a: Double, b: Double): Int = toInt32(a) * toInt32(b)
    @JvmStatic fun clz32(d: Double): Int = Integer.numberOfLeadingZeros(toInt32(d))
    @JvmStatic fun clz32(v: Long): Int = Integer.numberOfLeadingZeros(v.toInt())
    @JvmStatic fun fround(d: Double): Double = d.toFloat().toDouble()
    @JvmStatic fun sign(d: Double): Double = if (java.lang.Double.isNaN(d)) Double.NaN else if (d > 0) 1.0 else if (d < 0) -1.0 else d
    @JvmStatic fun trunc(d: Double): Double = if (d < 0) Math.ceil(d) else Math.floor(d)
    @JvmStatic fun round(d: Double): Double { if (java.lang.Double.isNaN(d) || java.lang.Double.isInfinite(d)) return d; return Math.floor(d + 0.5) }
    @JvmStatic fun max(vararg v: Double): Double { var r = Double.NEGATIVE_INFINITY; for (x in v) { if (java.lang.Double.isNaN(x)) return Double.NaN; if (x > r || (x == 0.0 && r == 0.0 && java.lang.Double.doubleToRawLongBits(r) != 0L)) r = x }; return r }
    @JvmStatic fun min(vararg v: Double): Double { var r = Double.POSITIVE_INFINITY; for (x in v) { if (java.lang.Double.isNaN(x)) return Double.NaN; if (x < r || (x == 0.0 && r == 0.0 && java.lang.Double.doubleToRawLongBits(x) != 0L)) r = x }; return r }
    @JvmStatic fun maxOf(arr: Any?): Double { val a = arr as JsArrayLike; val v = DoubleArray(a.length()); for (i in v.indices) v[i] = toNum(a.getBoxed(i)); return max(*v) }
    @JvmStatic fun minOf(arr: Any?): Double { val a = arr as JsArrayLike; val v = DoubleArray(a.length()); for (i in v.indices) v[i] = toNum(a.getBoxed(i)); return min(*v) }
    @JvmStatic fun log2(d: Double): Double {
        if (d > 0) { val bits = java.lang.Double.doubleToRawLongBits(d); if ((bits and 0x000FFFFFFFFFFFFFL) == 0L && ((bits ushr 52) and 0x7FF) != 0L) return (((bits ushr 52) and 0x7FF) - 1023).toDouble() }
        return Math.log(d) / Math.log(2.0)
    }
    @JvmStatic fun cbrt(d: Double): Double = Math.cbrt(d)
    @JvmStatic fun hypot(vararg v: Double): Double { var s = 0.0; for (x in v) s += x * x; return Math.sqrt(s) }
    @JvmStatic fun isInteger(o: Any?): Boolean { if (o !is Number || o is java.math.BigInteger) return false; val d = o.toDouble(); return !java.lang.Double.isInfinite(d) && d == Math.floor(d) }
    @JvmStatic fun isInteger(d: Double): Boolean = !java.lang.Double.isInfinite(d) && !java.lang.Double.isNaN(d) && d == Math.floor(d)
    @JvmStatic fun isSafeInteger(d: Double): Boolean = isInteger(d) && Math.abs(d) <= 9007199254740991.0
    @JvmStatic fun isFinite(o: Any?): Boolean = o is Number && o !is java.math.BigInteger && !java.lang.Double.isInfinite(o.toDouble()) && !java.lang.Double.isNaN(o.toDouble())
    @JvmStatic fun isNaN(o: Any?): Boolean = (o is Double && o.isNaN()) || (o is Float && o.isNaN())
    @JvmStatic fun random(): Double = RANDOM.nextDouble()
    @JvmField val RANDOM = java.util.Random(0x5EED)

    // ---------------------------------------------------------------- strings
    @JvmStatic fun str(o: Any?): String {
        if (o == null) return "undefined"
        if (o is String) return o
        if (o is Double || o is Float) return str((o as Number).toDouble())
        if (o is Number) return o.toString()
        if (o is Boolean) return o.toString()
        if (o is JsError) return if (o.value != null) str(o.value) else o.name + ": " + o.message
        if (o is Throwable) return "Error: " + o.message
        if (o is JsFn) return "function () { [native code] }"
        return o.toString()
    }
    @JvmStatic fun str(v: Int): String = Integer.toString(v)
    @JvmStatic fun str(v: Long): String = java.lang.Long.toString(v)
    @JvmStatic fun str(v: Boolean): String = if (v) "true" else "false"
    @JvmStatic fun str(s: String?): String = s ?: "null"
    @JvmStatic fun strOrNull(o: Any?): String = if (o == null) "null" else str(o)
    /** JavaScript Number::toString(10). */
    @JvmStatic fun str(d: Double): String {
        if (java.lang.Double.isNaN(d)) return "NaN"
        if (java.lang.Double.isInfinite(d)) return if (d > 0) "Infinity" else "-Infinity"
        if (d == 0.0) return "0"
        if (d == Math.rint(d) && Math.abs(d) < 1e21) {
            if (Math.abs(d) < 9.007199254740992E15) return java.lang.Long.toString(d.toLong())
            return java.math.BigDecimal(d).toBigInteger().toString()
        }
        val sign = if (d < 0) "-" else ""
        val bd = java.math.BigDecimal(java.lang.Double.toString(Math.abs(d))).stripTrailingZeros()
        val digits = bd.unscaledValue().toString()
        val k = digits.length
        val n = k - bd.scale()
        val sb = StringBuilder(sign)
        if (k <= n && n <= 21) { sb.append(digits); for (i in 0 until n - k) sb.append('0') }
        else if (0 < n && n <= 21) { sb.append(digits, 0, n).append('.').append(digits.substring(n)) }
        else if (-6 < n && n <= 0) { sb.append("0."); for (i in 0 until -n) sb.append('0'); sb.append(digits) }
        else {
            val e = n - 1
            sb.append(digits[0])
            if (k > 1) sb.append('.').append(digits.substring(1))
            sb.append('e').append(if (e >= 0) "+" else "-").append(Math.abs(e))
        }
        return sb.toString()
    }
    /** Number.prototype.toString(radix). */
    @JvmStatic fun toRadix(d: Double, radix: Int): String {
        var d = d
        if (radix == 10) return str(d)
        if (d == Math.rint(d) && !java.lang.Double.isInfinite(d) && Math.abs(d) < 9.007199254740992E15) return java.lang.Long.toString(d.toLong(), radix)
        if (java.lang.Double.isNaN(d)) return "NaN"
        if (java.lang.Double.isInfinite(d)) return if (d > 0) "Infinity" else "-Infinity"
        val sb = StringBuilder()
        if (d < 0) { sb.append('-'); d = -d }
        val ip = Math.floor(d); var fp = d - ip
        sb.append(java.math.BigDecimal(ip).toBigInteger().toString(radix))
        if (fp > 0) { sb.append('.'); var i = 0; while (i < 52 && fp > 0) { fp *= radix; val digit = Math.floor(fp).toInt(); sb.append(Character.forDigit(digit, radix)); fp -= digit; ++i } }
        return sb.toString()
    }
    @JvmStatic fun toRadix(v: Long, radix: Int): String = java.lang.Long.toString(v, radix)
    @JvmStatic fun toRadix(v: Int, radix: Int): String = Integer.toString(v, radix)
    @JvmStatic fun toRadix(v: java.math.BigInteger?, radix: Int): String = v!!.toString(radix)
    @JvmStatic fun toRadix(o: Any?, radix: Int): String {
        if (o is java.math.BigInteger) return o.toString(radix)
        if (o is Number) return toRadix(o.toDouble(), radix)
        return str(o)
    }
    @JvmStatic fun toFixed(d: Double, digits: Int): String {
        if (java.lang.Double.isNaN(d)) return "NaN"
        if (Math.abs(d) >= 1e21) return str(d)
        return java.math.BigDecimal(d).setScale(digits, java.math.RoundingMode.HALF_UP).toPlainString()
    }
    @JvmStatic fun propKey(k: Any?): String {
        if (k is String) return k
        if (k is Double || k is Float) return str((k as Number).toDouble())
        return str(k)
    }
    @JvmStatic fun mapKey(k: Any?): Any? {
        if (k is Int || k is Long || k is Short || k is Byte) return (k as Number).toDouble()
        if (k is Float) return k.toDouble()
        if (k is Double && k == 0.0) return 0.0
        return k
    }
    @JvmStatic fun unMapKey(k: Any?): Any? = k
    @JvmStatic fun charAt(s: String?, i: Double): String = if (i < 0 || i >= s!!.length || i != Math.floor(i)) "" else s[i.toInt()].toString()
    @JvmStatic fun charAt(s: String?, i: Long): String = if (i < 0 || i >= s!!.length) "" else s[i.toInt()].toString()
    /** charCodeAt: NaN out of range, so the result is a double. */
    @JvmStatic fun charCodeAt(s: String?, i: Double): Double = if (i < 0 || i >= s!!.length) Double.NaN else s[i.toInt()].code.toDouble()
    @JvmStatic fun charCodeAtInt(s: String?, i: Long): Int = if (i < 0 || i >= s!!.length) 0 else s[i.toInt()].code
    @JvmStatic fun codePointAt(s: String?, i: Long): Int = s!!.codePointAt(i.toInt())
    @JvmStatic fun fromCharCode(vararg codes: Double): String { val sb = StringBuilder(codes.size); for (c in codes) sb.append((toInt32(c) and 0xFFFF).toChar()); return sb.toString() }
    @JvmStatic fun fromCharCode(c: Long): String = (c and 0xFFFF).toInt().toChar().toString()
    @JvmStatic fun fromCharCodes(arr: Any?): String { val a = arr as JsArrayLike; val sb = StringBuilder(a.length()); for (i in 0 until a.length()) sb.append((toInt32(a.getBoxed(i)) and 0xFFFF).toChar()); return sb.toString() }
    @JvmStatic fun fromCodePoint(vararg codes: Double): String { val sb = StringBuilder(); for (c in codes) sb.appendCodePoint(c.toInt()); return sb.toString() }
    @JvmStatic fun substring(s: String?, start: Double): String = substring(s, start, s!!.length.toDouble())
    @JvmStatic fun substring(s: String?, start: Double, end: Double): String {
        val s = s!!
        val a = Math.max(0.0, Math.min(if (java.lang.Double.isNaN(start)) 0.0 else trunc(start), s.length.toDouble())).toInt()
        val b = Math.max(0.0, Math.min(if (java.lang.Double.isNaN(end)) 0.0 else trunc(end), s.length.toDouble())).toInt()
        return if (a <= b) s.substring(a, b) else s.substring(b, a)
    }
    @JvmStatic fun slice(s: String?, start: Double): String = slice(s, start, s!!.length.toDouble())
    @JvmStatic fun slice(s: String?, start: Double, end: Double): String { val a = relIndex(start, s!!.length); val b = relIndex(end, s.length); return if (a < b) s.substring(a, b) else "" }
    @JvmStatic fun substr(s: String?, start: Double): String = substr(s, start, Double.POSITIVE_INFINITY)
    @JvmStatic fun substr(s: String?, start: Double, length: Double): String {
        val s = s!!
        val a = relIndex(start, s.length)
        val l = if (java.lang.Double.isNaN(length)) 0.0 else trunc(length)
        val b = Math.min(s.length.toDouble(), Math.max(a.toDouble(), a + Math.min(l, s.length.toDouble()))).toInt()
        return if (l <= 0) "" else s.substring(a, b)
    }
    @JvmStatic fun indexOf(s: String?, v: String?): Int = s!!.indexOf(v!!)
    @JvmStatic fun indexOf(s: String?, v: String?, from: Double): Int = s!!.indexOf(v!!, Math.max(0.0, Math.min(from, s.length.toDouble())).toInt())
    @JvmStatic fun lastIndexOf(s: String?, v: String?): Int = s!!.lastIndexOf(v!!)
    @JvmStatic fun repeat(s: String?, n: Double): String { if (n < 0 || java.lang.Double.isInfinite(n)) throw JsError("RangeError", "Invalid count value"); return s!!.repeat(n.toInt()) }
    @JvmStatic fun padStart(s: String?, len: Double, fill: String?): String { val s = s!!; val n = len.toInt(); if (s.length >= n || fill!!.isEmpty()) return s; val sb = StringBuilder(); while (sb.length < n - s.length) sb.append(fill); return sb.substring(0, n - s.length) + s }
    @JvmStatic fun padStart(s: String?, len: Double): String = padStart(s, len, " ")
    @JvmStatic fun padEnd(s: String?, len: Double, fill: String?): String { val s = s!!; val n = len.toInt(); if (s.length >= n || fill!!.isEmpty()) return s; val sb = StringBuilder(s); while (sb.length < n) sb.append(fill); return sb.substring(0, n) }
    @JvmStatic fun padEnd(s: String?, len: Double): String = padEnd(s, len, " ")
    @JvmStatic fun trim(s: String?): String { val s = s!!; var a = 0; var b = s.length; while (a < b && isJsSpace(s[a])) a++; while (b > a && isJsSpace(s[b - 1])) b--; return s.substring(a, b) }
    @JvmStatic fun trimStart(s: String?): String { val s = s!!; var a = 0; while (a < s.length && isJsSpace(s[a])) a++; return s.substring(a) }
    @JvmStatic fun trimEnd(s: String?): String { val s = s!!; var b = s.length; while (b > 0 && isJsSpace(s[b - 1])) b--; return s.substring(0, b) }
    @JvmStatic fun isJsSpace(c: Char): Boolean = Character.isWhitespace(c) || Character.isSpaceChar(c) || c == '﻿'
    @JvmStatic fun toUpperCase(s: String?): String = s!!.uppercase(java.util.Locale.ROOT)
    @JvmStatic fun toLowerCase(s: String?): String = s!!.lowercase(java.util.Locale.ROOT)
    @JvmStatic fun replace(s: String?, search: String?, replacement: String?): String { val s = s!!; val i = indexOf(s, search); return if (i < 0) s else s.substring(0, i) + replacement + s.substring(i + search!!.length) }
    @JvmStatic fun replaceAll(s: String?, search: String?, replacement: String?): String = s!!.replace(search!!, replacement!!)
    @JvmStatic fun replace(s: String?, re: JsRegExp?, replacement: String?): String = re!!.replace(s, replacement)
    @JvmStatic fun replaceAll(s: String?, re: JsRegExp?, replacement: String?): String = re!!.replace(s, replacement)
    @JvmStatic fun replace(s: String?, re: JsRegExp?, fn: JsFn?): String = re!!.replace(s, fn)
    @JvmStatic fun replace(s: String?, search: String?, fn: JsFn?): String { val s = s!!; val i = indexOf(s, search); return if (i < 0) s else s.substring(0, i) + str(fn!!.call(search, i, s)) + s.substring(i + search!!.length) }
    @JvmStatic fun split(s: String?): JsArray<String?> = JsArray.of<String?>(s)
    @JvmStatic fun split(s: String?, sep: String?): JsArray<String?> {
        val s = s!!; val sep = sep!!
        val r = JsArray<String?>()
        if (sep.isEmpty()) { for (i in 0 until s.length) r.push(s[i].toString()); return r }
        var from = 0
        while (true) { val i = indexOf(s, sep, from.toDouble()); if (i < 0) break; r.push(s.substring(from, i)); from = i + sep.length }
        r.push(s.substring(from))
        return r
    }
    @JvmStatic fun split(s: String?, sep: String?, limit: Double): JsArray<String?> { val r = split(s, sep); if (r.length() > limit) r.setLength(limit.toInt()); return r }
    @JvmStatic fun split(s: String?, re: JsRegExp?): JsArray<String?> = re!!.split(s)
    @JvmStatic fun includes(s: String?, v: String?): Boolean = s!!.contains(v!!)
    @JvmStatic fun startsWith(s: String?, v: String?): Boolean = s!!.startsWith(v!!)
    @JvmStatic fun endsWith(s: String?, v: String?): Boolean = s!!.endsWith(v!!)
    @JvmStatic fun concat(s: String?, vararg others: Any?): String { val sb = StringBuilder(s); for (o in others) sb.append(str(o)); return sb.toString() }
    @JvmStatic fun parseInt(s: String?): Double = parseInt(s, 0.0)
    @JvmStatic fun parseInt(s: Any?, radixD: Double): Double {
        var t = trim(str(s))
        var radix = toInt32(radixD)
        var neg = false
        if (t.startsWith("-")) { neg = true; t = t.substring(1) } else if (t.startsWith("+")) t = t.substring(1)
        if (radix == 0) radix = 10
        if ((radix == 16 || toInt32(radixD) == 0) && (t.startsWith("0x") || t.startsWith("0X"))) { t = t.substring(2); radix = 16 }
        if (radix < 2 || radix > 36) return Double.NaN
        var end = 0
        while (end < t.length && Character.digit(t[end], radix) >= 0) end++
        if (end == 0) return Double.NaN
        val v = java.math.BigInteger(t.substring(0, end), radix).toDouble()
        return if (neg) -v else v
    }
    @JvmStatic fun parseFloat(s: Any?): Double {
        val t = trim(str(s))
        val m = java.util.regex.Pattern.compile("^[+-]?(Infinity|\\d+\\.?\\d*([eE][+-]?\\d+)?|\\.\\d+([eE][+-]?\\d+)?)").matcher(t)
        if (!m.find()) return Double.NaN
        val g = m.group()
        if (g.endsWith("Infinity")) return if (g.startsWith("-")) Double.NEGATIVE_INFINITY else Double.POSITIVE_INFINITY
        return java.lang.Double.parseDouble(g)
    }
    @JvmStatic fun typeOf(o: Any?): String {
        if (o == null) return "undefined"
        if (o is String) return "string"
        if (o is java.math.BigInteger) return "bigint"
        if (o is Number) return "number"
        if (o is Boolean) return "boolean"
        if (o is JsFn) return "function"
        return "object"
    }
    @JvmStatic fun isArray(o: Any?): Boolean = o is JsArrayLike && !o.isFixed()
    @JvmStatic fun isTypedAny(o: Any?): Boolean = o is JsArrayLike && o.isFixed()
    /** A name JavaScript resolves at run time; none is defined here. */
    @JvmStatic fun global(name: String?): Any? {
        when (name) { "undefined" -> return null; "NaN" -> return Double.NaN; "Infinity" -> return Double.POSITIVE_INFINITY }
        throw JsError("ReferenceError", name + " is not defined")
    }
    @JvmStatic fun callGlobal(name: String?, vararg args: Any?): Any? { val f = global(name); return toFn(f)!!.call(*args) }
    @JvmStatic fun construct(name: String?, vararg args: Any?): Any? { throw JsError("ReferenceError", name + " is not defined") }
    @JvmStatic fun constructValue(ctor: Any?, vararg args: Any?): Any? {
        if (ctor is Class<*>) {
            for (c in ctor.declaredConstructors) {
                if (c.parameterCount != args.size) continue
                val ts = c.parameterTypes; val a = arrayOfNulls<Any?>(args.size)
                for (i in args.indices) a[i] = coerce(args[i], ts[i])
                c.isAccessible = true
                try { return c.newInstance(*a) }
                catch (e: java.lang.reflect.InvocationTargetException) { throw unwrap(e) }
                catch (e: ReflectiveOperationException) { throw JsError(e.toString()) }
            }
        }
        throw JsError("TypeError", str(ctor) + " is not a constructor")
    }
    /**
     * The exports of another algorithm module (a bundled unit): its classes, as constructors, and its
     * module-level values. Loading the unit registers its algorithms, as require() does.
     */
    @JvmStatic fun module(name: String?): Any? {
        for (cn in arrayOf(name + "_depGenerated", name + "Generated")) {
            val u: Class<*>
            try { u = Class.forName(cn) } catch (e: ClassNotFoundException) { continue }
            val o = JsObject()
            for (c in u.declaredClasses) o.put(c.simpleName, c)
            try {
                for (f in u.declaredFields)
                    if (java.lang.reflect.Modifier.isStatic(f.modifiers) && f.name != "INSTANCE") { f.isAccessible = true; o.put(f.name, f.get(null)) }
            } catch (e: IllegalAccessException) { throw JsError(e.toString()) }
            return o
        }
        return null
    }
    @JvmStatic fun unsupported(what: String?): Any? { throw JsError("SyntaxError", what + " cannot run on the JVM") }
    @JvmStatic fun typeError(message: String?): Any? { throw JsError("TypeError", message) }
    @JvmStatic fun optIndex(o: Any?, key: Any?): Any? = if (o == null) null else index(o, key)
    /** A frozen framework enumeration given another value reads it as undefined. */
    @JvmStatic fun <E> enumOf(o: Any?, type: Class<E>): E? = if (type.isInstance(o)) type.cast(o) else null
    @JvmStatic fun toKeySizes(o: Any?): JsArray<KeySize?>? { if (o == null) return null; val s = o as JsArrayLike; val r = JsArray<KeySize?>(s.length()); for (i in 0 until s.length()) r.set(i, toKeySize(s.getBoxed(i))); return r }
    @JvmStatic fun toLinkItems(o: Any?): JsArray<LinkItem?>? { if (o == null) return null; val s = o as JsArrayLike; val r = JsArray<LinkItem?>(s.length()); for (i in 0 until s.length()) r.set(i, toLinkItem(s.getBoxed(i))); return r }
    @JvmStatic fun toVulnerabilitys(o: Any?): JsArray<Vulnerability?>? { if (o == null) return null; val s = o as JsArrayLike; val r = JsArray<Vulnerability?>(s.length()); for (i in 0 until s.length()) r.set(i, toVulnerability(s.getBoxed(i))); return r }
    @JvmStatic fun toTestCases(o: Any?): JsArray<TestCase?>? = toTests(o)
    /** Metadata of another shape than the framework expects (a string vulnerability, a number key size). */
    @JvmStatic fun toKeySize(o: Any?): KeySize? {
        if (o == null || o is KeySize) return o as KeySize?
        if (o is JsObject) return KeySize(toInt(o.get("minSize")), toInt(o.get("maxSize")), if (o.get("stepSize") == null) 1 else toInt(o.get("stepSize")))
        val n = toInt(o); return KeySize(n, n, 0)
    }
    @JvmStatic fun toLinkItem(o: Any?): LinkItem? {
        if (o == null || o is LinkItem) return o as LinkItem?
        if (o is JsObject) return LinkItem(if (o.get("text") == null) null else str(o.get("text")), if (o.get("uri") == null) null else str(o.get("uri")))
        return LinkItem(str(o), null)
    }
    @JvmStatic fun toVulnerability(o: Any?): Vulnerability? {
        if (o == null || o is Vulnerability) return o as Vulnerability?
        if (o is JsObject) return Vulnerability(if (o.get("type") == null) (if (o.get("name") == null) "" else str(o.get("name"))) else str(o.get("type")), if (o.get("description") == null) "" else str(o.get("description")), if (o.get("mitigation") == null) "" else str(o.get("mitigation")), if (o.get("uri") == null) "" else str(o.get("uri")))
        return Vulnerability(str(o))
    }

    // ---------------------------------------------------------------- arrays and values
    @JvmStatic fun <T> cast(o: Any?): T = o as T
    @JvmStatic fun arg(args: Array<out Any?>?, i: Int): Any? = if (i < args!!.size) args[i] else null
    @JvmStatic fun toU8(o: Any?): U8Array? = if (o == null || o is U8Array) o as U8Array? else U8Array.from(o)
    @JvmStatic fun toI8(o: Any?): I8Array? = if (o == null || o is I8Array) o as I8Array? else I8Array.from(o)
    @JvmStatic fun toU16(o: Any?): U16Array? = if (o == null || o is U16Array) o as U16Array? else U16Array.from(o)
    @JvmStatic fun toI16(o: Any?): I16Array? = if (o == null || o is I16Array) o as I16Array? else I16Array.from(o)
    @JvmStatic fun toU32(o: Any?): U32Array? = if (o == null || o is U32Array) o as U32Array? else U32Array.from(o)
    @JvmStatic fun toI32(o: Any?): I32Array? = if (o == null || o is I32Array) o as I32Array? else I32Array.from(o)
    @JvmStatic fun toI64(o: Any?): I64Array? = if (o == null || o is I64Array) o as I64Array? else I64Array.from(o)
    @JvmStatic fun toF64(o: Any?): F64Array? = if (o == null || o is F64Array) o as F64Array? else F64Array.from(o)
    @JvmStatic fun toF32(o: Any?): F32Array? = if (o == null || o is F32Array) o as F32Array? else F32Array.from(o)
    @JvmStatic fun toBools(o: Any?): BoolArray? = if (o == null || o is BoolArray) o as BoolArray? else BoolArray.from(o)
    @JvmStatic fun <T> toArr(o: Any?): JsArray<T>? = if (o == null || o is JsArray<*>) o as JsArray<T>? else JsArray.from<T>(o)
    @JvmStatic fun toObj(o: Any?): JsObject? { if (o == null || o is JsObject) return o as JsObject?; if (o is JsDynamic) return o.props(); throw JsError("TypeError", "not a plain object: " + o.javaClass.simpleName) }
    @JvmStatic fun toFn(o: Any?): JsFn? { if (o == null || o is JsFn) return o as JsFn?; throw JsError("TypeError", str(o) + " is not a function") }
    @JvmStatic fun boxBool(o: Any?): Boolean? = if (o == null) null else truthy(o)
    @JvmStatic fun boxInt(o: Any?): Int? = if (o == null) null else toInt(o)
    @JvmStatic fun boxLong(o: Any?): Long? = if (o == null) null else toLong(o)
    @JvmStatic fun boxNum(o: Any?): Double? = if (o == null) null else toNum(o)
    @JvmStatic fun length(o: Any?): Int {
        if (o is JsArrayLike) return o.length()
        if (o is String) return o.length
        if (o == null) throw JsError("TypeError", "Cannot read properties of undefined (reading 'length')")
        return toInt(getProp(o, "length"))
    }
    /** Spread of a string or array into an array of its elements. */
    @JvmStatic fun spread(o: Any?): JsArrayLike {
        if (o is JsObject && o.has("length")) return JsArray<Any?>(toInt(o.get("length"))) // Array.from({ length: n })
        return if (o is String) JsArray.from<Any?>(o) else if (o is JsSet) JsArray.from<Any?>(o) else if (o is JsMap) o.entries() else o as JsArrayLike
    }
    @JvmStatic fun toBigs(o: Any?): JsArray<java.math.BigInteger?>? {
        if (o == null) return null
        val s = o as JsArrayLike; val r = JsArray<java.math.BigInteger?>(s.length())
        for (i in 0 until s.length()) { val v = s.getBoxed(i); r.set(i, if (v == null) null else toBig(v)) }
        return r
    }
    @JvmStatic fun index(o: Any?, key: Any?): Any? {
        if (o is JsArrayLike && key is Number) { val d = key.toDouble(); return if (d == Math.floor(d)) o.getBoxed(d.toInt()) else null }
        if (o is String && key is Number) return charAt(o, key.toDouble())
        if (o is JsMap) return getProp(o, propKey(key))
        return getProp(o, propKey(key))
    }
    @JvmStatic fun setIndex(o: Any?, key: Any?, v: Any?): Any? {
        if (o is JsArrayLike && key is Number) { o.setBoxed(toInt(key), v); return v }
        return setProp(o, propKey(key), v)
    }

    // ---------------------------------------------------------------- dynamic members (reflection)
    /** Classes whose members JavaScript code can reach: the generated ones and the runtime's, never java.* or kotlin.*. */
    @JvmStatic fun reflectable(k: Class<*>?): Boolean = k != null && k != Any::class.java && !k.name.startsWith("java.") && !k.name.startsWith("kotlin.")
    /** A member by its JavaScript name, or the mangled name the code generator gave it (a keyword, finalize, ...). */
    @JvmStatic fun findField(c: Class<*>, name: String): java.lang.reflect.Field? = findFieldExact(c, name) ?: findFieldExact(c, name + "_")
    @JvmStatic fun findFieldExact(c: Class<*>, name: String): java.lang.reflect.Field? {
        var k: Class<*>? = c
        while (reflectable(k)) {
            for (f in k!!.declaredFields)
                if (f.name == name && !java.lang.reflect.Modifier.isStatic(f.modifiers)) { f.isAccessible = true; return f }
            k = k.superclass
        }
        return null
    }
    @JvmStatic fun findMethod(c: Class<*>, name: String, arity: Int): java.lang.reflect.Method? = findMethodExact(c, name, arity) ?: findMethodExact(c, name + "_", arity)
    @JvmStatic fun findMethodExact(c: Class<*>, name: String, arity: Int): java.lang.reflect.Method? {
        var best: java.lang.reflect.Method? = null
        var k: Class<*>? = c
        while (reflectable(k)) {
            for (m in k!!.declaredMethods)
                if (m.name == name && !m.isBridge && !java.lang.reflect.Modifier.isStatic(m.modifiers)) {
                    if (m.parameterCount == arity) { m.isAccessible = true; return m }
                    if (best == null || Math.abs(m.parameterCount - arity) < Math.abs(best.parameterCount - arity)) best = m
                }
            k = k.superclass
        }
        if (best != null) best.isAccessible = true
        return best
    }
    @JvmStatic fun hasMember(o: Any?, name: String?): Boolean {
        val name = name!!
        if (o == null) return false
        if (o is JsObject) return o.has(name)
        if (o is JsDynamic && o.props()!!.has(name)) return true
        if (findField(o.javaClass, name) != null) return true
        if (findMethod(o.javaClass, "get_" + name, 0) != null || findMethod(o.javaClass, "set_" + name, 1) != null) return true
        return findMethod(o.javaClass, name, -1) != null
    }
    @JvmStatic fun getProp(o: Any?, name: String?): Any? {
        val name = name!!
        if (o == null) throw JsError("TypeError", "Cannot read properties of undefined (reading '" + name + "')")
        if (o is JsObject) return o.get(name)
        if (name == "length") { if (o is JsArrayLike) return o.length(); if (o is String) return o.length }
        if (o is JsError && name == "message") return o.message
        if (o is JsError && name == "name") return o.name
        if (o is Throwable && name == "message") return o.message
        try {
            val g = findMethod(o.javaClass, "get_" + name, 0)
            if (g != null && g.parameterCount == 0) return g.invoke(o)
            val f = findField(o.javaClass, name)
            if (f != null) return f.get(o)
        } catch (e: java.lang.reflect.InvocationTargetException) { throw unwrap(e) }
        catch (e: IllegalAccessException) { throw JsError(e.toString()) }
        if (o is JsDynamic) return o.props()!!.get(name)
        val m = findMethod(o.javaClass, name, -1)
        if (m != null) return JsFn { args -> invoke(o, name, *args) }
        return null
    }
    @JvmStatic fun setProp(o: Any?, name: String?, v: Any?): Any? {
        val name = name!!
        if (o == null) throw JsError("TypeError", "Cannot set properties of undefined (setting '" + name + "')")
        if (o is JsObject) return o.put(name, v)
        if (name == "length" && o is JsArrayLike) { o.setLength(toInt(v)); return v }
        try {
            val s = findMethod(o.javaClass, "set_" + name, 1)
            if (s != null && s.parameterCount == 1) { s.invoke(o, coerce(v, s.parameterTypes[0])); return v }
            val f = findField(o.javaClass, name)
            if (f != null) { f.set(o, coerce(v, f.type)); return v }
        } catch (e: java.lang.reflect.InvocationTargetException) { throw unwrap(e) }
        catch (e: IllegalAccessException) { throw JsError(e.toString()) }
        if (o is JsDynamic) return o.props()!!.put(name, v)
        throw JsError("TypeError", "Cannot add property " + name + " to " + o.javaClass.simpleName)
    }
    @JvmStatic fun invoke(o: Any?, name: String?, vararg args: Any?): Any? {
        val name = name!!
        if (o == null) throw JsError("TypeError", "Cannot read properties of undefined (reading '" + name + "')")
        if (o is JsObject) { val f = o.get(name); if (f is JsFn) return f.call(*args); throw JsError("TypeError", name + " is not a function") }
        if (o is JsDynamic && o.props()!!.get(name) is JsFn) return (o.props()!!.get(name) as JsFn).call(*args)
        if (o is String || o is Number || o is Boolean || o is JsArrayLike) return builtin(o, name, args)
        val m = findMethod(o.javaClass, name, args.size)
        if (m == null) {
            val f = getProp(o, name)
            if (f is JsFn) return f.call(*args)
            throw JsError("TypeError", o.javaClass.simpleName + "." + name + " is not a function")
        }
        return invokeMethod(m, o, args)
    }
    @JvmStatic fun invokeMethod(m: java.lang.reflect.Method, o: Any?, args: Array<out Any?>): Any? {
        val types = m.parameterTypes
        val actual = arrayOfNulls<Any?>(types.size)
        for (i in types.indices) {
            if (m.isVarArgs && i == types.size - 1) {
                val ct = types[i].componentType
                val n = Math.max(0, args.size - i)
                val rest = java.lang.reflect.Array.newInstance(ct, n)
                for (j in 0 until n) java.lang.reflect.Array.set(rest, j, coerce(args[i + j], ct))
                actual[i] = rest
            } else actual[i] = coerce(if (i < args.size) args[i] else null, types[i])
        }
        try { return m.invoke(o, *actual) }
        catch (e: java.lang.reflect.InvocationTargetException) { throw unwrap(e) }
        catch (e: IllegalAccessException) { throw JsError(e.toString()) }
    }
    @JvmStatic fun a(args: Array<out Any?>, i: Int): Any? = if (i < args.size) args[i] else null
    @JvmStatic fun d(args: Array<out Any?>, i: Int, dflt: Double): Double = if (i < args.size && args[i] != null) toNum(args[i]) else dflt
    /** A built-in method of a string, number or array called on a value whose type was not known statically. */
    @JvmStatic fun builtin(o: Any?, name: String, args: Array<out Any?>): Any? {
        if (o is String) {
            val s: String = o
            when (name) {
                "split" -> return if (args.size == 0 || args[0] == null) split(s) else if (args[0] is JsRegExp) split(s, args[0] as JsRegExp) else if (args.size > 1) split(s, str(args[0]), toNum(args[1])) else split(s, str(args[0]))
                "replace" -> return if (args[0] is JsRegExp) (if (args[1] is JsFn) replace(s, args[0] as JsRegExp, args[1] as JsFn) else replace(s, args[0] as JsRegExp, str(args[1]))) else (if (args[1] is JsFn) replace(s, str(args[0]), args[1] as JsFn) else replace(s, str(args[0]), str(args[1])))
                "replaceAll" -> return if (args[0] is JsRegExp) replace(s, args[0] as JsRegExp, str(args[1])) else replaceAll(s, str(args[0]), str(args[1]))
                "charCodeAt" -> return charCodeAt(s, d(args, 0, 0.0))
                "codePointAt" -> return s.codePointAt(d(args, 0, 0.0).toInt())
                "charAt" -> return charAt(s, d(args, 0, 0.0))
                "substring" -> return if (args.size > 1) substring(s, d(args, 0, 0.0), d(args, 1, s.length.toDouble())) else substring(s, d(args, 0, 0.0))
                "substr" -> return if (args.size > 1) substr(s, d(args, 0, 0.0), d(args, 1, s.length.toDouble())) else substr(s, d(args, 0, 0.0))
                "slice" -> return if (args.size > 1) slice(s, d(args, 0, 0.0), d(args, 1, s.length.toDouble())) else slice(s, d(args, 0, 0.0))
                "indexOf" -> return if (args.size > 1) indexOf(s, str(args[0]), d(args, 1, 0.0)) else indexOf(s, str(args[0]))
                "lastIndexOf" -> return lastIndexOf(s, str(args[0]))
                "includes" -> return s.contains(str(args[0]))
                "startsWith" -> return s.startsWith(str(args[0]))
                "endsWith" -> return s.endsWith(str(args[0]))
                "toUpperCase" -> return toUpperCase(s)
                "toLowerCase" -> return toLowerCase(s)
                "trim" -> return trim(s)
                "trimStart" -> return trimStart(s)
                "trimEnd" -> return trimEnd(s)
                "padStart" -> return if (args.size > 1) padStart(s, d(args, 0, 0.0), str(args[1])) else padStart(s, d(args, 0, 0.0))
                "padEnd" -> return if (args.size > 1) padEnd(s, d(args, 0, 0.0), str(args[1])) else padEnd(s, d(args, 0, 0.0))
                "repeat" -> return repeat(s, d(args, 0, 0.0))
                "concat" -> return concat(s, *args)
                "match" -> return (args[0] as JsRegExp).match(s)
                "toString", "valueOf" -> return s
                "localeCompare" -> return s.compareTo(str(args[0]))
            }
        } else if (o is Number) {
            when (name) {
                "toString" -> return if (args.size == 0 || args[0] == null) str(o) else toRadix(o, toInt(args[0]))
                "toFixed" -> return toFixed(toNum(o), if (args.size == 0) 0 else toInt(args[0]))
                "valueOf" -> return o
            }
        } else if (o is Boolean) {
            if (name == "toString") return str(o)
            if (name == "valueOf") return o
        } else {
            val arr = o as JsArrayLike
            when (name) {
                "push" -> { var n = arr.length(); for (v in args) n = arr.pushBoxed(v); return n }
                "join" -> return if (args.size == 0 || args[0] == null) arr.join() else arr.join(str(args[0]))
                "toString" -> return arr.join()
                "indexOf" -> return arr.indexOfBoxed(a(args, 0))
                "includes" -> return includesDyn(arr, a(args, 0))
                "forEach" -> { arr.forEach(toFn(a(args, 0))); return null }
                "some" -> return arr.some(toFn(a(args, 0)))
                "every" -> return arr.every(toFn(a(args, 0)))
                "find" -> return arr.find(toFn(a(args, 0)))
                "findIndex" -> return arr.findIndex(toFn(a(args, 0)))
                "reduce" -> return if (args.size > 1) arr.reduce(toFn(a(args, 0)), args[1]) else arr.reduce(toFn(a(args, 0)))
                "map" -> return arr.mapToObjects(toFn(a(args, 0)))
            }
        }
        // slice, concat, filter, reverse, fill, sort, pop, shift, ... : the array class's own method
        var m: java.lang.reflect.Method? = null
        for (c in o!!.javaClass.methods)
            if (c.name == name && !java.lang.reflect.Modifier.isStatic(c.modifiers) && (c.parameterCount == args.size || (c.isVarArgs && args.size >= c.parameterCount - 1)))
                if (m == null || c.parameterTypes.size > 0 && c.parameterTypes[0] == Double::class.javaPrimitiveType) m = c
        if (m == null || o is String || o is Number || o is Boolean)
            throw JsError("TypeError", typeOf(o) + "." + name + " is not a function")
        return invokeMethod(m, o, args)
    }

    @JvmStatic fun unwrap(e: java.lang.reflect.InvocationTargetException): RuntimeException {
        val t = e.cause
        if (t is RuntimeException) return t
        if (t is Error) throw t
        return JsError(t.toString())
    }
    /** A dynamic value converted to a JVM parameter or field type. */
    @JvmStatic fun coerce(v: Any?, t: Class<*>): Any? {
        if (t == Any::class.java) return v
        if (t == Int::class.javaPrimitiveType) return toInt(v)
        if (t == Long::class.javaPrimitiveType) return toLong(v)
        if (t == Double::class.javaPrimitiveType) return toNum(v)
        if (t == Boolean::class.javaPrimitiveType) return truthy(v)
        if (v == null) return null
        if (t.isInstance(v)) return v
        if (t == Int::class.javaObjectType) return toInt(v)
        if (t == Long::class.javaObjectType) return toLong(v)
        if (t == Double::class.javaObjectType) return toNum(v)
        if (t == Boolean::class.javaObjectType) return truthy(v)
        if (t == String::class.java) return str(v)
        if (t == java.math.BigInteger::class.java) return toBig(v)
        if (t == U8Array::class.java) return toU8(v)
        if (t == I8Array::class.java) return toI8(v)
        if (t == U16Array::class.java) return toU16(v)
        if (t == I16Array::class.java) return toI16(v)
        if (t == U32Array::class.java) return toU32(v)
        if (t == I32Array::class.java) return toI32(v)
        if (t == I64Array::class.java) return toI64(v)
        if (t == F64Array::class.java) return toF64(v)
        if (t == F32Array::class.java) return toF32(v)
        if (t == BoolArray::class.java) return toBools(v)
        if (t == JsArray::class.java) return toArr<Any?>(v)
        if (t == TestCase::class.java && v is JsObject) return TestCase.fromObject(v)
        if ((v is JsObject || v is JsDynamic) && JsDynamic::class.java.isAssignableFrom(t)) return structural(v, t)
        return v
    }
    /** A value used as a local class: the object itself, else (JavaScript types by shape) a copy of its properties. */
    @JvmStatic fun <T> ´as´(v: Any?, t: Class<T>): T? {
        if (v == null || t.isInstance(v)) return v as T?
        val r = coerce(v, t)
        return (if (t.isInstance(r)) r else v) as T?
    }
    /**
     * JavaScript objects are typed by shape: a plain object, or an object of a class from another
     * unit, used where a local class is declared becomes an instance of it holding the same properties.
     */
    @JvmStatic fun structural(v: Any?, t: Class<*>): Any? {
        if (t.isInterface || java.lang.reflect.Modifier.isAbstract(t.modifiers)) return v
        val r: Any
        try {
            var c: java.lang.reflect.Constructor<*>? = null
            try { c = t.getDeclaredConstructor() } catch (e: NoSuchMethodException) { c = null }
            if (c != null) { c.isAccessible = true; r = c.newInstance() }
            else {
                // no constructor without arguments: allocate it bare (every property is copied below)
                val u = Class.forName("sun.misc.Unsafe")
                val f = u.getDeclaredField("theUnsafe")
                f.isAccessible = true
                r = u.getMethod("allocateInstance", Class::class.java).invoke(f.get(null), t)
            }
        } catch (e: java.lang.reflect.InvocationTargetException) { throw unwrap(e) }
        catch (e: ReflectiveOperationException) { return v }
        if (v is JsObject) {
            val keys = v.keys()
            for (i in 0 until keys.length()) setProp(r, keys.get(i), v.get(keys.get(i)))
            return r
        }
        try {
            var k: Class<*>? = v!!.javaClass
            while (k != null && k != Any::class.java) {
                for (f in k.declaredFields) {
                    if (java.lang.reflect.Modifier.isStatic(f.modifiers) || f.name.endsWith("__") || f.isSynthetic) continue
                    f.isAccessible = true
                    val g = findField(t, f.name)
                    if (g != null) { g.isAccessible = true; g.set(r, coerce(f.get(v), g.type)) }
                    else if (r is JsDynamic) r.props()!!.put(f.name, f.get(v))
                }
                k = k.superclass
            }
        } catch (e: IllegalAccessException) { throw JsError(e.toString()) }
        val extra = (v as JsDynamic).props()!!
        val keys = extra.keys()
        for (i in 0 until keys.length()) setProp(r, keys.get(i), extra.get(keys.get(i)))
        return r
    }
    /** new Error(message) and friends. */
    @JvmStatic fun error(name: String?, message: Any?): JsError = JsError(name, if (message == null) "" else str(message))
    @JvmStatic fun message(e: Throwable?): String? = if (e is JsError) e.message else e!!.message.toString()
    @JvmStatic fun log(vararg args: Any?) { val sb = StringBuilder(); for (a in args) { if (sb.length > 0) sb.append(' '); sb.append(str(a)) }; System.err.println(sb) }
    @JvmStatic fun now(): Long = System.currentTimeMillis()
    @JvmStatic fun nowMs(): Double = System.nanoTime() / 1e6

    // ---------------------------------------------------------------- expression helpers
    // ---- arrays converted for a parameter the callee changes: the changes are copied back after the call
    @JvmField val BACK = java.util.ArrayList<JsArrayLike>()
    @JvmStatic fun mark(): Int = BACK.size
    @JvmStatic fun <A> aliasArg(orig: Any?, conv: A): A {
        if (conv !== orig && orig is JsArrayLike && conv is JsArrayLike) { BACK.add(orig); BACK.add(conv) }
        return conv
    }
    @JvmStatic fun writeBack(m: Int) {
        var i = BACK.size - 2
        while (i >= m) {
            val o = BACK[i]; val c = BACK[i + 1]
            val n = c.length()
            if (!o.isFixed()) o.setLength(n)
            var k = 0
            while (k < n && k < o.length()) { o.setBoxed(k, c.getBoxed(k)); ++k }
            i -= 2
        }
        while (BACK.size > m) BACK.removeAt(BACK.size - 1)
    }
    @JvmStatic fun <T> back(m: Int, r: T): T { writeBack(m); return r }
    @JvmStatic fun back(m: Int, r: Int): Int { writeBack(m); return r }
    @JvmStatic fun back(m: Int, r: Long): Long { writeBack(m); return r }
    @JvmStatic fun back(m: Int, r: Double): Double { writeBack(m); return r }
    @JvmStatic fun back(m: Int, r: Boolean): Boolean { writeBack(m); return r }

    @JvmStatic fun <T> seq(a: Any?, b: T): T = b
    @JvmStatic fun <T> seq(a: Any?, b: Any?, c: T): T = c
    @JvmStatic fun <T> seq(a: Any?, b: Any?, c: Any?, d: T): T = d
    @JvmStatic fun discard(o: Any?) {}
    @JvmStatic fun <T> coalesce(a: T, b: T): T = a ?: b
    @JvmStatic fun <T> or(a: T, b: T): T = if (truthy(a)) a else b
    @JvmStatic fun <T> and(a: T, b: T): T = if (truthy(a)) b else a
    /** Integer remainder; a zero divisor gives NaN in JavaScript, 0 here. */
    @JvmStatic fun rem(a: Int, b: Int): Int = if (b == 0) 0 else a % b
    @JvmStatic fun rem(a: Long, b: Long): Long = if (b == 0L) 0L else a % b
    @JvmStatic fun atIndex(i: Double, len: Int): Int { val k = trunc(i).toInt(); return if (k < 0) len + k else k }
    @JvmStatic fun concatChunks(vararg parts: String?): String { val sb = StringBuilder(); for (p in parts) sb.append(p); return sb.toString() }

    /** A spread operand: its elements are inserted where it stands. */
    class Spread(@JvmField val src: Any?)
    @JvmStatic fun spreadOf(src: Any?): Any? = Spread(src)
    /** Fill an array with values and spreads, in order. */
    @JvmStatic fun <A : JsArrayLike?> build(target: A, vararg parts: Any?): A {
        for (p in parts) {
            if (p is Spread) { val s = spread(p.src); for (i in 0 until s.length()) target!!.pushBoxed(s.getBoxed(i)) }
            else target!!.pushBoxed(p)
        }
        return target
    }
    @JvmStatic fun spreadArgs(vararg parts: Any?): Array<Any?> {
        val out = java.util.ArrayList<Any?>()
        for (p in parts) {
            if (p is Spread) { val s = spread(p.src); for (i in 0 until s.length()) out.add(s.getBoxed(i)) }
            else out.add(p)
        }
        return out.toTypedArray()
    }
    @JvmStatic fun argsOf(arrayLike: Any?): Array<Any?> { if (arrayLike == null) return arrayOfNulls(0); val a = spread(arrayLike); val r = arrayOfNulls<Any?>(a.length()); for (i in r.indices) r[i] = a.getBoxed(i); return r }
    @JvmStatic fun restArgs(args: Array<out Any?>?, from: Int): JsArray<Any?> { val r = JsArray<Any?>(); for (i in from until args!!.size) r.push(args[i]); return r }
    @JvmStatic fun bigTyped(n: Int): JsArray<java.math.BigInteger?> = JsArray.filled<java.math.BigInteger?>(n, java.math.BigInteger.ZERO)
    @JvmStatic fun bigTypedFrom(src: Any?): JsArray<java.math.BigInteger?> { val s = spread(src); val r = JsArray<java.math.BigInteger?>(s.length()); for (i in 0 until s.length()) r.set(i, toBig(s.getBoxed(i))); return r }
    @JvmStatic fun toTests(o: Any?): JsArray<TestCase?>? {
        if (o == null) return null
        val s = o as JsArrayLike; val r = JsArray<TestCase?>(s.length())
        for (i in 0 until s.length()) r.set(i, toTest(s.getBoxed(i)))
        return r
    }
    @JvmStatic fun toTest(o: Any?): TestCase? = if (o == null || o is TestCase) o as TestCase? else TestCase.fromObject(toObj(o))
    @JvmStatic fun errorName(e: Throwable?): String = if (e is JsError) e.name else if (e is ArithmeticException || e is IndexOutOfBoundsException) "RangeError" else if (e is ClassCastException || e is NullPointerException) "TypeError" else "Error"
    @JvmStatic fun isTyped(o: Any?, name: String?): Boolean {
        if (o !is JsArrayLike || !o.isFixed()) return false
        return when (name) {
            "Uint8Array", "Uint8ClampedArray" -> o is U8Array
            "Int8Array" -> o is I8Array
            "Uint16Array" -> o is U16Array
            "Int16Array" -> o is I16Array
            "Uint32Array" -> o is U32Array
            "Int32Array" -> o is I32Array
            "Float32Array" -> o is F32Array
            "Float64Array" -> o is F64Array
            else -> false
        }
    }
    @JvmStatic fun indexOfDyn(arr: Any?, v: Any?): Int { if (arr is String) return arr.indexOf(str(v)); return (arr as JsArrayLike).indexOfBoxed(v) }
    @JvmStatic fun includesDyn(arr: Any?, v: Any?): Boolean { if (arr is String) return arr.contains(str(v)); val a = arr as JsArrayLike; for (i in 0 until a.length()) if (sameValueZero(a.getBoxed(i), v)) return true; return false }
    @JvmStatic fun indexKeys(arr: Any?): JsArray<String?> { val a = arr as JsArrayLike; val r = JsArray<String?>(a.length()); for (i in 0 until a.length()) r.set(i, Integer.toString(i)); return r }
    @JvmStatic fun indexKeysAsNumbers(arr: Any?): JsArray<Any?> { val a = arr as JsArrayLike; val r = JsArray<Any?>(a.length()); for (i in 0 until a.length()) r.set(i, i); return r }
    @JvmStatic fun invokeIndex(o: Any?, key: Any?, vararg args: Any?): Any? {
        val f = index(o, key)
        if (f is JsFn) return f.call(*args)
        return invoke(o, propKey(key), *args)
    }

    // ---------------------------------------------------------------- Object.*
    @JvmStatic fun hasOwn(o: Any?, key: Any?): Boolean {
        if (o is JsObject) return o.has(key)
        if (o is JsArrayLike) { val d = toNum(key); return d >= 0 && d < o.length() }
        if (o is JsDynamic && o.props()!!.has(key)) return true
        return o != null && findField(o.javaClass, propKey(key)) != null
    }
    @JvmStatic fun keys(o: Any?): JsArray<String?> {
        if (o is JsObject) return o.keys()
        if (o is JsArrayLike || o is String) { val n = length(o); val r = JsArray<String?>(n); for (i in 0 until n) r.set(i, Integer.toString(i)); return r }
        val r = JsArray<String?>()
        if (o == null) throw JsError("TypeError", "Cannot convert undefined or null to object")
        var k: Class<*>? = o.javaClass
        while (k != null && k != Any::class.java) {
            for (f in k.declaredFields) if (!java.lang.reflect.Modifier.isStatic(f.modifiers) && !f.isSynthetic) r.push(f.name)
            k = k.superclass
        }
        if (o is JsDynamic) r.pushAll(o.props()!!.keys())
        return r
    }
    @JvmStatic fun values(o: Any?): JsArray<Any?> {
        if (o is JsObject) return o.values()
        val k = keys(o); val r = JsArray<Any?>(k.length())
        for (i in 0 until k.length()) r.set(i, index(o, k.get(i)))
        return r
    }
    @JvmStatic fun entries(o: Any?): JsArray<Any?> {
        if (o is JsObject) return o.entries()
        val k = keys(o); val r = JsArray<Any?>(k.length())
        for (i in 0 until k.length()) r.set(i, JsArray.of<Any?>(k.get(i), index(o, k.get(i))))
        return r
    }
    @JvmStatic fun fromEntries(entries: Any?): JsObject {
        val r = JsObject(); val e = spread(entries)
        for (i in 0 until e.length()) { val kv = e.getBoxed(i) as JsArrayLike; r.put(kv.getBoxed(0), kv.getBoxed(1)) }
        return r
    }
    @JvmStatic fun assign(target: Any?, vararg sources: Any?): JsObject? {
        val t = toObj(target)
        for (s in sources) {
            if (s == null) continue
            val k = keys(s)
            for (i in 0 until k.length()) t!!.put(k.get(i), index(s, k.get(i)))
        }
        return t
    }
    @JvmStatic fun deleteProp(o: Any?, key: Any?): Boolean {
        if (o is JsObject) return o.delete(key)
        if (o is JsDynamic) return o.props()!!.delete(key)
        if (o is JsArrayLike) { o.setBoxed(toInt(key), null); return true }
        return true
    }
    @JvmStatic fun stringify(o: Any?): String {
        if (o == null) return "null"
        if (o is String) return "\"" + o.replace("\\", "\\\\").replace("\"", "\\\"") + "\""
        if (o is Number || o is Boolean) return str(o)
        if (o is JsArrayLike) { val sb = StringBuilder("["); for (i in 0 until o.length()) { if (i > 0) sb.append(','); sb.append(stringify(o.getBoxed(i))) }; return sb.append(']').toString() }
        val k = keys(o); val sb = StringBuilder("{")
        for (i in 0 until k.length()) { if (i > 0) sb.append(','); sb.append(stringify(k.get(i))).append(':').append(stringify(index(o, k.get(i)))) }
        return sb.append('}').toString()
    }

    // ---------------------------------------------------------------- bytes and text
    @JvmStatic fun hexToBytes(hex: String?): U8Array {
        if (hex == null) throw JsError("Hex8ToBytes: Input must be a string")
        for (i in 0 until hex.length) if (Character.digit(hex[i], 16) < 0) throw JsError("Hex8ToBytes: Invalid hex characters found")
        val r = U8Array(hex.length / 2)
        var i = 0
        while (i + 1 < hex.length) { r.set(i / 2, Integer.parseInt(hex.substring(i, i + 2), 16)); i += 2 }
        return r
    }
    @JvmStatic fun bytesToHex(bytes: Any?): String { val a = bytes as JsArrayLike; val sb = StringBuilder(); for (i in 0 until a.length()) { val b = toInt(a.getBoxed(i)) and 0xFF; sb.append(Character.forDigit(b shr 4, 16)).append(Character.forDigit(b and 15, 16)) }; return sb.toString() }
    /** AnsiToBytes / AsciiToBytes: each char code, masked to a byte. */
    @JvmStatic fun charsToBytes(s: String?): U8Array { val r = U8Array(s!!.length); for (i in 0 until s.length) r.set(i, s[i].code and 0xFF); return r }
    @JvmStatic fun utf8ToBytes(s: String?): U8Array { val b = s!!.toByteArray(java.nio.charset.StandardCharsets.UTF_8); val r = U8Array(b.size); for (i in b.indices) r.set(i, b[i].toInt() and 0xFF); return r }
    @JvmStatic fun bytesToUtf8(bytes: Any?): String { val a = bytes as JsArrayLike; val b = ByteArray(a.length()); for (i in b.indices) b[i] = toInt(a.getBoxed(i)).toByte(); return String(b, java.nio.charset.StandardCharsets.UTF_8) }
    @JvmStatic fun bytesToChars(bytes: Any?): String { val a = bytes as JsArrayLike; val sb = StringBuilder(a.length()); for (i in 0 until a.length()) sb.append((toInt32(a.getBoxed(i)) and 0xFFFF).toChar()); return sb.toString() }
}

/** A captured variable a nested function assigns. */
class IntRef(@JvmField var v: Int)
class LongRef(@JvmField var v: Long)
class DoubleRef(@JvmField var v: Double)
class BoolRef(@JvmField var v: Boolean)
class Ref<T>(@JvmField var v: T)

/** A DataView over the bytes of a U8Array. */
class JsDataView {
    @JvmField val buffer: U8Array
    @JvmField val offset: Int
    constructor(buffer: Any?, offset: Int) { this.buffer = buffer as U8Array; this.offset = offset }
    constructor(buffer: Any?) : this(buffer, 0)
    fun byteLength(): Int = buffer.length() - offset
    fun read(at: Int, n: Int, le: Boolean): Long { var v = 0L; for (i in 0 until n) { val b = buffer.get(offset + at + (if (le) n - 1 - i else i)); v = (v shl 8) or b.toLong() }; return v }
    fun write(at: Int, n: Int, v: Long, le: Boolean) { for (i in 0 until n) buffer.set(offset + at + (if (le) i else n - 1 - i), ((v ushr (8 * i)) and 0xFF).toInt()) }
    fun getUint8(at: Int): Int = read(at, 1, false).toInt()
    fun getInt8(at: Int): Int = read(at, 1, false).toByte().toInt()
    fun getUint16(at: Int, le: Boolean): Int = read(at, 2, le).toInt()
    fun getInt16(at: Int, le: Boolean): Int = read(at, 2, le).toShort().toInt()
    fun getUint32(at: Int, le: Boolean): Long = read(at, 4, le)
    fun getInt32(at: Int, le: Boolean): Int = read(at, 4, le).toInt()
    fun getFloat32(at: Int, le: Boolean): Double = java.lang.Float.intBitsToFloat(read(at, 4, le).toInt()).toDouble()
    fun getFloat64(at: Int, le: Boolean): Double = java.lang.Double.longBitsToDouble(read(at, 8, le))
    fun getBigUint64(at: Int, le: Boolean): java.math.BigInteger = Js.bigU64(read(at, 8, le))
    fun getBigInt64(at: Int, le: Boolean): java.math.BigInteger = java.math.BigInteger.valueOf(read(at, 8, le))
    fun setUint8(at: Int, v: Long) { write(at, 1, v, false) }
    fun setInt8(at: Int, v: Long) { write(at, 1, v, false) }
    fun setUint16(at: Int, v: Long, le: Boolean) { write(at, 2, v, le) }
    fun setInt16(at: Int, v: Long, le: Boolean) { write(at, 2, v, le) }
    fun setUint32(at: Int, v: Long, le: Boolean) { write(at, 4, v, le) }
    fun setInt32(at: Int, v: Long, le: Boolean) { write(at, 4, v, le) }
    fun setFloat32(at: Int, v: Double, le: Boolean) { write(at, 4, java.lang.Float.floatToRawIntBits(v.toFloat()).toLong(), le) }
    fun setFloat64(at: Int, v: Double, le: Boolean) { write(at, 8, java.lang.Double.doubleToRawLongBits(v), le) }
    fun setBigUint64(at: Int, v: java.math.BigInteger?, le: Boolean) { write(at, 8, v!!.toLong(), le) }
    fun setBigInt64(at: Int, v: java.math.BigInteger?, le: Boolean) { write(at, 8, v!!.toLong(), le) }
}

/** A JavaScript RegExp over java.util.regex (the common subset). */
class JsRegExp {
    @JvmField val p: java.util.regex.Pattern
    @JvmField val global: Boolean
    @JvmField val source: String?
    @JvmField val flags: String
    @JvmField var lastIndex: Int = 0
    constructor(source: String?, flags: String?) {
        this.source = source; this.flags = flags ?: ""
        var f = 0
        if (this.flags.contains("i")) f = f or java.util.regex.Pattern.CASE_INSENSITIVE
        if (this.flags.contains("m")) f = f or java.util.regex.Pattern.MULTILINE
        if (this.flags.contains("s")) f = f or java.util.regex.Pattern.DOTALL
        this.p = java.util.regex.Pattern.compile(source!!, f)
        this.global = this.flags.contains("g")
    }
    fun test(s: String?): Boolean = p.matcher(s!!).find()
    fun replace(s: String?, r: String?): String {
        val m = p.matcher(s!!)
        val jr = r!!.replace("\\", "\\\\").replace(Regex("\\$(\\d)"), "\\$$1").replace("$&", "$0")
        return if (global) m.replaceAll(jr) else m.replaceFirst(jr)
    }
    fun replace(s: String?, fn: JsFn?): String {
        val s = s!!
        val m = p.matcher(s); val sb = StringBuilder(); var last = 0
        while (m.find()) {
            val args = arrayOfNulls<Any?>(m.groupCount() + 3)
            args[0] = m.group(); for (i in 1..m.groupCount()) args[i] = m.group(i)
            args[m.groupCount() + 1] = m.start(); args[m.groupCount() + 2] = s
            sb.append(s, last, m.start()).append(Js.str(fn!!.call(*args))); last = m.end()
            if (!global) break
        }
        return sb.append(s.substring(last)).toString()
    }
    fun split(s: String?): JsArray<String?> { val r = JsArray<String?>(); for (part in p.split(s!!, -1)) r.push(part); return r }
    fun match(s: String?): JsArray<String?>? {
        val m = p.matcher(s!!)
        if (global) { val r = JsArray<String?>(); while (m.find()) r.push(m.group()); return if (r.length() == 0) null else r }
        if (!m.find()) return null
        val r = JsArray<String?>(); for (i in 0..m.groupCount()) r.push(m.group(i)); return r
    }
}
`;

  const RUNTIME_FRAMEWORK = String.raw`// ===================================================================
// AlgorithmFramework (mirrors AlgorithmFramework.js member for member)
// ===================================================================

class CategoryType private constructor(@JvmField val name: String, @JvmField val color: String, @JvmField val icon: String, @JvmField val description: String) {
    companion object {
        @JvmField val ASYMMETRIC = CategoryType("Asymmetric Ciphers", "#dc3545", "", "Public-key cryptography algorithms")
        @JvmField val BLOCK = CategoryType("Block Ciphers", "#007bff", "", "Block-based symmetric encryption")
        @JvmField val STREAM = CategoryType("Stream Ciphers", "#17a2b8", "", "Stream-based symmetric encryption")
        @JvmField val HASH = CategoryType("Hash Functions", "#ffc107", "", "Cryptographic hash algorithms")
        @JvmField val CHECKSUM = CategoryType("Checksums", "#20c997", "", "Checksum and integrity verification algorithms")
        @JvmField val COMPRESSION = CategoryType("Compression Algorithms", "#28a745", "", "Data compression algorithms")
        @JvmField val ENCODING = CategoryType("Encoding Schemes", "#6f42c1", "", "Data encoding and representation")
        @JvmField val CLASSICAL = CategoryType("Classical Ciphers", "#fd7e14", "", "Historical and educational ciphers")
        @JvmField val MAC = CategoryType("Message Authentication", "#e83e8c", "", "Message authentication codes")
        @JvmField val KDF = CategoryType("Key Derivation Functions", "#343a40", "", "Key derivation and stretching functions")
        @JvmField val ECC = CategoryType("Error Correction", "#17a2b8", "", "Error correction codes")
        @JvmField val MODE = CategoryType("Cipher Modes", "#495057", "", "Block cipher modes of operation")
        @JvmField val PADDING = CategoryType("Padding Schemes", "#6c757d", "", "Data padding algorithms")
        @JvmField val AEAD = CategoryType("Authenticated Encryption", "#dc3545", "", "Authenticated encryption with associated data")
        @JvmField val SPECIAL = CategoryType("Special Algorithms", "#6f42c1", "", "Special purpose algorithms")
        @JvmField val PQC = CategoryType("Post-Quantum Cryptography", "#e83e8c", "", "Quantum-resistant cryptographic algorithms")
        @JvmField val RANDOM = CategoryType("Random Number Generators", "#6c757d", "", "Pseudo-random number generators")
    }
    override fun toString(): String = "[object " + "Object]"
}

class SecurityStatus private constructor(@JvmField val name: String, @JvmField val color: String) {
    @JvmField val icon: String = ""
    companion object {
        @JvmField val SECURE = SecurityStatus("Secure", "#28a745")
        @JvmField val DEPRECATED = SecurityStatus("Deprecated", "#ffc107")
        @JvmField val BROKEN = SecurityStatus("Broken", "#dc3545")
        @JvmField val OBSOLETE = SecurityStatus("Obsolete", "#6c757d")
        @JvmField val EXPERIMENTAL = SecurityStatus("Experimental", "#17a2b8")
        @JvmField val EDUCATIONAL = SecurityStatus("Educational Only", "#fd7e14")
    }
    override fun toString(): String = "[object " + "Object]"
}

class ComplexityType private constructor(@JvmField val name: String, @JvmField val color: String, @JvmField val level: Int) {
    companion object {
        @JvmField val BEGINNER = ComplexityType("Beginner", "#28a745", 1)
        @JvmField val INTERMEDIATE = ComplexityType("Intermediate", "#ffc107", 2)
        @JvmField val ADVANCED = ComplexityType("Advanced", "#fd7e14", 3)
        @JvmField val EXPERT = ComplexityType("Expert", "#dc3545", 4)
        @JvmField val RESEARCH = ComplexityType("Research", "#6f42c1", 5)
    }
    override fun toString(): String = "[object " + "Object]"
}

class CountryCode private constructor(@JvmField val name: String) {
    @JvmField val icon: String = ""
    companion object {
        @JvmField val US = CountryCode("United States")
        @JvmField val RU = CountryCode("Russia")
        @JvmField val CN = CountryCode("China")
        @JvmField val UA = CountryCode("Ukraine")
        @JvmField val DE = CountryCode("Germany")
        @JvmField val GB = CountryCode("United Kingdom")
        @JvmField val FR = CountryCode("France")
        @JvmField val JP = CountryCode("Japan")
        @JvmField val KR = CountryCode("South Korea")
        @JvmField val IL = CountryCode("Israel")
        @JvmField val BE = CountryCode("Belgium")
        @JvmField val CA = CountryCode("Canada")
        @JvmField val AU = CountryCode("Australia")
        @JvmField val IT = CountryCode("Italy")
        @JvmField val NL = CountryCode("Netherlands")
        @JvmField val CH = CountryCode("Switzerland")
        @JvmField val SE = CountryCode("Sweden")
        @JvmField val NO = CountryCode("Norway")
        @JvmField val IN = CountryCode("India")
        @JvmField val BR = CountryCode("Brazil")
        @JvmField val INTL = CountryCode("International")
        @JvmField val ANCIENT = CountryCode("Ancient")
        @JvmField val UNKNOWN = CountryCode("Unknown")
    }
    override fun toString(): String = "[object " + "Object]"
}

open class LinkItem {
    @JvmField var text: String? = null
    @JvmField var uri: String? = null
    constructor(text: String?, uri: String?) { this.text = text; this.uri = uri }
    constructor(text: String?) : this(text, null)
}

/** A test vector: its framework fields, and every other field of the source object. */
open class TestCase : LinkItem, JsDynamic {
    @JvmField var input: U8Array? = null
    @JvmField var expected: U8Array? = null
    @JvmField val extra = JsObject()
    override fun props(): JsObject? = extra
    constructor(input: U8Array?, expected: U8Array?, description: String?, uri: String?) : super(description, uri) { this.input = input; this.expected = expected }
    constructor(input: U8Array?, expected: U8Array?, description: String?) : this(input, expected, description, "")
    constructor(input: U8Array?, expected: U8Array?) : this(input, expected, "", "")
    companion object {
        /** _processTestVector: a plain vector object becomes a TestCase keeping its other fields. */
        @JvmStatic fun fromObject(o: JsObject?): TestCase? {
            if (o == null) return null
            val text = o.get("text"); val uri = o.get("uri")
            val t = TestCase(Js.toU8(o.get("input")), if (o.has("expected") && o.get("expected") != null) Js.toU8(o.get("expected")) else U8Array(), if (text == null) "" else Js.str(text), if (uri == null) "" else Js.str(uri))
            val keys = o.keys()
            for (i in 0 until keys.length()) { val k = keys.get(i); if (k != "input" && k != "expected" && k != "text" && k != "uri") t.extra.put(k, o.get(k)) }
            return t
        }
    }
    /** A vector field by its JavaScript name, or null when the vector has none. */
    fun field(name: String): Any? {
        when (name) { "input" -> return input; "expected" -> return expected; "text" -> return text; "uri" -> return uri }
        if (extra.has(name)) return extra.get(name)
        // a subclass declares its own vector fields
        return if (javaClass != TestCase::class.java && Js.hasMember(this, name)) Js.getProp(this, name) else null
    }
    fun hasField(name: String): Boolean =
        name == "input" || name == "expected" || name == "text" || name == "uri" || extra.has(name) ||
            (javaClass != TestCase::class.java && Js.hasMember(this, name))
}

open class Vulnerability : LinkItem {
    @JvmField var description: String? = null
    @JvmField var mitigation: String? = null
    constructor(type: String?, description: String?, mitigation: String?, uri: String?) : super(type, uri) { this.description = description; this.mitigation = mitigation }
    constructor(type: String?, description: String?, mitigation: String?) : this(type, description, mitigation, "")
    constructor(type: String?, description: String?) : this(type, description, "", "")
    constructor(type: String?) : this(type, "", "", "")
}

open class AuthResult {
    @JvmField var Success: Boolean = false
    @JvmField var Output: U8Array? = null
    @JvmField var FailureReason: String? = null
    constructor(success: Boolean, output: U8Array?, failureReason: String?) { Success = success; Output = output; FailureReason = failureReason }
    constructor(success: Boolean, output: U8Array?) : this(success, output, null)
    constructor(success: Boolean) : this(success, null, null)
}

open class KeySize {
    @JvmField var minSize: Int = 0
    @JvmField var maxSize: Int = 0
    @JvmField var stepSize: Int = 0
    constructor(minSize: Int, maxSize: Int, stepSize: Int) { this.minSize = minSize; this.maxSize = maxSize; this.stepSize = stepSize }
    constructor(minSize: Int, maxSize: Int) : this(minSize, maxSize, 1)
}

open class BlockAbsorber {
    @JvmField var _blockSize: Int = 0
    @JvmField var _processBlock: JsFn? = null
    @JvmField var _held: U8Array? = null
    @JvmField var _pending: Int = 0
    @JvmField var _length: Long = 0L
    constructor(blockSize: Int, processBlock: JsFn?) {
        if (!(blockSize > 0)) throw JsError("BlockAbsorber: blockSize must be positive")
        if (processBlock == null) throw JsError("BlockAbsorber: processBlock must be a function")
        _blockSize = blockSize; _processBlock = processBlock; _held = U8Array(blockSize); _pending = 0; _length = 0L
    }
    open fun get_BlockSize(): Int = _blockSize
    open fun get_Pending(): Int = _pending
    open fun get_Length(): Long = _length
    open fun Absorb(data: U8Array?) {
        if (data == null || data.length() == 0) return
        val blockSize = _blockSize; val total = data.length(); var offset = 0
        while (offset < total) {
            if (_pending == blockSize) { _processBlock!!.call(_held); _pending = 0 }
            val take = Math.min(blockSize - _pending, total - offset)
            for (i in 0 until take) _held!!.set(_pending + i, AlgorithmFramework._byte(data.get(offset + i).toDouble()))
            _pending += take; offset += take; _length += take
        }
    }
    open fun Finish(finalize: JsFn?): Any? {
        if (finalize == null) throw JsError("BlockAbsorber: finalize must be a function")
        return finalize.call(_held!!.slice(0.0, _pending.toDouble()), _pending, _length)
    }
    open fun Reset() { _held!!.fill(0); _pending = 0; _length = 0L }
}

abstract class IAlgorithmInstance {
    @JvmField var algorithm: Algorithm? = null
    @JvmField var isInverse: Boolean = false
    @JvmField var inputBuffer: U8Array? = null
    constructor(algorithm: Algorithm?) { this.algorithm = algorithm; this.isInverse = false; this.inputBuffer = U8Array() }
    constructor() : this(null)
    open fun Feed(data: U8Array?) {
        if (data == null || data.length() == 0) return
        if (inputBuffer == null) inputBuffer = U8Array()
        for (i in 0 until data.length()) inputBuffer!!.push(data.get(i))
    }
    open fun Result(): U8Array? { throw JsError.thrown("Result() not implemented") }
    open fun Dispose() { if (inputBuffer != null) inputBuffer!!.setLength(0) }
}

abstract class Algorithm {
    @JvmField var name: String? = null
    @JvmField var description: String? = null
    @JvmField var inventor: String? = null
    @JvmField var year: Int = 0
    @JvmField var category: CategoryType? = null
    @JvmField var subCategory: String? = null
    @JvmField var securityStatus: SecurityStatus? = null
    @JvmField var complexity: ComplexityType? = null
    @JvmField var country: CountryCode? = null
    @JvmField var documentation: JsArray<LinkItem?>? = JsArray()
    @JvmField var references: JsArray<LinkItem?>? = JsArray()
    @JvmField var knownVulnerabilities: JsArray<Vulnerability?>? = JsArray()
    @JvmField var tests: JsArray<TestCase?>? = JsArray()
    constructor()
    open fun CreateInstance(isInverse: Boolean): IAlgorithmInstance? { throw JsError.thrown("CreateInstance() not implemented") }
    open fun CreateInstance(): IAlgorithmInstance? = CreateInstance(false)
}

abstract class CryptoAlgorithm : Algorithm()
abstract class SymmetricCipherAlgorithm : CryptoAlgorithm()
abstract class AsymmetricCipherAlgorithm : CryptoAlgorithm()
abstract class BlockCipherAlgorithm : SymmetricCipherAlgorithm() {
    @JvmField var SupportedKeySizes: JsArray<KeySize?>? = JsArray()
    @JvmField var SupportedBlockSizes: JsArray<KeySize?>? = JsArray()
}
abstract class StreamCipherAlgorithm : SymmetricCipherAlgorithm()
abstract class EncodingAlgorithm : Algorithm()
abstract class CompressionAlgorithm : Algorithm()
abstract class ErrorCorrectionAlgorithm : Algorithm()
abstract class HashFunctionAlgorithm : Algorithm() { @JvmField var SupportedOutputSizes: JsArray<KeySize?>? = JsArray() }
abstract class MacAlgorithm : Algorithm() { @JvmField var SupportedMacSizes: JsArray<KeySize?>? = JsArray(); @JvmField var NeedsKey: Boolean = true }
abstract class KdfAlgorithm : Algorithm() { @JvmField var SupportedOutputSizes: JsArray<KeySize?>? = JsArray(); @JvmField var SaltRequired: Boolean = true }
abstract class PaddingAlgorithm : Algorithm() { @JvmField var IsLengthIncluded: Boolean = false }
abstract class CipherModeAlgorithm : Algorithm() { @JvmField var RequiresIV: Boolean = true; @JvmField var SupportedIVSizes: JsArray<KeySize?>? = JsArray() }
abstract class AeadAlgorithm : CryptoAlgorithm() { @JvmField var SupportedTagSizes: JsArray<KeySize?>? = JsArray(); @JvmField var SupportsDetached: Boolean = false }
abstract class RandomGenerationAlgorithm : Algorithm() { @JvmField var IsDeterministic: Boolean = false; @JvmField var IsCryptographicallySecure: Boolean = true; @JvmField var SupportedSeedSizes: JsArray<KeySize?>? = JsArray() }

abstract class IBlockCipherInstance : IAlgorithmInstance {
    @JvmField var BlockSize: Int = 0
    @JvmField var KeySize: Int = 0
    @JvmField var _key: U8Array? = null
    constructor(algorithm: Algorithm?) : super(algorithm) { BlockSize = 0; KeySize = 0; _key = null }
    constructor() : this(null)
    open fun set_key(keyBytes: U8Array?) { _key = keyBytes }
    open fun get_key(): U8Array? = _key
    open fun EncryptBlock(block: U8Array?): U8Array? { throw JsError.thrown("EncryptBlock() not implemented") }
    open fun DecryptBlock(block: U8Array?): U8Array? { throw JsError.thrown("DecryptBlock() not implemented") }
    open fun RequireBlockMultiple(blockSize: Int): Int {
        val size = if (blockSize != 0) blockSize else BlockSize
        if (!(size > 0)) throw JsError("BlockSize not set")
        val length = if (inputBuffer != null) inputBuffer!!.length() else 0
        if (length % size != 0) throw JsError("Input length must be multiple of " + size + " bytes")
        return length / size
    }
    open fun RequireBlockMultiple(): Int = RequireBlockMultiple(0)
    override fun Result(): U8Array? {
        if (get_key() == null) throw JsError("Key not set")
        if (inputBuffer == null || inputBuffer!!.length() == 0) throw JsError("No data fed")
        val blockSize = BlockSize
        RequireBlockMultiple(blockSize)
        val output = U8Array()
        var offset = 0
        while (offset < inputBuffer!!.length()) {
            val block = inputBuffer!!.slice(offset.toDouble(), (offset + blockSize).toDouble())
            val processed = if (isInverse) DecryptBlock(block) else EncryptBlock(block)
            for (i in 0 until processed!!.length()) output.push(processed.get(i))
            offset += blockSize
        }
        inputBuffer = U8Array()
        return output
    }
}
abstract class IHashFunctionInstance : IAlgorithmInstance { @JvmField var OutputSize: Int = 0; constructor(a: Algorithm?) : super(a) { OutputSize = 0 }; constructor() : this(null) }
abstract class IMacInstance : IAlgorithmInstance { constructor(a: Algorithm?) : super(a); constructor() : this(null); open fun ComputeMac(data: U8Array?): U8Array? { throw JsError.thrown("ComputeMac() not implemented") } }
abstract class IKdfInstance : IAlgorithmInstance { @JvmField var OutputSize: Int = 0; @JvmField var Iterations: Int = 0; constructor(a: Algorithm?) : super(a) { OutputSize = 0; Iterations = 0 }; constructor() : this(null) }
abstract class IAeadInstance : IAlgorithmInstance { @JvmField var aad: U8Array? = null; @JvmField var tagSize: Int = 0; constructor(a: Algorithm?) : super(a) { aad = U8Array(); tagSize = 0 }; constructor() : this(null) }
abstract class IErrorCorrectionInstance : IAlgorithmInstance { constructor(a: Algorithm?) : super(a); constructor() : this(null); open fun DetectError(data: U8Array?): Boolean { throw JsError.thrown("DetectError() not implemented") } }
abstract class IRandomGeneratorInstance : IAlgorithmInstance { constructor(a: Algorithm?) : super(a); constructor() : this(null); open fun NextBytes(count: Int): U8Array? { throw JsError.thrown("NextBytes() not implemented") } }

/** The registry and the shared construction primitives. */
object AlgorithmFramework {
    @JvmField val Algorithms = JsArray<Algorithm?>()
    @JvmStatic fun RegisterAlgorithm(algorithm: Algorithm?) {
        if (algorithm == null) throw JsError("RegisterAlgorithm: Invalid algorithm object")
        if (algorithm.name == null || algorithm.name!!.isEmpty()) throw JsError("RegisterAlgorithm: Algorithm must have a valid name")
        for (i in 0 until Algorithms.length()) if (Algorithms.get(i)!!.name == algorithm.name) throw JsError("RegisterAlgorithm: Algorithm '" + algorithm.name + "' already registered")
        val tests = algorithm.tests
        if (tests != null)
            for (i in 0 until tests.length())
                if (tests.get(i) == null || (tests.get(i)!!.input == null && !tests.get(i)!!.hasField("input")))
                    throw JsError("RegisterAlgorithm: Invalid test vector #" + (i + 1) + " in algorithm '" + algorithm.name + "' - must have at least 'input' field")
        Algorithms.push(algorithm)
    }
    @JvmStatic fun Find(name: String?): Algorithm? { for (i in 0 until Algorithms.length()) if (Algorithms.get(i)!!.name == name) return Algorithms.get(i); return null }
    @JvmStatic fun Clear() { Algorithms.setLength(0) }
    @JvmStatic fun _byte(value: Double): Int { val reduced = Js.trunc(value) % 256; return (if (reduced < 0) reduced + 256 else reduced).toInt() }
    @JvmStatic fun _mergeBits(a: Int, b: Int): Int = (_byte(a.toDouble()) or _byte(b.toDouble())) and 0xFF
    @JvmStatic fun _encodeLength(value: Double, byteCount: Int, littleEndian: Boolean): U8Array {
        val encoded = U8Array(byteCount)
        var remaining = Math.max(0.0, Js.trunc(value))
        for (i in 0 until byteCount) { encoded.set(if (littleEndian) i else byteCount - 1 - i, (remaining % 256).toInt()); remaining = Math.floor(remaining / 256) }
        return encoded
    }
    @JvmStatic fun SpongePadBlocks(held: U8Array?, pending: Int, rate: Int, separator: Int): JsArray<U8Array?> {
        if (!(rate > 0)) throw JsError("SpongePadBlocks: rate must be positive")
        if (pending < 0 || pending > rate) throw JsError("SpongePadBlocks: pending " + pending + " outside 0.." + rate)
        val blocks = JsArray<U8Array?>()
        var block = U8Array(rate)
        for (i in 0 until pending) block.set(i, _byte(held!!.get(i).toDouble()))
        var used = pending
        if (used == rate) { blocks.push(block); block = U8Array(rate); used = 0 }
        block.set(used, _byte(separator.toDouble()))
        block.set(rate - 1, _mergeBits(block.get(rate - 1), 0x80))
        blocks.push(block)
        return blocks
    }
    @JvmStatic fun MerkleDamgardBlocks(held: U8Array?, pending: Int, totalLength: Double, options: JsObject?): JsArray<U8Array?> {
        val settings = options ?: JsObject()
        val blockSize = Js.toInt(settings.get("blockSize"))
        if (!(blockSize > 0)) throw JsError("MerkleDamgardBlocks: blockSize must be positive")
        if (pending < 0 || pending > blockSize) throw JsError("MerkleDamgardBlocks: pending " + pending + " outside 0.." + blockSize)
        val padByte = if (settings.get("padByte") == null) 0x80 else Js.toInt(settings.get("padByte"))
        val lengthBytes = if (settings.get("lengthBytes") == null) 8 else Js.toInt(settings.get("lengthBytes"))
        val littleEndian = true == settings.get("lengthLittleEndian")
        val inBits = false != settings.get("lengthInBits")
        if (lengthBytes < 0 || lengthBytes >= blockSize) throw JsError("MerkleDamgardBlocks: lengthBytes " + lengthBytes + " does not fit a " + blockSize + "-byte block")
        val blocks = JsArray<U8Array?>()
        var block = U8Array(blockSize)
        for (i in 0 until pending) block.set(i, _byte(held!!.get(i).toDouble()))
        var used = pending
        if (used == blockSize) { blocks.push(block); block = U8Array(blockSize); used = 0 }
        block.set(used, _byte(padByte.toDouble()))
        used++
        if (used > blockSize - lengthBytes) { blocks.push(block); block = U8Array(blockSize) }
        if (lengthBytes > 0) {
            val encoded = _encodeLength(if (inBits) totalLength * 8 else totalLength, lengthBytes, littleEndian)
            for (i in 0 until lengthBytes) block.set(blockSize - lengthBytes + i, encoded.get(i))
        }
        blocks.push(block)
        return blocks
    }
}
`;

  const RUNTIME_OPCODES = String.raw`// ===================================================================
// OpCodes (the helpers the IL does not inline; mirrors OpCodes.js)
// ===================================================================
@Suppress("UNCHECKED_CAST")
object OpCodes {
    /** OpCodes.UInt64: 64-bit values as [high32, low32] word pairs. */
    object UInt64 {
        @JvmStatic fun bits(a: Any?): Long { val s = a as JsArrayLike; return (Js.toUint32(s.getBoxed(0)) shl 32) or Js.toUint32(s.getBoxed(1)) }
        @JvmStatic fun pair(v: Long): U32Array = U32Array.of(v ushr 32, v and 0xFFFFFFFFL)
        @JvmStatic fun create(high: Double, low: Double): U32Array = U32Array.of(Js.toUint32(high), Js.toUint32(low))
        @JvmStatic fun fromBytes(bytes: Any?): U32Array {
            val s = bytes as JsArrayLike; val n = s.length(); var v = 0L
            for (i in 0 until 8) { val k = i - (8 - Math.min(n, 8)); v = (v shl 8) or (if (k < 0) 0L else (Js.toInt32(s.getBoxed(if (n < 8) k else i)) and 0xFF).toLong()) }
            return pair(v)
        }
        @JvmStatic fun toBytes(a: Any?): U8Array = Unpack64BE(java.math.BigInteger.valueOf(bits(a)).and(MASK64))
        @JvmStatic fun add(a: Any?, b: Any?): U32Array = pair(bits(a) + bits(b))
        @JvmStatic fun sub(a: Any?, b: Any?): U32Array = pair(bits(a) - bits(b))
        @JvmStatic fun shr(a: Any?, n: Double): Any? { val c = n.toInt(); return if (c == 0) a else pair(bits(a) ushr (c and 63)) }
        @JvmStatic fun shl(a: Any?, n: Double): Any? { val c = n.toInt(); return if (c == 0) a else pair(bits(a) shl (c and 63)) }
        @JvmStatic fun rotr(a: Any?, n: Double): Any? { val c = n.toInt(); return if (c == 0) a else pair(java.lang.Long.rotateRight(bits(a), c % 64)) }
        @JvmStatic fun rotl(a: Any?, n: Double): Any? { val c = n.toInt(); return if (c == 0) a else pair(java.lang.Long.rotateLeft(bits(a), c % 64)) }
        @JvmStatic fun xor(a: Any?, b: Any?): U32Array = pair(bits(a) xor bits(b))
        @JvmStatic fun and(a: Any?, b: Any?): U32Array = pair(bits(a) and bits(b))
        @JvmStatic fun or(a: Any?, b: Any?): U32Array = pair(bits(a) or bits(b))
        @JvmStatic fun not(a: Any?): U32Array = pair(bits(a).inv())
        @JvmStatic fun toNumber(a: Any?): Double { val s = a as JsArrayLike; return Js.toUint32(s.getBoxed(0)) * 4294967296.0 + Js.toUint32(s.getBoxed(1)) }
        @JvmStatic fun equals(a: Any?, b: Any?): Boolean = bits(a) == bits(b)
        @JvmStatic fun clone(a: Any?): U32Array = pair(bits(a))
    }
    @JvmField val MASK64: java.math.BigInteger = Js.MASK64
    @JvmField val MASK128: java.math.BigInteger = java.math.BigInteger.ONE.shiftLeft(128).subtract(java.math.BigInteger.ONE)

    // ---- pack / unpack / rotate (IL nodes PackBytes, UnpackBytes, RotateLeft/Right)
    @JvmStatic fun Pack16BE(b0: Int, b1: Int): Int = ((b0 and 0xFF) shl 8) or (b1 and 0xFF)
    @JvmStatic fun Pack16LE(b0: Int, b1: Int): Int = ((b1 and 0xFF) shl 8) or (b0 and 0xFF)
    @JvmStatic fun Pack32BE(b0: Int, b1: Int, b2: Int, b3: Int): Long = (((b0 and 0xFF) shl 24) or ((b1 and 0xFF) shl 16) or ((b2 and 0xFF) shl 8) or (b3 and 0xFF)).toLong() and 0xFFFFFFFFL
    @JvmStatic fun Pack32LE(b0: Int, b1: Int, b2: Int, b3: Int): Long = Pack32BE(b3, b2, b1, b0)
    @JvmStatic fun Pack64BE(b0: Int, b1: Int, b2: Int, b3: Int, b4: Int, b5: Int, b6: Int, b7: Int): java.math.BigInteger = java.math.BigInteger.valueOf(Pack32BE(b0, b1, b2, b3)).shiftLeft(32).or(java.math.BigInteger.valueOf(Pack32BE(b4, b5, b6, b7)))
    @JvmStatic fun Pack64LE(b0: Int, b1: Int, b2: Int, b3: Int, b4: Int, b5: Int, b6: Int, b7: Int): java.math.BigInteger = Pack64BE(b7, b6, b5, b4, b3, b2, b1, b0)
    @JvmStatic fun bytesOf(a: Any?, n: Int): IntArray { val s = a as JsArrayLike; val b = IntArray(n); for (i in 0 until n) b[i] = Js.toInt32(s.getBoxed(i)); return b }
    @JvmStatic fun Pack16BEOf(a: Any?): Int { val b = bytesOf(a, 2); return Pack16BE(b[0], b[1]) }
    @JvmStatic fun Pack16LEOf(a: Any?): Int { val b = bytesOf(a, 2); return Pack16LE(b[0], b[1]) }
    @JvmStatic fun Pack32BEOf(a: Any?): Long { val b = bytesOf(a, 4); return Pack32BE(b[0], b[1], b[2], b[3]) }
    @JvmStatic fun Pack32LEOf(a: Any?): Long { val b = bytesOf(a, 4); return Pack32LE(b[0], b[1], b[2], b[3]) }
    @JvmStatic fun Pack64BEOf(a: Any?): java.math.BigInteger { val b = bytesOf(a, 8); return Pack64BE(b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7]) }
    @JvmStatic fun Pack64LEOf(a: Any?): java.math.BigInteger { val b = bytesOf(a, 8); return Pack64LE(b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7]) }
    @JvmStatic fun Unpack16BE(w: Long): U8Array = U8Array.of(((w ushr 8) and 0xFF).toInt(), (w and 0xFF).toInt())
    @JvmStatic fun Unpack16LE(w: Long): U8Array = U8Array.of((w and 0xFF).toInt(), ((w ushr 8) and 0xFF).toInt())
    @JvmStatic fun Unpack32BE(w: Long): U8Array = U8Array.of(((w ushr 24) and 0xFF).toInt(), ((w ushr 16) and 0xFF).toInt(), ((w ushr 8) and 0xFF).toInt(), (w and 0xFF).toInt())
    @JvmStatic fun Unpack32LE(w: Long): U8Array = U8Array.of((w and 0xFF).toInt(), ((w ushr 8) and 0xFF).toInt(), ((w ushr 16) and 0xFF).toInt(), ((w ushr 24) and 0xFF).toInt())
    @JvmStatic fun u64bits(q: Any?): Long = if (q is java.math.BigInteger) q.toLong() else if (q is Long || q is Int) (q as Number).toLong() else Js.big(Js.toNum(q)).toLong()
    @JvmStatic fun Unpack64BE(q: Any?): U8Array { val v = u64bits(q); val r = U8Array(8); for (i in 0 until 8) r.set(i, ((v ushr (56 - 8 * i)) and 0xFF).toInt()); return r }
    @JvmStatic fun Unpack64LE(q: Any?): U8Array = Unpack64BE(q).reverse()
    @JvmStatic fun RotL8(v: Long, n: Long): Int { val x = v.toInt() and 0xFF; val p = n.toInt() and 7; return ((x shl p) or (x ushr (8 - p))) and 0xFF }
    @JvmStatic fun RotR8(v: Long, n: Long): Int { val x = v.toInt() and 0xFF; val p = n.toInt() and 7; return ((x ushr p) or (x shl (8 - p))) and 0xFF }
    @JvmStatic fun RotL16(v: Long, n: Long): Int { val x = v.toInt() and 0xFFFF; val p = n.toInt() and 15; return ((x shl p) or (x ushr (16 - p))) and 0xFFFF }
    @JvmStatic fun RotR16(v: Long, n: Long): Int { val x = v.toInt() and 0xFFFF; val p = n.toInt() and 15; return ((x ushr p) or (x shl (16 - p))) and 0xFFFF }
    @JvmStatic fun RotL32(v: Long, n: Long): Long = Integer.rotateLeft(v.toInt(), n.toInt() and 31).toLong() and 0xFFFFFFFFL
    @JvmStatic fun RotR32(v: Long, n: Long): Long = Integer.rotateRight(v.toInt(), n.toInt() and 31).toLong() and 0xFFFFFFFFL
    @JvmStatic fun RotL64n(v: java.math.BigInteger?, n: Long): java.math.BigInteger {
        val v = v!!.and(MASK64); val p = n.toInt() and 63; if (p == 0) return v
        return v.shiftLeft(p).or(v.shiftRight(64 - p)).and(MASK64)
    }
    @JvmStatic fun RotR64n(v: java.math.BigInteger?, n: Long): java.math.BigInteger {
        val v = v!!.and(MASK64); val p = n.toInt() and 63; if (p == 0) return v
        return v.shiftRight(p).or(v.shiftLeft(64 - p)).and(MASK64)
    }
    @JvmStatic fun RotL128n(v: java.math.BigInteger?, n: Long): java.math.BigInteger {
        val v = v!!.and(MASK128); val p = n.toInt() and 127; if (p == 0) return v
        return v.shiftLeft(p).or(v.shiftRight(128 - p)).and(MASK128)
    }
    @JvmStatic fun RotR128n(v: java.math.BigInteger?, n: Long): java.math.BigInteger {
        val v = v!!.and(MASK128); val p = n.toInt() and 127; if (p == 0) return v
        return v.shiftRight(p).or(v.shiftLeft(128 - p)).and(MASK128)
    }
    @JvmStatic fun ShiftLn(v: java.math.BigInteger?, n: Long): java.math.BigInteger = v!!.shiftLeft(n.toInt())
    @JvmStatic fun ShiftRn(v: java.math.BigInteger?, n: Long): java.math.BigInteger = v!!.shiftRight(n.toInt())

    // ---- hex and text
    @JvmStatic fun Hex8ToBytes(hex: String?): U8Array = Js.hexToBytes(hex)
    @JvmStatic fun BytesToHex(bytes: Any?): String = Js.bytesToHex(bytes)
    @JvmStatic fun Hex32ToDWords(hex: String?): U32Array {
        val r = U32Array()
        var i = 0
        while (i < hex!!.length) { r.push(Js.toUint32(Js.parseInt(hex.substring(i, Math.min(hex.length, i + 8)), 16.0))); i += 8 }
        return r
    }
    @JvmStatic fun BytesToChars(bytes: Any?): String = Js.bytesToChars(bytes)

    // ---- arrays
    @JvmStatic fun CopyArray(a: U8Array?): U8Array = a!!.slice()
    @JvmStatic fun CopyArray(a: I8Array?): I8Array = a!!.slice()
    @JvmStatic fun CopyArray(a: U16Array?): U16Array = a!!.slice()
    @JvmStatic fun CopyArray(a: I16Array?): I16Array = a!!.slice()
    @JvmStatic fun CopyArray(a: U32Array?): U32Array = a!!.slice()
    @JvmStatic fun CopyArray(a: I32Array?): I32Array = a!!.slice()
    @JvmStatic fun CopyArray(a: I64Array?): I64Array = a!!.slice()
    @JvmStatic fun CopyArray(a: F64Array?): F64Array = a!!.slice()
    @JvmStatic fun CopyArray(a: F32Array?): F32Array = a!!.slice()
    @JvmStatic fun CopyArray(a: BoolArray?): BoolArray = a!!.slice()
    @JvmStatic fun <T> CopyArray(a: JsArray<T>?): JsArray<T> = a!!.slice()
    @JvmStatic fun CopyArray(a: Any?): Any? { val s = a as JsArrayLike; val r = JsArray<Any?>(s.length()); for (i in 0 until s.length()) r.set(i, s.getBoxed(i)); return if (a is JsArray<*>) r else U8Array.from(a) }
    @JvmStatic fun ClearArray(arr: Any?) { val a = arr as JsArrayLike; for (i in 0 until a.length()) a.setBoxed(i, 0) }
    @JvmStatic fun XorArrays(x: Any?, y: Any?): U8Array {
        val a = x as JsArrayLike; val b = y as JsArrayLike
        val n = Math.min(a.length(), b.length()); val r = U8Array(n)
        for (i in 0 until n) r.set(i, (Js.toInt32(a.getBoxed(i)) xor Js.toInt32(b.getBoxed(i))) and 0xFF)
        return r
    }
    @JvmStatic fun ConcatArrays(arrays: Any?): U8Array {
        val all = arrays as JsArrayLike; val r = U8Array()
        for (i in 0 until all.length()) r.pushAll(all.getBoxed(i))
        return r
    }
    /** A plain array of length copies of value (any number: callers fill word tables with it too). */
    @JvmStatic fun CreateArray(length: Double, value: Double): F64Array { val r = F64Array(length.toInt()); r.fill(value); return r }
    @JvmStatic fun CreateArray(length: Double): F64Array { val r = F64Array(length.toInt()); r.fill(0.0); return r }
    /** The elements from start to end as a plain array of the source's class. */
    @JvmStatic fun <A : JsArrayLike?> ArraySlice(arr: A, start: Double, end: Double): A {
        val r: A
        try { r = arr!!.javaClass.getConstructor().newInstance() as A } catch (e: ReflectiveOperationException) { throw JsError(e.toString()) }
        var i = start.toInt()
        while (i < end && i < arr.length()) { r!!.pushBoxed(arr.getBoxed(i)); ++i }
        return r
    }
    @JvmStatic fun <A : JsArrayLike?> ArraySlice(arr: A, start: Double): A = ArraySlice(arr, start, arr!!.length().toDouble())
    @JvmStatic fun SecureCompare(x: Any?, y: Any?): Boolean {
        val a = x as JsArrayLike; val b = y as JsArrayLike
        if (a.length() != b.length()) return false
        var result = 0
        for (i in 0 until a.length()) result = result or (Js.toInt32(a.getBoxed(i)) xor Js.toInt32(b.getBoxed(i)))
        return result == 0
    }
    @JvmStatic fun ArraysEqual(x: Any?, y: Any?): Boolean = SecureCompare(x, y)
    @JvmStatic fun CompareArrays(x: Any?, y: Any?): Boolean {
        val a = x as JsArrayLike; val b = y as JsArrayLike
        if (a.length() != b.length()) return false
        for (i in 0 until a.length()) if (!Js.strictEq(a.getBoxed(i), b.getBoxed(i))) return false
        return true
    }
    @JvmStatic fun ConstantTimeCompare(x: Any?, y: Any?, lengthD: Double): Boolean {
        val a = x as JsArrayLike; val b = y as JsArrayLike
        var length = lengthD.toInt()
        if (length == 0) length = Math.min(a.length(), b.length())
        var result = 0
        for (i in 0 until length) result = result or ((if (i < a.length()) Js.toInt32(a.getBoxed(i)) else 0) xor (if (i < b.length()) Js.toInt32(b.getBoxed(i)) else 0))
        result = result or (a.length() xor b.length())
        return result == 0
    }
    @JvmStatic fun ConstantTimeCompare(x: Any?, y: Any?): Boolean = ConstantTimeCompare(x, y, 0.0)
    @JvmStatic fun XorArrayWithByte(arr: Any?, value: Long): U8Array {
        val a = arr as JsArrayLike; val v = value.toInt() and 0xFF; val r = U8Array(a.length())
        for (i in 0 until a.length()) r.set(i, (Js.toInt32(a.getBoxed(i)) xor v) and 0xFF)
        return r
    }
    @JvmStatic fun SecureRandomBytes(count: Double): U8Array {
        if (count < 0 || count != Math.floor(count)) throw JsError("RangeError", "SecureRandomBytes: count must be a non-negative integer")
        val b = ByteArray(count.toInt()); java.security.SecureRandom().nextBytes(b)
        val r = U8Array(b.size); for (i in b.indices) r.set(i, b[i].toInt() and 0xFF); return r
    }
    @JvmStatic fun Words32ToBytesBE(words: Any?): U8Array {
        val w = words as JsArrayLike; val r = U8Array()
        for (i in 0 until w.length()) { val v = Js.toUint32(w.getBoxed(i)); r.push((v ushr 24).toInt() and 0xFF); r.push((v ushr 16).toInt() and 0xFF); r.push((v ushr 8).toInt() and 0xFF); r.push(v.toInt() and 0xFF) }
        return r
    }
    @JvmStatic fun BytesToWords32BE(bytes: Any?): U32Array {
        val b = bytes as JsArrayLike; val r = U32Array()
        var i = 0
        while (i < b.length()) {
            val x = IntArray(4)
            for (j in 0 until 4) x[j] = if (i + j < b.length()) Js.toInt32(b.getBoxed(i + j)) and 0xFF else 0
            r.push(Pack32BE(x[0], x[1], x[2], x[3]))
            i += 4
        }
        return r
    }
    @JvmStatic fun CreateUint64ArrayFromHex(hexValues: Any?): JsArray<U32Array?> {
        val h = hexValues as JsArrayLike; val r = JsArray<U32Array?>(h.length())
        for (i in 0 until h.length()) {
            var s = Js.str(h.getBoxed(i))
            if (s.startsWith("0x") || s.startsWith("0X")) s = s.substring(2)
            s = Js.padStart(s, 16.0, "0")
            r.set(i, U32Array.of(Js.toUint32(Js.parseInt(s.substring(0, 8), 16.0)), Js.toUint32(Js.parseInt(s.substring(8, 16), 16.0))))
        }
        return r
    }
    @JvmStatic fun GHashMul(x: U8Array?, y: U8Array?): U8Array {
        if (x == null || x.length() != 16 || y == null || y.length() != 16) throw JsError("GHashMul requires 16-byte arrays")
        val z = U8Array(16); val v = y.slice()
        for (i in 0 until 16) {
            val xi = x.get(i)
            var j = 7
            while (j >= 0) {
                if ((xi and (1 shl j)) != 0) for (k in 0 until 16) z.set(k, (z.get(k) xor v.get(k)) and 0xFF)
                val lsb = v.get(15) and 1
                var k = 15
                while (k >= 1) { v.set(k, ((v.get(k) ushr 1) or ((v.get(k - 1) and 1) shl 7)) and 0xFF); --k }
                v.set(0, (v.get(0) ushr 1) and 0xFF)
                if (lsb != 0) v.set(0, (v.get(0) xor 0xE1) and 0xFF)
                --j
            }
        }
        return z
    }
    @JvmStatic fun GCMIncrement(counter: U8Array?): U8Array {
        if (counter == null || counter.length() != 16) throw JsError("GCMIncrement requires 16-byte counter")
        var carry = 1
        var i = 15
        while (i >= 12) { val sum = counter.get(i) + carry; counter.set(i, sum and 0xFF); carry = sum ushr 8; --i }
        return counter
    }

    // ---- bits and words
    @JvmStatic fun GetByte(word: Long, byteIndex: Long): Int = (word.toInt() ushr (byteIndex * 8).toInt()) and 0xFF
    @JvmStatic fun GF256Mul(av: Long, bv: Long): Int {
        var result = 0; var a = av.toInt() and 0xFF; var b = bv.toInt() and 0xFF
        for (i in 0 until 8) { if ((b and 1) != 0) result = result xor a; val hi = a and 0x80; a = (a shl 1) and 0xFF; if (hi != 0) a = a xor 0x1B; b = b ushr 1 }
        return result and 0xFF
    }
    @JvmStatic fun GFMul(av: Long, bv: Long, irreducible: Long, width: Long): Long {
        var result = 0; var a = av.toInt(); var b = bv.toInt(); val w = width.toInt()
        val mask = (1 shl w) - 1
        while (b != 0) { if ((b and 1) != 0) result = result xor a; a = a shl 1; if ((a and (1 shl w)) != 0) a = a xor irreducible.toInt(); a = a and mask; b = b ushr 1 }
        return result.toLong()
    }
    @JvmStatic fun GetBit(value: Long, bitIndex: Long): Boolean = ((value.toInt() ushr bitIndex.toInt()) and 1) != 0
    @JvmStatic fun SetBit(value: Long, bitIndex: Long, bit: Boolean): Long = if (bit) ((value.toInt() or (1 shl bitIndex.toInt())).toLong() and 0xFFFFFFFFL) else ((value.toInt() and (1 shl bitIndex.toInt()).inv()).toLong() and 0xFFFFFFFFL)
    @JvmStatic fun BitMask(bits: Long): Long { if (bits >= 32) return 0xFFFFFFFFL; if (bits <= 0) return 0L; return ((1 shl bits.toInt()) - 1).toLong() }
    @JvmStatic fun Shr32Signed(value: Long, positions: Long): Int = value.toInt() shr positions.toInt()
    @JvmStatic fun PopCount(value: Long): Int = Integer.bitCount(value.toInt())
    @JvmStatic fun PopCountFast(value: Long): Int = Integer.bitCount(value.toInt())
    @JvmStatic fun MulHi32(a: Long, b: Long): Long = ((a and 0xFFFFFFFFL) * (b and 0xFFFFFFFFL)) ushr 32
    @JvmStatic fun AddMod(a: Long, b: Long, m: Long): Int = (((a % m) + (b % m)) % m).toInt()
    @JvmStatic fun SubMod(a: Long, b: Long, m: Long): Int = (((a % m) - (b % m) + m) % m).toInt()
    @JvmStatic fun ToShort(value: Long): Int { val v = value.toInt() and 0xFFFF; return if (v > 32767) v - 65536 else v }
    @JvmStatic fun ToSByte(value: Long): Int { val v = value.toInt() and 0xFF; return if (v > 127) v - 256 else v }
    @JvmStatic fun EncodeMsgLength64LE(bitLength: Double): U8Array { val s = Split64(bitLength); return Unpack32LE(Js.toLong(s.get("low32"))).concat(Unpack32LE(Js.toLong(s.get("high32")))) }
    @JvmStatic fun Split64(value: Double): JsObject = JsObject.of("high32", Math.floor(value / 4294967296.0), "low32", Js.toInt32(value).toLong())
    @JvmStatic fun Add3L64(al: Long, bl: Long, cl: Long): Long = (al and 0xFFFFFFFFL) + (bl and 0xFFFFFFFFL) + (cl and 0xFFFFFFFFL)
    @JvmStatic fun Add3H64(lowSum: Double, ah: Double, bh: Double, ch: Double): Int = Js.toInt32(ah + bh + ch + Js.toInt32(lowSum / 4294967296.0))
    @JvmStatic fun RotL64_HL(high: Long, low: Long, nn: Long): JsObject {
        var n = nn.toInt() and 63; val h = high.toInt(); val l = low.toInt()
        if (n == 0) return JsObject.of("h", h.toLong() and 0xFFFFFFFFL, "l", l.toLong() and 0xFFFFFFFFL)
        if (n == 32) return JsObject.of("h", l.toLong() and 0xFFFFFFFFL, "l", h.toLong() and 0xFFFFFFFFL)
        if (n < 32) return JsObject.of("h", ((h shl n) or (l ushr (32 - n))).toLong() and 0xFFFFFFFFL, "l", ((l shl n) or (h ushr (32 - n))).toLong() and 0xFFFFFFFFL)
        n -= 32
        return JsObject.of("h", ((l shl n) or (h ushr (32 - n))).toLong() and 0xFFFFFFFFL, "l", ((h shl n) or (l ushr (32 - n))).toLong() and 0xFFFFFFFFL)
    }
    @JvmStatic fun RotR64_HL(high: Long, low: Long, nn: Long): JsObject {
        var n = nn.toInt() and 63; val h = high.toInt(); val l = low.toInt()
        if (n == 0) return JsObject.of("h", h.toLong() and 0xFFFFFFFFL, "l", l.toLong() and 0xFFFFFFFFL)
        if (n == 32) return JsObject.of("h", l.toLong() and 0xFFFFFFFFL, "l", h.toLong() and 0xFFFFFFFFL)
        if (n < 32) return JsObject.of("h", ((h ushr n) or (l shl (32 - n))).toLong() and 0xFFFFFFFFL, "l", ((l ushr n) or (h shl (32 - n))).toLong() and 0xFFFFFFFFL)
        n -= 32
        return JsObject.of("h", ((l ushr n) or (h shl (32 - n))).toLong() and 0xFFFFFFFFL, "l", ((h ushr n) or (l shl (32 - n))).toLong() and 0xFFFFFFFFL)
    }

    // ---- BigInt helpers
    @JvmStatic fun ToLong(v: java.math.BigInteger?): java.math.BigInteger { val x = v!!.and(MASK64); return if (x.testBit(63)) x.subtract(Js.TWO64) else x }
    @JvmStatic fun ToQWord(v: java.math.BigInteger?): java.math.BigInteger = v!!.and(MASK64)
    @JvmStatic fun GetBitN(v: java.math.BigInteger?, bitIndex: Long): java.math.BigInteger = v!!.shiftRight(bitIndex.toInt()).and(java.math.BigInteger.ONE)
    @JvmStatic fun SetBitN(v: java.math.BigInteger?, bitIndex: Long, bit: java.math.BigInteger?): java.math.BigInteger = if (bit!!.testBit(0)) v!!.setBit(bitIndex.toInt()) else v!!.clearBit(bitIndex.toInt())
    @JvmStatic fun AndN(a: java.math.BigInteger?, b: java.math.BigInteger?): java.math.BigInteger = a!!.and(b)
    @JvmStatic fun OrN(a: java.math.BigInteger?, b: java.math.BigInteger?): java.math.BigInteger = a!!.or(b)
    @JvmStatic fun XorN(a: java.math.BigInteger?, b: java.math.BigInteger?): java.math.BigInteger = a!!.xor(b)
    @JvmStatic fun MulModN(a: java.math.BigInteger?, b: java.math.BigInteger?, m: java.math.BigInteger?): java.math.BigInteger = a!!.remainder(m).multiply(b!!.remainder(m)).remainder(m)
    @JvmStatic fun SquareModN(a: java.math.BigInteger?, m: java.math.BigInteger?): java.math.BigInteger { val r = a!!.remainder(m); return r.multiply(r).remainder(m) }
    @JvmStatic fun ModPowN(base: java.math.BigInteger?, exp: java.math.BigInteger?, m: java.math.BigInteger?): java.math.BigInteger {
        if (m == java.math.BigInteger.ONE) return java.math.BigInteger.ZERO
        if (exp!!.signum() == 0) return java.math.BigInteger.ONE
        var result = java.math.BigInteger.ONE; var base = base!!.remainder(m); var exp: java.math.BigInteger = exp
        while (exp.signum() > 0) { if (exp.testBit(0)) result = result.multiply(base).remainder(m); exp = exp.shiftRight(1); base = base.multiply(base).remainder(m) }
        return result
    }
    @JvmStatic fun GcdN(a: java.math.BigInteger?, b: java.math.BigInteger?): java.math.BigInteger = a!!.abs().gcd(b!!.abs())
    @JvmStatic fun ModN(a: java.math.BigInteger?, m: java.math.BigInteger?): java.math.BigInteger {
        if (m!!.signum() <= 0) throw JsError("RangeError", "ModN requires a positive modulus")
        val r = a!!.remainder(m); return if (r.signum() < 0) r.add(m) else r
    }
    @JvmStatic fun ModInverseN(a: java.math.BigInteger?, m: java.math.BigInteger?): java.math.BigInteger {
        var oldR = ModN(a, m); var r = m!!; var oldS = java.math.BigInteger.ONE; var s = java.math.BigInteger.ZERO
        while (r.signum() != 0) {
            val q = oldR.divide(r)
            val nextR = oldR.subtract(q.multiply(r)); oldR = r; r = nextR
            val nextS = oldS.subtract(q.multiply(s)); oldS = s; s = nextS
        }
        if (oldR != java.math.BigInteger.ONE) throw JsError("RangeError", "ModInverseN: value has no inverse modulo m")
        return ModN(oldS, m)
    }
    @JvmStatic fun BitCountN(v: java.math.BigInteger?): Int { if (v!!.signum() == 0) return 1; return v.abs().bitLength() }

    @JvmStatic fun CreateBitStream(initialBytes: U8Array?): _BitStream = _BitStream(initialBytes)
    @JvmStatic fun CreateBitStream(): _BitStream = _BitStream(null)
}

/** OpCodes._BitStream */
class _BitStream {
    @JvmField var buffer: Int = 0
    @JvmField var bufferBits: Int = 0
    @JvmField var byteArray: U8Array = U8Array()
    @JvmField var readPosition: Int = 0
    @JvmField var totalBitsWritten: Int = 0
    constructor(initialBytes: U8Array?) { if (initialBytes != null && initialBytes.length() > 0) { byteArray = initialBytes.slice(); totalBitsWritten = initialBytes.length() * 8 } }
    constructor() : this(null)
    fun writeBits(valueL: Long, numBitsL: Long) {
        val numBits = numBitsL.toInt()
        if (numBits <= 0 || numBits > 32) throw JsError("BitStream.writeBits: numBits must be 1-32")
        val mask = if (numBits == 32) -1 else (1 shl numBits) - 1
        val value = valueL.toInt() and mask
        buffer = (buffer shl numBits) or value; bufferBits += numBits; totalBitsWritten += numBits
        while (bufferBits >= 8) { bufferBits -= 8; byteArray.push((buffer ushr bufferBits) and 0xFF); if (bufferBits > 0) buffer = buffer and ((1 shl bufferBits) - 1) else buffer = 0 }
    }
    fun writeBit(bit: Long) { writeBits(bit and 1, 1) }
    fun writeByte(b: Long) { writeBits(b and 0xFF, 8) }
    fun writeBytes(bytes: U8Array?) { for (i in 0 until bytes!!.length()) writeByte(bytes.get(i).toLong()) }
    fun writeUint16BE(v: Long) { writeBits((v ushr 8) and 0xFF, 8); writeBits(v and 0xFF, 8) }
    fun writeUint16LE(v: Long) { writeBits(v and 0xFF, 8); writeBits((v ushr 8) and 0xFF, 8) }
    fun writeUint32BE(v: Long) { writeBits((v ushr 24) and 0xFF, 8); writeBits((v ushr 16) and 0xFF, 8); writeBits((v ushr 8) and 0xFF, 8); writeBits(v and 0xFF, 8) }
    fun writeUint32LE(v: Long) { writeBits(v and 0xFF, 8); writeBits((v ushr 8) and 0xFF, 8); writeBits((v ushr 16) and 0xFF, 8); writeBits((v ushr 24) and 0xFF, 8) }
    fun readBits(numBitsL: Long): Long {
        val numBits = numBitsL.toInt()
        if (numBits <= 0 || numBits > 32) throw JsError("BitStream.readBits: numBits must be 1-32")
        var result = 0; var bitsRead = 0
        while (bitsRead < numBits) {
            val byteIndex = readPosition / 8; val bitOffset = readPosition % 8
            if (byteIndex >= byteArray.length()) { if (bitsRead == 0) throw JsError("BitStream.readBits: No more data available"); break }
            val currentByte = byteArray.get(byteIndex); val available = 8 - bitOffset; val take = Math.min(numBits - bitsRead, available)
            val mask = (1 shl take) - 1
            result = (result shl take) or ((currentByte ushr (available - take)) and mask)
            bitsRead += take; readPosition += take
        }
        return result.toLong()
    }
    fun readBit(): Long = readBits(1)
    fun readByte(): Int = readBits(8).toInt() and 0xFF
    fun readBytes(count: Long): U8Array { val r = U8Array(); var i = 0; while (i < count) { r.push(readByte()); ++i }; return r }
    fun peekBits(n: Long): Long { val saved = readPosition; val r = readBits(n); readPosition = saved; return r }
    fun skipBits(n: Long) { readPosition += n.toInt(); val max = byteArray.length() * 8; if (readPosition > max) readPosition = max }
    fun hasMoreBits(): Boolean = readPosition < byteArray.length() * 8
    fun getRemainingBits(): Int = Math.max(0, byteArray.length() * 8 - readPosition)
    fun resetReadPosition() { readPosition = 0 }
    fun seekBits(off: Long) { val max = byteArray.length() * 8; val o = off.toInt() and 0x7FFFFFFF; val c = if (o > max) max else o; readPosition = if (c > 0) c else 0 }
    fun toArray(pad: Boolean): U8Array { if (bufferBits > 0 && pad) { buffer = buffer shl (8 - bufferBits); byteArray.push(buffer and 0xFF); buffer = 0; bufferBits = 0 }; return byteArray.slice() }
    fun toArray(): U8Array = toArray(true)
    fun getBitLength(): Int = totalBitsWritten
    fun getByteLength(): Int = byteArray.length() + bufferBits / 8 + (if (bufferBits % 8 > 0) 1 else 0)
    fun clear() { buffer = 0; bufferBits = 0; byteArray = U8Array(); readPosition = 0; totalBitsWritten = 0 }
    fun clone(): _BitStream { val c = _BitStream(null); c.buffer = buffer; c.bufferBits = bufferBits; c.byteArray = byteArray.slice(); c.readPosition = readPosition; c.totalBitsWritten = totalBitsWritten; return c }
    fun writeVarInt(v0: Long) { var v = v0 and 0xFFFFFFFFL; while (v >= 0x80) { writeByte((v and 0x7F) or 0x80); v = v ushr 7 }; writeByte(v and 0x7F) }
    fun readVarInt(): Long { var result = 0; var shift = 0; var b: Int; do { if (shift >= 32) throw JsError("BitStream.readVarInt: Integer overflow"); b = readByte(); result = result or ((b and 0x7F) shl shift); shift += 7 } while ((b and 0x80) != 0); return result.toLong() and 0xFFFFFFFFL }
    fun writeUnary(v: Long) { var i = 0L; while (i < v) { writeBit(1); ++i }; writeBit(0) }
    fun readUnary(): Int { var c = 0; while (hasMoreBits() && readBit() == 1L) c++; return c }
    fun alignToByte() { while (bufferBits % 8 != 0) writeBit(0) }
    fun isAligned(): Boolean = bufferBits % 8 == 0
}
`;

  /** The runtime's Kotlin source (cached); the name of Js.as is a keyword, written in backticks. */
  let runtimeCache = null, signatureCache = null;
  function kotlinRuntime() {
    if (!runtimeCache) runtimeCache = [RUNTIME_CORE, ...KT_ARRAY_KINDS.map(ktArrayClass), RUNTIME_JS, RUNTIME_FRAMEWORK, RUNTIME_OPCODES].join('\n').replace(/\u00B4/g, '\u0060');
    return runtimeCache;
  }
  /** The runtime's class and member signatures (the emitter resolves calls against them). */
  function kotlinRuntimeSignatures() {
    if (!signatureCache) signatureCache = parseKotlinSignatures(kotlinRuntime());
    return signatureCache;
  }

  class KotlinPlugin extends LanguagePlugin {
    constructor() {
      super();
      this.name = 'Kotlin';
      this.extension = 'kt';
      this.icon = '🔷';
      this.description = 'Kotlin/JVM code generator';
      this.mimeType = 'text/x-kotlin';
      this.version = 'Kotlin 2.2+';
      this.options = {
        indent: '    ',
        lineEnding: '\n',
        packageName: '',
        className: 'GeneratedClass',
        includeRuntime: true
      };
    }

    /**
     * Generate Kotlin code from the IL AST.
     * @param {Object} ast - IL AST
     * @param {Object} options - generation options (className, packageName, includeRuntime, libraries)
     * @returns {CodeGenerationResult}
     */
    GenerateFromAST(ast, options = {}) {
      try {
        const merged = { ...this.options, ...options };
        if (!ast || typeof ast !== 'object') return this.CreateErrorResult('Invalid AST: must be an object');
        const transformer = new KotlinTransformer({ className: merged.className || 'GeneratedClass' });
        const unit = transformer.transform(ast, { libraries: merged.libraries || [] });
        const emitter = new KotlinEmitter({ indent: merged.indent, newline: merged.lineEnding });
        const code = emitter.emit(unit, {
          packageName: merged.packageName || null,
          runtime: merged.includeRuntime === false ? null : kotlinRuntime(),
          runtimeSignatures: kotlinRuntimeSignatures()
        });
        return this.CreateSuccessResult(code, [], transformer.warnings || []);
      } catch (error) {
        return this.CreateErrorResult('AST pipeline generation failed: ' + error.message);
      }
    }

    /** The runtime the generated code needs. */
    GetRuntime() { return kotlinRuntime(); }

    GetCompilerInfo() {
      return {
        name: this.name,
        compilerName: 'Kotlin/JVM (kotlinc)',
        downloadUrl: 'https://kotlinlang.org/docs/command-line.html',
        installInstructions: 'Install the Kotlin command-line compiler (2.2 or newer) and a JDK, put kotlinc on PATH; verify with: kotlinc -version',
        verifyCommand: 'kotlinc -version',
        packageManager: 'Gradle/Maven',
        documentation: 'https://kotlinlang.org/docs/'
      };
    }
  }

  const kotlinPlugin = new KotlinPlugin();
  LanguagePlugins.Add(kotlinPlugin);
  if (typeof module !== 'undefined' && module.exports) module.exports = kotlinPlugin;
})();
