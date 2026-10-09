// ---------------------------------------------------------------------------
// Vector harness appended to a transpiled C++ algorithm by
// tests/TranspilerValidation.js (the VALIDATION category). (c)2006-2025 Hawkynt
//
// The spec placeholder below is replaced by the harness spec the reference run
// produced: the algorithms the file registers and, per vector, the fields to
// apply in TestEngine order and the checks the reference passed. Fields are
// applied with the semantics of TestEngine.ConfigureInstance: a setter method
// of the field's setter name, else a property of the field's name (`field in
// instance`); a field that reaches neither, or whose setter throws, fails the
// vector. The transpiled code carries the runtime (namespace js): its
// registry, and the member protocol every transpiled class answers
// (__has/__get/__set/__hasMethod/__call).
//
// Output protocol: @@ALGO <a> MISSING <msg> | @@ALGO <a> COUNT <n> |
//                  @@VEC <a> <v> PASS | @@VEC <a> <v> FAIL <msg> | @@DONE
// ---------------------------------------------------------------------------
#include <iostream>
#include <stdexcept>

namespace validation_harness {

using js::Any;
using js::String;

static const char* SPEC_JSON = __SPEC_JSON__;

// ------------------------------------------------------------ JSON
struct Json {
  const char* p;
  explicit Json(const char* text) : p(text) {}
  void ws() { while (*p == ' ' || *p == '\n' || *p == '\r' || *p == '\t') ++p; }
  Any value() {
    ws();
    if (*p == '{') {
      ++p; js::DynObject* o = js::newObject(); ws();
      if (*p == '}') { ++p; return Any(o); }
      for (;;) {
        ws(); String k = string(); ws(); ++p; // ':'
        Any v = value();
        *o->__expandoSlot(k.s(), true) = v;
        ws(); if (*p == ',') { ++p; continue; }
        ++p; return Any(o);
      }
    }
    if (*p == '[') {
      ++p; js::Array<Any> a = js::Array<Any>::create(0); ws();
      if (*p == ']') { ++p; return Any(a); }
      for (;;) { a.push(value()); ws(); if (*p == ',') { ++p; continue; } ++p; return Any(a); }
    }
    if (*p == '"') return Any(string());
    if (!std::strncmp(p, "true", 4)) { p += 4; return Any(true); }
    if (!std::strncmp(p, "false", 5)) { p += 5; return Any(false); }
    if (!std::strncmp(p, "null", 4)) { p += 4; return Any(nullptr); }
    char* end; double d = std::strtod(p, &end); p = end; return Any(d);
  }
  String string() {
    ++p; std::u16string s;
    while (*p && *p != '"') {
      if (*p == '\\') {
        ++p;
        switch (*p) {
          case 'n': s.push_back(u'\n'); break; case 't': s.push_back(u'\t'); break; case 'r': s.push_back(u'\r'); break;
          case 'b': s.push_back(u'\b'); break; case 'f': s.push_back(u'\f'); break;
          case 'u': { char h[5] = {p[1], p[2], p[3], p[4], 0}; s.push_back((char16_t)std::strtoul(h, nullptr, 16)); p += 4; break; }
          default: s.push_back((char16_t)*p);
        }
        ++p;
      } else s.push_back((char16_t)(unsigned char)*p++);
    }
    ++p;
    return String(s);
  }
};

// ------------------------------------------------------------ helpers
static std::string oneLine(const std::u16string& text) {
  std::string s = js::toUtf8(text), r;
  for (size_t i = 0; i < s.size(); ++i) {
    if (s[i] == '\r' || s[i] == '\n') { while (!r.empty() && r.back() == ' ') r.pop_back(); r += " | "; while (i + 1 < s.size() && (s[i + 1] == '\r' || s[i + 1] == '\n' || s[i + 1] == ' ')) ++i; }
    else r.push_back(s[i]);
  }
  return r;
}
static std::u16string describeThrow(const Any& v) {
  if (v.tag == js::Tag::Obj && dynamic_cast<js::Error*>(v.o)) return js::describe(v);
  return u"thrown: " + js::str(v).s();
}
struct Failure { std::u16string message; };
[[noreturn]] static void fail(const std::u16string& m) { throw Failure{m}; }

static js::Algorithm* findAlgorithm(const String& name) {
  js::Array<js::Algorithm*>& all = js::Algorithms();
  for (int32_t i = all.length(); i-- > 0;) if (all.get(i) && all.get(i)->name == name) return all.get(i);
  return nullptr;
}

static js::Array<double> toList(const Any& v, bool& ok) {
  ok = false;
  js::Array<double> r = js::Array<double>::create(0);
  if (v.tag != js::Tag::Arr) return r;
  js::ArrayBase* a = v.asArr();
  for (int32_t i = 0; i < a->length(); ++i) {
    Any e = a->getAny(i);
    if (!e.isNumber()) { if (e.tag == js::Tag::Big) { r.push(e.asBig().toDouble()); continue; } return r; }
    r.push(e.toNumber());
  }
  ok = true;
  return r;
}
static bool sameBytes(const Any& a, const Any& b) {
  bool oa, ob;
  js::Array<double> x = toList(a, oa), y = toList(b, ob);
  if (!oa || !ob || x.length() != y.length()) return false;
  for (int32_t i = 0; i < x.length(); ++i) if (x.get(i) != y.get(i)) return false;
  return true;
}
static std::u16string hex(const Any& v) {
  if (v.tag != js::Tag::Arr) return js::str(v).s();
  js::ArrayBase* a = v.asArr();
  std::u16string r; static const char16_t* d = u"0123456789abcdef";
  for (int32_t i = 0; i < a->length(); ++i) {
    Any e = a->getAny(i);
    double n = e.isNumber() ? e.toNumber() : -1;
    if (n >= 0 && n < 256 && n == std::floor(n)) { int b = (int)n; r.push_back(d[b >> 4]); r.push_back(d[b & 15]); }
    else r += u"<" + js::str(e).s() + u">";
  }
  return r;
}
static js::Array<uint8_t> defaultBytes() { js::Array<uint8_t> r = js::Array<uint8_t>::create(16); for (int i = 0; i < 16; ++i) r.at(i) = (uint8_t)i; return r; }

// ------------------------------------------------------------ the identity cipher of tests/DummyBlockCipher.js
struct DummyCipherAlgorithm : js::BlockCipherAlgorithm {
  js::IAlgorithmInstance* CreateInstance(bool isInverse = false) override;
};
struct DummyCipher : js::IBlockCipherInstance {
  js::Array<uint8_t> Result() override {
    js::Array<uint8_t> k = __get_key();
    if (k.isNull()) js::throwError(u"Error", u"Key not set");
    js::Array<uint8_t> out = js::Array<uint8_t>::create(0);
    for (int32_t i = 0; i < inputBuffer.length(); i += 16)
      for (int32_t j = 0; j < 16; ++j) out.push((uint8_t)((i + j < inputBuffer.length() ? inputBuffer.get(i + j) : 0) ^ k.get(j % k.length())));
    inputBuffer = js::Array<uint8_t>::create(0);
    return out;
  }
};
js::IAlgorithmInstance* DummyCipherAlgorithm::CreateInstance(bool) { DummyCipher* c = new DummyCipher(); c->__ctor(this); c->BlockSize = 16; return c; }
static js::IAlgorithmInstance* dummyCipher() {
  DummyCipherAlgorithm* a = new DummyCipherAlgorithm(); a->__ctor(); a->name = String(u"DummyBlockCipher");
  return a->CreateInstance(false);
}

// ------------------------------------------------------------ applying a vector
static void setField(const String& field, const std::function<void()>& apply) {
  try { apply(); }
  catch (js::Throw& t) { fail(u"Setting vector field '" + field.s() + u"' failed: " + describeThrow(t.value)); }
  catch (std::exception& e) { fail(u"Setting vector field '" + field.s() + u"' failed: " + js::fromUtf8(e.what())); }
}

// A setter method of that name, else a property of the field's name
static bool applyProperty(js::Object* instance, const String& field, const String& setter, const Any& value) {
  if (!setter.isNull() && instance->__hasMethod(setter.s())) {
    setField(field, [&] { std::vector<Any> args{value}; Any out; instance->__call(setter.s(), args, out); });
    return true;
  }
  if (instance->__has(field.s())) {
    setField(field, [&] { instance->__set(field.s(), value); });
    return true;
  }
  return false;
}

static Any vectorField(js::Object* vector, const String& field) { Any v; vector->__get(field.s(), v); return v; }

static const std::pair<const char16_t*, const char16_t*> CIPHER_NAMES[] = {
  {u"AES", u"Rijndael (AES)"}, {u"Rijndael", u"Rijndael (AES)"}, {u"DES", u"DES"}, {u"3DES", u"3DES (Triple DES)"},
  {u"Blowfish", u"Blowfish"}, {u"Camellia", u"Camellia"}, {u"ARIA", u"ARIA"}};

static void configure(const Any& spec, const Any& plan, js::Object* instance, js::Object* vector) {
  std::vector<std::u16string> applied;
  auto isApplied = [&](const std::u16string& f) { return std::find(applied.begin(), applied.end(), f) != applied.end(); };
  js::Array<Any> fields = js::fromAny<js::Array<Any>>(plan.get(String(u"fields")));
  auto hasField = [&](const char16_t* f) { for (int32_t i = 0; i < fields.length(); ++i) if (fields.get(i).asString().s() == f) return true; return false; };
  if (spec.get(String(u"isMode")).truthy()) {
    Any mode = plan.get(String(u"mode"));
    bool multiKey = spec.get(String(u"multiKey")).truthy();
    js::Object* cipher = nullptr;
    Any cipherName = mode.get(String(u"cipher"));
    if (cipherName.tag == js::Tag::Str) {
      std::u16string name = cipherName.asString().s(), mapped = name;
      for (auto& kv : CIPHER_NAMES) if (name == kv.first) mapped = kv.second;
      js::Algorithm* found = findAlgorithm(String(mapped));
      if (!found) found = findAlgorithm(String(name));
      if (found) cipher = found->CreateInstance(false);
      if (!cipher) fail(u"Vector field 'cipher' is not applied: no block cipher named '" + name + u"' is registered");
    } else {
      cipher = dummyCipher();
    }
    if (!multiKey) cipher->__set(u"key", mode.get(String(u"keyTruthy")).truthy() ? vectorField(vector, String(u"key")) : Any(defaultBytes()));
    if (hasField(u"cipher")) applied.push_back(u"cipher");
    if (hasField(u"key") && !multiKey) applied.push_back(u"key");
    if (instance->__hasMethod(u"setBlockCipher")) { std::vector<Any> args{Any(cipher)}; Any out; instance->__call(u"setBlockCipher", args, out); }
    if (instance->__hasMethod(u"setIV")) {
      if (mode.get(String(u"ivTruthy")).truthy()) {
        Any iv = vectorField(vector, String(u"iv"));
        setField(String(u"iv"), [&] { std::vector<Any> args{iv}; Any out; instance->__call(u"setIV", args, out); });
        applied.push_back(u"iv");
      } else {
        std::vector<Any> args{Any(defaultBytes())}; Any out; instance->__call(u"setIV", args, out);
      }
    }
  }

  js::Array<Any> steps = js::fromAny<js::Array<Any>>(plan.get(String(u"steps")));
  for (int32_t i = 0; i < steps.length(); ++i) {
    Any step = steps.get(i);
    String field = step.get(String(u"field")).asString();
    Any value = vectorField(vector, field);
    Any kind = step.get(String(u"kind")), setter = step.get(String(u"setter"));
    if (kind.tag == js::Tag::Str && kind.asString().s() == u"kek") {
      bool asKek = applyProperty(instance, String(u"kek"), String(u"setKEK"), value);
      bool asKey = !instance->__hasMethod(u"setKEK") && instance->__hasMethod(u"setKey") && applyProperty(instance, String(u"key"), String(u"setKey"), value);
      if (asKek || asKey) applied.push_back(u"kek");
    } else if (applyProperty(instance, field, setter.tag == js::Tag::Str ? setter.asString() : String(), value)) {
      applied.push_back(field.s());
    }
  }

  for (int32_t i = 0; i < fields.length(); ++i) {
    std::u16string f = fields.get(i).asString().s();
    if (!isApplied(f))
      fail(u"Vector field '" + f + u"' is not applied: " + spec.get(String(u"name")).asString().s() + u" has no setter or property of that name");
  }
}

static Any runOnce(js::Algorithm* algorithm, const Any& spec, const Any& plan, js::Object* vector, bool inverse, const Any& input) {
  js::IAlgorithmInstance* instance = algorithm->CreateInstance(inverse);
  if (!instance) fail(std::u16string(u"Failed to create algorithm instance (inverse=") + (inverse ? u"true" : u"false") + u")");
  configure(spec, plan, instance, vector);
  instance->Feed(js::fromAny<js::Array<uint8_t>>(input));
  return Any(instance->Result());
}

static std::u16string checkVector(js::Algorithm* algorithm, const Any& spec, const Any& plan, js::Object* vector) {
  bool inverse = plan.get(String(u"inverse")).truthy();
  Any input = vectorField(vector, String(u"input"));
  Any output = runOnce(algorithm, spec, plan, vector, inverse, input);
  if (plan.get(String(u"expect")).truthy()) {
    Any expected = vectorField(vector, String(u"expected"));
    if (!sameBytes(output, expected)) return u"output " + hex(output) + u" expected " + hex(expected);
  }
  Any rt = plan.get(String(u"rt"));
  std::u16string mode = rt.tag == js::Tag::Str ? rt.asString().s() : u"";
  if (mode == u"decode") {
    Any back = runOnce(algorithm, spec, plan, vector, !inverse, output);
    if (!sameBytes(back, input)) return u"round trip gave " + hex(back) + u" expected the input " + hex(input);
  } else if (mode == u"stability") {
    Any decoded = runOnce(algorithm, spec, plan, vector, true, output);
    Any again = runOnce(algorithm, spec, plan, vector, false, decoded);
    if (!sameBytes(again, output)) return u"encoding is not stable: re-encoding gave " + hex(again) + u" expected " + hex(output);
  }
  return std::u16string();
}

static int run() {
  try {
    js::runModuleInits();
  } catch (js::Throw& t) {
    std::cerr << "module initialisation threw: " << oneLine(describeThrow(t.value)) << std::endl;
  }
  Any spec = Json(SPEC_JSON).value();
  js::Array<Any> algorithms = js::fromAny<js::Array<Any>>(spec.get(String(u"algorithms")));
  for (int32_t a = 0; a < algorithms.length(); ++a) {
    Any s = algorithms.get(a);
    js::Algorithm* algorithm = findAlgorithm(s.get(String(u"name")).asString());
    if (!algorithm) {
      std::cout << "@@ALGO " << a << " MISSING no algorithm named '" << oneLine(s.get(String(u"name")).asString().s()) << "' is registered" << std::endl;
      continue;
    }
    js::Array<js::TestCase*> tests = algorithm->tests.isNull() ? js::Array<js::TestCase*>::create(0) : algorithm->tests;
    js::Array<Any> vectors = js::fromAny<js::Array<Any>>(s.get(String(u"vectors")));
    if (tests.length() != vectors.length()) std::cout << "@@ALGO " << a << " COUNT " << tests.length() << std::endl;
    for (int32_t v = 0; v < vectors.length(); ++v) {
      std::u16string failure;
      try {
        failure = v < tests.length() ? checkVector(algorithm, s, vectors.get(v), tests.get(v)) : std::u16string(u"vector missing");
      } catch (Failure& f) {
        failure = f.message;
      } catch (js::Throw& t) {
        failure = describeThrow(t.value);
      } catch (std::exception& e) {
        failure = u"C++ exception: " + js::fromUtf8(e.what());
      }
      std::cout << "@@VEC " << a << " " << v << (failure.empty() ? " PASS" : " FAIL " + oneLine(failure)) << std::endl;
    }
  }
  std::cout << "@@DONE" << std::endl;
  return 0;
}

} // namespace validation_harness

int main() { return validation_harness::run(); }
