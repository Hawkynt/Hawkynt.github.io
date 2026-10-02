
// ---------------------------------------------------------------------------
// Vector harness appended to a transpiled C# algorithm by
// tests/TranspilerValidation.js (the VALIDATION category). (c)2006-2025 Hawkynt
//
// The placeholders below are replaced when the harness is generated: the spec of
// the reference run (the algorithms the file registers and, per vector, the
// fields to apply in TestEngine order and the checks the reference passed),
// the AlgorithmFramework class names, and the members those classes give an
// instance in JavaScript. Fields are applied with the semantics of
// TestEngine.ConfigureInstance: a field that reaches no setter or property, or
// whose setter throws, fails the vector. A member only the C# framework stubs
// declare does not count, because the JavaScript instance would not have it.
//
// Output protocol: @@ALGO <a> MISSING <msg> | @@ALGO <a> COUNT <n> |
//                  @@VEC <a> <v> PASS | @@VEC <a> <v> FAIL <msg> | @@DONE
// ---------------------------------------------------------------------------
namespace __NAMESPACE__
{
    using System;
    using System.Collections;
    using System.Collections.Generic;
    using System.Globalization;
    using System.Linq;
    using System.Reflection;
    using System.Text.Json;

__DUMMY_CLASSES__

    public static class ValidationHarness
    {
        private const string SpecJson = @"__SPEC_JSON__";
        private static readonly HashSet<string> FrameworkTypes = new HashSet<string>(new string[] { __FRAMEWORK_TYPES__ });
        private static readonly HashSet<string> FrameworkMembers = new HashSet<string>(new string[] { __FRAMEWORK_MEMBERS__ });
        private static readonly Dictionary<string, string> CipherNames = new Dictionary<string, string>
        {
            { "AES", "Rijndael (AES)" }, { "Rijndael", "Rijndael (AES)" }, { "DES", "DES" }, { "3DES", "3DES (Triple DES)" },
            { "Blowfish", "Blowfish" }, { "Camellia", "Camellia" }, { "ARIA", "ARIA" }
        };
        private const BindingFlags Declared = BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance | BindingFlags.DeclaredOnly;
        private static readonly List<string> DiscoveryErrors = new List<string>();
        private static List<object> knownAlgorithms;

        public static int Main(string[] args)
        {
            using (JsonDocument document = JsonDocument.Parse(SpecJson))
            {
                int index = 0;
                foreach (JsonElement spec in document.RootElement.GetProperty("algorithms").EnumerateArray())
                    RunAlgorithm(index++, spec);
            }
            Console.WriteLine("@@DONE");
            return 0;
        }

        private static void RunAlgorithm(int index, JsonElement spec)
        {
            string name = spec.GetProperty("name").GetString();
            object algorithm;
            try
            {
                algorithm = FindAlgorithm(name, spec.GetProperty("className").GetString());
            }
            catch (Exception e)
            {
                Console.WriteLine("@@ALGO " + index + " MISSING " + OneLine(Describe(e)));
                return;
            }
            if (algorithm == null)
            {
                string why = DiscoveryErrors.Count > 0 ? " (" + string.Join("; ", DiscoveryErrors.Take(3)) + ")" : "";
                Console.WriteLine("@@ALGO " + index + " MISSING no algorithm named '" + OneLine(name) + "' is registered" + OneLine(why));
                return;
            }

            List<object> tests;
            try
            {
                tests = ToObjects(GetMember(algorithm, "Tests")) ?? new List<object>();
            }
            catch (Exception e)
            {
                Console.WriteLine("@@ALGO " + index + " MISSING reading its tests: " + OneLine(Describe(e)));
                return;
            }
            JsonElement vectors = spec.GetProperty("vectors");
            if (tests.Count != vectors.GetArrayLength())
                Console.WriteLine("@@ALGO " + index + " COUNT " + tests.Count);

            int v = 0;
            foreach (JsonElement plan in vectors.EnumerateArray())
            {
                string failure;
                try
                {
                    failure = v < tests.Count ? CheckVector(algorithm, spec, plan, tests[v]) : "vector missing";
                }
                catch (Exception e)
                {
                    failure = Describe(e);
                }
                Console.WriteLine("@@VEC " + index + " " + v + (failure == null ? " PASS" : " FAIL " + OneLine(failure)));
                ++v;
            }
        }

        // ------------------------------------------------------------ vectors

        private static string CheckVector(object algorithm, JsonElement spec, JsonElement plan, object vector)
        {
            bool inverse = plan.GetProperty("inverse").GetBoolean();
            object input = ReadField(vector, "input", false);
            object output = RunOnce(algorithm, spec, plan, vector, inverse, input);
            if (plan.GetProperty("expect").GetBoolean())
            {
                object expected = ReadField(vector, "expected", false);
                if (!SameBytes(output, expected)) return "output " + Hex(output) + " expected " + Hex(expected);
            }
            string rt = plan.GetProperty("rt").ValueKind == JsonValueKind.String ? plan.GetProperty("rt").GetString() : null;
            if (rt == "decode")
            {
                object back = RunOnce(algorithm, spec, plan, vector, !inverse, output);
                if (!SameBytes(back, input)) return "round trip gave " + Hex(back) + " expected the input " + Hex(input);
            }
            else if (rt == "stability")
            {
                object decoded = RunOnce(algorithm, spec, plan, vector, true, output);
                object again = RunOnce(algorithm, spec, plan, vector, false, decoded);
                if (!SameBytes(again, output)) return "encoding is not stable: re-encoding gave " + Hex(again) + " expected " + Hex(output);
            }
            return null;
        }

        private static object RunOnce(object algorithm, JsonElement spec, JsonElement plan, object vector, bool inverse, object data)
        {
            object instance = ((dynamic)algorithm).CreateInstance(inverse);
            if (instance == null) throw new InvalidOperationException("Failed to create algorithm instance (inverse=" + inverse + ")");
            Configure(spec, plan, instance, vector);
            dynamic dynamicInstance = instance;
            dynamicInstance.Feed((dynamic)AsBytesIfPossible(data));
            return (object)dynamicInstance.Result();
        }

        private static void Configure(JsonElement spec, JsonElement plan, object instance, object vector)
        {
            var applied = new HashSet<string>();
            var fields = plan.GetProperty("fields").EnumerateArray().Select(f => f.GetString()).ToList();
            string name = spec.GetProperty("name").GetString();
            if (spec.GetProperty("isMode").GetBoolean())
            {
                JsonElement mode = plan.GetProperty("mode");
                bool multiKey = spec.GetProperty("multiKey").GetBoolean();
                object cipher;
                if (mode.GetProperty("cipher").ValueKind == JsonValueKind.String)
                {
                    string cipherName = mode.GetProperty("cipher").GetString();
                    object found = FindAlgorithm(CipherNames.TryGetValue(cipherName, out var mapped) ? mapped : cipherName, null)
                        ?? FindAlgorithm(cipherName, null);
                    cipher = found == null ? null : (object)((dynamic)found).CreateInstance(false);
                    if (cipher == null)
                        throw new InvalidOperationException("Vector field 'cipher' is not applied: no block cipher named '" + cipherName + "' is registered");
                }
                else
                {
                    cipher = CreateDummyCipher();
                }
                if (!multiKey)
                {
                    object key = mode.GetProperty("keyTruthy").GetBoolean() ? ReadField(vector, "key", false) : DefaultBytes();
                    MemberInfo keyMember = FindMember(cipher, "key");
                    if (keyMember == null) throw new InvalidOperationException("the block cipher instance " + cipher.GetType().Name + " has no key");
                    Assign(keyMember, cipher, key);
                }
                if (fields.Contains("cipher")) applied.Add("cipher");
                if (fields.Contains("key") && !multiKey) applied.Add("key");
                MethodInfo setBlockCipher = FindSetter(instance, "setBlockCipher");
                if (setBlockCipher != null) Invoke(setBlockCipher, instance, cipher);
                MethodInfo setIV = FindSetter(instance, "setIV");
                if (setIV != null)
                {
                    if (mode.GetProperty("ivTruthy").GetBoolean())
                    {
                        object iv = ReadField(vector, "iv", false);
                        SetField("iv", () => Invoke(setIV, instance, iv));
                        applied.Add("iv");
                    }
                    else
                    {
                        Invoke(setIV, instance, DefaultBytes());
                    }
                }
            }

            foreach (JsonElement step in plan.GetProperty("steps").EnumerateArray())
            {
                string field = step.GetProperty("field").GetString();
                bool jsNull = step.TryGetProperty("isNull", out var isNull) && isNull.GetBoolean();
                object value = ReadField(vector, field, !jsNull);
                string kind = step.TryGetProperty("kind", out var k) ? k.GetString() : null;
                string setter = step.TryGetProperty("setter", out var s) ? s.GetString() : null;
                if (kind == "kek")
                {
                    bool asKek = ApplyProperty(instance, "kek", "setKEK", value);
                    bool asKey = FindSetter(instance, "setKEK") == null && FindSetter(instance, "setKey") != null
                        && ApplyProperty(instance, "key", "setKey", value);
                    if (asKek || asKey) applied.Add("kek");
                }
                else if (ApplyProperty(instance, field, setter, value))
                {
                    applied.Add(field);
                }
            }

            foreach (string field in fields)
                if (!applied.Contains(field))
                    throw new InvalidOperationException("Vector field '" + field + "' is not applied: " + name
                        + " has no setter or property of that name" + StubNote(instance, field));
        }

        private static string StubNote(object instance, string field)
        {
            MemberInfo stub = FindMember(instance, field, true);
            return stub == null ? "" : " (only the framework stub " + stub.DeclaringType.Name + "." + stub.Name + " declares one)";
        }

        private static bool ApplyProperty(object instance, string field, string setter, object value)
        {
            if (setter != null)
            {
                MethodInfo method = FindSetter(instance, setter);
                if (method != null)
                {
                    SetField(field, () => Invoke(method, instance, value));
                    return true;
                }
            }
            MemberInfo member = FindMember(instance, field);
            if (member != null)
            {
                SetField(field, () => Assign(member, instance, value));
                return true;
            }
            return false;
        }

        private static void SetField(string field, Action apply)
        {
            try
            {
                apply();
            }
            catch (Exception e)
            {
                throw new InvalidOperationException("Setting vector field '" + field + "' failed: " + Describe(e));
            }
        }

        // ------------------------------------------------------------ members

        private static string Pascal(string name) => string.IsNullOrEmpty(name) ? name : char.ToUpperInvariant(name[0]) + name.Substring(1);

        private static IEnumerable<Type> Chain(Type type)
        {
            for (Type t = type; t != null && t != typeof(object); t = t.BaseType) yield return t;
        }

        private static bool IsFramework(Type type) => FrameworkTypes.Contains(type.Name);

        /// <summary>The most derived setter method of that name taking one argument (more only when optional).</summary>
        private static MethodInfo FindSetter(object instance, string setter)
        {
            string wanted = Pascal(setter);
            foreach (Type type in Chain(instance.GetType()))
            {
                if (IsFramework(type)) continue;
                MethodInfo hit = type.GetMethods(Declared).FirstOrDefault(m => !m.IsSpecialName
                    && (m.Name == wanted || m.Name == setter)
                    && m.GetParameters().Length >= 1 && m.GetParameters().Skip(1).All(p => p.IsOptional));
                if (hit != null) return hit;
            }
            return null;
        }

        /// <summary>
        /// The most derived writable property or field of the field's name. A member a
        /// framework stub declares counts only when the JavaScript framework gives the
        /// instance that member too (stubsOnly: report such a stub member instead).
        /// </summary>
        private static MemberInfo FindMember(object instance, string field, bool stubsOnly = false)
        {
            string[] names = { Pascal(field), field };
            foreach (bool ignoreCase in new[] { false, true })
            {
                foreach (Type type in Chain(instance.GetType()))
                {
                    bool framework = IsFramework(type);
                    bool javaScriptHasIt = FrameworkMembers.Contains(field);
                    bool eligible = stubsOnly ? framework && !javaScriptHasIt : !framework || javaScriptHasIt;
                    if (!eligible) continue;
                    var comparison = ignoreCase ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal;
                    MemberInfo hit = (MemberInfo)type.GetProperties(Declared).FirstOrDefault(p => p.CanWrite && p.GetIndexParameters().Length == 0
                            && names.Any(n => string.Equals(p.Name, n, comparison)))
                        ?? type.GetFields(Declared).FirstOrDefault(f => !f.IsInitOnly && !f.IsLiteral && !f.Name.Contains("<")
                            && names.Any(n => string.Equals(f.Name, n, comparison)));
                    if (hit != null) return hit;
                }
            }
            return null;
        }

        private static object GetMember(object target, string name)
        {
            foreach (Type type in Chain(target.GetType()))
            {
                PropertyInfo property = type.GetProperties(Declared).FirstOrDefault(p => p.Name == name && p.GetIndexParameters().Length == 0);
                if (property != null) return property.GetValue(target);
                FieldInfo field = type.GetFields(Declared).FirstOrDefault(f => f.Name == name);
                if (field != null) return field.GetValue(target);
            }
            throw new MissingMemberException(target.GetType().Name, name);
        }

        private static void Assign(MemberInfo member, object instance, object value)
        {
            try
            {
                if (member is PropertyInfo property) property.SetValue(instance, ConvertTo(value, property.PropertyType));
                else ((FieldInfo)member).SetValue(instance, ConvertTo(value, ((FieldInfo)member).FieldType));
            }
            catch (TargetInvocationException e) when (e.InnerException != null)
            {
                throw e.InnerException;
            }
        }

        private static void Invoke(MethodInfo method, object instance, object value)
        {
            ParameterInfo[] parameters = method.GetParameters();
            var arguments = new object[parameters.Length];
            arguments[0] = ConvertTo(value, parameters[0].ParameterType);
            for (int i = 1; i < parameters.Length; ++i) arguments[i] = Type.Missing;
            try
            {
                method.Invoke(instance, BindingFlags.OptionalParamBinding, null, arguments, CultureInfo.InvariantCulture);
            }
            catch (TargetInvocationException e) when (e.InnerException != null)
            {
                throw e.InnerException;
            }
        }

        private static object ConvertTo(object value, Type target)
        {
            if (value == null)
            {
                if (target.IsValueType && Nullable.GetUnderlyingType(target) == null)
                    throw new InvalidCastException("null cannot be assigned to " + target.Name);
                return null;
            }
            if (target == typeof(object) || target.IsInstanceOfType(value)) return value;
            Type under = Nullable.GetUnderlyingType(target) ?? target;
            if (under.IsArray && value is IEnumerable sequence && !(value is string))
            {
                Type element = under.GetElementType();
                List<object> items = sequence.Cast<object>().ToList();
                Array array = Array.CreateInstance(element, items.Count);
                for (int i = 0; i < items.Count; ++i) array.SetValue(ConvertTo(items[i], element), i);
                return array;
            }
            if (under.IsGenericType && under.GetGenericTypeDefinition() == typeof(List<>) && value is IEnumerable listSource && !(value is string))
            {
                Type element = under.GetGenericArguments()[0];
                var list = (IList)Activator.CreateInstance(under);
                foreach (object item in listSource) list.Add(ConvertTo(item, element));
                return list;
            }
            if (under.IsEnum) return Enum.ToObject(under, Convert.ToInt64(value, CultureInfo.InvariantCulture));
            if (value is IConvertible && typeof(IConvertible).IsAssignableFrom(under))
                return Convert.ChangeType(value, under, CultureInfo.InvariantCulture);
            throw new InvalidCastException(value.GetType().Name + " cannot be converted to " + target.Name);
        }

        private static object ReadField(object vector, string field, bool requirePresent)
        {
            object value = null;
            bool found = false;
            if (vector is IDictionary<string, object> dictionary)
            {
                found = dictionary.TryGetValue(field, out value) || dictionary.TryGetValue(Pascal(field), out value);
            }
            else
            {
                foreach (Type type in Chain(vector.GetType()))
                {
                    PropertyInfo property = type.GetProperties(Declared).FirstOrDefault(p => p.GetIndexParameters().Length == 0 && p.CanRead
                        && (p.Name == Pascal(field) || p.Name == field));
                    if (property != null) { value = property.GetValue(vector); found = true; break; }
                }
                if (!found || value == null)
                {
                    PropertyInfo indexer = vector.GetType().GetProperties().FirstOrDefault(p => p.GetIndexParameters().Length == 1
                        && p.GetIndexParameters()[0].ParameterType == typeof(string));
                    if (indexer != null)
                    {
                        object indexed = indexer.GetValue(vector, new object[] { field }) ?? indexer.GetValue(vector, new object[] { Pascal(field) });
                        if (indexed != null) { value = indexed; found = true; }
                    }
                }
            }
            if (requirePresent && value == null)
                throw new InvalidOperationException("Vector field '" + field + "' is missing from the transpiled vector");
            return value;
        }

        // ------------------------------------------------------------ algorithms

        private static bool IsAlgorithmType(Type type)
        {
            for (Type t = type; t != null; t = t.BaseType)
                if (t.Name == "Algorithm" && IsFramework(t)) return true;
            return false;
        }

        private static string NameOf(object algorithm)
        {
            try { return GetMember(algorithm, "Name") as string; }
            catch (MissingMemberException) { return null; }
        }

        private static IEnumerable<Type> AlgorithmTypes()
        {
            Type[] types;
            try { types = typeof(ValidationHarness).Assembly.GetTypes(); }
            catch (ReflectionTypeLoadException e) { types = e.Types.Where(t => t != null).ToArray(); }
            return types.Where(t => !t.IsAbstract && !t.ContainsGenericParameters && IsAlgorithmType(t) && !IsFramework(t)
                && !t.Name.StartsWith("ValidationDummy", StringComparison.Ordinal));
        }

        /// <summary>
        /// The algorithm registered under that name: a static algorithm field of the
        /// generated code, else an instance of its JavaScript class, else of any algorithm class.
        /// </summary>
        private static object FindAlgorithm(string name, string className)
        {
            if (knownAlgorithms == null)
            {
                knownAlgorithms = new List<object>();
                Type[] types;
                try { types = typeof(ValidationHarness).Assembly.GetTypes(); }
                catch (ReflectionTypeLoadException e) { types = e.Types.Where(t => t != null).ToArray(); }
                foreach (Type type in types)
                {
                    if (type.ContainsGenericParameters || type == typeof(ValidationHarness)) continue;
                    foreach (FieldInfo field in type.GetFields(BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly))
                    {
                        if (field.IsLiteral || (!IsAlgorithmType(field.FieldType) && field.FieldType != typeof(object))) continue;
                        try
                        {
                            object value = field.GetValue(null);
                            if (value != null && IsAlgorithmType(value.GetType()) && !knownAlgorithms.Contains(value)) knownAlgorithms.Add(value);
                        }
                        catch (Exception e)
                        {
                            DiscoveryErrors.Add(type.Name + "." + field.Name + ": " + Describe(e));
                        }
                    }
                }
            }
            object hit = knownAlgorithms.LastOrDefault(a => NameOf(a) == name);
            if (hit != null) return hit;

            IEnumerable<Type> candidates = AlgorithmTypes();
            if (className != null)
                candidates = candidates.OrderBy(t => string.Equals(t.Name, className, StringComparison.OrdinalIgnoreCase) ? 0 : 1);
            foreach (Type type in candidates)
            {
                if (knownAlgorithms.Any(a => a.GetType() == type)) continue;
                if (type.GetConstructor(BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance, null, Type.EmptyTypes, null) == null) continue;
                object created;
                try
                {
                    created = Activator.CreateInstance(type, true);
                }
                catch (Exception e)
                {
                    DiscoveryErrors.Add("new " + type.Name + "(): " + Describe(e));
                    continue;
                }
                knownAlgorithms.Add(created);
                if (NameOf(created) == name) return created;
            }
            return null;
        }

        // ------------------------------------------------------------ values

        private static byte[] DefaultBytes() => Enumerable.Range(0, 16).Select(i => (byte)i).ToArray();

        private static List<object> ToObjects(object value)
        {
            if (value == null) return null;
            if (value is string || !(value is IEnumerable sequence)) return null;
            return sequence.Cast<object>().ToList();
        }

        private static string Number(object item)
        {
            if (item == null || item is bool) return null;
            if (item is System.Numerics.BigInteger big) return big.ToString(CultureInfo.InvariantCulture);
            if (item is IConvertible convertible)
            {
                switch (convertible.GetTypeCode())
                {
                    case TypeCode.Byte: case TypeCode.SByte: case TypeCode.Int16: case TypeCode.UInt16:
                    case TypeCode.Int32: case TypeCode.UInt32: case TypeCode.Int64: case TypeCode.UInt64:
                    case TypeCode.Double: case TypeCode.Single: case TypeCode.Decimal:
                        return Convert.ToString(item, CultureInfo.InvariantCulture);
                }
            }
            return null;
        }

        private static bool SameBytes(object left, object right)
        {
            List<object> a = ToObjects(left), b = ToObjects(right);
            if (a == null || b == null || a.Count != b.Count) return false;
            for (int i = 0; i < a.Count; ++i)
            {
                string x = Number(a[i]), y = Number(b[i]);
                if (x == null || y == null || x != y) return false;
            }
            return true;
        }

        private static object AsBytesIfPossible(object data)
        {
            if (data == null || data is byte[]) return data;
            List<object> items = ToObjects(data);
            if (items == null) return data;
            var bytes = new byte[items.Count];
            for (int i = 0; i < items.Count; ++i)
            {
                string n = Number(items[i]);
                if (n == null || !int.TryParse(n, NumberStyles.Integer, CultureInfo.InvariantCulture, out int b) || b < 0 || b > 255) return data;
                bytes[i] = (byte)b;
            }
            return bytes;
        }

        private static string Hex(object value)
        {
            List<object> items = ToObjects(value);
            if (items == null) return value == null ? "<null>" : "<" + value + ">";
            return string.Concat(items.Select(item =>
            {
                string n = Number(item);
                return n != null && int.TryParse(n, NumberStyles.Integer, CultureInfo.InvariantCulture, out int b) && b >= 0 && b < 256
                    ? b.ToString("x2", CultureInfo.InvariantCulture) : "<" + (item ?? "null") + ">";
            }));
        }

        private static string OneLine(string text) => System.Text.RegularExpressions.Regex.Replace(text ?? "", @"\s*[\r\n]+\s*", " | ");

        private static string Describe(Exception e)
        {
            while ((e is TargetInvocationException || e is TypeInitializationException || e is AggregateException) && e.InnerException != null)
                e = e.InnerException;
            return e.GetType().Name + ": " + e.Message;
        }

        private static object CreateDummyCipher()
        {
            __DUMMY_FACTORY__
        }
    }
}
