// ---------------------------------------------------------------------------
// Vector harness appended to a transpiled Kotlin algorithm by
// tests/TranspilerValidation.js (the VALIDATION category). (c)2006-2025 Hawkynt
//
// The Kotlin twin of Harness.java. The placeholders below are replaced when
// the harness is generated: the spec of the reference run (the algorithms the
// file registers and, per vector, the fields to apply in TestEngine order and
// the checks the reference passed) and the generated units whose initialisers
// register the algorithms. Fields are applied with the semantics of
// TestEngine.ConfigureInstance: a field that reaches no setter or property, or
// whose setter throws, fails the vector. The runtime's framework classes
// mirror AlgorithmFramework.js member for member, so `field in instance` is the
// same question in both languages.
//
// Output protocol: @@ALGO <a> MISSING <msg> | @@ALGO <a> COUNT <n> |
//                  @@VEC <a> <v> PASS | @@VEC <a> <v> FAIL <msg> | @@DONE
// ---------------------------------------------------------------------------

/** The identity cipher of tests/DummyBlockCipher.js, for mode vectors naming no cipher. */
class ValidationDummyCipherAlgorithm : BlockCipherAlgorithm() {
    init { name = "DummyBlockCipher" }
    override fun CreateInstance(isInverse: Boolean): IAlgorithmInstance? = ValidationDummyCipherInstance(this)
}

class ValidationDummyCipherInstance(algorithm: Algorithm?) : IBlockCipherInstance(algorithm) {
    private val buffer = U8Array()
    init { BlockSize = 16 }
    override fun Feed(data: U8Array?) { if (data != null) buffer.pushAll(data) }
    override fun Result(): U8Array? {
        val key = _key
        if (key == null || key.length() == 0) throw JsError("Key not set")
        val output = U8Array()
        var i = 0
        while (i < buffer.length()) {
            for (j in 0 until 16) output.push(((if (i + j < buffer.length()) buffer.get(i + j) else 0) xor key.get(j % key.length())) and 0xFF)
            i += 16
        }
        buffer.setLength(0)
        return output
    }
    override fun EncryptBlock(block: U8Array?): U8Array? { val r = U8Array(); for (j in 0 until block!!.length()) r.push((block.get(j) xor _key!!.get(j % _key!!.length())) and 0xFF); return r }
    override fun DecryptBlock(block: U8Array?): U8Array? = EncryptBlock(block)
}

object TestHarness {
    private const val SPEC_JSON: String = __SPEC_JSON__
    private val GENERATED_UNITS: Array<String> = arrayOf(__GENERATED_UNITS__)
    private val CIPHER_NAMES: Map<String, String> = mapOf(
        "AES" to "Rijndael (AES)", "Rijndael" to "Rijndael (AES)", "DES" to "DES", "3DES" to "3DES (Triple DES)",
        "Blowfish" to "Blowfish", "Camellia" to "Camellia", "ARIA" to "ARIA")
    private var initError: String? = null

    @JvmStatic fun main(args: Array<String>) {
        for (unit in GENERATED_UNITS) {
            try {
                Class.forName(unit, true, TestHarness::class.java.classLoader)
            } catch (e: Throwable) {
                if (initError == null) initError = unit + ": " + describe(e)
            }
        }
        val spec = Json(SPEC_JSON).value() as Map<*, *>
        val algorithms = spec["algorithms"] as List<*>
        for (i in algorithms.indices) runAlgorithm(i, algorithms[i] as Map<*, *>)
        println("@@DONE")
        System.out.flush()
        System.exit(0)
    }

    private fun runAlgorithm(index: Int, spec: Map<*, *>) {
        val name = spec["name"] as String
        val algorithm = AlgorithmFramework.Find(name)
        if (algorithm == null) {
            println("@@ALGO " + index + " MISSING no algorithm named '" + oneLine(name) + "' is registered" + (if (initError != null) " (" + oneLine(initError) + ")" else ""))
            return
        }
        val tests = algorithm.tests ?: JsArray()
        val vectors = spec["vectors"] as List<*>
        if (tests.length() != vectors.size) println("@@ALGO " + index + " COUNT " + tests.length())
        for (v in vectors.indices) {
            val failure: String? = try {
                if (v < tests.length()) checkVector(algorithm, spec, vectors[v] as Map<*, *>, tests.get(v)!!) else "vector missing"
            } catch (e: Throwable) {
                describe(e)
            }
            println("@@VEC " + index + " " + v + (if (failure == null) " PASS" else " FAIL " + oneLine(failure)))
        }
    }

    // ------------------------------------------------------------ vectors

    private fun checkVector(algorithm: Algorithm, spec: Map<*, *>, plan: Map<*, *>, vector: TestCase): String? {
        val inverse = true == plan["inverse"]
        val input: Any? = vector.input
        val output = runOnce(algorithm, spec, plan, vector, inverse, input)
        if (true == plan["expect"]) {
            val expected: Any? = vector.expected
            if (!sameBytes(output, expected)) return "output " + hex(output) + " expected " + hex(expected)
        }
        val rt = plan["rt"]
        if ("decode" == rt) {
            val back = runOnce(algorithm, spec, plan, vector, !inverse, output)
            if (!sameBytes(back, input)) return "round trip gave " + hex(back) + " expected the input " + hex(input)
        } else if ("stability" == rt) {
            val decoded = runOnce(algorithm, spec, plan, vector, true, output)
            val again = runOnce(algorithm, spec, plan, vector, false, decoded)
            if (!sameBytes(again, output)) return "encoding is not stable: re-encoding gave " + hex(again) + " expected " + hex(output)
        }
        return null
    }

    private fun runOnce(algorithm: Algorithm, spec: Map<*, *>, plan: Map<*, *>, vector: TestCase, inverse: Boolean, data: Any?): Any? {
        val instance = algorithm.CreateInstance(inverse) ?: throw IllegalStateException("Failed to create algorithm instance (inverse=" + inverse + ")")
        configure(spec, plan, instance, vector)
        instance.Feed(if (data == null) null else Js.toU8(data))
        return instance.Result()
    }

    private fun configure(spec: Map<*, *>, plan: Map<*, *>, instance: IAlgorithmInstance, vector: TestCase) {
        val applied = HashSet<String>()
        val fields = plan["fields"] as List<*>
        val name = spec["name"] as String
        if (true == spec["isMode"]) {
            val mode = plan["mode"] as Map<*, *>
            val multiKey = true == spec["multiKey"]
            val cipher: Any?
            if (mode["cipher"] is String) {
                val cipherName = mode["cipher"] as String
                var found = AlgorithmFramework.Find(CIPHER_NAMES[cipherName] ?: cipherName)
                if (found == null) found = AlgorithmFramework.Find(cipherName)
                cipher = found?.CreateInstance(false)
                if (cipher == null) throw IllegalStateException("Vector field 'cipher' is not applied: no block cipher named '" + cipherName + "' is registered")
            } else {
                cipher = ValidationDummyCipherAlgorithm().CreateInstance(false)
            }
            if (!multiKey) {
                val key: Any? = if (true == mode["keyTruthy"]) vector.field("key") else defaultBytes()
                Js.setProp(cipher, "key", key)
            }
            if (fields.contains("cipher")) applied.add("cipher")
            if (fields.contains("key") && !multiKey) applied.add("key")
            val setBlockCipher = findSetter(instance, "setBlockCipher")
            if (setBlockCipher != null) invoke(setBlockCipher, instance, cipher)
            val setIV = findSetter(instance, "setIV")
            if (setIV != null) {
                if (true == mode["ivTruthy"]) {
                    val iv = vector.field("iv")
                    setField("iv") { invoke(setIV, instance, iv) }
                    applied.add("iv")
                } else {
                    invoke(setIV, instance, defaultBytes())
                }
            }
        }

        for (stepObj in plan["steps"] as List<*>) {
            val step = stepObj as Map<*, *>
            val field = step["field"] as String
            val jsNull = true == step["isNull"]
            if (!jsNull && !vector.hasField(field)) throw IllegalStateException("Vector field '" + field + "' is missing from the transpiled vector")
            val value = vector.field(field)
            val kind = step["kind"] as String?
            val setter = step["setter"] as String?
            if ("kek" == kind) {
                val asKek = applyProperty(instance, "kek", "setKEK", value)
                val asKey = findSetter(instance, "setKEK") == null && findSetter(instance, "setKey") != null && applyProperty(instance, "key", "setKey", value)
                if (asKek || asKey) applied.add("kek")
            } else if (applyProperty(instance, field, setter, value)) {
                applied.add(field)
            }
        }

        for (f in fields)
            if (!applied.contains(f))
                throw IllegalStateException("Vector field '" + f + "' is not applied: " + name + " has no setter or property of that name")
    }

    private fun applyProperty(instance: Any, field: String, setter: String?, value: Any?): Boolean {
        if (setter != null) {
            val method = findSetter(instance, setter)
            if (method != null) {
                setField(field) { invoke(method, instance, value) }
                return true
            }
        }
        if (Js.hasMember(instance, field)) {
            setField(field) { Js.setProp(instance, field, value) }
            return true
        }
        return false
    }

    private fun setField(field: String, apply: () -> Unit) {
        try {
            apply()
        } catch (e: Throwable) {
            throw IllegalStateException("Setting vector field '" + field + "' failed: " + describe(e))
        }
    }

    /** A setter method of that JavaScript name taking one argument (the shortest overload taking at least one). */
    private fun findSetter(instance: Any, setter: String): java.lang.reflect.Method? {
        var best: java.lang.reflect.Method? = null
        var k: Class<*>? = instance.javaClass
        while (k != null && k != Any::class.java) {
            for (m in k.declaredMethods)
                if (m.name == setter && !java.lang.reflect.Modifier.isStatic(m.modifiers) && m.parameterCount >= 1 && !m.isBridge)
                    if (best == null || m.parameterCount < best.parameterCount) best = m
            k = k.superclass
        }
        if (best != null) best.isAccessible = true
        return best
    }

    private fun invoke(method: java.lang.reflect.Method, instance: Any, value: Any?) {
        val types = method.parameterTypes
        val args = arrayOfNulls<Any?>(types.size)
        args[0] = Js.coerce(value, types[0])
        for (i in 1 until types.size) args[i] = Js.coerce(null, types[i])
        try {
            method.invoke(instance, *args)
        } catch (e: java.lang.reflect.InvocationTargetException) {
            val t = e.cause
            if (t is RuntimeException) throw t
            if (t is Error) throw t
            throw RuntimeException(t)
        }
    }

    // ------------------------------------------------------------ values

    private fun defaultBytes(): U8Array { val r = U8Array(16); for (i in 0 until 16) r.set(i, i); return r }

    private fun sameBytes(left: Any?, right: Any?): Boolean {
        if (left !is JsArrayLike || right !is JsArrayLike) return false
        if (left.length() != right.length()) return false
        for (i in 0 until left.length()) if (!Js.strictEq(left.getBoxed(i), right.getBoxed(i))) return false
        return true
    }

    private fun hex(value: Any?): String {
        if (value !is JsArrayLike) return if (value == null) "<null>" else "<" + Js.str(value) + ">"
        val sb = StringBuilder()
        for (i in 0 until value.length()) {
            val item = value.getBoxed(i)
            if (item is Number && item !is java.math.BigInteger) {
                val d = item.toDouble()
                if (d == Math.floor(d) && d >= 0 && d < 256) { val b = d.toInt(); sb.append(Character.forDigit(b shr 4, 16)).append(Character.forDigit(b and 15, 16)); continue }
            }
            sb.append('<').append(Js.str(item)).append('>')
        }
        return sb.toString()
    }

    private fun oneLine(text: String?): String = text?.replace(Regex("\\s*[\\r\\n]+\\s*"), " | ") ?: ""

    private fun describe(e0: Throwable): String {
        var e = e0
        while ((e is java.lang.reflect.InvocationTargetException || e is ExceptionInInitializerError) && e.cause != null) e = e.cause!!
        val type = if (e is JsError) e.name else e.javaClass.simpleName
        var at: StackTraceElement? = null
        for (s in e.stackTrace) if (!s.className.startsWith("java.") && !s.className.startsWith("jdk.") && !s.className.startsWith("kotlin.")) { at = s; break }
        return type + ": " + e.message + (if (at != null && e !is JsError) " at " + at.className + "." + at.methodName + ":" + at.lineNumber else "")
    }

    /** A minimal JSON reader for the spec (objects, arrays, strings, numbers, booleans, null). */
    private class Json(private val s: String) {
        private var i = 0
        fun value(): Any? {
            ws()
            val c = s[i]
            if (c == '{') {
                val m = LinkedHashMap<String, Any?>(); i++; ws(); if (s[i] == '}') { i++; return m }
                while (true) { ws(); val k = value() as String; ws(); i++; m[k] = value(); ws(); if (s[i++] == '}') return m }
            }
            if (c == '[') {
                val l = ArrayList<Any?>(); i++; ws(); if (s[i] == ']') { i++; return l }
                while (true) { l.add(value()); ws(); if (s[i++] == ']') return l }
            }
            if (c == '"') {
                val sb = StringBuilder(); i++
                while (s[i] != '"') {
                    val ch = s[i++]
                    if (ch == '\\') {
                        when (val e = s[i++]) {
                            'n' -> sb.append('\n'); 't' -> sb.append('\t'); 'r' -> sb.append('\r')
                            'b' -> sb.append('\b'); 'f' -> sb.append('\u000C')
                            'u' -> { sb.append(Integer.parseInt(s.substring(i, i + 4), 16).toChar()); i += 4 }
                            else -> sb.append(e)
                        }
                    } else sb.append(ch)
                }
                i++
                return sb.toString()
            }
            if (s.startsWith("true", i)) { i += 4; return true }
            if (s.startsWith("false", i)) { i += 5; return false }
            if (s.startsWith("null", i)) { i += 4; return null }
            val start = i
            while (i < s.length && "+-0123456789.eE".indexOf(s[i]) >= 0) i++
            return java.lang.Double.parseDouble(s.substring(start, i))
        }
        private fun ws() { while (i < s.length && Character.isWhitespace(s[i])) i++ }
    }
}
