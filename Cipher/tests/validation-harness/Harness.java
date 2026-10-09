// ---------------------------------------------------------------------------
// Vector harness appended to a transpiled Java algorithm by
// tests/TranspilerValidation.js (the VALIDATION category). (c)2006-2025 Hawkynt
//
// The placeholders below are replaced when the harness is generated: the spec
// of the reference run (the algorithms the file registers and, per vector, the
// fields to apply in TestEngine order and the checks the reference passed) and
// the generated classes whose initialisers register the algorithms. Fields are
// applied with the semantics of TestEngine.ConfigureInstance: a field that
// reaches no setter or property, or whose setter throws, fails the vector. The
// runtime's framework classes mirror AlgorithmFramework.js member for member,
// so `field in instance` is the same question in both languages.
//
// Output protocol: @@ALGO <a> MISSING <msg> | @@ALGO <a> COUNT <n> |
//                  @@VEC <a> <v> PASS | @@VEC <a> <v> FAIL <msg> | @@DONE
// ---------------------------------------------------------------------------

/** The identity cipher of tests/DummyBlockCipher.js, for mode vectors naming no cipher. */
final class ValidationDummyCipherAlgorithm extends BlockCipherAlgorithm {
    ValidationDummyCipherAlgorithm() { name = "DummyBlockCipher"; }
    @Override public IAlgorithmInstance CreateInstance(boolean isInverse) { return new ValidationDummyCipherInstance(this); }
}

final class ValidationDummyCipherInstance extends IBlockCipherInstance {
    private final U8Array buffer = new U8Array();
    ValidationDummyCipherInstance(Algorithm algorithm) { super(algorithm); BlockSize = 16; }
    @Override public void Feed(U8Array data) { if (data != null) buffer.pushAll(data); }
    @Override public U8Array Result() {
        if (_key == null || _key.length() == 0) throw new JsError("Key not set");
        U8Array output = new U8Array();
        for (int i = 0; i < buffer.length(); i += 16)
            for (int j = 0; j < 16; ++j)
                output.push(((i + j < buffer.length() ? buffer.get(i + j) : 0) ^ _key.get(j % _key.length())) & 0xFF);
        buffer.setLength(0);
        return output;
    }
    @Override public U8Array EncryptBlock(U8Array block) { U8Array r = new U8Array(); for (int j = 0; j < block.length(); ++j) r.push((block.get(j) ^ _key.get(j % _key.length())) & 0xFF); return r; }
    @Override public U8Array DecryptBlock(U8Array block) { return EncryptBlock(block); }
}

public final class TestHarness {
    private static final String SPEC_JSON = __SPEC_JSON__;
    private static final String[] GENERATED_UNITS = { __GENERATED_UNITS__ };
    private static final java.util.Map<String, String> CIPHER_NAMES = java.util.Map.of(
        "AES", "Rijndael (AES)", "Rijndael", "Rijndael (AES)", "DES", "DES", "3DES", "3DES (Triple DES)",
        "Blowfish", "Blowfish", "Camellia", "Camellia", "ARIA", "ARIA");
    private static final String[] DEFAULT_BYTES = null;
    private static String initError = null;

    public static void main(String[] args) {
        for (String unit : GENERATED_UNITS) {
            try {
                Class.forName(unit, true, TestHarness.class.getClassLoader());
            } catch (Throwable e) {
                if (initError == null) initError = unit + ": " + describe(e);
            }
        }
        Object spec = new Json(SPEC_JSON).value();
        java.util.List<?> algorithms = (java.util.List<?>) ((java.util.Map<?, ?>) spec).get("algorithms");
        for (int i = 0; i < algorithms.size(); ++i) runAlgorithm(i, (java.util.Map<?, ?>) algorithms.get(i));
        System.out.println("@@DONE");
        System.out.flush();
        System.exit(0);
    }

    private static void runAlgorithm(int index, java.util.Map<?, ?> spec) {
        String name = (String) spec.get("name");
        Algorithm algorithm = AlgorithmFramework.Find(name);
        if (algorithm == null) {
            System.out.println("@@ALGO " + index + " MISSING no algorithm named '" + oneLine(name) + "' is registered" + (initError != null ? " (" + oneLine(initError) + ")" : ""));
            return;
        }
        JsArray<TestCase> tests = algorithm.tests != null ? algorithm.tests : new JsArray<>();
        java.util.List<?> vectors = (java.util.List<?>) spec.get("vectors");
        if (tests.length() != vectors.size()) System.out.println("@@ALGO " + index + " COUNT " + tests.length());
        for (int v = 0; v < vectors.size(); ++v) {
            String failure;
            try {
                failure = v < tests.length() ? checkVector(algorithm, spec, (java.util.Map<?, ?>) vectors.get(v), tests.get(v)) : "vector missing";
            } catch (Throwable e) {
                failure = describe(e);
            }
            System.out.println("@@VEC " + index + " " + v + (failure == null ? " PASS" : " FAIL " + oneLine(failure)));
        }
    }

    // ------------------------------------------------------------ vectors

    private static String checkVector(Algorithm algorithm, java.util.Map<?, ?> spec, java.util.Map<?, ?> plan, TestCase vector) {
        boolean inverse = Boolean.TRUE.equals(plan.get("inverse"));
        Object input = vector.input;
        Object output = runOnce(algorithm, spec, plan, vector, inverse, input);
        if (Boolean.TRUE.equals(plan.get("expect"))) {
            Object expected = vector.expected;
            if (!sameBytes(output, expected)) return "output " + hex(output) + " expected " + hex(expected);
        }
        Object rt = plan.get("rt");
        if ("decode".equals(rt)) {
            Object back = runOnce(algorithm, spec, plan, vector, !inverse, output);
            if (!sameBytes(back, input)) return "round trip gave " + hex(back) + " expected the input " + hex(input);
        } else if ("stability".equals(rt)) {
            Object decoded = runOnce(algorithm, spec, plan, vector, true, output);
            Object again = runOnce(algorithm, spec, plan, vector, false, decoded);
            if (!sameBytes(again, output)) return "encoding is not stable: re-encoding gave " + hex(again) + " expected " + hex(output);
        }
        return null;
    }

    private static Object runOnce(Algorithm algorithm, java.util.Map<?, ?> spec, java.util.Map<?, ?> plan, TestCase vector, boolean inverse, Object data) {
        IAlgorithmInstance instance = algorithm.CreateInstance(inverse);
        if (instance == null) throw new IllegalStateException("Failed to create algorithm instance (inverse=" + inverse + ")");
        configure(spec, plan, instance, vector);
        instance.Feed(data == null ? null : Js.toU8(data));
        return instance.Result();
    }

    private static void configure(java.util.Map<?, ?> spec, java.util.Map<?, ?> plan, IAlgorithmInstance instance, TestCase vector) {
        java.util.Set<String> applied = new java.util.HashSet<>();
        java.util.List<?> fields = (java.util.List<?>) plan.get("fields");
        String name = (String) spec.get("name");
        if (Boolean.TRUE.equals(spec.get("isMode"))) {
            java.util.Map<?, ?> mode = (java.util.Map<?, ?>) plan.get("mode");
            boolean multiKey = Boolean.TRUE.equals(spec.get("multiKey"));
            Object cipher;
            if (mode.get("cipher") instanceof String) {
                String cipherName = (String) mode.get("cipher");
                Algorithm found = AlgorithmFramework.Find(CIPHER_NAMES.getOrDefault(cipherName, cipherName));
                if (found == null) found = AlgorithmFramework.Find(cipherName);
                cipher = found == null ? null : found.CreateInstance(false);
                if (cipher == null) throw new IllegalStateException("Vector field 'cipher' is not applied: no block cipher named '" + cipherName + "' is registered");
            } else {
                cipher = new ValidationDummyCipherAlgorithm().CreateInstance(false);
            }
            if (!multiKey) {
                Object key = Boolean.TRUE.equals(mode.get("keyTruthy")) ? vector.field("key") : defaultBytes();
                Js.setProp(cipher, "key", key);
            }
            if (fields.contains("cipher")) applied.add("cipher");
            if (fields.contains("key") && !multiKey) applied.add("key");
            java.lang.reflect.Method setBlockCipher = findSetter(instance, "setBlockCipher");
            if (setBlockCipher != null) invoke(setBlockCipher, instance, cipher);
            java.lang.reflect.Method setIV = findSetter(instance, "setIV");
            if (setIV != null) {
                if (Boolean.TRUE.equals(mode.get("ivTruthy"))) {
                    Object iv = vector.field("iv");
                    setField("iv", () -> invoke(setIV, instance, iv));
                    applied.add("iv");
                } else {
                    invoke(setIV, instance, defaultBytes());
                }
            }
        }

        for (Object stepObj : (java.util.List<?>) plan.get("steps")) {
            java.util.Map<?, ?> step = (java.util.Map<?, ?>) stepObj;
            String field = (String) step.get("field");
            boolean jsNull = Boolean.TRUE.equals(step.get("isNull"));
            if (!jsNull && !vector.hasField(field)) throw new IllegalStateException("Vector field '" + field + "' is missing from the transpiled vector");
            Object value = vector.field(field);
            String kind = (String) step.get("kind");
            String setter = (String) step.get("setter");
            if ("kek".equals(kind)) {
                boolean asKek = applyProperty(instance, "kek", "setKEK", value);
                boolean asKey = findSetter(instance, "setKEK") == null && findSetter(instance, "setKey") != null && applyProperty(instance, "key", "setKey", value);
                if (asKek || asKey) applied.add("kek");
            } else if (applyProperty(instance, field, setter, value)) {
                applied.add(field);
            }
        }

        for (Object f : fields)
            if (!applied.contains(f))
                throw new IllegalStateException("Vector field '" + f + "' is not applied: " + name + " has no setter or property of that name");
    }

    private static boolean applyProperty(Object instance, String field, String setter, Object value) {
        if (setter != null) {
            java.lang.reflect.Method method = findSetter(instance, setter);
            if (method != null) {
                setField(field, () -> invoke(method, instance, value));
                return true;
            }
        }
        if (Js.hasMember(instance, field)) {
            setField(field, () -> Js.setProp(instance, field, value));
            return true;
        }
        return false;
    }

    private static void setField(String field, Runnable apply) {
        try {
            apply.run();
        } catch (Throwable e) {
            throw new IllegalStateException("Setting vector field '" + field + "' failed: " + describe(e));
        }
    }

    /** A setter method of that JavaScript name taking one argument (the shortest overload taking at least one). */
    private static java.lang.reflect.Method findSetter(Object instance, String setter) {
        java.lang.reflect.Method best = null;
        for (Class<?> k = instance.getClass(); k != null && k != Object.class; k = k.getSuperclass())
            for (java.lang.reflect.Method m : k.getDeclaredMethods())
                if (m.getName().equals(setter) && !java.lang.reflect.Modifier.isStatic(m.getModifiers()) && m.getParameterCount() >= 1 && !m.isBridge())
                    if (best == null || m.getParameterCount() < best.getParameterCount()) best = m;
        if (best != null) best.setAccessible(true);
        return best;
    }

    private static void invoke(java.lang.reflect.Method method, Object instance, Object value) {
        Class<?>[] types = method.getParameterTypes();
        Object[] args = new Object[types.length];
        args[0] = Js.coerce(value, types[0]);
        for (int i = 1; i < types.length; ++i) args[i] = Js.coerce(null, types[i]);
        try {
            method.invoke(instance, args);
        } catch (java.lang.reflect.InvocationTargetException e) {
            Throwable t = e.getCause();
            if (t instanceof RuntimeException) throw (RuntimeException) t;
            if (t instanceof Error) throw (Error) t;
            throw new RuntimeException(t);
        } catch (IllegalAccessException e) {
            throw new RuntimeException(e);
        }
    }

    // ------------------------------------------------------------ values

    private static U8Array defaultBytes() { U8Array r = new U8Array(16); for (int i = 0; i < 16; ++i) r.set(i, i); return r; }

    private static boolean sameBytes(Object left, Object right) {
        if (!(left instanceof JsArrayLike) || !(right instanceof JsArrayLike)) return false;
        JsArrayLike a = (JsArrayLike) left, b = (JsArrayLike) right;
        if (a.length() != b.length()) return false;
        for (int i = 0; i < a.length(); ++i) if (!Js.strictEq(a.getBoxed(i), b.getBoxed(i))) return false;
        return true;
    }

    private static String hex(Object value) {
        if (!(value instanceof JsArrayLike)) return value == null ? "<null>" : "<" + Js.str(value) + ">";
        JsArrayLike a = (JsArrayLike) value;
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < a.length(); ++i) {
            Object item = a.getBoxed(i);
            if (item instanceof Number && !(item instanceof java.math.BigInteger)) {
                double d = ((Number) item).doubleValue();
                if (d == Math.floor(d) && d >= 0 && d < 256) { int b = (int) d; sb.append(Character.forDigit(b >> 4, 16)).append(Character.forDigit(b & 15, 16)); continue; }
            }
            sb.append('<').append(Js.str(item)).append('>');
        }
        return sb.toString();
    }

    private static String oneLine(String text) { return text == null ? "" : text.replaceAll("\\s*[\\r\\n]+\\s*", " | "); }

    private static String describe(Throwable e) {
        while ((e instanceof java.lang.reflect.InvocationTargetException || e instanceof ExceptionInInitializerError) && e.getCause() != null) e = e.getCause();
        String type = e instanceof JsError ? ((JsError) e).name : e.getClass().getSimpleName();
        StackTraceElement at = null;
        for (StackTraceElement s : e.getStackTrace()) if (!s.getClassName().startsWith("java.") && !s.getClassName().startsWith("jdk.")) { at = s; break; }
        return type + ": " + e.getMessage() + (at != null && !(e instanceof JsError) ? " at " + at.getClassName() + "." + at.getMethodName() + ":" + at.getLineNumber() : "");
    }

    /** A minimal JSON reader for the spec (objects, arrays, strings, numbers, booleans, null). */
    private static final class Json {
        private final String s; private int i;
        Json(String s) { this.s = s; }
        Object value() {
            ws();
            char c = s.charAt(i);
            if (c == '{') { java.util.Map<String, Object> m = new java.util.LinkedHashMap<>(); i++; ws(); if (s.charAt(i) == '}') { i++; return m; }
                while (true) { ws(); String k = (String) value(); ws(); i++; m.put(k, value()); ws(); if (s.charAt(i++) == '}') return m; } }
            if (c == '[') { java.util.List<Object> l = new java.util.ArrayList<>(); i++; ws(); if (s.charAt(i) == ']') { i++; return l; }
                while (true) { l.add(value()); ws(); if (s.charAt(i++) == ']') return l; } }
            if (c == '"') {
                StringBuilder sb = new StringBuilder(); i++;
                while (s.charAt(i) != '"') {
                    char ch = s.charAt(i++);
                    if (ch == '\\') {
                        char e = s.charAt(i++);
                        switch (e) {
                            case 'n': sb.append('\n'); break; case 't': sb.append('\t'); break; case 'r': sb.append('\r'); break;
                            case 'b': sb.append('\b'); break; case 'f': sb.append('\f'); break;
                            case 'u': sb.append((char) Integer.parseInt(s.substring(i, i + 4), 16)); i += 4; break;
                            default: sb.append(e);
                        }
                    } else sb.append(ch);
                }
                i++;
                return sb.toString();
            }
            if (s.startsWith("true", i)) { i += 4; return Boolean.TRUE; }
            if (s.startsWith("false", i)) { i += 5; return Boolean.FALSE; }
            if (s.startsWith("null", i)) { i += 4; return null; }
            int start = i;
            while (i < s.length() && "+-0123456789.eE".indexOf(s.charAt(i)) >= 0) i++;
            return Double.parseDouble(s.substring(start, i));
        }
        private void ws() { while (i < s.length() && Character.isWhitespace(s.charAt(i))) i++; }
    }
}
