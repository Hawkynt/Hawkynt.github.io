/**
 * Java Language Plugin for Multi-Language Code Generation
 * (c)2006-2025 Hawkynt
 *
 * IL AST -> JavaTransformer (typed JVM IR) -> JavaEmitter -> Java source.
 *
 * The generated code runs on a small runtime emitted with it: JavaScript
 * value semantics (Js), growable and typed arrays (U8Array ... JsArray<T>),
 * plain objects, maps and functions, the AlgorithmFramework classes member
 * for member, and the OpCodes helpers the IL does not inline. The runtime is
 * self-contained Java 17 (no dependencies) and is shared by every generated
 * file, so a file plus the runtime compiles on its own with javac.
 */

(function () {
  let LanguagePlugin, LanguagePlugins, JavaEmitter, JavaTransformer;

  if (typeof require !== 'undefined') {
    const framework = require('./LanguagePlugin.js');
    LanguagePlugin = framework.LanguagePlugin;
    LanguagePlugins = framework.LanguagePlugins;
    JavaEmitter = require('./JavaEmitter.js').JavaEmitter;
    JavaTransformer = require('./JavaTransformer.js').JavaTransformer;
  } else {
    LanguagePlugin = window.LanguagePlugin;
    LanguagePlugins = window.LanguagePlugins;
    JavaEmitter = window.JavaEmitter;
    JavaTransformer = window.JavaTransformer;
  }

  // =================================================================
  // The Java runtime
  // =================================================================

const ARRAY_KINDS = [
  ['U8Array', 'byte', 'int', 'x & 0xFF', '(byte) v', '0', 'int'],
  ['I8Array', 'byte', 'int', 'x', '(byte) v', '0', 'int'],
  ['U16Array', 'char', 'int', 'x', '(char) v', '0', 'int'],
  ['I16Array', 'short', 'int', 'x', '(short) v', '0', 'int'],
  ['U32Array', 'int', 'long', 'x & 0xFFFFFFFFL', '(int) v', '0L', 'long'],
  ['I32Array', 'int', 'int', 'x', 'v', '0', 'int'],
  ['I64Array', 'long', 'long', 'x', 'v', '0L', 'long'],
  ['F64Array', 'double', 'double', 'x', 'v', 'Double.NaN', 'double'],
  ['F32Array', 'float', 'double', 'x', '(float) v', 'Double.NaN', 'double'],
  ['BoolArray', 'boolean', 'boolean', 'x', 'v', 'false', 'boolean']
];

function arrayClass([name, st, vt, rd, wr, zero, kind]) {
  const read = x => rd.replace(/\bx\b/g, x);
  const write = v => wr.replace(/\bv\b/g, v);
  const box = kind === 'int' ? 'Js.toInt' : kind === 'long' ? 'Js.toLong' : kind === 'double' ? 'Js.toNum' : 'Js.truthy';
  const eq = kind === 'double' ? '(a == b)' : '(a == b)';
  const cmp = kind === 'boolean' ? 'Boolean.compare(a, b)' : kind === 'int' ? 'Integer.compare(a, b)' : kind === 'long' ? 'Long.compare(a, b)' : 'Double.compare(a, b)';
  return String.raw`
final class ${name} extends JsArrayLike {
    ${st}[] a;
    int off;
    public ${name}() { a = new ${st}[8]; }
    public ${name}(int n) { if (n < 0) throw new JsError("Invalid array length"); a = new ${st}[Math.max(n, 4)]; len = n; }
    private ${name}(${st}[] data, int off, int len, boolean fixed) { this.a = data; this.off = off; this.len = len; this.fixed = fixed; }
    public static ${name} typed(int n) { ${name} r = new ${name}(n); r.fixed = true; return r; }
    public static ${name} typed(double n) { return typed((int) n); }
    public static ${name} of(${vt}... v) { ${name} r = new ${name}(v.length); for (int i = 0; i < v.length; ++i) r.a[i] = ${write('v[i]')}; return r; }
    public static ${name} typedOf(${vt}... v) { ${name} r = of(v); r.fixed = true; return r; }
    /** A long literal table, comma-separated (keeps the class file small). */
    public static ${name} parse(String csv) {
        String[] p = csv.split(",");
        ${name} r = new ${name}(p.length);
        for (int i = 0; i < p.length; ++i) r.a[i] = ${write(kind === 'int' ? '(int) Long.parseLong(p[i])' : kind === 'long' ? 'Long.parseLong(p[i])' : kind === 'double' ? 'Double.parseDouble(p[i])' : 'Boolean.parseBoolean(p[i])')};
        return r;
    }
    public static ${name} typedParse(String csv) { ${name} r = parse(csv); r.fixed = true; return r; }
    public static ${name} from(Object src) {
        if (src == null) throw new JsError("TypeError: cannot convert null to an array");
        if (src instanceof String) { String s = (String) src; ${name} r = new ${name}(s.length()); for (int i = 0; i < s.length(); ++i) r.setBoxed(i, String.valueOf(s.charAt(i))); return r; }
        if (src instanceof Number) { ${name} r = new ${name}(0); return r; }
        JsArrayLike s = (JsArrayLike) src; int n = s.length(); ${name} r = new ${name}(n);
        if (s instanceof ${name}) { ${name} t = (${name}) s; System.arraycopy(t.a, t.off, r.a, 0, n); return r; }
        for (int i = 0; i < n; ++i) r.a[i] = ${write(box + '(s.getBoxed(i))')};
        return r;
    }
    public static ${name} typedFrom(Object src) {
        if (src instanceof Number) return typed(Js.toInt(src));
        ${name} r = from(src); r.fixed = true; return r;
    }
    public ${vt} get(int i) { if (i < 0 || i >= len) return ${zero}; ${st} x = a[off + i]; return ${read('x')}; }
    public ${vt} get(long i) { return i < 0 || i >= len ? ${zero} : get((int) i); }
    public ${vt} get(double i) { return i != Math.floor(i) || i < 0 || i >= len ? ${zero} : get((int) i); }
    public ${vt} set(int i, ${vt} v) {
        if (i < 0) return v;
        if (i >= len) { if (fixed) return v; setLength(i + 1); }
        a[off + i] = ${write('v')};
        return v;
    }
    public ${vt} set(long i, ${vt} v) { return i < 0 || i > Integer.MAX_VALUE ? v : set((int) i, v); }${kind === 'boolean' ? '' : `
    public ${vt} postInc(double i) { ${vt} old = get(i); set(i, (${vt}) (old + 1)); return old; }
    public ${vt} postDec(double i) { ${vt} old = get(i); set(i, (${vt}) (old - 1)); return old; }
    public ${vt} preInc(double i) { return set(i, (${vt}) (get(i) + 1)); }
    public ${vt} preDec(double i) { return set(i, (${vt}) (get(i) - 1)); }`}
    public ${vt} set(double i, ${vt} v) { return i != Math.floor(i) || i < 0 ? v : set((int) i, v); }
    private void ensure(int n) {
        if (off + n <= a.length) return;
        ${st}[] b = new ${st}[Math.max(n, a.length * 2 + 4)];
        System.arraycopy(a, off, b, 0, len);
        a = b; off = 0;
    }
    public void setLength(int n) {
        if (n < 0) throw new JsError("Invalid array length");
        if (fixed) return;
        if (n > len) { ensure(n); java.util.Arrays.fill(a, off + len, off + n, (${st}) ${st === 'boolean' ? 'false' : '0'}); }
        len = n;
    }
    public Object getBoxed(int i) { return i < 0 || i >= len ? null : (Object) get(i); }
    public void setBoxed(int i, Object v) { set(i, ${box}(v)); }
    public int pushBoxed(Object v) { return push(${box}(v)); }
    public int push(${vt} v) { if (fixed) throw new JsError("TypeError: push on a typed array"); ensure(len + 1); a[off + len++] = ${write('v')}; return len; }
    public int push(${vt} v, ${vt} w) { push(v); return push(w); }
    public int push(${vt} v, ${vt} w, ${vt} x) { push(v); push(w); return push(x); }
    public int push(${vt} v, ${vt} w, ${vt} x, ${vt} y) { push(v); push(w); push(x); return push(y); }
    public int pushAll(Object src) {
        if (src instanceof ${name}) { ${name} s = (${name}) src; int n = s.len; ensure(len + n); System.arraycopy(s.a, s.off, a, off + len, n); len += n; return len; }
        JsArrayLike s = (JsArrayLike) src; int n = s.length();
        for (int i = 0; i < n; ++i) pushBoxed(s.getBoxed(i));
        return len;
    }
    public ${vt} pop() { if (len == 0) return ${zero}; ${vt} v = get(len - 1); len--; return v; }
    public ${vt} shift() { if (len == 0) return ${zero}; ${vt} v = get(0); off++; len--; return v; }
    public int unshift(${vt} v) { ensure(len + 1); System.arraycopy(a, off, a, off + 1, len); a[off] = ${write('v')}; len++; return len; }
    public int unshiftAll(Object src) { JsArrayLike s = (JsArrayLike) src; ${name} t = from(s); t.pushAll(this); a = t.a; off = t.off; len = t.len; return len; }
    public ${name} slice() { return slice(0, len); }
    public ${name} slice(double s) { return slice(s, len); }
    public ${name} slice(double s, double e) {
        int b = Js.relIndex(s, len), f = Js.relIndex(e, len);
        int n = Math.max(0, f - b);
        ${name} r = new ${name}(n); System.arraycopy(a, off + b, r.a, 0, n); r.fixed = fixed; return r;
    }
    public ${name} subarray() { return subarray(0, len); }
    public ${name} subarray(double s) { return subarray(s, len); }
    public ${name} subarray(double s, double e) {
        int b = Js.relIndex(s, len), f = Js.relIndex(e, len);
        return new ${name}(a, off + b, Math.max(0, f - b), true);
    }
    public ${name} concat(Object... others) {
        ${name} r = slice(); r.fixed = false;
        for (Object o : others) { if (o instanceof JsArrayLike) r.pushAll(o); else r.pushBoxed(o); }
        return r;
    }
    public ${name} splice(double start) { return splice(start, len); }
    public ${name} splice(double start, double deleteCount, Object... items) {
        int s = Js.relIndex(start, len);
        int d = (int) Math.max(0, Math.min(Js.toIntegerOrZero(deleteCount), len - s));
        ${name} removed = new ${name}(d); System.arraycopy(a, off + s, removed.a, 0, d);
        int n = items.length, tail = len - s - d;
        ensure(len - d + n);
        System.arraycopy(a, off + s + d, a, off + s + n, tail);
        for (int i = 0; i < n; ++i) a[off + s + i] = ${write(box + '(items[i])')};
        len = len - d + n;
        return removed;
    }
    public int indexOf(${vt} v) { return indexOf(v, 0); }
    public int indexOf(${vt} v, double from) { for (int i = Js.relIndex(from, len); i < len; ++i) { ${vt} b = get(i); ${vt} a = v; if ${eq} return i; } return -1; }
    public int lastIndexOf(${vt} v) { for (int i = len - 1; i >= 0; --i) { ${vt} b = get(i); ${vt} a = v; if ${eq} return i; } return -1; }
    public boolean includes(${vt} v) { return indexOf(v) >= 0; }
    public int indexOfBoxed(Object v) { if (!Js.isNumberLike(v, ${kind === 'boolean'})) return -1; return indexOf(${box}(v)); }
    public ${name} fill(${vt} v) { return fill(v, 0, len); }
    public ${name} fill(${vt} v, double s) { return fill(v, s, len); }
    public ${name} fill(${vt} v, double s, double e) { int b = Js.relIndex(s, len), f = Js.relIndex(e, len); for (int i = b; i < f; ++i) a[off + i] = ${write('v')}; return this; }
    public ${name} reverse() { for (int i = 0, j = len - 1; i < j; ++i, --j) { ${st} t = a[off + i]; a[off + i] = a[off + j]; a[off + j] = t; } return this; }
    public ${name} sort() {
        Object[] boxed = new Object[len];
        for (int i = 0; i < len; ++i) boxed[i] = get(i);
        if (fixed) java.util.Arrays.sort(boxed, (x, y) -> { ${vt} a = ${box}(x), b = ${box}(y); return ${cmp}; });
        else java.util.Arrays.sort(boxed, (x, y) -> Js.str(x).compareTo(Js.str(y)));
        for (int i = 0; i < len; ++i) setBoxed(i, boxed[i]);
        return this;
    }
    public ${name} sort(JsFn cmp) {
        if (cmp == null) return sort();
        Object[] boxed = new Object[len];
        for (int i = 0; i < len; ++i) boxed[i] = get(i);
        java.util.Arrays.sort(boxed, (x, y) -> { double d = Js.toNum(cmp.call(x, y)); return d < 0 ? -1 : d > 0 ? 1 : 0; });
        for (int i = 0; i < len; ++i) setBoxed(i, boxed[i]);
        return this;
    }
    public void set(Object src) { set(src, 0); }
    public void set(Object src, double offset) {
        int o = (int) offset;
        if (src instanceof ${name}) { ${name} s = (${name}) src; if (o + s.len > len) throw new JsError("RangeError: offset is out of bounds"); System.arraycopy(s.a, s.off, a, off + o, s.len); return; }
        JsArrayLike s = (JsArrayLike) src; int n = s.length();
        if (o + n > len) throw new JsError("RangeError: offset is out of bounds");
        for (int i = 0; i < n; ++i) setBoxed(o + i, s.getBoxed(i));
    }
    public ${name} copy() { return slice(); }
    public ${name} map(JsFn fn) { ${name} r = new ${name}(len); r.fixed = fixed; for (int i = 0; i < len; ++i) r.setBoxed(i, fn.call(get(i), i, this)); return r; }
    public ${name} filter(JsFn fn) { ${name} r = new ${name}(); for (int i = 0; i < len; ++i) if (Js.truthy(fn.call(get(i), i, this))) r.push(get(i)); r.fixed = fixed; return r; }
}
`;
}

const RUNTIME_CORE = String.raw`
// ===================================================================
// JavaScript value semantics for the transpiled code (runtime support)
// ===================================================================

/** A JavaScript exception: an Error with a message, or a thrown value. */
class JsError extends RuntimeException {
    public final Object value;
    public String name = "Error";
    public JsError(String message) { super(message); this.value = null; }
    public JsError(String name, String message) { super(message); this.value = null; this.name = name; }
    private JsError(Object value, boolean thrown) { super(Js.str(value)); this.value = value; }
    public static JsError thrown(Object value) { return value instanceof JsError ? (JsError) value : new JsError(value, true); }
    public String getMessageText() { return getMessage(); }
}

/** A JavaScript function value. */
@FunctionalInterface
interface JsFn { Object call(Object... args); }

/** Objects carrying JavaScript properties beyond their declared fields. */
interface JsDynamic { JsObject props(); }

/** Base of every array: a JavaScript Array (growable) or TypedArray (fixed). */
abstract class JsArrayLike {
    int len;
    boolean fixed;
    public final int length() { return len; }
    public abstract void setLength(int n);
    public void setLength(long n) { setLength((int) n); }
    public void setLength(double n) { setLength((int) n); }
    public final boolean isFixed() { return fixed; }
    public abstract Object getBoxed(int i);
    public abstract void setBoxed(int i, Object v);
    public abstract int pushBoxed(Object v);
    public abstract int indexOfBoxed(Object v);
    public String join() { return join(","); }
    public String join(String sep) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < len; ++i) { if (i > 0) sb.append(sep); Object v = getBoxed(i); if (v != null) sb.append(Js.str(v)); }
        return sb.toString();
    }
    @Override public String toString() { return join(","); }
    public void forEach(JsFn fn) { for (int i = 0; i < len; ++i) fn.call(getBoxed(i), i, this); }
    public boolean some(JsFn fn) { for (int i = 0; i < len; ++i) if (Js.truthy(fn.call(getBoxed(i), i, this))) return true; return false; }
    public boolean every(JsFn fn) { for (int i = 0; i < len; ++i) if (!Js.truthy(fn.call(getBoxed(i), i, this))) return false; return true; }
    public Object find(JsFn fn) { for (int i = 0; i < len; ++i) if (Js.truthy(fn.call(getBoxed(i), i, this))) return getBoxed(i); return null; }
    public int findIndex(JsFn fn) { for (int i = 0; i < len; ++i) if (Js.truthy(fn.call(getBoxed(i), i, this))) return i; return -1; }
    public Object reduce(JsFn fn, Object init) { Object acc = init; for (int i = 0; i < len; ++i) acc = fn.call(acc, getBoxed(i), i, this); return acc; }
    public Object reduce(JsFn fn) { if (len == 0) throw new JsError("TypeError: Reduce of empty array with no initial value"); Object acc = getBoxed(0); for (int i = 1; i < len; ++i) acc = fn.call(acc, getBoxed(i), i, this); return acc; }
    public JsArray<Object> mapToObjects(JsFn fn) { JsArray<Object> r = new JsArray<>(len); for (int i = 0; i < len; ++i) r.set(i, fn.call(getBoxed(i), i, this)); return r; }
}

/** An array of references (strings, objects, nested arrays, BigInts). */
final class JsArray<T> extends JsArrayLike {
    Object[] a;
    public JsArray() { a = new Object[8]; }
    public JsArray(int n) { if (n < 0) throw new JsError("Invalid array length"); a = new Object[Math.max(n, 4)]; len = n; }
    @SafeVarargs public static <T> JsArray<T> of(T... v) { JsArray<T> r = new JsArray<>(v.length); System.arraycopy(v, 0, r.a, 0, v.length); return r; }
    public static <T> JsArray<T> from(Object src) {
        JsArray<T> r = new JsArray<>();
        if (src == null) throw new JsError("TypeError: cannot convert null to an array");
        if (src instanceof String) { String s = (String) src; for (int i = 0; i < s.length(); ++i) r.pushBoxed(String.valueOf(s.charAt(i))); return r; }
        if (src instanceof JsSet) { for (Object o : ((JsSet) src).s) r.pushBoxed(o); return r; }
        if (src instanceof JsMap) return Js.cast(((JsMap) src).entries());
        if (src instanceof Number) { int n = Js.toInt(src); r.setLength(0); return r; }
        JsArrayLike s = (JsArrayLike) src;
        for (int i = 0; i < s.length(); ++i) r.pushBoxed(s.getBoxed(i));
        return r;
    }
    public static <T> JsArray<T> filled(int n, T v) { JsArray<T> r = new JsArray<>(n); java.util.Arrays.fill(r.a, 0, n, v); return r; }
    @SuppressWarnings("unchecked") public T get(int i) { return i < 0 || i >= len ? null : (T) a[i]; }
    public T get(long i) { return i < 0 || i >= len ? null : get((int) i); }
    public T get(double i) { return i != Math.floor(i) || i < 0 || i >= len ? null : get((int) i); }
    public T set(int i, T v) { if (i < 0) return v; if (i >= len) setLength(i + 1); a[i] = v; return v; }
    public T set(long i, T v) { return set((int) i, v); }
    public T set(double i, T v) { return set((int) i, v); }
    private void ensure(int n) { if (n <= a.length) return; a = java.util.Arrays.copyOf(a, Math.max(n, a.length * 2 + 4)); }
    public void setLength(int n) { if (n < 0) throw new JsError("Invalid array length"); if (n > len) ensure(n); else java.util.Arrays.fill(a, n, len, null); len = n; }
    public Object getBoxed(int i) { return get(i); }
    @SuppressWarnings("unchecked") public void setBoxed(int i, Object v) { set(i, (T) v); }
    @SuppressWarnings("unchecked") public int pushBoxed(Object v) { return push((T) v); }
    public int push(T v) { ensure(len + 1); a[len++] = v; return len; }
    @SafeVarargs public final int push(T v, T... more) { push(v); for (T m : more) push(m); return len; }
    public int pushAll(Object src) { JsArrayLike s = (JsArrayLike) src; int n = s.length(); for (int i = 0; i < n; ++i) pushBoxed(s.getBoxed(i)); return len; }
    public T pop() { if (len == 0) return null; T v = get(len - 1); a[--len] = null; return v; }
    public T shift() { if (len == 0) return null; T v = get(0); System.arraycopy(a, 1, a, 0, len - 1); a[--len] = null; return v; }
    public int unshift(T v) { ensure(len + 1); System.arraycopy(a, 0, a, 1, len); a[0] = v; return ++len; }
    public JsArray<T> slice() { return slice(0, len); }
    public JsArray<T> slice(double s) { return slice(s, len); }
    public JsArray<T> slice(double s, double e) { int b = Js.relIndex(s, len), f = Js.relIndex(e, len); int n = Math.max(0, f - b); JsArray<T> r = new JsArray<>(n); System.arraycopy(a, b, r.a, 0, n); return r; }
    public JsArray<T> concat(Object... others) { JsArray<T> r = slice(); for (Object o : others) { if (o instanceof JsArrayLike) r.pushAll(o); else r.pushBoxed(o); } return r; }
    public JsArray<T> splice(double start) { return splice(start, len); }
    @SuppressWarnings("unchecked") public JsArray<T> splice(double start, double deleteCount, Object... items) {
        int s = Js.relIndex(start, len);
        int d = (int) Math.max(0, Math.min(Js.toIntegerOrZero(deleteCount), len - s));
        JsArray<T> removed = new JsArray<>(d); System.arraycopy(a, s, removed.a, 0, d);
        int n = items.length, tail = len - s - d;
        ensure(len - d + n);
        System.arraycopy(a, s + d, a, s + n, tail);
        for (int i = 0; i < n; ++i) a[s + i] = items[i];
        int newLen = len - d + n;
        if (newLen < len) java.util.Arrays.fill(a, newLen, len, null);
        len = newLen;
        return removed;
    }
    public int indexOf(Object v) { return indexOf(v, 0); }
    public int indexOf(Object v, double from) { for (int i = Js.relIndex(from, len); i < len; ++i) if (Js.strictEq(a[i], v)) return i; return -1; }
    public int lastIndexOf(Object v) { for (int i = len - 1; i >= 0; --i) if (Js.strictEq(a[i], v)) return i; return -1; }
    public boolean includes(Object v) { for (int i = 0; i < len; ++i) if (Js.sameValueZero(a[i], v)) return true; return false; }
    public int indexOfBoxed(Object v) { return indexOf(v); }
    public JsArray<T> fill(T v) { return fill(v, 0, len); }
    public JsArray<T> fill(T v, double s) { return fill(v, s, len); }
    public JsArray<T> fill(T v, double s, double e) { int b = Js.relIndex(s, len), f = Js.relIndex(e, len); for (int i = b; i < f; ++i) a[i] = v; return this; }
    public JsArray<T> reverse() { for (int i = 0, j = len - 1; i < j; ++i, --j) { Object t = a[i]; a[i] = a[j]; a[j] = t; } return this; }
    public JsArray<T> sort() { java.util.Arrays.sort(a, 0, len, (x, y) -> x == null ? (y == null ? 0 : 1) : y == null ? -1 : Js.str(x).compareTo(Js.str(y))); return this; }
    public JsArray<T> sort(JsFn cmp) {
        if (cmp == null) return sort();
        java.util.Arrays.sort(a, 0, len, (x, y) -> { double d = Js.toNum(cmp.call(x, y)); return d < 0 ? -1 : d > 0 ? 1 : 0; });
        return this;
    }
    public JsArray<T> copy() { return slice(); }
    @SuppressWarnings("unchecked") public JsArray<T> map(JsFn fn) { JsArray<T> r = new JsArray<>(len); for (int i = 0; i < len; ++i) r.a[i] = fn.call(get(i), i, this); return r; }
    public JsArray<T> filter(JsFn fn) { JsArray<T> r = new JsArray<>(); for (int i = 0; i < len; ++i) if (Js.truthy(fn.call(get(i), i, this))) r.push(get(i)); return r; }
}

/** A plain JavaScript object: string keys, integer-like keys first in ascending order. */
final class JsObject implements JsDynamic {
    final java.util.LinkedHashMap<String, Object> m = new java.util.LinkedHashMap<>();
    public JsObject props() { return this; }
    public static JsObject of(Object... kv) { JsObject o = new JsObject(); for (int i = 0; i + 1 < kv.length; i += 2) o.put(Js.propKey(kv[i]), kv[i + 1]); return o; }
    public Object get(String k) { return m.get(k); }
    public Object get(Object k) { return m.get(Js.propKey(k)); }
    public Object put(String k, Object v) { m.put(k, v); return v; }
    public Object put(Object k, Object v) { m.put(Js.propKey(k), v); return v; }
    public boolean has(Object k) { return m.containsKey(Js.propKey(k)); }
    public boolean delete(Object k) { m.remove(Js.propKey(k)); return true; }
    public JsArray<String> keys() {
        java.util.ArrayList<String> ints = new java.util.ArrayList<>(), others = new java.util.ArrayList<>();
        for (String k : m.keySet()) { if (Js.isArrayIndex(k)) ints.add(k); else others.add(k); }
        ints.sort((x, y) -> Long.compare(Long.parseLong(x), Long.parseLong(y)));
        JsArray<String> r = new JsArray<>();
        for (String k : ints) r.push(k);
        for (String k : others) r.push(k);
        return r;
    }
    public JsArray<Object> values() { JsArray<String> k = keys(); JsArray<Object> r = new JsArray<>(); for (int i = 0; i < k.length(); ++i) r.push(m.get(k.get(i))); return r; }
    public JsArray<Object> entries() { JsArray<String> k = keys(); JsArray<Object> r = new JsArray<>(); for (int i = 0; i < k.length(); ++i) r.push(JsArray.<Object>of(k.get(i), m.get(k.get(i)))); return r; }
    @Override public String toString() { return "[object " + "Object]"; }
}

/** A JavaScript Map: SameValueZero keys, insertion order. */
final class JsMap {
    final java.util.LinkedHashMap<Object, Object> m = new java.util.LinkedHashMap<>();
    public JsMap() {}
    public JsMap(Object entries) { if (entries != null) { JsArrayLike e = (JsArrayLike) entries; for (int i = 0; i < e.length(); ++i) { JsArrayLike kv = (JsArrayLike) e.getBoxed(i); set(kv.getBoxed(0), kv.getBoxed(1)); } } }
    public Object get(Object k) { return m.get(Js.mapKey(k)); }
    public JsMap set(Object k, Object v) { m.put(Js.mapKey(k), v); return this; }
    public boolean has(Object k) { return m.containsKey(Js.mapKey(k)); }
    public boolean delete(Object k) { Object key = Js.mapKey(k); boolean had = m.containsKey(key); m.remove(key); return had; }
    public int size() { return m.size(); }
    public void clear() { m.clear(); }
    public JsArray<Object> keys() { JsArray<Object> r = new JsArray<>(); for (Object k : m.keySet()) r.push(Js.unMapKey(k)); return r; }
    public JsArray<Object> values() { JsArray<Object> r = new JsArray<>(); for (Object v : m.values()) r.push(v); return r; }
    public JsArray<Object> entries() { JsArray<Object> r = new JsArray<>(); for (java.util.Map.Entry<Object, Object> e : m.entrySet()) r.push(JsArray.<Object>of(Js.unMapKey(e.getKey()), e.getValue())); return r; }
    public void forEach(JsFn fn) { for (java.util.Map.Entry<Object, Object> e : new java.util.ArrayList<>(m.entrySet())) fn.call(e.getValue(), Js.unMapKey(e.getKey()), this); }
}

/** A JavaScript Set: SameValueZero values, insertion order. */
final class JsSet {
    final java.util.LinkedHashSet<Object> s = new java.util.LinkedHashSet<>();
    public JsSet() {}
    public JsSet(Object values) { if (values != null) { JsArrayLike e = values instanceof String ? JsArray.from(values) : (JsArrayLike) values; for (int i = 0; i < e.length(); ++i) add(e.getBoxed(i)); } }
    public JsSet add(Object v) { s.add(Js.mapKey(v)); return this; }
    public boolean has(Object v) { return s.contains(Js.mapKey(v)); }
    public boolean delete(Object v) { return s.remove(Js.mapKey(v)); }
    public int size() { return s.size(); }
    public void clear() { s.clear(); }
    public JsArray<Object> values() { JsArray<Object> r = new JsArray<>(); for (Object v : s) r.push(Js.unMapKey(v)); return r; }
    public void forEach(JsFn fn) { for (Object v : new java.util.ArrayList<>(s)) fn.call(Js.unMapKey(v), Js.unMapKey(v), this); }
}

/** JavaScript operators and builtins over Java values. */
final class Js {
    private Js() {}
    static final java.math.BigInteger MASK64 = java.math.BigInteger.ONE.shiftLeft(64).subtract(java.math.BigInteger.ONE);
    /** The global object module-level code sees as this. */
    public static final JsObject GLOBAL = new JsObject();
    static final java.math.BigInteger TWO64 = java.math.BigInteger.ONE.shiftLeft(64);

    // ---------------------------------------------------------------- numbers
    public static int toInt32(double d) {
        if (Double.isNaN(d) || Double.isInfinite(d)) return 0;
        if (d >= -2147483648.0 && d <= 2147483647.0) return (int) d;
        double t = d < 0 ? Math.ceil(d) : Math.floor(d);
        double m = t % 4294967296.0;
        return (int) (long) m;
    }
    public static int toInt32(long v) { return (int) v; }
    public static int toInt32(int v) { return v; }
    public static int toInt32(Object o) { return o instanceof Integer ? (Integer) o : o instanceof Long ? (int) (long) (Long) o : toInt32(toNum(o)); }
    public static long toUint32(double d) { return toInt32(d) & 0xFFFFFFFFL; }
    public static long toUint32(long v) { return v & 0xFFFFFFFFL; }
    public static long toUint32(int v) { return v & 0xFFFFFFFFL; }
    public static long toUint32(Object o) { return toInt32(o) & 0xFFFFFFFFL; }
    /** JavaScript ToNumber, then exact integral conversion (the value is integral by the IL type). */
    public static int toInt(Object o) {
        if (o instanceof Integer) return (Integer) o;
        if (o instanceof Long) return (int) (long) (Long) o;
        if (o instanceof Number && !(o instanceof java.math.BigInteger)) { double d = ((Number) o).doubleValue(); return Double.isNaN(d) ? 0 : (int) (long) d; }
        if (o instanceof java.math.BigInteger) return ((java.math.BigInteger) o).intValue();
        double d = toNum(o); return Double.isNaN(d) ? 0 : (int) (long) d;
    }
    public static long toLong(Object o) {
        if (o instanceof Long) return (Long) o;
        if (o instanceof Integer) return (Integer) o;
        if (o instanceof java.math.BigInteger) return ((java.math.BigInteger) o).longValue();
        double d = toNum(o); return Double.isNaN(d) ? 0 : (long) d;
    }
    public static long toLong(double d) { return Double.isNaN(d) ? 0 : (long) d; }
    public static int toInt(double d) { return Double.isNaN(d) ? 0 : (int) (long) d; }
    public static double toNum(Object o) {
        if (o == null) return Double.NaN;
        if (o instanceof Number) return ((Number) o).doubleValue();
        if (o instanceof Boolean) return (Boolean) o ? 1 : 0;
        if (o instanceof String) {
            String s = ((String) o).trim();
            if (s.isEmpty()) return 0;
            try {
                if (s.startsWith("0x") || s.startsWith("0X")) return Long.parseLong(s.substring(2), 16);
                if (s.equals("Infinity") || s.equals("+Infinity")) return Double.POSITIVE_INFINITY;
                if (s.equals("-Infinity")) return Double.NEGATIVE_INFINITY;
                if (!s.matches("[+-]?(\\d+\\.?\\d*([eE][+-]?\\d+)?|\\.\\d+([eE][+-]?\\d+)?)")) return Double.NaN;
                return Double.parseDouble(s);
            } catch (NumberFormatException e) { return Double.NaN; }
        }
        if (o instanceof JsArrayLike) { JsArrayLike a = (JsArrayLike) o; if (a.length() == 0) return 0; if (a.length() == 1) return toNum(a.getBoxed(0)); return Double.NaN; }
        return Double.NaN;
    }
    public static double toNum(double d) { return d; }
    public static java.math.BigInteger toBig(Object o) {
        if (o instanceof java.math.BigInteger) return (java.math.BigInteger) o;
        if (o instanceof Integer || o instanceof Long) return java.math.BigInteger.valueOf(((Number) o).longValue());
        if (o instanceof Number) return big(((Number) o).doubleValue());
        if (o instanceof Boolean) return (Boolean) o ? java.math.BigInteger.ONE : java.math.BigInteger.ZERO;
        if (o instanceof String) return bigOf((String) o);
        if (o instanceof JsArrayLike) return bigOf(str(o));
        throw new JsError("TypeError", "Cannot convert " + str(o) + " to a BigInt");
    }
    /** BigInt(number): the number must be an integer. */
    public static java.math.BigInteger big(double d) {
        if (Double.isNaN(d) || Double.isInfinite(d) || d != Math.floor(d)) throw new JsError("RangeError", "The number " + str(d) + " cannot be converted to a BigInt because it is not an integer");
        return new java.math.BigDecimal(d).toBigInteger();
    }
    public static java.math.BigInteger big(long v) { return java.math.BigInteger.valueOf(v); }
    public static java.math.BigInteger big(int v) { return java.math.BigInteger.valueOf(v); }
    public static java.math.BigInteger big(boolean v) { return v ? java.math.BigInteger.ONE : java.math.BigInteger.ZERO; }
    public static java.math.BigInteger big(java.math.BigInteger v) { return v; }
    public static java.math.BigInteger big(String s) { return bigOf(s); }
    public static java.math.BigInteger big(Object o) { return toBig(o); }
    public static java.math.BigInteger bigOf(String s) {
        s = s.trim();
        if (s.isEmpty()) return java.math.BigInteger.ZERO;
        try {
            if (s.startsWith("0x") || s.startsWith("0X")) return new java.math.BigInteger(s.substring(2), 16);
            if (s.startsWith("0b") || s.startsWith("0B")) return new java.math.BigInteger(s.substring(2), 2);
            if (s.startsWith("0o") || s.startsWith("0O")) return new java.math.BigInteger(s.substring(2), 8);
            return new java.math.BigInteger(s);
        } catch (NumberFormatException e) { throw new JsError("SyntaxError", "Cannot convert " + s + " to a BigInt"); }
    }
    /** BigInt.asUintN(64, x) as a Java long (two's complement bits). */
    public static long u64(java.math.BigInteger v) { return v.longValue(); }
    public static java.math.BigInteger bigU64(long v) { java.math.BigInteger b = java.math.BigInteger.valueOf(v); return v < 0 ? b.add(TWO64) : b; }
    public static java.math.BigInteger asUintN(int bits, java.math.BigInteger v) { java.math.BigInteger m = java.math.BigInteger.ONE.shiftLeft(bits); java.math.BigInteger r = v.mod(m); return r; }
    public static java.math.BigInteger asIntN(int bits, java.math.BigInteger v) { java.math.BigInteger r = asUintN(bits, v); return r.testBit(bits - 1) ? r.subtract(java.math.BigInteger.ONE.shiftLeft(bits)) : r; }
    public static double num(java.math.BigInteger v) { return v.doubleValue(); }
    public static boolean isNumberLike(Object v, boolean bool) { return bool ? v instanceof Boolean : v instanceof Number && !(v instanceof java.math.BigInteger); }
    public static long toIntegerOrZero(double d) { return Double.isNaN(d) ? 0 : (long) d; }
    /** A relative index (negative counts from the end) clamped to [0, len]. */
    public static int relIndex(double d, int len) {
        if (Double.isNaN(d)) return 0;
        double t = d < 0 ? Math.ceil(d) : Math.floor(d);
        if (t < 0) return (int) Math.max(0, len + t);
        return (int) Math.min(t, len);
    }
    public static boolean isArrayIndex(String k) { if (k.isEmpty() || k.length() > 10) return false; for (int i = 0; i < k.length(); ++i) if (k.charAt(i) < '0' || k.charAt(i) > '9') return false; return k.equals("0") || k.charAt(0) != '0'; }

    // ---------------------------------------------------------------- operators
    public static boolean truthy(Object o) {
        if (o == null) return false;
        if (o instanceof Boolean) return (Boolean) o;
        if (o instanceof String) return !((String) o).isEmpty();
        if (o instanceof java.math.BigInteger) return ((java.math.BigInteger) o).signum() != 0;
        if (o instanceof Number) { double d = ((Number) o).doubleValue(); return d != 0 && !Double.isNaN(d); }
        return true;
    }
    public static boolean truthy(double d) { return d != 0 && !Double.isNaN(d); }
    public static boolean truthy(long v) { return v != 0; }
    public static boolean truthy(int v) { return v != 0; }
    public static boolean truthy(boolean v) { return v; }
    public static boolean truthy(String s) { return s != null && !s.isEmpty(); }
    public static boolean truthy(java.math.BigInteger v) { return v != null && v.signum() != 0; }
    /** JavaScript ===. */
    public static boolean strictEq(Object a, Object b) {
        if (a == b) return a == null || !(a instanceof Double) || !((Double) a).isNaN();
        if (a == null || b == null) return false;
        if (a instanceof java.math.BigInteger || b instanceof java.math.BigInteger) return a instanceof java.math.BigInteger && b instanceof java.math.BigInteger && a.equals(b);
        if (a instanceof Number && b instanceof Number) return ((Number) a).doubleValue() == ((Number) b).doubleValue();
        if (a instanceof String && b instanceof String) return a.equals(b);
        if (a instanceof Boolean && b instanceof Boolean) return a.equals(b);
        return false;
    }
    /** JavaScript ==. */
    public static boolean looseEq(Object a, Object b) {
        if (a == null || b == null) return a == null && b == null;
        if (a instanceof java.math.BigInteger && b instanceof Number) return b instanceof java.math.BigInteger ? a.equals(b) : (Double.isNaN(((Number) b).doubleValue()) ? false : new java.math.BigDecimal(((Number) b).doubleValue()).compareTo(new java.math.BigDecimal((java.math.BigInteger) a)) == 0);
        if (b instanceof java.math.BigInteger && a instanceof Number) return looseEq(b, a);
        if (a.getClass() == b.getClass() || (a instanceof Number && b instanceof Number)) return strictEq(a, b);
        if (a instanceof Number || a instanceof Boolean || b instanceof Number || b instanceof Boolean) {
            if ((a instanceof String || a instanceof Number || a instanceof Boolean) && (b instanceof String || b instanceof Number || b instanceof Boolean)) return toNum(a) == toNum(b);
        }
        if (a instanceof String && b instanceof JsArrayLike) return a.equals(str(b));
        if (b instanceof String && a instanceof JsArrayLike) return b.equals(str(a));
        return false;
    }
    public static boolean sameValueZero(Object a, Object b) {
        if (a instanceof Double && b instanceof Double && ((Double) a).isNaN() && ((Double) b).isNaN()) return true;
        return strictEq(a, b);
    }
    /** BigInt and Number compared by mathematical value (BigInt < Number etc.). */
    public static int cmpBigNum(java.math.BigInteger a, double b) {
        if (Double.isNaN(b)) return 2;
        if (Double.isInfinite(b)) return b > 0 ? -1 : 1;
        return new java.math.BigDecimal(a).compareTo(new java.math.BigDecimal(b));
    }
    /** a < b etc. on dynamic values (numbers, strings, BigInts); NaN compares false. */
    public static int compare(Object a, Object b) {
        if (a instanceof String && b instanceof String) { int c = ((String) a).compareTo((String) b); return c < 0 ? -1 : c > 0 ? 1 : 0; }
        if (a instanceof java.math.BigInteger && b instanceof java.math.BigInteger) return ((java.math.BigInteger) a).compareTo((java.math.BigInteger) b);
        if (a instanceof java.math.BigInteger) return cmpBigNum((java.math.BigInteger) a, toNum(b));
        if (b instanceof java.math.BigInteger) { int c = cmpBigNum((java.math.BigInteger) b, toNum(a)); return c == 2 ? 2 : -c; }
        double x = toNum(a), y = toNum(b);
        if (Double.isNaN(x) || Double.isNaN(y)) return 2;
        return x < y ? -1 : x > y ? 1 : 0;
    }
    public static boolean lt(Object a, Object b) { int c = compare(a, b); return c == -1; }
    public static boolean le(Object a, Object b) { int c = compare(a, b); return c == -1 || c == 0; }
    public static boolean gt(Object a, Object b) { int c = compare(a, b); return c == 1; }
    public static boolean ge(Object a, Object b) { int c = compare(a, b); return c == 1 || c == 0; }
    /** JavaScript + on dynamic values. */
    public static Object add(Object a, Object b) {
        Object pa = a instanceof JsArrayLike || a instanceof JsObject ? str(a) : a;
        Object pb = b instanceof JsArrayLike || b instanceof JsObject ? str(b) : b;
        if (pa instanceof String || pb instanceof String) return str(pa) + str(pb);
        if (pa instanceof java.math.BigInteger && pb instanceof java.math.BigInteger) return ((java.math.BigInteger) pa).add((java.math.BigInteger) pb);
        if (pa instanceof java.math.BigInteger || pb instanceof java.math.BigInteger) throw new JsError("TypeError", "Cannot mix BigInt and other types, use explicit conversions");
        return toNum(pa) + toNum(pb);
    }
    public static double sub(Object a, Object b) { return toNum(a) - toNum(b); }
    public static double mul(Object a, Object b) { return toNum(a) * toNum(b); }
    public static double div(Object a, Object b) { return toNum(a) / toNum(b); }
    public static double mod(Object a, Object b) { return toNum(a) % toNum(b); }
    public static double mod(double a, double b) { return a % b; }
    /** JavaScript ** (Math.pow with its NaN rule for 1 ** Infinity). */
    public static double pow(double a, double b) { if (Double.isNaN(b)) return Double.NaN; if (Math.abs(a) == 1 && Double.isInfinite(b)) return Double.NaN; return Math.pow(a, b); }
    public static java.math.BigInteger pow(java.math.BigInteger a, java.math.BigInteger b) {
        if (b.signum() < 0) throw new JsError("RangeError", "Exponent must be non-negative");
        return a.pow(b.intValueExact());
    }
    public static int imul(long a, long b) { return (int) a * (int) b; }
    public static int imul(double a, double b) { return toInt32(a) * toInt32(b); }
    public static int clz32(double d) { return Integer.numberOfLeadingZeros(toInt32(d)); }
    public static int clz32(long v) { return Integer.numberOfLeadingZeros((int) v); }
    public static double fround(double d) { return (float) d; }
    public static double sign(double d) { return Double.isNaN(d) ? Double.NaN : d > 0 ? 1 : d < 0 ? -1 : d; }
    public static double trunc(double d) { return d < 0 ? Math.ceil(d) : Math.floor(d); }
    public static double round(double d) { if (Double.isNaN(d) || Double.isInfinite(d)) return d; return Math.floor(d + 0.5); }
    public static double max(double... v) { double r = Double.NEGATIVE_INFINITY; for (double x : v) { if (Double.isNaN(x)) return Double.NaN; if (x > r || (x == 0 && r == 0 && Double.doubleToRawLongBits(r) != 0)) r = x; } return r; }
    public static double min(double... v) { double r = Double.POSITIVE_INFINITY; for (double x : v) { if (Double.isNaN(x)) return Double.NaN; if (x < r || (x == 0 && r == 0 && Double.doubleToRawLongBits(x) != 0)) r = x; } return r; }
    public static double maxOf(Object arr) { JsArrayLike a = (JsArrayLike) arr; double[] v = new double[a.length()]; for (int i = 0; i < v.length; ++i) v[i] = toNum(a.getBoxed(i)); return max(v); }
    public static double minOf(Object arr) { JsArrayLike a = (JsArrayLike) arr; double[] v = new double[a.length()]; for (int i = 0; i < v.length; ++i) v[i] = toNum(a.getBoxed(i)); return min(v); }
    public static double log2(double d) { if (d > 0) { long bits = Double.doubleToRawLongBits(d); if ((bits & 0x000FFFFFFFFFFFFFL) == 0 && ((bits >>> 52) & 0x7FF) != 0) return ((bits >>> 52) & 0x7FF) - 1023; } return Math.log(d) / Math.log(2); }
    public static double cbrt(double d) { return Math.cbrt(d); }
    public static double hypot(double... v) { double s = 0; for (double x : v) s += x * x; return Math.sqrt(s); }
    public static boolean isInteger(Object o) { if (!(o instanceof Number) || o instanceof java.math.BigInteger) return false; double d = ((Number) o).doubleValue(); return !Double.isInfinite(d) && d == Math.floor(d); }
    public static boolean isInteger(double d) { return !Double.isInfinite(d) && !Double.isNaN(d) && d == Math.floor(d); }
    public static boolean isSafeInteger(double d) { return isInteger(d) && Math.abs(d) <= 9007199254740991.0; }
    public static boolean isFinite(Object o) { return o instanceof Number && !(o instanceof java.math.BigInteger) && !Double.isInfinite(((Number) o).doubleValue()) && !Double.isNaN(((Number) o).doubleValue()); }
    public static boolean isNaN(Object o) { return o instanceof Double && ((Double) o).isNaN() || o instanceof Float && ((Float) o).isNaN(); }
    public static double random() { return RANDOM.nextDouble(); }
    static final java.util.Random RANDOM = new java.util.Random(0x5EED);

    // ---------------------------------------------------------------- strings
    public static String str(Object o) {
        if (o == null) return "undefined";
        if (o instanceof String) return (String) o;
        if (o instanceof Double || o instanceof Float) return str(((Number) o).doubleValue());
        if (o instanceof Number) return o.toString();
        if (o instanceof Boolean) return o.toString();
        if (o instanceof JsError) { JsError e = (JsError) o; return e.value != null ? str(e.value) : e.name + ": " + e.getMessage(); }
        if (o instanceof Throwable) return "Error: " + ((Throwable) o).getMessage();
        if (o instanceof JsFn) return "function () { [native code] }";
        return o.toString();
    }
    public static String str(int v) { return Integer.toString(v); }
    public static String str(long v) { return Long.toString(v); }
    public static String str(boolean v) { return v ? "true" : "false"; }
    public static String str(String s) { return s == null ? "null" : s; }
    public static String strOrNull(Object o) { return o == null ? "null" : str(o); }
    /** JavaScript Number::toString(10). */
    public static String str(double d) {
        if (Double.isNaN(d)) return "NaN";
        if (Double.isInfinite(d)) return d > 0 ? "Infinity" : "-Infinity";
        if (d == 0) return "0";
        if (d == Math.rint(d) && Math.abs(d) < 1e21) {
            if (Math.abs(d) < 9.007199254740992E15) return Long.toString((long) d);
            return new java.math.BigDecimal(d).toBigInteger().toString();
        }
        String sign = d < 0 ? "-" : "";
        java.math.BigDecimal bd = new java.math.BigDecimal(Double.toString(Math.abs(d))).stripTrailingZeros();
        String digits = bd.unscaledValue().toString();
        int k = digits.length();
        int n = k - bd.scale();
        StringBuilder sb = new StringBuilder(sign);
        if (k <= n && n <= 21) { sb.append(digits); for (int i = 0; i < n - k; ++i) sb.append('0'); }
        else if (0 < n && n <= 21) { sb.append(digits, 0, n).append('.').append(digits.substring(n)); }
        else if (-6 < n && n <= 0) { sb.append("0."); for (int i = 0; i < -n; ++i) sb.append('0'); sb.append(digits); }
        else {
            int e = n - 1;
            sb.append(digits.charAt(0));
            if (k > 1) sb.append('.').append(digits.substring(1));
            sb.append('e').append(e >= 0 ? "+" : "-").append(Math.abs(e));
        }
        return sb.toString();
    }
    /** Number.prototype.toString(radix). */
    public static String toRadix(double d, int radix) {
        if (radix == 10) return str(d);
        if (d == Math.rint(d) && !Double.isInfinite(d) && Math.abs(d) < 9.007199254740992E15) return Long.toString((long) d, radix);
        if (Double.isNaN(d)) return "NaN";
        if (Double.isInfinite(d)) return d > 0 ? "Infinity" : "-Infinity";
        StringBuilder sb = new StringBuilder();
        if (d < 0) { sb.append('-'); d = -d; }
        double ip = Math.floor(d), fp = d - ip;
        sb.append(new java.math.BigDecimal(ip).toBigInteger().toString(radix));
        if (fp > 0) { sb.append('.'); for (int i = 0; i < 52 && fp > 0; ++i) { fp *= radix; int digit = (int) Math.floor(fp); sb.append(Character.forDigit(digit, radix)); fp -= digit; } }
        return sb.toString();
    }
    public static String toRadix(long v, int radix) { return Long.toString(v, radix); }
    public static String toRadix(int v, int radix) { return Integer.toString(v, radix); }
    public static String toRadix(java.math.BigInteger v, int radix) { return v.toString(radix); }
    public static String toRadix(Object o, int radix) {
        if (o instanceof java.math.BigInteger) return ((java.math.BigInteger) o).toString(radix);
        if (o instanceof Number) return toRadix(((Number) o).doubleValue(), radix);
        return str(o);
    }
    public static String toFixed(double d, int digits) {
        if (Double.isNaN(d)) return "NaN";
        if (Math.abs(d) >= 1e21) return str(d);
        return new java.math.BigDecimal(d).setScale(digits, java.math.RoundingMode.HALF_UP).toPlainString();
    }
    public static String propKey(Object k) {
        if (k instanceof String) return (String) k;
        if (k instanceof Double || k instanceof Float) return str(((Number) k).doubleValue());
        return str(k);
    }
    public static Object mapKey(Object k) {
        if (k instanceof Integer || k instanceof Long || k instanceof Short || k instanceof Byte) return ((Number) k).doubleValue();
        if (k instanceof Float) return ((Number) k).doubleValue();
        if (k instanceof Double && ((Double) k) == 0) return 0.0;
        return k;
    }
    public static Object unMapKey(Object k) { return k; }
    public static String charAt(String s, double i) { return i < 0 || i >= s.length() || i != Math.floor(i) ? "" : String.valueOf(s.charAt((int) i)); }
    public static String charAt(String s, long i) { return i < 0 || i >= s.length() ? "" : String.valueOf(s.charAt((int) i)); }
    /** charCodeAt: NaN out of range, so the result is a double. */
    public static double charCodeAt(String s, double i) { return i < 0 || i >= s.length() ? Double.NaN : s.charAt((int) i); }
    public static int charCodeAtInt(String s, long i) { return i < 0 || i >= s.length() ? 0 : s.charAt((int) i); }
    public static int codePointAt(String s, long i) { return s.codePointAt((int) i); }
    public static String fromCharCode(double... codes) { StringBuilder sb = new StringBuilder(codes.length); for (double c : codes) sb.append((char) (toInt32(c) & 0xFFFF)); return sb.toString(); }
    public static String fromCharCode(long c) { return String.valueOf((char) (c & 0xFFFF)); }
    public static String fromCharCodes(Object arr) { JsArrayLike a = (JsArrayLike) arr; StringBuilder sb = new StringBuilder(a.length()); for (int i = 0; i < a.length(); ++i) sb.append((char) (toInt32(a.getBoxed(i)) & 0xFFFF)); return sb.toString(); }
    public static String fromCodePoint(double... codes) { StringBuilder sb = new StringBuilder(); for (double c : codes) sb.appendCodePoint((int) c); return sb.toString(); }
    public static String substring(String s, double start) { return substring(s, start, s.length()); }
    public static String substring(String s, double start, double end) {
        int a = (int) Math.max(0, Math.min(Double.isNaN(start) ? 0 : trunc(start), s.length()));
        int b = (int) Math.max(0, Math.min(Double.isNaN(end) ? 0 : trunc(end), s.length()));
        return a <= b ? s.substring(a, b) : s.substring(b, a);
    }
    public static String slice(String s, double start) { return slice(s, start, s.length()); }
    public static String slice(String s, double start, double end) { int a = relIndex(start, s.length()), b = relIndex(end, s.length()); return a < b ? s.substring(a, b) : ""; }
    public static String substr(String s, double start) { return substr(s, start, Double.POSITIVE_INFINITY); }
    public static String substr(String s, double start, double length) {
        int a = relIndex(start, s.length());
        double l = Double.isNaN(length) ? 0 : trunc(length);
        int b = (int) Math.min(s.length(), Math.max(a, a + Math.min(l, s.length())));
        return l <= 0 ? "" : s.substring(a, b);
    }
    public static int indexOf(String s, String v) { return s.indexOf(v); }
    public static int indexOf(String s, String v, double from) { return s.indexOf(v, (int) Math.max(0, Math.min(from, s.length()))); }
    public static int lastIndexOf(String s, String v) { return s.lastIndexOf(v); }
    public static String repeat(String s, double n) { if (n < 0 || Double.isInfinite(n)) throw new JsError("RangeError", "Invalid count value"); return s.repeat((int) n); }
    public static String padStart(String s, double len, String fill) { int n = (int) len; if (s.length() >= n || fill.isEmpty()) return s; StringBuilder sb = new StringBuilder(); while (sb.length() < n - s.length()) sb.append(fill); return sb.substring(0, n - s.length()) + s; }
    public static String padStart(String s, double len) { return padStart(s, len, " "); }
    public static String padEnd(String s, double len, String fill) { int n = (int) len; if (s.length() >= n || fill.isEmpty()) return s; StringBuilder sb = new StringBuilder(s); while (sb.length() < n) sb.append(fill); return sb.substring(0, n); }
    public static String padEnd(String s, double len) { return padEnd(s, len, " "); }
    public static String trim(String s) { int a = 0, b = s.length(); while (a < b && isJsSpace(s.charAt(a))) a++; while (b > a && isJsSpace(s.charAt(b - 1))) b--; return s.substring(a, b); }
    public static String trimStart(String s) { int a = 0; while (a < s.length() && isJsSpace(s.charAt(a))) a++; return s.substring(a); }
    public static String trimEnd(String s) { int b = s.length(); while (b > 0 && isJsSpace(s.charAt(b - 1))) b--; return s.substring(0, b); }
    static boolean isJsSpace(char c) { return Character.isWhitespace(c) || Character.isSpaceChar(c) || c == '﻿'; }
    public static String toUpperCase(String s) { return s.toUpperCase(java.util.Locale.ROOT); }
    public static String toLowerCase(String s) { return s.toLowerCase(java.util.Locale.ROOT); }
    public static String replace(String s, String search, String replacement) { int i = s.indexOf(search); return i < 0 ? s : s.substring(0, i) + replacement + s.substring(i + search.length()); }
    public static String replaceAll(String s, String search, String replacement) { return s.replace(search, replacement); }
    public static String replace(String s, JsRegExp re, String replacement) { return re.replace(s, replacement); }
    public static String replaceAll(String s, JsRegExp re, String replacement) { return re.replace(s, replacement); }
    public static String replace(String s, JsRegExp re, JsFn fn) { return re.replace(s, fn); }
    public static String replace(String s, String search, JsFn fn) { int i = s.indexOf(search); return i < 0 ? s : s.substring(0, i) + str(fn.call(search, i, s)) + s.substring(i + search.length()); }
    public static JsArray<String> split(String s) { return JsArray.of(s); }
    public static JsArray<String> split(String s, String sep) {
        JsArray<String> r = new JsArray<>();
        if (sep.isEmpty()) { for (int i = 0; i < s.length(); ++i) r.push(String.valueOf(s.charAt(i))); return r; }
        int from = 0, i;
        while ((i = s.indexOf(sep, from)) >= 0) { r.push(s.substring(from, i)); from = i + sep.length(); }
        r.push(s.substring(from));
        return r;
    }
    public static JsArray<String> split(String s, String sep, double limit) { JsArray<String> r = split(s, sep); if (r.length() > limit) r.setLength((int) limit); return r; }
    public static JsArray<String> split(String s, JsRegExp re) { return re.split(s); }
    public static boolean includes(String s, String v) { return s.contains(v); }
    public static boolean startsWith(String s, String v) { return s.startsWith(v); }
    public static boolean endsWith(String s, String v) { return s.endsWith(v); }
    public static String concat(String s, Object... others) { StringBuilder sb = new StringBuilder(s); for (Object o : others) sb.append(str(o)); return sb.toString(); }
    public static double parseInt(String s) { return parseInt(s, 0); }
    public static double parseInt(Object s, double radixD) {
        String t = trim(str(s));
        int radix = toInt32(radixD);
        boolean neg = false;
        if (t.startsWith("-")) { neg = true; t = t.substring(1); } else if (t.startsWith("+")) t = t.substring(1);
        if (radix == 0) radix = 10;
        if ((radix == 16 || toInt32(radixD) == 0) && (t.startsWith("0x") || t.startsWith("0X"))) { t = t.substring(2); radix = 16; }
        if (radix < 2 || radix > 36) return Double.NaN;
        int end = 0;
        while (end < t.length() && Character.digit(t.charAt(end), radix) >= 0) end++;
        if (end == 0) return Double.NaN;
        double v = new java.math.BigInteger(t.substring(0, end), radix).doubleValue();
        return neg ? -v : v;
    }
    public static double parseFloat(Object s) {
        String t = trim(str(s));
        java.util.regex.Matcher m = java.util.regex.Pattern.compile("^[+-]?(Infinity|\\d+\\.?\\d*([eE][+-]?\\d+)?|\\.\\d+([eE][+-]?\\d+)?)").matcher(t);
        if (!m.find()) return Double.NaN;
        String g = m.group();
        if (g.endsWith("Infinity")) return g.startsWith("-") ? Double.NEGATIVE_INFINITY : Double.POSITIVE_INFINITY;
        return Double.parseDouble(g);
    }
    public static String typeOf(Object o) {
        if (o == null) return "undefined";
        if (o instanceof String) return "string";
        if (o instanceof java.math.BigInteger) return "bigint";
        if (o instanceof Number) return "number";
        if (o instanceof Boolean) return "boolean";
        if (o instanceof JsFn) return "function";
        return "object";
    }
    public static boolean isArray(Object o) { return o instanceof JsArrayLike && !((JsArrayLike) o).isFixed(); }
    public static boolean isTypedAny(Object o) { return o instanceof JsArrayLike && ((JsArrayLike) o).isFixed(); }
    /** A name JavaScript resolves at run time; none is defined here. */
    public static Object global(String name) {
        switch (name) { case "undefined": return null; case "NaN": return Double.NaN; case "Infinity": return Double.POSITIVE_INFINITY; }
        throw new JsError("ReferenceError", name + " is not defined");
    }
    public static Object callGlobal(String name, Object... args) { Object f = global(name); return toFn(f).call(args); }
    public static Object construct(String name, Object... args) { throw new JsError("ReferenceError", name + " is not defined"); }
    public static Object constructValue(Object ctor, Object... args) {
        if (ctor instanceof Class) {
            for (java.lang.reflect.Constructor<?> c : ((Class<?>) ctor).getDeclaredConstructors()) {
                if (c.getParameterCount() != args.length) continue;
                Class<?>[] ts = c.getParameterTypes(); Object[] a = new Object[args.length];
                for (int i = 0; i < args.length; ++i) a[i] = coerce(args[i], ts[i]);
                c.setAccessible(true);
                try { return c.newInstance(a); }
                catch (java.lang.reflect.InvocationTargetException e) { throw unwrap(e); }
                catch (ReflectiveOperationException e) { throw new JsError(e.toString()); }
            }
        }
        throw new JsError("TypeError", str(ctor) + " is not a constructor");
    }
    /**
     * The exports of another algorithm module (a bundled unit): its classes, as constructors, and its
     * module-level values. Loading the unit registers its algorithms, as require() does.
     */
    public static Object module(String name) {
        for (String cn : new String[] { name + "_depGenerated", name + "Generated" }) {
            Class<?> u;
            try { u = Class.forName(cn); } catch (ClassNotFoundException e) { continue; }
            JsObject o = new JsObject();
            for (Class<?> c : u.getDeclaredClasses()) o.put(c.getSimpleName(), c);
            try {
                for (java.lang.reflect.Field f : u.getDeclaredFields())
                    if (java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); o.put(f.getName(), f.get(null)); }
            } catch (IllegalAccessException e) { throw new JsError(e.toString()); }
            return o;
        }
        return null;
    }
    public static Object unsupported(String what) { throw new JsError("SyntaxError", what + " cannot run on the JVM"); }
    public static Object typeError(String message) { throw new JsError("TypeError", message); }
    public static Object optIndex(Object o, Object key) { return o == null ? null : index(o, key); }
    /** A frozen framework enumeration given another value reads it as undefined. */
    public static <E> E enumOf(Object o, Class<E> type) { return type.isInstance(o) ? type.cast(o) : null; }
    public static JsArray<KeySize> toKeySizes(Object o) { if (o == null) return null; JsArrayLike s = (JsArrayLike) o; JsArray<KeySize> r = new JsArray<>(s.length()); for (int i = 0; i < s.length(); ++i) r.set(i, toKeySize(s.getBoxed(i))); return r; }
    public static JsArray<LinkItem> toLinkItems(Object o) { if (o == null) return null; JsArrayLike s = (JsArrayLike) o; JsArray<LinkItem> r = new JsArray<>(s.length()); for (int i = 0; i < s.length(); ++i) r.set(i, toLinkItem(s.getBoxed(i))); return r; }
    public static JsArray<Vulnerability> toVulnerabilitys(Object o) { if (o == null) return null; JsArrayLike s = (JsArrayLike) o; JsArray<Vulnerability> r = new JsArray<>(s.length()); for (int i = 0; i < s.length(); ++i) r.set(i, toVulnerability(s.getBoxed(i))); return r; }
    public static JsArray<TestCase> toTestCases(Object o) { return toTests(o); }
    /** Metadata of another shape than the framework expects (a string vulnerability, a number key size). */
    public static KeySize toKeySize(Object o) {
        if (o == null || o instanceof KeySize) return (KeySize) o;
        if (o instanceof JsObject) { JsObject j = (JsObject) o; return new KeySize(toInt(j.get("minSize")), toInt(j.get("maxSize")), j.get("stepSize") == null ? 1 : toInt(j.get("stepSize"))); }
        int n = toInt(o); return new KeySize(n, n, 0);
    }
    public static LinkItem toLinkItem(Object o) {
        if (o == null || o instanceof LinkItem) return (LinkItem) o;
        if (o instanceof JsObject) { JsObject j = (JsObject) o; return new LinkItem(j.get("text") == null ? null : str(j.get("text")), j.get("uri") == null ? null : str(j.get("uri"))); }
        return new LinkItem(str(o), null);
    }
    public static Vulnerability toVulnerability(Object o) {
        if (o == null || o instanceof Vulnerability) return (Vulnerability) o;
        if (o instanceof JsObject) { JsObject j = (JsObject) o; return new Vulnerability(j.get("type") == null ? (j.get("name") == null ? "" : str(j.get("name"))) : str(j.get("type")), j.get("description") == null ? "" : str(j.get("description")), j.get("mitigation") == null ? "" : str(j.get("mitigation")), j.get("uri") == null ? "" : str(j.get("uri"))); }
        return new Vulnerability(str(o));
    }

    // ---------------------------------------------------------------- arrays and values
    @SuppressWarnings("unchecked") public static <T> T cast(Object o) { return (T) o; }
    public static Object arg(Object[] args, int i) { return i < args.length ? args[i] : null; }
    public static U8Array toU8(Object o) { return o == null || o instanceof U8Array ? (U8Array) o : U8Array.from(o); }
    public static I8Array toI8(Object o) { return o == null || o instanceof I8Array ? (I8Array) o : I8Array.from(o); }
    public static U16Array toU16(Object o) { return o == null || o instanceof U16Array ? (U16Array) o : U16Array.from(o); }
    public static I16Array toI16(Object o) { return o == null || o instanceof I16Array ? (I16Array) o : I16Array.from(o); }
    public static U32Array toU32(Object o) { return o == null || o instanceof U32Array ? (U32Array) o : U32Array.from(o); }
    public static I32Array toI32(Object o) { return o == null || o instanceof I32Array ? (I32Array) o : I32Array.from(o); }
    public static I64Array toI64(Object o) { return o == null || o instanceof I64Array ? (I64Array) o : I64Array.from(o); }
    public static F64Array toF64(Object o) { return o == null || o instanceof F64Array ? (F64Array) o : F64Array.from(o); }
    public static F32Array toF32(Object o) { return o == null || o instanceof F32Array ? (F32Array) o : F32Array.from(o); }
    public static BoolArray toBools(Object o) { return o == null || o instanceof BoolArray ? (BoolArray) o : BoolArray.from(o); }
    @SuppressWarnings("unchecked") public static <T> JsArray<T> toArr(Object o) { return o == null || o instanceof JsArray ? (JsArray<T>) o : JsArray.from(o); }
    public static JsObject toObj(Object o) { if (o == null || o instanceof JsObject) return (JsObject) o; if (o instanceof JsDynamic) return ((JsDynamic) o).props(); throw new JsError("TypeError", "not a plain object: " + o.getClass().getSimpleName()); }
    public static JsFn toFn(Object o) { if (o == null || o instanceof JsFn) return (JsFn) o; throw new JsError("TypeError", str(o) + " is not a function"); }
    public static Boolean boxBool(Object o) { return o == null ? null : truthy(o); }
    public static Integer boxInt(Object o) { return o == null ? null : toInt(o); }
    public static Long boxLong(Object o) { return o == null ? null : toLong(o); }
    public static Double boxNum(Object o) { return o == null ? null : toNum(o); }
    public static int length(Object o) {
        if (o instanceof JsArrayLike) return ((JsArrayLike) o).length();
        if (o instanceof String) return ((String) o).length();
        if (o == null) throw new JsError("TypeError", "Cannot read properties of undefined (reading 'length')");
        return toInt(getProp(o, "length"));
    }
    /** Spread of a string or array into an array of its elements. */
    public static JsArrayLike spread(Object o) {
        if (o instanceof JsObject && ((JsObject) o).has("length")) return new JsArray<Object>(toInt(((JsObject) o).get("length"))); // Array.from({ length: n })
        return o instanceof String ? JsArray.from(o) : o instanceof JsSet ? JsArray.from(o) : o instanceof JsMap ? ((JsMap) o).entries() : (JsArrayLike) o;
    }
    public static JsArray<java.math.BigInteger> toBigs(Object o) {
        if (o == null) return null;
        JsArrayLike s = (JsArrayLike) o; JsArray<java.math.BigInteger> r = new JsArray<>(s.length());
        for (int i = 0; i < s.length(); ++i) { Object v = s.getBoxed(i); r.set(i, v == null ? null : toBig(v)); }
        return r;
    }
    public static Object index(Object o, Object key) {
        if (o instanceof JsArrayLike && key instanceof Number) { double d = ((Number) key).doubleValue(); return d == Math.floor(d) ? ((JsArrayLike) o).getBoxed((int) d) : null; }
        if (o instanceof String && key instanceof Number) return charAt((String) o, ((Number) key).doubleValue());
        if (o instanceof JsMap) return getProp(o, propKey(key));
        return getProp(o, propKey(key));
    }
    public static Object setIndex(Object o, Object key, Object v) {
        if (o instanceof JsArrayLike && key instanceof Number) { ((JsArrayLike) o).setBoxed(toInt(key), v); return v; }
        return setProp(o, propKey(key), v);
    }

    // ---------------------------------------------------------------- dynamic members (reflection)
    /** Classes whose members JavaScript code can reach: the generated ones and the runtime's, never java.*. */
    static boolean reflectable(Class<?> k) { return k != null && k != Object.class && !k.getName().startsWith("java."); }
    /** A member by its JavaScript name, or the mangled name the code generator gave it (a Java keyword, finalize, ...). */
    static java.lang.reflect.Field findField(Class<?> c, String name) {
        java.lang.reflect.Field f = findFieldExact(c, name);
        return f != null ? f : findFieldExact(c, name + "_");
    }
    static java.lang.reflect.Field findFieldExact(Class<?> c, String name) {
        for (Class<?> k = c; reflectable(k); k = k.getSuperclass())
            for (java.lang.reflect.Field f : k.getDeclaredFields())
                if (f.getName().equals(name) && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); return f; }
        return null;
    }
    static java.lang.reflect.Method findMethod(Class<?> c, String name, int arity) {
        java.lang.reflect.Method m = findMethodExact(c, name, arity);
        return m != null ? m : findMethodExact(c, name + "_", arity);
    }
    static java.lang.reflect.Method findMethodExact(Class<?> c, String name, int arity) {
        java.lang.reflect.Method best = null;
        for (Class<?> k = c; reflectable(k); k = k.getSuperclass())
            for (java.lang.reflect.Method m : k.getDeclaredMethods())
                if (m.getName().equals(name) && !m.isBridge() && !java.lang.reflect.Modifier.isStatic(m.getModifiers())) {
                    if (m.getParameterCount() == arity) { m.setAccessible(true); return m; }
                    if (best == null || Math.abs(m.getParameterCount() - arity) < Math.abs(best.getParameterCount() - arity)) best = m;
                }
        if (best != null) best.setAccessible(true);
        return best;
    }
    public static boolean hasMember(Object o, String name) {
        if (o == null) return false;
        if (o instanceof JsObject) return ((JsObject) o).has(name);
        if (o instanceof JsDynamic && ((JsDynamic) o).props().has(name)) return true;
        if (findField(o.getClass(), name) != null) return true;
        if (findMethod(o.getClass(), "get_" + name, 0) != null || findMethod(o.getClass(), "set_" + name, 1) != null) return true;
        return findMethod(o.getClass(), name, -1) != null;
    }
    public static Object getProp(Object o, String name) {
        if (o == null) throw new JsError("TypeError", "Cannot read properties of undefined (reading '" + name + "')");
        if (o instanceof JsObject) return ((JsObject) o).get(name);
        if (name.equals("length")) { if (o instanceof JsArrayLike) return ((JsArrayLike) o).length(); if (o instanceof String) return ((String) o).length(); }
        if (o instanceof JsError && name.equals("message")) return ((JsError) o).getMessage();
        if (o instanceof JsError && name.equals("name")) return ((JsError) o).name;
        if (o instanceof Throwable && name.equals("message")) return ((Throwable) o).getMessage();
        try {
            java.lang.reflect.Method g = findMethod(o.getClass(), "get_" + name, 0);
            if (g != null && g.getParameterCount() == 0) return g.invoke(o);
            java.lang.reflect.Field f = findField(o.getClass(), name);
            if (f != null) return f.get(o);
        } catch (java.lang.reflect.InvocationTargetException e) { throw unwrap(e); }
        catch (IllegalAccessException e) { throw new JsError(e.toString()); }
        if (o instanceof JsDynamic) return ((JsDynamic) o).props().get(name);
        java.lang.reflect.Method m = findMethod(o.getClass(), name, -1);
        if (m != null) return (JsFn) args -> invoke(o, name, args);
        return null;
    }
    public static Object setProp(Object o, String name, Object v) {
        if (o == null) throw new JsError("TypeError", "Cannot set properties of undefined (setting '" + name + "')");
        if (o instanceof JsObject) return ((JsObject) o).put(name, v);
        if (name.equals("length") && o instanceof JsArrayLike) { ((JsArrayLike) o).setLength(toInt(v)); return v; }
        try {
            java.lang.reflect.Method s = findMethod(o.getClass(), "set_" + name, 1);
            if (s != null && s.getParameterCount() == 1) { s.invoke(o, coerce(v, s.getParameterTypes()[0])); return v; }
            java.lang.reflect.Field f = findField(o.getClass(), name);
            if (f != null) { f.set(o, coerce(v, f.getType())); return v; }
        } catch (java.lang.reflect.InvocationTargetException e) { throw unwrap(e); }
        catch (IllegalAccessException e) { throw new JsError(e.toString()); }
        if (o instanceof JsDynamic) return ((JsDynamic) o).props().put(name, v);
        throw new JsError("TypeError", "Cannot add property " + name + " to " + o.getClass().getSimpleName());
    }
    public static Object invoke(Object o, String name, Object... args) {
        if (o == null) throw new JsError("TypeError", "Cannot read properties of undefined (reading '" + name + "')");
        if (o instanceof JsObject) { Object f = ((JsObject) o).get(name); if (f instanceof JsFn) return ((JsFn) f).call(args); throw new JsError("TypeError", name + " is not a function"); }
        if (o instanceof JsDynamic && ((JsDynamic) o).props().get(name) instanceof JsFn) return ((JsFn) ((JsDynamic) o).props().get(name)).call(args);
        if (o instanceof String || o instanceof Number || o instanceof Boolean || o instanceof JsArrayLike) return builtin(o, name, args);
        java.lang.reflect.Method m = findMethod(o.getClass(), name, args.length);
        if (m == null) {
            Object f = getProp(o, name);
            if (f instanceof JsFn) return ((JsFn) f).call(args);
            throw new JsError("TypeError", o.getClass().getSimpleName() + "." + name + " is not a function");
        }
        Class<?>[] types = m.getParameterTypes();
        Object[] actual = new Object[types.length];
        for (int i = 0; i < types.length; ++i) {
            if (m.isVarArgs() && i == types.length - 1) {
                Class<?> ct = types[i].getComponentType();
                int n = Math.max(0, args.length - i);
                Object rest = java.lang.reflect.Array.newInstance(ct, n);
                for (int j = 0; j < n; ++j) java.lang.reflect.Array.set(rest, j, coerce(args[i + j], ct));
                actual[i] = rest;
            } else actual[i] = coerce(i < args.length ? args[i] : null, types[i]);
        }
        try { return m.invoke(o, actual); }
        catch (java.lang.reflect.InvocationTargetException e) { throw unwrap(e); }
        catch (IllegalAccessException e) { throw new JsError(e.toString()); }
    }
    static Object a(Object[] args, int i) { return i < args.length ? args[i] : null; }
    static double d(Object[] args, int i, double dflt) { return i < args.length && args[i] != null ? toNum(args[i]) : dflt; }
    /** A built-in method of a string, number or array called on a value whose type was not known statically. */
    static Object builtin(Object o, String name, Object[] args) {
        if (o instanceof String) {
            String s = (String) o;
            switch (name) {
                case "split": return args.length == 0 || args[0] == null ? split(s) : args[0] instanceof JsRegExp ? split(s, (JsRegExp) args[0]) : args.length > 1 ? split(s, str(args[0]), toNum(args[1])) : split(s, str(args[0]));
                case "replace": return args[0] instanceof JsRegExp ? (args[1] instanceof JsFn ? replace(s, (JsRegExp) args[0], (JsFn) args[1]) : replace(s, (JsRegExp) args[0], str(args[1]))) : (args[1] instanceof JsFn ? replace(s, str(args[0]), (JsFn) args[1]) : replace(s, str(args[0]), str(args[1])));
                case "replaceAll": return args[0] instanceof JsRegExp ? replace(s, (JsRegExp) args[0], str(args[1])) : replaceAll(s, str(args[0]), str(args[1]));
                case "charCodeAt": return charCodeAt(s, d(args, 0, 0));
                case "codePointAt": return s.codePointAt((int) d(args, 0, 0));
                case "charAt": return charAt(s, d(args, 0, 0));
                case "substring": return args.length > 1 ? substring(s, d(args, 0, 0), d(args, 1, s.length())) : substring(s, d(args, 0, 0));
                case "substr": return args.length > 1 ? substr(s, d(args, 0, 0), d(args, 1, s.length())) : substr(s, d(args, 0, 0));
                case "slice": return args.length > 1 ? slice(s, d(args, 0, 0), d(args, 1, s.length())) : slice(s, d(args, 0, 0));
                case "indexOf": return args.length > 1 ? indexOf(s, str(args[0]), d(args, 1, 0)) : indexOf(s, str(args[0]));
                case "lastIndexOf": return lastIndexOf(s, str(args[0]));
                case "includes": return s.contains(str(args[0]));
                case "startsWith": return s.startsWith(str(args[0]));
                case "endsWith": return s.endsWith(str(args[0]));
                case "toUpperCase": return toUpperCase(s);
                case "toLowerCase": return toLowerCase(s);
                case "trim": return trim(s);
                case "trimStart": return trimStart(s);
                case "trimEnd": return trimEnd(s);
                case "padStart": return args.length > 1 ? padStart(s, d(args, 0, 0), str(args[1])) : padStart(s, d(args, 0, 0));
                case "padEnd": return args.length > 1 ? padEnd(s, d(args, 0, 0), str(args[1])) : padEnd(s, d(args, 0, 0));
                case "repeat": return repeat(s, d(args, 0, 0));
                case "concat": return concat(s, args);
                case "match": return ((JsRegExp) args[0]).match(s);
                case "toString": case "valueOf": return s;
                case "localeCompare": return s.compareTo(str(args[0]));
            }
        } else if (o instanceof Number) {
            switch (name) {
                case "toString": return args.length == 0 || args[0] == null ? str(o) : toRadix(o, toInt(args[0]));
                case "toFixed": return toFixed(toNum(o), args.length == 0 ? 0 : toInt(args[0]));
                case "valueOf": return o;
            }
        } else if (o instanceof Boolean) {
            if (name.equals("toString")) return str(o);
            if (name.equals("valueOf")) return o;
        } else {
            JsArrayLike arr = (JsArrayLike) o;
            switch (name) {
                case "push": { int n = arr.length(); for (Object v : args) n = arr.pushBoxed(v); return n; }
                case "join": return args.length == 0 || args[0] == null ? arr.join() : arr.join(str(args[0]));
                case "toString": return arr.join();
                case "indexOf": return arr.indexOfBoxed(a(args, 0));
                case "includes": return includesDyn(arr, a(args, 0));
                case "forEach": arr.forEach(toFn(a(args, 0))); return null;
                case "some": return arr.some(toFn(a(args, 0)));
                case "every": return arr.every(toFn(a(args, 0)));
                case "find": return arr.find(toFn(a(args, 0)));
                case "findIndex": return arr.findIndex(toFn(a(args, 0)));
                case "reduce": return args.length > 1 ? arr.reduce(toFn(a(args, 0)), args[1]) : arr.reduce(toFn(a(args, 0)));
                case "map": return arr.mapToObjects(toFn(a(args, 0)));
            }
        }
        // slice, concat, filter, reverse, fill, sort, pop, shift, ... : the array class's own method
        java.lang.reflect.Method m = null;
        for (java.lang.reflect.Method c : o.getClass().getMethods())
            if (c.getName().equals(name) && !java.lang.reflect.Modifier.isStatic(c.getModifiers()) && (c.getParameterCount() == args.length || (c.isVarArgs() && args.length >= c.getParameterCount() - 1)))
                if (m == null || c.getParameterTypes().length > 0 && c.getParameterTypes()[0] == double.class) m = c;
        if (m == null || o instanceof String || o instanceof Number || o instanceof Boolean)
            throw new JsError("TypeError", typeOf(o) + "." + name + " is not a function");
        Class<?>[] types = m.getParameterTypes();
        Object[] actual = new Object[types.length];
        for (int i = 0; i < types.length; ++i) {
            if (m.isVarArgs() && i == types.length - 1) {
                Class<?> ct = types[i].getComponentType(); int n = Math.max(0, args.length - i);
                Object rest = java.lang.reflect.Array.newInstance(ct, n);
                for (int j = 0; j < n; ++j) java.lang.reflect.Array.set(rest, j, coerce(args[i + j], ct));
                actual[i] = rest;
            } else actual[i] = coerce(i < args.length ? args[i] : null, types[i]);
        }
        try { return m.invoke(o, actual); }
        catch (java.lang.reflect.InvocationTargetException e) { throw unwrap(e); }
        catch (IllegalAccessException e) { throw new JsError(e.toString()); }
    }

    public static RuntimeException unwrap(java.lang.reflect.InvocationTargetException e) {
        Throwable t = e.getCause();
        if (t instanceof RuntimeException) return (RuntimeException) t;
        if (t instanceof Error) throw (Error) t;
        return new JsError(String.valueOf(t));
    }
    /** A dynamic value converted to a Java parameter or field type. */
    public static Object coerce(Object v, Class<?> t) {
        if (t == Object.class) return v;
        if (t == int.class) return toInt(v);
        if (t == long.class) return toLong(v);
        if (t == double.class) return toNum(v);
        if (t == boolean.class) return truthy(v);
        if (v == null) return null;
        if (t.isInstance(v)) return v;
        if (t == Integer.class) return toInt(v);
        if (t == Long.class) return toLong(v);
        if (t == Double.class) return toNum(v);
        if (t == Boolean.class) return truthy(v);
        if (t == String.class) return str(v);
        if (t == java.math.BigInteger.class) return toBig(v);
        if (t == U8Array.class) return toU8(v);
        if (t == I8Array.class) return toI8(v);
        if (t == U16Array.class) return toU16(v);
        if (t == I16Array.class) return toI16(v);
        if (t == U32Array.class) return toU32(v);
        if (t == I32Array.class) return toI32(v);
        if (t == I64Array.class) return toI64(v);
        if (t == F64Array.class) return toF64(v);
        if (t == F32Array.class) return toF32(v);
        if (t == BoolArray.class) return toBools(v);
        if (t == JsArray.class) return toArr(v);
        if (t == TestCase.class && v instanceof JsObject) return TestCase.fromObject((JsObject) v);
        if ((v instanceof JsObject || v instanceof JsDynamic) && JsDynamic.class.isAssignableFrom(t)) return structural(v, t);
        return v;
    }
    /**
     * JavaScript objects are typed by shape: a plain object, or an object of a class from another
     * unit, used where a local class is declared becomes an instance of it holding the same properties.
     */
    /** A value used as a local class: the object itself, else (JavaScript types by shape) a copy of its properties. */
    @SuppressWarnings("unchecked") public static <T> T as(Object v, Class<T> t) {
        if (v == null || t.isInstance(v)) return (T) v;
        Object r = coerce(v, t);
        return (T) (t.isInstance(r) ? r : v);
    }
    static Object structural(Object v, Class<?> t) {
        if (t.isInterface() || java.lang.reflect.Modifier.isAbstract(t.getModifiers())) return v;
        Object r;
        try {
            java.lang.reflect.Constructor<?> c = null;
            try { c = t.getDeclaredConstructor(); } catch (NoSuchMethodException e) { c = null; }
            if (c != null) { c.setAccessible(true); r = c.newInstance(); }
            else {
                // no constructor without arguments: allocate it bare (every property is copied below)
                Class<?> u = Class.forName("sun.misc.Unsafe");
                java.lang.reflect.Field f = u.getDeclaredField("theUnsafe");
                f.setAccessible(true);
                r = u.getMethod("allocateInstance", Class.class).invoke(f.get(null), t);
            }
        } catch (java.lang.reflect.InvocationTargetException e) { throw unwrap(e); }
        catch (ReflectiveOperationException e) { return v; }
        if (v instanceof JsObject) {
            JsArray<String> keys = ((JsObject) v).keys();
            for (int i = 0; i < keys.length(); ++i) setProp(r, keys.get(i), ((JsObject) v).get(keys.get(i)));
            return r;
        }
        try {
            for (Class<?> k = v.getClass(); k != null && k != Object.class; k = k.getSuperclass())
                for (java.lang.reflect.Field f : k.getDeclaredFields()) {
                    if (java.lang.reflect.Modifier.isStatic(f.getModifiers()) || f.getName().endsWith("__") || f.isSynthetic()) continue;
                    f.setAccessible(true);
                    java.lang.reflect.Field g = findField(t, f.getName());
                    if (g != null) { g.setAccessible(true); g.set(r, coerce(f.get(v), g.getType())); }
                    else if (r instanceof JsDynamic) ((JsDynamic) r).props().put(f.getName(), f.get(v));
                }
        } catch (IllegalAccessException e) { throw new JsError(e.toString()); }
        JsObject extra = ((JsDynamic) v).props();
        JsArray<String> keys = extra.keys();
        for (int i = 0; i < keys.length(); ++i) setProp(r, keys.get(i), extra.get(keys.get(i)));
        return r;
    }
    /** new Error(message) and friends. */
    public static JsError error(String name, Object message) { return new JsError(name, message == null ? "" : str(message)); }
    public static String message(Throwable e) { return e instanceof JsError ? e.getMessage() : String.valueOf(e.getMessage()); }
    public static void log(Object... args) { StringBuilder sb = new StringBuilder(); for (Object a : args) { if (sb.length() > 0) sb.append(' '); sb.append(str(a)); } System.err.println(sb); }
    public static long now() { return System.currentTimeMillis(); }
    public static double nowMs() { return System.nanoTime() / 1e6; }

    // ---------------------------------------------------------------- expression helpers
    // ---- arrays converted for a parameter the callee changes: the changes are copied back after the call
    static final java.util.ArrayList<JsArrayLike> BACK = new java.util.ArrayList<>();
    public static int mark() { return BACK.size(); }
    public static <A> A aliasArg(Object orig, A conv) {
        if (conv != orig && orig instanceof JsArrayLike && conv instanceof JsArrayLike) { BACK.add((JsArrayLike) orig); BACK.add((JsArrayLike) conv); }
        return conv;
    }
    public static void writeBack(int m) {
        for (int i = BACK.size() - 2; i >= m; i -= 2) {
            JsArrayLike o = BACK.get(i), c = BACK.get(i + 1);
            int n = c.length();
            if (!o.isFixed()) o.setLength(n);
            for (int k = 0; k < n && k < o.length(); ++k) o.setBoxed(k, c.getBoxed(k));
        }
        while (BACK.size() > m) BACK.remove(BACK.size() - 1);
    }
    public static <T> T back(int m, T r) { writeBack(m); return r; }
    public static int back(int m, int r) { writeBack(m); return r; }
    public static long back(int m, long r) { writeBack(m); return r; }
    public static double back(int m, double r) { writeBack(m); return r; }
    public static boolean back(int m, boolean r) { writeBack(m); return r; }

    public static <T> T seq(Object a, T b) { return b; }
    public static <T> T seq(Object a, Object b, T c) { return c; }
    public static <T> T seq(Object a, Object b, Object c, T d) { return d; }
    public static void discard(Object o) {}
    public static <T> T coalesce(T a, T b) { return a != null ? a : b; }
    public static <T> T or(T a, T b) { return truthy(a) ? a : b; }
    public static <T> T and(T a, T b) { return truthy(a) ? b : a; }
    /** Integer remainder; a zero divisor gives NaN in JavaScript, 0 here. */
    public static int rem(int a, int b) { return b == 0 ? 0 : a % b; }
    public static long rem(long a, long b) { return b == 0 ? 0 : a % b; }
    public static int atIndex(double i, int len) { int k = (int) trunc(i); return k < 0 ? len + k : k; }
    public static String concatChunks(String... parts) { StringBuilder sb = new StringBuilder(); for (String p : parts) sb.append(p); return sb.toString(); }

    /** A spread operand: its elements are inserted where it stands. */
    static final class Spread { final Object src; Spread(Object src) { this.src = src; } }
    public static Object spreadOf(Object src) { return new Spread(src); }
    /** Fill an array with values and spreads, in order. */
    public static <A extends JsArrayLike> A build(A target, Object... parts) {
        for (Object p : parts) {
            if (p instanceof Spread) { JsArrayLike s = spread(((Spread) p).src); for (int i = 0; i < s.length(); ++i) target.pushBoxed(s.getBoxed(i)); }
            else target.pushBoxed(p);
        }
        return target;
    }
    public static Object[] spreadArgs(Object... parts) {
        java.util.ArrayList<Object> out = new java.util.ArrayList<>();
        for (Object p : parts) {
            if (p instanceof Spread) { JsArrayLike s = spread(((Spread) p).src); for (int i = 0; i < s.length(); ++i) out.add(s.getBoxed(i)); }
            else out.add(p);
        }
        return out.toArray();
    }
    public static Object[] argsOf(Object arrayLike) { if (arrayLike == null) return new Object[0]; JsArrayLike a = spread(arrayLike); Object[] r = new Object[a.length()]; for (int i = 0; i < r.length; ++i) r[i] = a.getBoxed(i); return r; }
    public static JsArray<Object> restArgs(Object[] args, int from) { JsArray<Object> r = new JsArray<>(); for (int i = from; i < args.length; ++i) r.push(args[i]); return r; }
    public static JsArray<java.math.BigInteger> bigTyped(int n) { return JsArray.filled(n, java.math.BigInteger.ZERO); }
    public static JsArray<java.math.BigInteger> bigTypedFrom(Object src) { JsArrayLike s = spread(src); JsArray<java.math.BigInteger> r = new JsArray<>(s.length()); for (int i = 0; i < s.length(); ++i) r.set(i, toBig(s.getBoxed(i))); return r; }
    public static JsArray<TestCase> toTests(Object o) {
        if (o == null) return null;
        JsArrayLike s = (JsArrayLike) o; JsArray<TestCase> r = new JsArray<>(s.length());
        for (int i = 0; i < s.length(); ++i) r.set(i, toTest(s.getBoxed(i)));
        return r;
    }
    public static TestCase toTest(Object o) { return o == null || o instanceof TestCase ? (TestCase) o : TestCase.fromObject(toObj(o)); }
    public static String errorName(Throwable e) { return e instanceof JsError ? ((JsError) e).name : e instanceof ArithmeticException || e instanceof IndexOutOfBoundsException ? "RangeError" : e instanceof ClassCastException || e instanceof NullPointerException ? "TypeError" : "Error"; }
    public static boolean isTyped(Object o, String name) {
        if (!(o instanceof JsArrayLike) || !((JsArrayLike) o).isFixed()) return false;
        switch (name) {
            case "Uint8Array": case "Uint8ClampedArray": return o instanceof U8Array;
            case "Int8Array": return o instanceof I8Array;
            case "Uint16Array": return o instanceof U16Array;
            case "Int16Array": return o instanceof I16Array;
            case "Uint32Array": return o instanceof U32Array;
            case "Int32Array": return o instanceof I32Array;
            case "Float32Array": return o instanceof F32Array;
            case "Float64Array": return o instanceof F64Array;
            default: return false;
        }
    }
    public static int indexOfDyn(Object arr, Object v) { if (arr instanceof String) return ((String) arr).indexOf(str(v)); return ((JsArrayLike) arr).indexOfBoxed(v); }
    public static boolean includesDyn(Object arr, Object v) { if (arr instanceof String) return ((String) arr).contains(str(v)); JsArrayLike a = (JsArrayLike) arr; for (int i = 0; i < a.length(); ++i) if (sameValueZero(a.getBoxed(i), v)) return true; return false; }
    public static JsArray<String> indexKeys(Object arr) { JsArrayLike a = (JsArrayLike) arr; JsArray<String> r = new JsArray<>(a.length()); for (int i = 0; i < a.length(); ++i) r.set(i, Integer.toString(i)); return r; }
    public static JsArray<Object> indexKeysAsNumbers(Object arr) { JsArrayLike a = (JsArrayLike) arr; JsArray<Object> r = new JsArray<>(a.length()); for (int i = 0; i < a.length(); ++i) r.set(i, i); return r; }
    public static Object invokeIndex(Object o, Object key, Object... args) {
        Object f = index(o, key);
        if (f instanceof JsFn) return ((JsFn) f).call(args);
        return invoke(o, propKey(key), args);
    }

    // ---------------------------------------------------------------- Object.*
    public static boolean hasOwn(Object o, Object key) {
        if (o instanceof JsObject) return ((JsObject) o).has(key);
        if (o instanceof JsArrayLike) { double d = toNum(key); return d >= 0 && d < ((JsArrayLike) o).length(); }
        if (o instanceof JsDynamic && ((JsDynamic) o).props().has(key)) return true;
        return o != null && findField(o.getClass(), propKey(key)) != null;
    }
    public static JsArray<String> keys(Object o) {
        if (o instanceof JsObject) return ((JsObject) o).keys();
        if (o instanceof JsArrayLike || o instanceof String) { int n = length(o); JsArray<String> r = new JsArray<>(n); for (int i = 0; i < n; ++i) r.set(i, Integer.toString(i)); return r; }
        JsArray<String> r = new JsArray<>();
        if (o == null) throw new JsError("TypeError", "Cannot convert undefined or null to object");
        for (Class<?> k = o.getClass(); k != null && k != Object.class; k = k.getSuperclass())
            for (java.lang.reflect.Field f : k.getDeclaredFields()) if (!java.lang.reflect.Modifier.isStatic(f.getModifiers()) && !f.isSynthetic()) r.push(f.getName());
        if (o instanceof JsDynamic) r.pushAll(((JsDynamic) o).props().keys());
        return r;
    }
    public static JsArray<Object> values(Object o) {
        if (o instanceof JsObject) return ((JsObject) o).values();
        JsArray<String> k = keys(o); JsArray<Object> r = new JsArray<>(k.length());
        for (int i = 0; i < k.length(); ++i) r.set(i, index(o, k.get(i)));
        return r;
    }
    public static JsArray<Object> entries(Object o) {
        if (o instanceof JsObject) return ((JsObject) o).entries();
        JsArray<String> k = keys(o); JsArray<Object> r = new JsArray<>(k.length());
        for (int i = 0; i < k.length(); ++i) r.set(i, JsArray.<Object>of(k.get(i), index(o, k.get(i))));
        return r;
    }
    public static JsObject fromEntries(Object entries) {
        JsObject r = new JsObject(); JsArrayLike e = spread(entries);
        for (int i = 0; i < e.length(); ++i) { JsArrayLike kv = (JsArrayLike) e.getBoxed(i); r.put(kv.getBoxed(0), kv.getBoxed(1)); }
        return r;
    }
    public static JsObject assign(Object target, Object... sources) {
        JsObject t = toObj(target);
        for (Object s : sources) {
            if (s == null) continue;
            JsArray<String> k = keys(s);
            for (int i = 0; i < k.length(); ++i) t.put(k.get(i), index(s, k.get(i)));
        }
        return t;
    }
    public static boolean deleteProp(Object o, Object key) {
        if (o instanceof JsObject) return ((JsObject) o).delete(key);
        if (o instanceof JsDynamic) return ((JsDynamic) o).props().delete(key);
        if (o instanceof JsArrayLike) { ((JsArrayLike) o).setBoxed(toInt(key), null); return true; }
        return true;
    }
    public static String stringify(Object o) {
        if (o == null) return "null";
        if (o instanceof String) return "\"" + ((String) o).replace("\\", "\\\\").replace("\"", "\\\"") + "\"";
        if (o instanceof Number || o instanceof Boolean) return str(o);
        if (o instanceof JsArrayLike) { JsArrayLike a = (JsArrayLike) o; StringBuilder sb = new StringBuilder("["); for (int i = 0; i < a.length(); ++i) { if (i > 0) sb.append(','); sb.append(stringify(a.getBoxed(i))); } return sb.append(']').toString(); }
        JsArray<String> k = keys(o); StringBuilder sb = new StringBuilder("{");
        for (int i = 0; i < k.length(); ++i) { if (i > 0) sb.append(','); sb.append(stringify(k.get(i))).append(':').append(stringify(index(o, k.get(i)))); }
        return sb.append('}').toString();
    }

    // ---------------------------------------------------------------- bytes and text
    public static U8Array hexToBytes(String hex) {
        if (hex == null) throw new JsError("Hex8ToBytes: Input must be a string");
        for (int i = 0; i < hex.length(); ++i) if (Character.digit(hex.charAt(i), 16) < 0) throw new JsError("Hex8ToBytes: Invalid hex characters found");
        U8Array r = new U8Array(hex.length() / 2);
        for (int i = 0; i + 1 < hex.length(); i += 2) r.set(i / 2, Integer.parseInt(hex.substring(i, i + 2), 16));
        return r;
    }
    public static String bytesToHex(Object bytes) { JsArrayLike a = (JsArrayLike) bytes; StringBuilder sb = new StringBuilder(); for (int i = 0; i < a.length(); ++i) { int b = toInt(a.getBoxed(i)) & 0xFF; sb.append(Character.forDigit(b >> 4, 16)).append(Character.forDigit(b & 15, 16)); } return sb.toString(); }
    /** AnsiToBytes / AsciiToBytes: each char code, masked to a byte. */
    public static U8Array charsToBytes(String s) { U8Array r = new U8Array(s.length()); for (int i = 0; i < s.length(); ++i) r.set(i, s.charAt(i) & 0xFF); return r; }
    public static U8Array utf8ToBytes(String s) { byte[] b = s.getBytes(java.nio.charset.StandardCharsets.UTF_8); U8Array r = new U8Array(b.length); for (int i = 0; i < b.length; ++i) r.set(i, b[i] & 0xFF); return r; }
    public static String bytesToUtf8(Object bytes) { JsArrayLike a = (JsArrayLike) bytes; byte[] b = new byte[a.length()]; for (int i = 0; i < b.length; ++i) b[i] = (byte) toInt(a.getBoxed(i)); return new String(b, java.nio.charset.StandardCharsets.UTF_8); }
    public static String bytesToChars(Object bytes) { JsArrayLike a = (JsArrayLike) bytes; StringBuilder sb = new StringBuilder(a.length()); for (int i = 0; i < a.length(); ++i) sb.append((char) (toInt32(a.getBoxed(i)) & 0xFFFF)); return sb.toString(); }
}

/** A captured variable a nested function assigns (Java captures only effectively final locals). */
final class IntRef { public int v; public IntRef(int v) { this.v = v; } }
final class LongRef { public long v; public LongRef(long v) { this.v = v; } }
final class DoubleRef { public double v; public DoubleRef(double v) { this.v = v; } }
final class BoolRef { public boolean v; public BoolRef(boolean v) { this.v = v; } }
final class Ref<T> { public T v; public Ref(T v) { this.v = v; } }

/** A DataView over the bytes of a U8Array. */
final class JsDataView {
    public final U8Array buffer; public final int offset;
    public JsDataView(Object buffer, int offset) { this.buffer = (U8Array) buffer; this.offset = offset; }
    public JsDataView(Object buffer) { this(buffer, 0); }
    public int byteLength() { return buffer.length() - offset; }
    long read(int at, int n, boolean le) { long v = 0; for (int i = 0; i < n; ++i) { int b = buffer.get(offset + at + (le ? n - 1 - i : i)); v = (v << 8) | b; } return v; }
    void write(int at, int n, long v, boolean le) { for (int i = 0; i < n; ++i) buffer.set(offset + at + (le ? i : n - 1 - i), (int) ((v >>> (8 * i)) & 0xFF)); }
    public int getUint8(int at) { return (int) read(at, 1, false); }
    public int getInt8(int at) { return (byte) read(at, 1, false); }
    public int getUint16(int at, boolean le) { return (int) read(at, 2, le); }
    public int getInt16(int at, boolean le) { return (short) read(at, 2, le); }
    public long getUint32(int at, boolean le) { return read(at, 4, le); }
    public int getInt32(int at, boolean le) { return (int) read(at, 4, le); }
    public double getFloat32(int at, boolean le) { return Float.intBitsToFloat((int) read(at, 4, le)); }
    public double getFloat64(int at, boolean le) { return Double.longBitsToDouble(read(at, 8, le)); }
    public java.math.BigInteger getBigUint64(int at, boolean le) { return Js.bigU64(read(at, 8, le)); }
    public java.math.BigInteger getBigInt64(int at, boolean le) { return java.math.BigInteger.valueOf(read(at, 8, le)); }
    public void setUint8(int at, long v) { write(at, 1, v, false); }
    public void setInt8(int at, long v) { write(at, 1, v, false); }
    public void setUint16(int at, long v, boolean le) { write(at, 2, v, le); }
    public void setInt16(int at, long v, boolean le) { write(at, 2, v, le); }
    public void setUint32(int at, long v, boolean le) { write(at, 4, v, le); }
    public void setInt32(int at, long v, boolean le) { write(at, 4, v, le); }
    public void setFloat32(int at, double v, boolean le) { write(at, 4, Float.floatToRawIntBits((float) v), le); }
    public void setFloat64(int at, double v, boolean le) { write(at, 8, Double.doubleToRawLongBits(v), le); }
    public void setBigUint64(int at, java.math.BigInteger v, boolean le) { write(at, 8, v.longValue(), le); }
    public void setBigInt64(int at, java.math.BigInteger v, boolean le) { write(at, 8, v.longValue(), le); }
}

/** A JavaScript RegExp over java.util.regex (the common subset). */
final class JsRegExp {
    final java.util.regex.Pattern p; final boolean global; public final String source; public final String flags;
    public int lastIndex;
    public JsRegExp(String source, String flags) {
        this.source = source; this.flags = flags == null ? "" : flags;
        int f = 0;
        if (this.flags.contains("i")) f |= java.util.regex.Pattern.CASE_INSENSITIVE;
        if (this.flags.contains("m")) f |= java.util.regex.Pattern.MULTILINE;
        if (this.flags.contains("s")) f |= java.util.regex.Pattern.DOTALL;
        this.p = java.util.regex.Pattern.compile(source, f);
        this.global = this.flags.contains("g");
    }
    public boolean test(String s) { return p.matcher(s).find(); }
    public String replace(String s, String r) {
        java.util.regex.Matcher m = p.matcher(s);
        String jr = r.replace("\\", "\\\\").replaceAll("\\$(\\d)", "\\$$1").replace("$&", "$0");
        return global ? m.replaceAll(jr) : m.replaceFirst(jr);
    }
    public String replace(String s, JsFn fn) {
        java.util.regex.Matcher m = p.matcher(s); StringBuilder sb = new StringBuilder(); int last = 0;
        while (m.find()) {
            Object[] args = new Object[m.groupCount() + 3];
            args[0] = m.group(); for (int i = 1; i <= m.groupCount(); ++i) args[i] = m.group(i);
            args[m.groupCount() + 1] = m.start(); args[m.groupCount() + 2] = s;
            sb.append(s, last, m.start()).append(Js.str(fn.call(args))); last = m.end();
            if (!global) break;
        }
        return sb.append(s.substring(last)).toString();
    }
    public JsArray<String> split(String s) { JsArray<String> r = new JsArray<>(); for (String part : p.split(s, -1)) r.push(part); return r; }
    public JsArray<String> match(String s) {
        java.util.regex.Matcher m = p.matcher(s);
        if (global) { JsArray<String> r = new JsArray<>(); while (m.find()) r.push(m.group()); return r.length() == 0 ? null : r; }
        if (!m.find()) return null;
        JsArray<String> r = new JsArray<>(); for (int i = 0; i <= m.groupCount(); ++i) r.push(m.group(i)); return r;
    }
}
`;

const RUNTIME_FRAMEWORK = String.raw`
// ===================================================================
// AlgorithmFramework (mirrors AlgorithmFramework.js member for member)
// ===================================================================

final class CategoryType {
    public final String name, color, icon, description;
    CategoryType(String name, String color, String icon, String description) { this.name = name; this.color = color; this.icon = icon; this.description = description; }
    public static final CategoryType ASYMMETRIC = new CategoryType("Asymmetric Ciphers", "#dc3545", "", "Public-key cryptography algorithms");
    public static final CategoryType BLOCK = new CategoryType("Block Ciphers", "#007bff", "", "Block-based symmetric encryption");
    public static final CategoryType STREAM = new CategoryType("Stream Ciphers", "#17a2b8", "", "Stream-based symmetric encryption");
    public static final CategoryType HASH = new CategoryType("Hash Functions", "#ffc107", "", "Cryptographic hash algorithms");
    public static final CategoryType CHECKSUM = new CategoryType("Checksums", "#20c997", "", "Checksum and integrity verification algorithms");
    public static final CategoryType COMPRESSION = new CategoryType("Compression Algorithms", "#28a745", "", "Data compression algorithms");
    public static final CategoryType ENCODING = new CategoryType("Encoding Schemes", "#6f42c1", "", "Data encoding and representation");
    public static final CategoryType CLASSICAL = new CategoryType("Classical Ciphers", "#fd7e14", "", "Historical and educational ciphers");
    public static final CategoryType MAC = new CategoryType("Message Authentication", "#e83e8c", "", "Message authentication codes");
    public static final CategoryType KDF = new CategoryType("Key Derivation Functions", "#343a40", "", "Key derivation and stretching functions");
    public static final CategoryType ECC = new CategoryType("Error Correction", "#17a2b8", "", "Error correction codes");
    public static final CategoryType MODE = new CategoryType("Cipher Modes", "#495057", "", "Block cipher modes of operation");
    public static final CategoryType PADDING = new CategoryType("Padding Schemes", "#6c757d", "", "Data padding algorithms");
    public static final CategoryType AEAD = new CategoryType("Authenticated Encryption", "#dc3545", "", "Authenticated encryption with associated data");
    public static final CategoryType SPECIAL = new CategoryType("Special Algorithms", "#6f42c1", "", "Special purpose algorithms");
    public static final CategoryType PQC = new CategoryType("Post-Quantum Cryptography", "#e83e8c", "", "Quantum-resistant cryptographic algorithms");
    public static final CategoryType RANDOM = new CategoryType("Random Number Generators", "#6c757d", "", "Pseudo-random number generators");
    @Override public String toString() { return "[object " + "Object]"; }
}

final class SecurityStatus {
    public final String name, color, icon;
    SecurityStatus(String name, String color) { this.name = name; this.color = color; this.icon = ""; }
    public static final SecurityStatus SECURE = new SecurityStatus("Secure", "#28a745");
    public static final SecurityStatus DEPRECATED = new SecurityStatus("Deprecated", "#ffc107");
    public static final SecurityStatus BROKEN = new SecurityStatus("Broken", "#dc3545");
    public static final SecurityStatus OBSOLETE = new SecurityStatus("Obsolete", "#6c757d");
    public static final SecurityStatus EXPERIMENTAL = new SecurityStatus("Experimental", "#17a2b8");
    public static final SecurityStatus EDUCATIONAL = new SecurityStatus("Educational Only", "#fd7e14");
    @Override public String toString() { return "[object " + "Object]"; }
}

final class ComplexityType {
    public final String name, color; public final int level;
    ComplexityType(String name, String color, int level) { this.name = name; this.color = color; this.level = level; }
    public static final ComplexityType BEGINNER = new ComplexityType("Beginner", "#28a745", 1);
    public static final ComplexityType INTERMEDIATE = new ComplexityType("Intermediate", "#ffc107", 2);
    public static final ComplexityType ADVANCED = new ComplexityType("Advanced", "#fd7e14", 3);
    public static final ComplexityType EXPERT = new ComplexityType("Expert", "#dc3545", 4);
    public static final ComplexityType RESEARCH = new ComplexityType("Research", "#6f42c1", 5);
    @Override public String toString() { return "[object " + "Object]"; }
}

final class CountryCode {
    public final String name, icon;
    CountryCode(String name) { this.name = name; this.icon = ""; }
    public static final CountryCode US = new CountryCode("United States");
    public static final CountryCode RU = new CountryCode("Russia");
    public static final CountryCode CN = new CountryCode("China");
    public static final CountryCode UA = new CountryCode("Ukraine");
    public static final CountryCode DE = new CountryCode("Germany");
    public static final CountryCode GB = new CountryCode("United Kingdom");
    public static final CountryCode FR = new CountryCode("France");
    public static final CountryCode JP = new CountryCode("Japan");
    public static final CountryCode KR = new CountryCode("South Korea");
    public static final CountryCode IL = new CountryCode("Israel");
    public static final CountryCode BE = new CountryCode("Belgium");
    public static final CountryCode CA = new CountryCode("Canada");
    public static final CountryCode AU = new CountryCode("Australia");
    public static final CountryCode IT = new CountryCode("Italy");
    public static final CountryCode NL = new CountryCode("Netherlands");
    public static final CountryCode CH = new CountryCode("Switzerland");
    public static final CountryCode SE = new CountryCode("Sweden");
    public static final CountryCode NO = new CountryCode("Norway");
    public static final CountryCode IN = new CountryCode("India");
    public static final CountryCode BR = new CountryCode("Brazil");
    public static final CountryCode INTL = new CountryCode("International");
    public static final CountryCode ANCIENT = new CountryCode("Ancient");
    public static final CountryCode UNKNOWN = new CountryCode("Unknown");
    @Override public String toString() { return "[object " + "Object]"; }
}

class LinkItem {
    public String text;
    public String uri;
    public LinkItem(String text, String uri) { this.text = text; this.uri = uri; }
    public LinkItem(String text) { this(text, null); }
}

/** A test vector: its framework fields, and every other field of the source object. */
class TestCase extends LinkItem implements JsDynamic {
    public U8Array input;
    public U8Array expected;
    final JsObject extra = new JsObject();
    public JsObject props() { return extra; }
    public TestCase(U8Array input, U8Array expected, String description, String uri) { super(description, uri); this.input = input; this.expected = expected; }
    public TestCase(U8Array input, U8Array expected, String description) { this(input, expected, description, ""); }
    public TestCase(U8Array input, U8Array expected) { this(input, expected, "", ""); }
    /** _processTestVector: a plain vector object becomes a TestCase keeping its other fields. */
    public static TestCase fromObject(JsObject o) {
        if (o == null) return null;
        Object text = o.get("text"), uri = o.get("uri");
        TestCase t = new TestCase(Js.toU8(o.get("input")), o.has("expected") && o.get("expected") != null ? Js.toU8(o.get("expected")) : new U8Array(), text == null ? "" : Js.str(text), uri == null ? "" : Js.str(uri));
        JsArray<String> keys = o.keys();
        for (int i = 0; i < keys.length(); ++i) { String k = keys.get(i); if (!k.equals("input") && !k.equals("expected") && !k.equals("text") && !k.equals("uri")) t.extra.put(k, o.get(k)); }
        return t;
    }
    /** A vector field by its JavaScript name, or null when the vector has none. */
    public Object field(String name) {
        switch (name) { case "input": return input; case "expected": return expected; case "text": return text; case "uri": return uri; }
        if (extra.has(name)) return extra.get(name);
        // a subclass declares its own vector fields
        return getClass() != TestCase.class && Js.hasMember(this, name) ? Js.getProp(this, name) : null;
    }
    public boolean hasField(String name) {
        return name.equals("input") || name.equals("expected") || name.equals("text") || name.equals("uri") || extra.has(name) ||
            (getClass() != TestCase.class && Js.hasMember(this, name));
    }
}

class Vulnerability extends LinkItem {
    public String description;
    public String mitigation;
    public Vulnerability(String type, String description, String mitigation, String uri) { super(type, uri); this.description = description; this.mitigation = mitigation; }
    public Vulnerability(String type, String description, String mitigation) { this(type, description, mitigation, ""); }
    public Vulnerability(String type, String description) { this(type, description, "", ""); }
    public Vulnerability(String type) { this(type, "", "", ""); }
}

class AuthResult {
    public boolean Success;
    public U8Array Output;
    public String FailureReason;
    public AuthResult(boolean success, U8Array output, String failureReason) { Success = success; Output = output; FailureReason = failureReason; }
    public AuthResult(boolean success, U8Array output) { this(success, output, null); }
    public AuthResult(boolean success) { this(success, null, null); }
}

class KeySize {
    public int minSize;
    public int maxSize;
    public int stepSize;
    public KeySize(int minSize, int maxSize, int stepSize) { this.minSize = minSize; this.maxSize = maxSize; this.stepSize = stepSize; }
    public KeySize(int minSize, int maxSize) { this(minSize, maxSize, 1); }
}

class BlockAbsorber {
    public int _blockSize;
    public JsFn _processBlock;
    public U8Array _held;
    public int _pending;
    public long _length;
    public BlockAbsorber(int blockSize, JsFn processBlock) {
        if (!(blockSize > 0)) throw new JsError("BlockAbsorber: blockSize must be positive");
        if (processBlock == null) throw new JsError("BlockAbsorber: processBlock must be a function");
        _blockSize = blockSize; _processBlock = processBlock; _held = new U8Array(blockSize); _pending = 0; _length = 0;
    }
    public int get_BlockSize() { return _blockSize; }
    public int get_Pending() { return _pending; }
    public long get_Length() { return _length; }
    public void Absorb(U8Array data) {
        if (data == null || data.length() == 0) return;
        int blockSize = _blockSize, total = data.length(), offset = 0;
        while (offset < total) {
            if (_pending == blockSize) { _processBlock.call(_held); _pending = 0; }
            int take = Math.min(blockSize - _pending, total - offset);
            for (int i = 0; i < take; i++) _held.set(_pending + i, AlgorithmFramework._byte(data.get(offset + i)));
            _pending += take; offset += take; _length += take;
        }
    }
    public Object Finish(JsFn finalize) {
        if (finalize == null) throw new JsError("BlockAbsorber: finalize must be a function");
        return finalize.call(_held.slice(0, _pending), _pending, _length);
    }
    public void Reset() { _held.fill(0); _pending = 0; _length = 0; }
}

abstract class IAlgorithmInstance {
    public Algorithm algorithm;
    public boolean isInverse;
    public U8Array inputBuffer;
    public IAlgorithmInstance(Algorithm algorithm) { this.algorithm = algorithm; this.isInverse = false; this.inputBuffer = new U8Array(); }
    public IAlgorithmInstance() { this(null); }
    public void Feed(U8Array data) {
        if (data == null || data.length() == 0) return;
        if (inputBuffer == null) inputBuffer = new U8Array();
        for (int i = 0; i < data.length(); i++) inputBuffer.push(data.get(i));
    }
    public U8Array Result() { throw JsError.thrown("Result() not implemented"); }
    public void Dispose() { if (inputBuffer != null) inputBuffer.setLength(0); }
}

abstract class Algorithm {
    public String name;
    public String description;
    public String inventor;
    public int year;
    public CategoryType category;
    public String subCategory;
    public SecurityStatus securityStatus;
    public ComplexityType complexity;
    public CountryCode country;
    public JsArray<LinkItem> documentation = new JsArray<>();
    public JsArray<LinkItem> references = new JsArray<>();
    public JsArray<Vulnerability> knownVulnerabilities = new JsArray<>();
    public JsArray<TestCase> tests = new JsArray<>();
    public Algorithm() {}
    public IAlgorithmInstance CreateInstance(boolean isInverse) { throw JsError.thrown("CreateInstance() not implemented"); }
    public IAlgorithmInstance CreateInstance() { return CreateInstance(false); }
}

abstract class CryptoAlgorithm extends Algorithm {}
abstract class SymmetricCipherAlgorithm extends CryptoAlgorithm {}
abstract class AsymmetricCipherAlgorithm extends CryptoAlgorithm {}
abstract class BlockCipherAlgorithm extends SymmetricCipherAlgorithm {
    public JsArray<KeySize> SupportedKeySizes = new JsArray<>();
    public JsArray<KeySize> SupportedBlockSizes = new JsArray<>();
}
abstract class StreamCipherAlgorithm extends SymmetricCipherAlgorithm {}
abstract class EncodingAlgorithm extends Algorithm {}
abstract class CompressionAlgorithm extends Algorithm {}
abstract class ErrorCorrectionAlgorithm extends Algorithm {}
abstract class HashFunctionAlgorithm extends Algorithm { public JsArray<KeySize> SupportedOutputSizes = new JsArray<>(); }
abstract class MacAlgorithm extends Algorithm { public JsArray<KeySize> SupportedMacSizes = new JsArray<>(); public boolean NeedsKey = true; }
abstract class KdfAlgorithm extends Algorithm { public JsArray<KeySize> SupportedOutputSizes = new JsArray<>(); public boolean SaltRequired = true; }
abstract class PaddingAlgorithm extends Algorithm { public boolean IsLengthIncluded = false; }
abstract class CipherModeAlgorithm extends Algorithm { public boolean RequiresIV = true; public JsArray<KeySize> SupportedIVSizes = new JsArray<>(); }
abstract class AeadAlgorithm extends CryptoAlgorithm { public JsArray<KeySize> SupportedTagSizes = new JsArray<>(); public boolean SupportsDetached = false; }
abstract class RandomGenerationAlgorithm extends Algorithm { public boolean IsDeterministic = false; public boolean IsCryptographicallySecure = true; public JsArray<KeySize> SupportedSeedSizes = new JsArray<>(); }

abstract class IBlockCipherInstance extends IAlgorithmInstance {
    public int BlockSize;
    public int KeySize;
    public U8Array _key;
    public IBlockCipherInstance(Algorithm algorithm) { super(algorithm); BlockSize = 0; KeySize = 0; _key = null; }
    public IBlockCipherInstance() { this(null); }
    public void set_key(U8Array keyBytes) { _key = keyBytes; }
    public U8Array get_key() { return _key; }
    public U8Array EncryptBlock(U8Array block) { throw JsError.thrown("EncryptBlock() not implemented"); }
    public U8Array DecryptBlock(U8Array block) { throw JsError.thrown("DecryptBlock() not implemented"); }
    public int RequireBlockMultiple(int blockSize) {
        int size = blockSize != 0 ? blockSize : BlockSize;
        if (!(size > 0)) throw new JsError("BlockSize not set");
        int length = inputBuffer != null ? inputBuffer.length() : 0;
        if (length % size != 0) throw new JsError("Input length must be multiple of " + size + " bytes");
        return length / size;
    }
    public int RequireBlockMultiple() { return RequireBlockMultiple(0); }
    @Override public U8Array Result() {
        if (get_key() == null) throw new JsError("Key not set");
        if (inputBuffer == null || inputBuffer.length() == 0) throw new JsError("No data fed");
        int blockSize = BlockSize;
        RequireBlockMultiple(blockSize);
        U8Array output = new U8Array();
        for (int offset = 0; offset < inputBuffer.length(); offset += blockSize) {
            U8Array block = inputBuffer.slice(offset, offset + blockSize);
            U8Array processed = isInverse ? DecryptBlock(block) : EncryptBlock(block);
            for (int i = 0; i < processed.length(); i++) output.push(processed.get(i));
        }
        inputBuffer = new U8Array();
        return output;
    }
}
abstract class IHashFunctionInstance extends IAlgorithmInstance { public int OutputSize; public IHashFunctionInstance(Algorithm a) { super(a); OutputSize = 0; } public IHashFunctionInstance() { this(null); } }
abstract class IMacInstance extends IAlgorithmInstance { public IMacInstance(Algorithm a) { super(a); } public IMacInstance() { this(null); } public U8Array ComputeMac(U8Array data) { throw JsError.thrown("ComputeMac() not implemented"); } }
abstract class IKdfInstance extends IAlgorithmInstance { public int OutputSize; public int Iterations; public IKdfInstance(Algorithm a) { super(a); OutputSize = 0; Iterations = 0; } public IKdfInstance() { this(null); } }
abstract class IAeadInstance extends IAlgorithmInstance { public U8Array aad; public int tagSize; public IAeadInstance(Algorithm a) { super(a); aad = new U8Array(); tagSize = 0; } public IAeadInstance() { this(null); } }
abstract class IErrorCorrectionInstance extends IAlgorithmInstance { public IErrorCorrectionInstance(Algorithm a) { super(a); } public IErrorCorrectionInstance() { this(null); } public boolean DetectError(U8Array data) { throw JsError.thrown("DetectError() not implemented"); } }
abstract class IRandomGeneratorInstance extends IAlgorithmInstance { public IRandomGeneratorInstance(Algorithm a) { super(a); } public IRandomGeneratorInstance() { this(null); } public U8Array NextBytes(int count) { throw JsError.thrown("NextBytes() not implemented"); } }

/** The registry and the shared construction primitives. */
final class AlgorithmFramework {
    private AlgorithmFramework() {}
    public static final JsArray<Algorithm> Algorithms = new JsArray<>();
    public static void RegisterAlgorithm(Algorithm algorithm) {
        if (algorithm == null) throw new JsError("RegisterAlgorithm: Invalid algorithm object");
        if (algorithm.name == null || algorithm.name.isEmpty()) throw new JsError("RegisterAlgorithm: Algorithm must have a valid name");
        for (int i = 0; i < Algorithms.length(); ++i) if (Algorithms.get(i).name.equals(algorithm.name)) throw new JsError("RegisterAlgorithm: Algorithm '" + algorithm.name + "' already registered");
        if (algorithm.tests != null)
            for (int i = 0; i < algorithm.tests.length(); ++i)
                if (algorithm.tests.get(i) == null || (algorithm.tests.get(i).input == null && !algorithm.tests.get(i).hasField("input")))
                    throw new JsError("RegisterAlgorithm: Invalid test vector #" + (i + 1) + " in algorithm '" + algorithm.name + "' - must have at least 'input' field");
        Algorithms.push(algorithm);
    }
    public static Algorithm Find(String name) { for (int i = 0; i < Algorithms.length(); ++i) if (Algorithms.get(i).name.equals(name)) return Algorithms.get(i); return null; }
    public static void Clear() { Algorithms.setLength(0); }
    static int _byte(double value) { double reduced = Js.trunc(value) % 256; return (int) (reduced < 0 ? reduced + 256 : reduced); }
    static int _mergeBits(int a, int b) { return (_byte(a) | _byte(b)) & 0xFF; }
    static U8Array _encodeLength(double value, int byteCount, boolean littleEndian) {
        U8Array encoded = new U8Array(byteCount);
        double remaining = Math.max(0, Js.trunc(value));
        for (int i = 0; i < byteCount; i++) { encoded.set(littleEndian ? i : byteCount - 1 - i, (int) (remaining % 256)); remaining = Math.floor(remaining / 256); }
        return encoded;
    }
    public static JsArray<U8Array> SpongePadBlocks(U8Array held, int pending, int rate, int separator) {
        if (!(rate > 0)) throw new JsError("SpongePadBlocks: rate must be positive");
        if (pending < 0 || pending > rate) throw new JsError("SpongePadBlocks: pending " + pending + " outside 0.." + rate);
        JsArray<U8Array> blocks = new JsArray<>();
        U8Array block = new U8Array(rate);
        for (int i = 0; i < pending; i++) block.set(i, _byte(held.get(i)));
        int used = pending;
        if (used == rate) { blocks.push(block); block = new U8Array(rate); used = 0; }
        block.set(used, _byte(separator));
        block.set(rate - 1, _mergeBits(block.get(rate - 1), 0x80));
        blocks.push(block);
        return blocks;
    }
    public static JsArray<U8Array> MerkleDamgardBlocks(U8Array held, int pending, double totalLength, JsObject options) {
        JsObject settings = options != null ? options : new JsObject();
        int blockSize = Js.toInt(settings.get("blockSize"));
        if (!(blockSize > 0)) throw new JsError("MerkleDamgardBlocks: blockSize must be positive");
        if (pending < 0 || pending > blockSize) throw new JsError("MerkleDamgardBlocks: pending " + pending + " outside 0.." + blockSize);
        int padByte = settings.get("padByte") == null ? 0x80 : Js.toInt(settings.get("padByte"));
        int lengthBytes = settings.get("lengthBytes") == null ? 8 : Js.toInt(settings.get("lengthBytes"));
        boolean littleEndian = Boolean.TRUE.equals(settings.get("lengthLittleEndian"));
        boolean inBits = !Boolean.FALSE.equals(settings.get("lengthInBits"));
        if (lengthBytes < 0 || lengthBytes >= blockSize) throw new JsError("MerkleDamgardBlocks: lengthBytes " + lengthBytes + " does not fit a " + blockSize + "-byte block");
        JsArray<U8Array> blocks = new JsArray<>();
        U8Array block = new U8Array(blockSize);
        for (int i = 0; i < pending; i++) block.set(i, _byte(held.get(i)));
        int used = pending;
        if (used == blockSize) { blocks.push(block); block = new U8Array(blockSize); used = 0; }
        block.set(used, _byte(padByte));
        used++;
        if (used > blockSize - lengthBytes) { blocks.push(block); block = new U8Array(blockSize); }
        if (lengthBytes > 0) {
            U8Array encoded = _encodeLength(inBits ? totalLength * 8 : totalLength, lengthBytes, littleEndian);
            for (int i = 0; i < lengthBytes; i++) block.set(blockSize - lengthBytes + i, encoded.get(i));
        }
        blocks.push(block);
        return blocks;
    }
}
`;

const RUNTIME_OPCODES = String.raw`
// ===================================================================
// OpCodes (the helpers the IL does not inline; mirrors OpCodes.js)
// ===================================================================
final class OpCodes {
    private OpCodes() {}

    /** OpCodes.UInt64: 64-bit values as [high32, low32] word pairs. */
    static final class UInt64 {
        private UInt64() {}
        static long bits(Object a) { JsArrayLike s = (JsArrayLike) a; return (Js.toUint32(s.getBoxed(0)) << 32) | Js.toUint32(s.getBoxed(1)); }
        static U32Array pair(long v) { return U32Array.of(v >>> 32, v & 0xFFFFFFFFL); }
        public static U32Array create(double high, double low) { return U32Array.of(Js.toUint32(high), Js.toUint32(low)); }
        public static U32Array fromBytes(Object bytes) {
            JsArrayLike s = (JsArrayLike) bytes; int n = s.length(); long v = 0;
            for (int i = 0; i < 8; ++i) { int k = i - (8 - Math.min(n, 8)); v = (v << 8) | (k < 0 ? 0 : Js.toInt32(s.getBoxed(n < 8 ? k : i)) & 0xFF); }
            return pair(v);
        }
        public static U8Array toBytes(Object a) { return Unpack64BE(java.math.BigInteger.valueOf(bits(a)).and(MASK64)); }
        public static U32Array add(Object a, Object b) { return pair(bits(a) + bits(b)); }
        public static U32Array sub(Object a, Object b) { return pair(bits(a) - bits(b)); }
        public static Object shr(Object a, double n) { int c = (int) n; return c == 0 ? a : pair(bits(a) >>> (c & 63)); }
        public static Object shl(Object a, double n) { int c = (int) n; return c == 0 ? a : pair(bits(a) << (c & 63)); }
        public static Object rotr(Object a, double n) { int c = (int) n; return c == 0 ? a : pair(Long.rotateRight(bits(a), c % 64)); }
        public static Object rotl(Object a, double n) { int c = (int) n; return c == 0 ? a : pair(Long.rotateLeft(bits(a), c % 64)); }
        public static U32Array xor(Object a, Object b) { return pair(bits(a) ^ bits(b)); }
        public static U32Array and(Object a, Object b) { return pair(bits(a) & bits(b)); }
        public static U32Array or(Object a, Object b) { return pair(bits(a) | bits(b)); }
        public static U32Array not(Object a) { return pair(~bits(a)); }
        public static double toNumber(Object a) { JsArrayLike s = (JsArrayLike) a; return Js.toUint32(s.getBoxed(0)) * 4294967296.0 + Js.toUint32(s.getBoxed(1)); }
        public static boolean equals(Object a, Object b) { return bits(a) == bits(b); }
        public static U32Array clone(Object a) { return pair(bits(a)); }
    }
    static final java.math.BigInteger MASK64 = Js.MASK64;
    static final java.math.BigInteger MASK128 = java.math.BigInteger.ONE.shiftLeft(128).subtract(java.math.BigInteger.ONE);

    // ---- pack / unpack / rotate (IL nodes PackBytes, UnpackBytes, RotateLeft/Right)
    public static int Pack16BE(int b0, int b1) { return ((b0 & 0xFF) << 8) | (b1 & 0xFF); }
    public static int Pack16LE(int b0, int b1) { return ((b1 & 0xFF) << 8) | (b0 & 0xFF); }
    public static long Pack32BE(int b0, int b1, int b2, int b3) { return (((b0 & 0xFF) << 24) | ((b1 & 0xFF) << 16) | ((b2 & 0xFF) << 8) | (b3 & 0xFF)) & 0xFFFFFFFFL; }
    public static long Pack32LE(int b0, int b1, int b2, int b3) { return Pack32BE(b3, b2, b1, b0); }
    public static java.math.BigInteger Pack64BE(int b0, int b1, int b2, int b3, int b4, int b5, int b6, int b7) { return java.math.BigInteger.valueOf(Pack32BE(b0, b1, b2, b3)).shiftLeft(32).or(java.math.BigInteger.valueOf(Pack32BE(b4, b5, b6, b7))); }
    public static java.math.BigInteger Pack64LE(int b0, int b1, int b2, int b3, int b4, int b5, int b6, int b7) { return Pack64BE(b7, b6, b5, b4, b3, b2, b1, b0); }
    static int[] bytesOf(Object a, int n) { JsArrayLike s = (JsArrayLike) a; int[] b = new int[n]; for (int i = 0; i < n; ++i) b[i] = Js.toInt32(s.getBoxed(i)); return b; }
    public static int Pack16BEOf(Object a) { int[] b = bytesOf(a, 2); return Pack16BE(b[0], b[1]); }
    public static int Pack16LEOf(Object a) { int[] b = bytesOf(a, 2); return Pack16LE(b[0], b[1]); }
    public static long Pack32BEOf(Object a) { int[] b = bytesOf(a, 4); return Pack32BE(b[0], b[1], b[2], b[3]); }
    public static long Pack32LEOf(Object a) { int[] b = bytesOf(a, 4); return Pack32LE(b[0], b[1], b[2], b[3]); }
    public static java.math.BigInteger Pack64BEOf(Object a) { int[] b = bytesOf(a, 8); return Pack64BE(b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7]); }
    public static java.math.BigInteger Pack64LEOf(Object a) { int[] b = bytesOf(a, 8); return Pack64LE(b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7]); }
    public static U8Array Unpack16BE(long w) { return U8Array.of((int) ((w >>> 8) & 0xFF), (int) (w & 0xFF)); }
    public static U8Array Unpack16LE(long w) { return U8Array.of((int) (w & 0xFF), (int) ((w >>> 8) & 0xFF)); }
    public static U8Array Unpack32BE(long w) { return U8Array.of((int) ((w >>> 24) & 0xFF), (int) ((w >>> 16) & 0xFF), (int) ((w >>> 8) & 0xFF), (int) (w & 0xFF)); }
    public static U8Array Unpack32LE(long w) { return U8Array.of((int) (w & 0xFF), (int) ((w >>> 8) & 0xFF), (int) ((w >>> 16) & 0xFF), (int) ((w >>> 24) & 0xFF)); }
    static long u64bits(Object q) { return q instanceof java.math.BigInteger ? ((java.math.BigInteger) q).longValue() : q instanceof Long || q instanceof Integer ? ((Number) q).longValue() : Js.big(Js.toNum(q)).longValue(); }
    public static U8Array Unpack64BE(Object q) { long v = u64bits(q); U8Array r = new U8Array(8); for (int i = 0; i < 8; ++i) r.set(i, (int) ((v >>> (56 - 8 * i)) & 0xFF)); return r; }
    public static U8Array Unpack64LE(Object q) { return Unpack64BE(q).reverse(); }
    public static int RotL8(long v, long n) { int x = (int) v & 0xFF; int p = (int) n & 7; return ((x << p) | (x >>> (8 - p))) & 0xFF; }
    public static int RotR8(long v, long n) { int x = (int) v & 0xFF; int p = (int) n & 7; return ((x >>> p) | (x << (8 - p))) & 0xFF; }
    public static int RotL16(long v, long n) { int x = (int) v & 0xFFFF; int p = (int) n & 15; return ((x << p) | (x >>> (16 - p))) & 0xFFFF; }
    public static int RotR16(long v, long n) { int x = (int) v & 0xFFFF; int p = (int) n & 15; return ((x >>> p) | (x << (16 - p))) & 0xFFFF; }
    public static long RotL32(long v, long n) { return Integer.rotateLeft((int) v, (int) n & 31) & 0xFFFFFFFFL; }
    public static long RotR32(long v, long n) { return Integer.rotateRight((int) v, (int) n & 31) & 0xFFFFFFFFL; }
    public static java.math.BigInteger RotL64n(java.math.BigInteger v, long n) {
        v = v.and(MASK64); int p = (int) n & 63; if (p == 0) return v;
        return v.shiftLeft(p).or(v.shiftRight(64 - p)).and(MASK64);
    }
    public static java.math.BigInteger RotR64n(java.math.BigInteger v, long n) {
        v = v.and(MASK64); int p = (int) n & 63; if (p == 0) return v;
        return v.shiftRight(p).or(v.shiftLeft(64 - p)).and(MASK64);
    }
    public static java.math.BigInteger RotL128n(java.math.BigInteger v, long n) {
        v = v.and(MASK128); int p = (int) n & 127; if (p == 0) return v;
        return v.shiftLeft(p).or(v.shiftRight(128 - p)).and(MASK128);
    }
    public static java.math.BigInteger RotR128n(java.math.BigInteger v, long n) {
        v = v.and(MASK128); int p = (int) n & 127; if (p == 0) return v;
        return v.shiftRight(p).or(v.shiftLeft(128 - p)).and(MASK128);
    }
    public static java.math.BigInteger ShiftLn(java.math.BigInteger v, long n) { return v.shiftLeft((int) n); }
    public static java.math.BigInteger ShiftRn(java.math.BigInteger v, long n) { return v.shiftRight((int) n); }

    // ---- hex and text
    public static U8Array Hex8ToBytes(String hex) { return Js.hexToBytes(hex); }
    public static String BytesToHex(Object bytes) { return Js.bytesToHex(bytes); }
    public static U32Array Hex32ToDWords(String hex) {
        U32Array r = new U32Array();
        for (int i = 0; i < hex.length(); i += 8) r.push(Js.toUint32(Js.parseInt(hex.substring(i, Math.min(hex.length(), i + 8)), 16)));
        return r;
    }
    public static String BytesToChars(Object bytes) { return Js.bytesToChars(bytes); }

    // ---- arrays
    public static U8Array CopyArray(U8Array a) { return a.slice(); }
    public static I8Array CopyArray(I8Array a) { return a.slice(); }
    public static U16Array CopyArray(U16Array a) { return a.slice(); }
    public static I16Array CopyArray(I16Array a) { return a.slice(); }
    public static U32Array CopyArray(U32Array a) { return a.slice(); }
    public static I32Array CopyArray(I32Array a) { return a.slice(); }
    public static I64Array CopyArray(I64Array a) { return a.slice(); }
    public static F64Array CopyArray(F64Array a) { return a.slice(); }
    public static F32Array CopyArray(F32Array a) { return a.slice(); }
    public static BoolArray CopyArray(BoolArray a) { return a.slice(); }
    public static <T> JsArray<T> CopyArray(JsArray<T> a) { return a.slice(); }
    public static Object CopyArray(Object a) { JsArrayLike s = (JsArrayLike) a; JsArray<Object> r = new JsArray<>(s.length()); for (int i = 0; i < s.length(); ++i) r.set(i, s.getBoxed(i)); return a instanceof JsArray ? r : U8Array.from(a); }
    public static void ClearArray(Object arr) { JsArrayLike a = (JsArrayLike) arr; for (int i = 0; i < a.length(); ++i) a.setBoxed(i, 0); }
    public static U8Array XorArrays(Object x, Object y) {
        JsArrayLike a = (JsArrayLike) x, b = (JsArrayLike) y;
        int n = Math.min(a.length(), b.length()); U8Array r = new U8Array(n);
        for (int i = 0; i < n; ++i) r.set(i, (Js.toInt32(a.getBoxed(i)) ^ Js.toInt32(b.getBoxed(i))) & 0xFF);
        return r;
    }
    public static U8Array ConcatArrays(Object arrays) {
        JsArrayLike all = (JsArrayLike) arrays; U8Array r = new U8Array();
        for (int i = 0; i < all.length(); ++i) r.pushAll(all.getBoxed(i));
        return r;
    }
    /** A plain array of length copies of value (any number: callers fill word tables with it too). */
    public static F64Array CreateArray(double length, double value) { F64Array r = new F64Array((int) length); r.fill(value); return r; }
    public static F64Array CreateArray(double length) { F64Array r = new F64Array((int) length); r.fill(0); return r; }
    /** The elements from start to end as a plain array of the source's class. */
    @SuppressWarnings("unchecked") public static <A extends JsArrayLike> A ArraySlice(A arr, double start, double end) {
        A r;
        try { r = (A) arr.getClass().getConstructor().newInstance(); } catch (ReflectiveOperationException e) { throw new JsError(e.toString()); }
        for (int i = (int) start; i < end && i < arr.length(); ++i) r.pushBoxed(arr.getBoxed(i));
        return r;
    }
    public static <A extends JsArrayLike> A ArraySlice(A arr, double start) { return ArraySlice(arr, start, arr.length()); }
    public static boolean SecureCompare(Object x, Object y) {
        JsArrayLike a = (JsArrayLike) x, b = (JsArrayLike) y;
        if (a.length() != b.length()) return false;
        int result = 0;
        for (int i = 0; i < a.length(); ++i) result |= Js.toInt32(a.getBoxed(i)) ^ Js.toInt32(b.getBoxed(i));
        return result == 0;
    }
    public static boolean ArraysEqual(Object x, Object y) { return SecureCompare(x, y); }
    public static boolean CompareArrays(Object x, Object y) {
        JsArrayLike a = (JsArrayLike) x, b = (JsArrayLike) y;
        if (a.length() != b.length()) return false;
        for (int i = 0; i < a.length(); ++i) if (!Js.strictEq(a.getBoxed(i), b.getBoxed(i))) return false;
        return true;
    }
    public static boolean ConstantTimeCompare(Object x, Object y, double lengthD) {
        JsArrayLike a = (JsArrayLike) x, b = (JsArrayLike) y;
        int length = (int) lengthD;
        if (length == 0) length = Math.min(a.length(), b.length());
        int result = 0;
        for (int i = 0; i < length; i++) result |= (i < a.length() ? Js.toInt32(a.getBoxed(i)) : 0) ^ (i < b.length() ? Js.toInt32(b.getBoxed(i)) : 0);
        result |= a.length() ^ b.length();
        return result == 0;
    }
    public static boolean ConstantTimeCompare(Object x, Object y) { return ConstantTimeCompare(x, y, 0); }
    public static U8Array XorArrayWithByte(Object arr, long value) {
        JsArrayLike a = (JsArrayLike) arr; int v = (int) value & 0xFF; U8Array r = new U8Array(a.length());
        for (int i = 0; i < a.length(); ++i) r.set(i, (Js.toInt32(a.getBoxed(i)) ^ v) & 0xFF);
        return r;
    }
    public static U8Array SecureRandomBytes(double count) {
        if (count < 0 || count != Math.floor(count)) throw new JsError("RangeError", "SecureRandomBytes: count must be a non-negative integer");
        byte[] b = new byte[(int) count]; new java.security.SecureRandom().nextBytes(b);
        U8Array r = new U8Array(b.length); for (int i = 0; i < b.length; ++i) r.set(i, b[i] & 0xFF); return r;
    }
    public static U8Array Words32ToBytesBE(Object words) {
        JsArrayLike w = (JsArrayLike) words; U8Array r = new U8Array();
        for (int i = 0; i < w.length(); ++i) { long v = Js.toUint32(w.getBoxed(i)); r.push((int) (v >>> 24) & 0xFF); r.push((int) (v >>> 16) & 0xFF); r.push((int) (v >>> 8) & 0xFF); r.push((int) v & 0xFF); }
        return r;
    }
    public static U32Array BytesToWords32BE(Object bytes) {
        JsArrayLike b = (JsArrayLike) bytes; U32Array r = new U32Array();
        for (int i = 0; i < b.length(); i += 4) {
            int[] x = new int[4];
            for (int j = 0; j < 4; ++j) x[j] = i + j < b.length() ? Js.toInt32(b.getBoxed(i + j)) & 0xFF : 0;
            r.push(Pack32BE(x[0], x[1], x[2], x[3]));
        }
        return r;
    }
    public static JsArray<U32Array> CreateUint64ArrayFromHex(Object hexValues) {
        JsArrayLike h = (JsArrayLike) hexValues; JsArray<U32Array> r = new JsArray<>(h.length());
        for (int i = 0; i < h.length(); ++i) {
            String s = Js.str(h.getBoxed(i));
            if (s.startsWith("0x") || s.startsWith("0X")) s = s.substring(2);
            s = Js.padStart(s, 16, "0");
            r.set(i, U32Array.of(Js.toUint32(Js.parseInt(s.substring(0, 8), 16)), Js.toUint32(Js.parseInt(s.substring(8, 16), 16))));
        }
        return r;
    }
    public static U8Array GHashMul(U8Array x, U8Array y) {
        if (x == null || x.length() != 16 || y == null || y.length() != 16) throw new JsError("GHashMul requires 16-byte arrays");
        U8Array z = new U8Array(16); U8Array v = y.slice();
        for (int i = 0; i < 16; i++) {
            int xi = x.get(i);
            for (int j = 7; j >= 0; j--) {
                if ((xi & (1 << j)) != 0) for (int k = 0; k < 16; k++) z.set(k, (z.get(k) ^ v.get(k)) & 0xFF);
                int lsb = v.get(15) & 1;
                for (int k = 15; k >= 1; k--) v.set(k, ((v.get(k) >>> 1) | ((v.get(k - 1) & 1) << 7)) & 0xFF);
                v.set(0, (v.get(0) >>> 1) & 0xFF);
                if (lsb != 0) v.set(0, (v.get(0) ^ 0xE1) & 0xFF);
            }
        }
        return z;
    }
    public static U8Array GCMIncrement(U8Array counter) {
        if (counter == null || counter.length() != 16) throw new JsError("GCMIncrement requires 16-byte counter");
        int carry = 1;
        for (int i = 15; i >= 12; i--) { int sum = counter.get(i) + carry; counter.set(i, sum & 0xFF); carry = sum >>> 8; }
        return counter;
    }

    // ---- bits and words
    public static int GetByte(long word, long byteIndex) { return ((int) word >>> (int) (byteIndex * 8)) & 0xFF; }
    public static int GF256Mul(long av, long bv) {
        int result = 0, a = (int) av & 0xFF, b = (int) bv & 0xFF;
        for (int i = 0; i < 8; ++i) { if ((b & 1) != 0) result ^= a; int hi = a & 0x80; a = (a << 1) & 0xFF; if (hi != 0) a ^= 0x1B; b >>>= 1; }
        return result & 0xFF;
    }
    public static long GFMul(long av, long bv, long irreducible, long width) {
        int result = 0, a = (int) av, b = (int) bv, w = (int) width;
        int mask = (1 << w) - 1;
        while (b != 0) { if ((b & 1) != 0) result ^= a; a <<= 1; if ((a & (1 << w)) != 0) a ^= (int) irreducible; a &= mask; b >>>= 1; }
        return result;
    }
    public static boolean GetBit(long value, long bitIndex) { return (((int) value >>> (int) bitIndex) & 1) != 0; }
    public static long SetBit(long value, long bitIndex, boolean bit) { return bit ? (((int) value | (1 << (int) bitIndex)) & 0xFFFFFFFFL) : (((int) value & ~(1 << (int) bitIndex)) & 0xFFFFFFFFL); }
    public static long BitMask(long bits) { if (bits >= 32) return 0xFFFFFFFFL; if (bits <= 0) return 0; return (1 << (int) bits) - 1; }
    public static int Shr32Signed(long value, long positions) { return (int) value >> (int) positions; }
    public static int PopCount(long value) { return Integer.bitCount((int) value); }
    public static int PopCountFast(long value) { return Integer.bitCount((int) value); }
    public static long MulHi32(long a, long b) { return ((a & 0xFFFFFFFFL) * (b & 0xFFFFFFFFL)) >>> 32; }
    public static int AddMod(long a, long b, long m) { return (int) (((a % m) + (b % m)) % m); }
    public static int SubMod(long a, long b, long m) { return (int) (((a % m) - (b % m) + m) % m); }
    public static int ToShort(long value) { int v = (int) value & 0xFFFF; return v > 32767 ? v - 65536 : v; }
    public static int ToSByte(long value) { int v = (int) value & 0xFF; return v > 127 ? v - 256 : v; }
    public static U8Array EncodeMsgLength64LE(double bitLength) { JsObject s = Split64(bitLength); return Unpack32LE(Js.toLong(s.get("low32"))).concat(Unpack32LE(Js.toLong(s.get("high32")))); }
    public static JsObject Split64(double value) { return JsObject.of("high32", Math.floor(value / 4294967296.0), "low32", (long) Js.toInt32(value)); }
    public static long Add3L64(long al, long bl, long cl) { return (al & 0xFFFFFFFFL) + (bl & 0xFFFFFFFFL) + (cl & 0xFFFFFFFFL); }
    public static int Add3H64(double lowSum, double ah, double bh, double ch) { return Js.toInt32(ah + bh + ch + Js.toInt32(lowSum / 4294967296.0)); }
    public static JsObject RotL64_HL(long high, long low, long nn) {
        int n = (int) nn & 63, h = (int) high, l = (int) low;
        if (n == 0) return JsObject.of("h", h & 0xFFFFFFFFL, "l", l & 0xFFFFFFFFL);
        if (n == 32) return JsObject.of("h", l & 0xFFFFFFFFL, "l", h & 0xFFFFFFFFL);
        if (n < 32) return JsObject.of("h", ((h << n) | (l >>> (32 - n))) & 0xFFFFFFFFL, "l", ((l << n) | (h >>> (32 - n))) & 0xFFFFFFFFL);
        n -= 32;
        return JsObject.of("h", ((l << n) | (h >>> (32 - n))) & 0xFFFFFFFFL, "l", ((h << n) | (l >>> (32 - n))) & 0xFFFFFFFFL);
    }
    public static JsObject RotR64_HL(long high, long low, long nn) {
        int n = (int) nn & 63, h = (int) high, l = (int) low;
        if (n == 0) return JsObject.of("h", h & 0xFFFFFFFFL, "l", l & 0xFFFFFFFFL);
        if (n == 32) return JsObject.of("h", l & 0xFFFFFFFFL, "l", h & 0xFFFFFFFFL);
        if (n < 32) return JsObject.of("h", ((h >>> n) | (l << (32 - n))) & 0xFFFFFFFFL, "l", ((l >>> n) | (h << (32 - n))) & 0xFFFFFFFFL);
        n -= 32;
        return JsObject.of("h", ((l >>> n) | (h << (32 - n))) & 0xFFFFFFFFL, "l", ((h >>> n) | (l << (32 - n))) & 0xFFFFFFFFL);
    }

    // ---- BigInt helpers
    public static java.math.BigInteger ToLong(java.math.BigInteger v) { java.math.BigInteger x = v.and(MASK64); return x.testBit(63) ? x.subtract(Js.TWO64) : x; }
    public static java.math.BigInteger ToQWord(java.math.BigInteger v) { return v.and(MASK64); }
    public static java.math.BigInteger GetBitN(java.math.BigInteger v, long bitIndex) { return v.shiftRight((int) bitIndex).and(java.math.BigInteger.ONE); }
    public static java.math.BigInteger SetBitN(java.math.BigInteger v, long bitIndex, java.math.BigInteger bit) { return bit.testBit(0) ? v.setBit((int) bitIndex) : v.clearBit((int) bitIndex); }
    public static java.math.BigInteger AndN(java.math.BigInteger a, java.math.BigInteger b) { return a.and(b); }
    public static java.math.BigInteger OrN(java.math.BigInteger a, java.math.BigInteger b) { return a.or(b); }
    public static java.math.BigInteger XorN(java.math.BigInteger a, java.math.BigInteger b) { return a.xor(b); }
    public static java.math.BigInteger MulModN(java.math.BigInteger a, java.math.BigInteger b, java.math.BigInteger m) { return a.remainder(m).multiply(b.remainder(m)).remainder(m); }
    public static java.math.BigInteger SquareModN(java.math.BigInteger a, java.math.BigInteger m) { java.math.BigInteger r = a.remainder(m); return r.multiply(r).remainder(m); }
    public static java.math.BigInteger ModPowN(java.math.BigInteger base, java.math.BigInteger exp, java.math.BigInteger m) {
        if (m.equals(java.math.BigInteger.ONE)) return java.math.BigInteger.ZERO;
        if (exp.signum() == 0) return java.math.BigInteger.ONE;
        java.math.BigInteger result = java.math.BigInteger.ONE; base = base.remainder(m);
        while (exp.signum() > 0) { if (exp.testBit(0)) result = result.multiply(base).remainder(m); exp = exp.shiftRight(1); base = base.multiply(base).remainder(m); }
        return result;
    }
    public static java.math.BigInteger GcdN(java.math.BigInteger a, java.math.BigInteger b) { return a.abs().gcd(b.abs()); }
    public static java.math.BigInteger ModN(java.math.BigInteger a, java.math.BigInteger m) {
        if (m.signum() <= 0) throw new JsError("RangeError", "ModN requires a positive modulus");
        java.math.BigInteger r = a.remainder(m); return r.signum() < 0 ? r.add(m) : r;
    }
    public static java.math.BigInteger ModInverseN(java.math.BigInteger a, java.math.BigInteger m) {
        java.math.BigInteger oldR = ModN(a, m), r = m, oldS = java.math.BigInteger.ONE, s = java.math.BigInteger.ZERO;
        while (r.signum() != 0) {
            java.math.BigInteger q = oldR.divide(r);
            java.math.BigInteger nextR = oldR.subtract(q.multiply(r)); oldR = r; r = nextR;
            java.math.BigInteger nextS = oldS.subtract(q.multiply(s)); oldS = s; s = nextS;
        }
        if (!oldR.equals(java.math.BigInteger.ONE)) throw new JsError("RangeError", "ModInverseN: value has no inverse modulo m");
        return ModN(oldS, m);
    }
    public static int BitCountN(java.math.BigInteger v) { if (v.signum() == 0) return 1; return v.abs().bitLength(); }

    public static _BitStream CreateBitStream(U8Array initialBytes) { return new _BitStream(initialBytes); }
    public static _BitStream CreateBitStream() { return new _BitStream(null); }
}

/** OpCodes._BitStream */
final class _BitStream {
    public int buffer; public int bufferBits; public U8Array byteArray = new U8Array(); public int readPosition; public int totalBitsWritten;
    public _BitStream(U8Array initialBytes) { if (initialBytes != null && initialBytes.length() > 0) { byteArray = initialBytes.slice(); totalBitsWritten = initialBytes.length() * 8; } }
    public _BitStream() { this(null); }
    public void writeBits(long valueL, long numBitsL) {
        int numBits = (int) numBitsL;
        if (numBits <= 0 || numBits > 32) throw new JsError("BitStream.writeBits: numBits must be 1-32");
        int mask = numBits == 32 ? 0xFFFFFFFF : (1 << numBits) - 1;
        int value = (int) valueL & mask;
        buffer = (buffer << numBits) | value; bufferBits += numBits; totalBitsWritten += numBits;
        while (bufferBits >= 8) { bufferBits -= 8; byteArray.push((buffer >>> bufferBits) & 0xFF); if (bufferBits > 0) buffer &= (1 << bufferBits) - 1; else buffer = 0; }
    }
    public void writeBit(long bit) { writeBits(bit & 1, 1); }
    public void writeByte(long b) { writeBits(b & 0xFF, 8); }
    public void writeBytes(U8Array bytes) { for (int i = 0; i < bytes.length(); i++) writeByte(bytes.get(i)); }
    public void writeUint16BE(long v) { writeBits((v >>> 8) & 0xFF, 8); writeBits(v & 0xFF, 8); }
    public void writeUint16LE(long v) { writeBits(v & 0xFF, 8); writeBits((v >>> 8) & 0xFF, 8); }
    public void writeUint32BE(long v) { writeBits((v >>> 24) & 0xFF, 8); writeBits((v >>> 16) & 0xFF, 8); writeBits((v >>> 8) & 0xFF, 8); writeBits(v & 0xFF, 8); }
    public void writeUint32LE(long v) { writeBits(v & 0xFF, 8); writeBits((v >>> 8) & 0xFF, 8); writeBits((v >>> 16) & 0xFF, 8); writeBits((v >>> 24) & 0xFF, 8); }
    public long readBits(long numBitsL) {
        int numBits = (int) numBitsL;
        if (numBits <= 0 || numBits > 32) throw new JsError("BitStream.readBits: numBits must be 1-32");
        int result = 0, bitsRead = 0;
        while (bitsRead < numBits) {
            int byteIndex = readPosition / 8, bitOffset = readPosition % 8;
            if (byteIndex >= byteArray.length()) { if (bitsRead == 0) throw new JsError("BitStream.readBits: No more data available"); break; }
            int currentByte = byteArray.get(byteIndex), available = 8 - bitOffset, take = Math.min(numBits - bitsRead, available);
            int mask = (1 << take) - 1;
            result = (result << take) | ((currentByte >>> (available - take)) & mask);
            bitsRead += take; readPosition += take;
        }
        return result;
    }
    public long readBit() { return readBits(1); }
    public int readByte() { return (int) readBits(8) & 0xFF; }
    public U8Array readBytes(long count) { U8Array r = new U8Array(); for (int i = 0; i < count; i++) r.push(readByte()); return r; }
    public long peekBits(long n) { int saved = readPosition; long r = readBits(n); readPosition = saved; return r; }
    public void skipBits(long n) { readPosition += (int) n; int max = byteArray.length() * 8; if (readPosition > max) readPosition = max; }
    public boolean hasMoreBits() { return readPosition < byteArray.length() * 8; }
    public int getRemainingBits() { return Math.max(0, byteArray.length() * 8 - readPosition); }
    public void resetReadPosition() { readPosition = 0; }
    public void seekBits(long off) { int max = byteArray.length() * 8; int o = (int) off & 0x7FFFFFFF; int c = o > max ? max : o; readPosition = c > 0 ? c : 0; }
    public U8Array toArray(boolean pad) { if (bufferBits > 0 && pad) { buffer = buffer << (8 - bufferBits); byteArray.push(buffer & 0xFF); buffer = 0; bufferBits = 0; } return byteArray.slice(); }
    public U8Array toArray() { return toArray(true); }
    public int getBitLength() { return totalBitsWritten; }
    public int getByteLength() { return byteArray.length() + bufferBits / 8 + (bufferBits % 8 > 0 ? 1 : 0); }
    public void clear() { buffer = 0; bufferBits = 0; byteArray = new U8Array(); readPosition = 0; totalBitsWritten = 0; }
    public _BitStream clone() { _BitStream c = new _BitStream(null); c.buffer = buffer; c.bufferBits = bufferBits; c.byteArray = byteArray.slice(); c.readPosition = readPosition; c.totalBitsWritten = totalBitsWritten; return c; }
    public void writeVarInt(long v) { v &= 0xFFFFFFFFL; while (v >= 0x80) { writeByte((v & 0x7F) | 0x80); v >>>= 7; } writeByte(v & 0x7F); }
    public long readVarInt() { int result = 0, shift = 0, b; do { if (shift >= 32) throw new JsError("BitStream.readVarInt: Integer overflow"); b = readByte(); result |= ((b & 0x7F) << shift); shift += 7; } while ((b & 0x80) != 0); return result & 0xFFFFFFFFL; }
    public void writeUnary(long v) { for (int i = 0; i < v; i++) writeBit(1); writeBit(0); }
    public int readUnary() { int c = 0; while (hasMoreBits() && readBit() == 1) c++; return c; }
    public void alignToByte() { while (bufferBits % 8 != 0) writeBit(0); }
    public boolean isAligned() { return bufferBits % 8 == 0; }
}
`;

  /** The runtime's Java source (cached). */
  let runtimeCache = null;
  function javaRuntime() {
    if (!runtimeCache) runtimeCache = [RUNTIME_CORE, ...ARRAY_KINDS.map(arrayClass), RUNTIME_FRAMEWORK, RUNTIME_OPCODES].join('\n');
    return runtimeCache;
  }

  class JavaPlugin extends LanguagePlugin {
    constructor() {
      super();
      this.name = 'Java';
      this.extension = 'java';
      this.icon = '☕';
      this.description = 'Java language code generator';
      this.mimeType = 'text/x-java';
      this.version = 'Java 17+';
      this.options = {
        indent: '    ',
        lineEnding: '\n',
        packageName: '',
        className: 'GeneratedClass',
        includeRuntime: true
      };
    }

    /**
     * Generate Java code from the IL AST.
     * @param {Object} ast - IL AST
     * @param {Object} options - generation options (className, packageName, includeRuntime)
     * @returns {CodeGenerationResult}
     */
    GenerateFromAST(ast, options = {}) {
      try {
        const merged = { ...this.options, ...options };
        if (!ast || typeof ast !== 'object') return this.CreateErrorResult('Invalid AST: must be an object');
        const transformer = new JavaTransformer({ className: merged.className || 'GeneratedClass' });
        const unit = transformer.transform(ast, { libraries: merged.libraries || [] });
        const emitter = new JavaEmitter({ indent: merged.indent, newline: merged.lineEnding });
        const code = emitter.emit(unit, {
          packageName: merged.packageName || null,
          runtime: merged.includeRuntime === false ? null : javaRuntime()
        });
        return this.CreateSuccessResult(code, [], transformer.warnings || []);
      } catch (error) {
        return this.CreateErrorResult('AST pipeline generation failed: ' + error.message);
      }
    }

    /** The runtime the generated code needs. */
    GetRuntime() { return javaRuntime(); }

    GetCompilerInfo() {
      return {
        name: this.name,
        compilerName: 'Java Development Kit (JDK)',
        downloadUrl: 'https://adoptium.net/',
        installInstructions: 'Install a JDK 17 or newer (e.g. Eclipse Temurin) and put its bin directory on PATH; verify with: javac -version',
        verifyCommand: 'javac -version',
        packageManager: 'Maven/Gradle',
        documentation: 'https://docs.oracle.com/en/java/'
      };
    }
  }

  const javaPlugin = new JavaPlugin();
  LanguagePlugins.Add(javaPlugin);
  if (typeof module !== 'undefined' && module.exports) module.exports = javaPlugin;
})();
