/* ---------------------------------------------------------------------------
 * Vector harness appended to a transpiled C algorithm by
 * tests/TranspilerValidation.js (the VALIDATION category). (c)2006-2025 Hawkynt
 *
 * The spec placeholder below is replaced by the harness spec the reference run
 * produced: the algorithms the file registers and, per vector, the fields to
 * apply in TestEngine order and the checks the reference passed. Fields are
 * applied with the semantics of TestEngine.ConfigureInstance: a setter method
 * of the field's setter name, else a property of the field's name (`field in
 * instance`); a field that reaches neither, or whose setter throws, fails the
 * vector. The transpiled code carries the runtime (js_* values with
 * JavaScript semantics) and the AlgorithmFramework registry; this harness is
 * tests/validation-harness/harness.js spelled against that runtime.
 *
 * Output protocol: @@ALGO <a> MISSING <msg> | @@ALGO <a> COUNT <n> |
 *                  @@VEC <a> <v> PASS | @@VEC <a> <v> FAIL <msg> | @@DONE
 * ------------------------------------------------------------------------- */

static const char* VH_SPEC_JSON = __SPEC_JSON__;

static js_val vh_get(js_val o, const char* k) { return js_get(o, js_atom_c(k)); }
static js_str* vh_cat(js_str* a, const char* b) { return js_str_concat(a, js_str_c(b)); }

/** describe(e): name: message for an error object, else thrown: String(e) */
static js_str* vh_describe(js_val e) {
  if (e.t == JS_T_OBJ && js_has_property(e, A_message)) {
    js_val name = js_get(e, A_name);
    js_str* n = js_truthy(name) ? js_to_str(name) : js_str_c("Error");
    return js_str_concat(vh_cat(n, ": "), js_to_str(js_get(e, A_message)));
  }
  return js_str_concat(js_str_c("thrown: "), js_to_str(e));
}
static void vh_throw(js_str* msg) __attribute__((noreturn));
static void vh_throw(js_str* msg) { js_throw(js_make_error(js_Error_proto, msg)); }
/** oneLine: line breaks with their surrounding white space become " | " */
static char* vh_one_line(js_str* s) {
  js_str* r = js_str_new(NULL, 0);
  int32_t i = 0, n = s->len;
  while (i < n) {
    // a run of white space containing a line break
    int32_t j = i;
    while (j < n && (s->d[j] == ' ' || s->d[j] == '\t' || s->d[j] == '\r' || s->d[j] == '\n' || s->d[j] == 0x0B || s->d[j] == 0x0C)) ++j;
    int nl = 0;
    for (int32_t k = i; k < j; ++k) if (s->d[k] == '\r' || s->d[k] == '\n') nl = 1;
    if (j > i && nl) { r = vh_cat(r, " | "); i = j; continue; }
    if (j > i) { r = js_str_concat(r, js_str_sub(s, i, j)); i = j; continue; }
    r = js_str_concat(r, js_str_char(s->d[i])); ++i;
  }
  return js_str_utf8z(r);
}

static js_val vh_registry(void) {
  js_prop* p = js_own(js_global, js_atom_c("AlgorithmFramework"));
  if (!p) return js_arr_new(0);
  js_val all = vh_get(p->v, "Algorithms");
  return all.t == JS_T_OBJ ? all : js_arr_new(0);
}
/** The last registration of that name (bundled dependencies register first) */
static js_val vh_find(js_val name) {
  js_val all = vh_registry();
  for (int64_t i = js_len_of(all) - 1; i >= 0; --i) {
    js_val a = js_idx_get(all, i);
    if (js_truthy(a) && js_strict_eq(js_get(a, A_name), name)) return a;
  }
  return JS_NULL;
}
static js_val vh_to_list(js_val v) {
  if (v.t <= JS_T_NULL) return v;
  if (js_is_kind(v, K_ARR)) return v;
  if (js_is_kind(v, K_TYPED) || js_is_kind(v, K_DVIEW)) return js_iter_to_array(v);
  return v;
}
static int vh_same_bytes(js_val a, js_val b) {
  a = vh_to_list(a); b = vh_to_list(b);
  if (!js_is_kind(a, K_ARR) || !js_is_kind(b, K_ARR)) return 0;
  js_arr* x = js_as_arr(a);
  js_arr* y = js_as_arr(b);
  if (x->len != y->len) return 0;
  for (int64_t i = 0; i < x->len; ++i) if (!js_strict_eq(x->a[i], y->a[i])) return 0;
  return 1;
}
static js_str* vh_hex(js_val v) {
  js_val list = vh_to_list(v);
  if (!js_is_kind(list, K_ARR)) return js_to_str(list);
  js_arr* a = js_as_arr(list);
  js_str* r = js_str_new(NULL, 0);
  for (int64_t i = 0; i < a->len; ++i) {
    js_val b = a->a[i].t == JS_T_HOLE ? JS_U : a->a[i];
    if (b.t == JS_T_NUM && b.u.n >= 0 && b.u.n < 256) {
      js_str* h = js_num_to_radix(b.u.n, 16);
      if (h->len < 2) r = vh_cat(r, "0");
      r = js_str_concat(r, h);
    } else r = vh_cat(js_str_concat(vh_cat(r, "<"), js_to_str(b)), ">");
  }
  return r;
}

/* ---------------- the identity cipher of tests/DummyBlockCipher.js */
static js_val vh_dummy_cipher(void);
JS_NATIVE(vh_dummy_create) { return vh_dummy_cipher(); }
JS_NATIVE(vh_dummy_setkey) {
  js_val bytes = NARG(0);
  js_set(self, js_atom_c("_key"), js_truthy(bytes) ? js_iter_to_array(bytes) : JS_NULL);
  return JS_U;
}
JS_NATIVE(vh_dummy_getkey) {
  js_val k = vh_get(self, "_key");
  return js_truthy(k) ? js_invoke(k, js_atom_c("slice"), 0, NULL) : JS_NULL;
}
JS_NATIVE(vh_dummy_feed) {
  js_val data = NARG(0);
  if (js_truthy(data) && js_truthy(js_get(data, A_length))) {
    js_val buf = vh_get(self, "inputBuffer");
    int64_t n = js_len_of(data);
    for (int64_t i = 0; i < n; ++i) js_invoke(buf, js_atom_c("push"), 1, (js_val[]){ js_idx_get(data, i) });
  }
  return JS_U;
}
JS_NATIVE(vh_dummy_result) {
  js_val key = vh_get(self, "_key");
  if (!js_truthy(key)) vh_throw(js_str_c("Key not set"));
  js_val buf = vh_get(self, "inputBuffer");
  js_val out = js_arr_new(0);
  int64_t n = js_len_of(buf), kl = js_len_of(key);
  for (int64_t i = 0; i < n; i += 16)
    for (int64_t j = 0; j < 16; ++j) {
      js_val b = i + j < n ? js_idx_get(buf, i + j) : JS_D(0);
      js_invoke(out, js_atom_c("push"), 1, (js_val[]){ js_bxor(b, js_idx_get(key, j % kl)) });
    }
  js_set(self, js_atom_c("inputBuffer"), js_arr_new(0));
  return out;
}
static js_val vh_dummy_cipher(void) {
  js_val algorithm = js_new_object();
  js_set(algorithm, A_name, JS_S(u"DummyBlockCipher"));
  js_set(algorithm, js_atom_c("BlockSize"), JS_D(16));
  js_set(algorithm, js_atom_c("CreateInstance"), js_native_fn(vh_dummy_create, "CreateInstance", 0));
  js_val c = js_new_object();
  js_set(c, js_atom_c("algorithm"), algorithm);
  js_set(c, js_atom_c("BlockSize"), JS_D(16));
  js_set(c, js_atom_c("isInverse"), JS_FALSE);
  js_set(c, js_atom_c("_key"), JS_NULL);
  js_set(c, js_atom_c("inputBuffer"), js_arr_new(0));
  js_obj_method(c, js_atom_c("key"), js_native_fn(vh_dummy_setkey, "key", 1), JM_SET);
  js_obj_method(c, js_atom_c("key"), js_native_fn(vh_dummy_getkey, "key", 0), JM_GET);
  js_obj_method(c, js_atom_c("Feed"), js_native_fn(vh_dummy_feed, "Feed", 1), JM_METHOD);
  js_obj_method(c, js_atom_c("Result"), js_native_fn(vh_dummy_result, "Result", 0), JM_METHOD);
  return c;
}

/* ---------------- applying a vector */
enum { VH_CALL, VH_PUT };
/** setField: run a setter call or a property write; a throw fails the vector */
static void vh_set_field(js_val field, int how, js_val instance, js_str* name, js_val value) {
  js_try t; JS_TRY_PUSH(t);
  if (!JS_SETJMP(t.jb)) {
    if (how == VH_CALL) js_invoke(instance, name, 1, (js_val[]){ value });
    else js_set(instance, name, value);
    JS_TRY_POP(t);
  } else {
    JS_TRY_POP(t);
    js_str* m = vh_cat(js_str_concat(js_str_c("Setting vector field '"), js_to_str(field)), "' failed: ");
    vh_throw(js_str_concat(m, vh_describe(t.exc)));
  }
}
static int vh_is_method(js_val instance, js_val setter) {
  return setter.t == JS_T_STR && js_is_callable(js_get(instance, js_intern(setter.u.s)));
}
/** A setter method of that name, else a property of the field's name */
static int vh_apply_property(js_val instance, js_val field, js_val setter, js_val value) {
  if (js_truthy(setter) && vh_is_method(instance, setter)) {
    vh_set_field(field, VH_CALL, instance, js_intern(setter.u.s), value);
    return 1;
  }
  js_str* f = js_to_key(field);
  if (js_has_property(instance, f)) {
    vh_set_field(field, VH_PUT, instance, f, value);
    return 1;
  }
  return 0;
}
static const char* VH_CIPHER_NAMES[][2] = {
  { "AES", "Rijndael (AES)" }, { "Rijndael", "Rijndael (AES)" }, { "DES", "DES" }, { "3DES", "3DES (Triple DES)" },
  { "Blowfish", "Blowfish" }, { "Camellia", "Camellia" }, { "ARIA", "ARIA" } };
static js_val vh_default_bytes(void) {
  js_val r = js_arr_new(0);
  for (int i = 0; i < 16; ++i) js_arr_push1(js_as_arr(r), JS_D(i));
  return r;
}
static void vh_configure(js_val spec, js_val plan, js_val instance, js_val vector) {
  js_val applied = js_arr_new(0);
  js_val fields = vh_get(plan, "fields");
  #define VH_HAS_FIELD(name) js_truthy(js_invoke(fields, js_atom_c("includes"), 1, (js_val[]){ JS_SV(js_str_c(name)) }))
  #define VH_APPLIED(v) js_arr_push1(js_as_arr(applied), (v))
  if (js_truthy(vh_get(spec, "isMode"))) {
    js_val mode = vh_get(plan, "mode");
    int multi = js_truthy(vh_get(spec, "multiKey"));
    js_val cipher = JS_NULL;
    js_val cname = vh_get(mode, "cipher");
    if (cname.t != JS_T_NULL) {
      js_val mapped = cname;
      for (size_t i = 0; i < sizeof VH_CIPHER_NAMES / sizeof VH_CIPHER_NAMES[0]; ++i)
        if (cname.t == JS_T_STR && js_str_eqc(cname.u.s, VH_CIPHER_NAMES[i][0])) mapped = JS_SV(js_str_c(VH_CIPHER_NAMES[i][1]));
      js_val found = vh_find(mapped);
      if (!js_truthy(found)) found = vh_find(cname);
      if (js_truthy(found)) cipher = js_invoke(found, js_atom_c("CreateInstance"), 1, (js_val[]){ JS_FALSE });
      if (!js_truthy(cipher))
        vh_throw(vh_cat(js_str_concat(js_str_c("Vector field 'cipher' is not applied: no block cipher named '"), js_to_str(cname)), "' is registered"));
    } else cipher = vh_dummy_cipher();
    if (!multi) js_set(cipher, js_atom_c("key"), js_truthy(vh_get(mode, "keyTruthy")) ? vh_get(vector, "key") : vh_default_bytes());
    if (VH_HAS_FIELD("cipher")) VH_APPLIED(JS_S(u"cipher"));
    if (VH_HAS_FIELD("key") && !multi) VH_APPLIED(JS_S(u"key"));
    if (js_is_callable(vh_get(instance, "setBlockCipher"))) js_invoke(instance, js_atom_c("setBlockCipher"), 1, (js_val[]){ cipher });
    if (js_is_callable(vh_get(instance, "setIV"))) {
      if (js_truthy(vh_get(mode, "ivTruthy"))) {
        vh_set_field(JS_S(u"iv"), VH_CALL, instance, js_atom_c("setIV"), vh_get(vector, "iv"));
        VH_APPLIED(JS_S(u"iv"));
      } else js_invoke(instance, js_atom_c("setIV"), 1, (js_val[]){ vh_default_bytes() });
    }
  }
  js_val steps = vh_get(plan, "steps");
  for (int64_t i = 0; i < js_len_of(steps); ++i) {
    js_val step = js_idx_get(steps, i);
    js_val field = vh_get(step, "field");
    js_val value = js_getv(vector, field);
    js_val kind = vh_get(step, "kind");
    if (kind.t == JS_T_STR && js_str_eqc(kind.u.s, "kek")) {
      int asKek = vh_apply_property(instance, JS_S(u"kek"), JS_S(u"setKEK"), value);
      int asKey = !js_is_callable(vh_get(instance, "setKEK")) && js_is_callable(vh_get(instance, "setKey"))
        && vh_apply_property(instance, JS_S(u"key"), JS_S(u"setKey"), value);
      if (asKek || asKey) VH_APPLIED(JS_S(u"kek"));
    } else {
      js_val setter = vh_get(step, "setter");
      if (vh_apply_property(instance, field, js_truthy(setter) ? setter : JS_NULL, value)) VH_APPLIED(field);
    }
  }
  for (int64_t i = 0; i < js_len_of(fields); ++i) {
    js_val f = js_idx_get(fields, i);
    if (!js_truthy(js_invoke(applied, js_atom_c("includes"), 1, (js_val[]){ f })))
      vh_throw(vh_cat(js_str_concat(vh_cat(js_str_concat(js_str_c("Vector field '"), js_to_str(f)), "' is not applied: "), js_to_str(vh_get(spec, "name"))), " has no setter or property of that name"));
  }
  #undef VH_HAS_FIELD
  #undef VH_APPLIED
}
static js_val vh_run(js_val algorithm, js_val spec, js_val plan, js_val vector, int inverse, js_val input) {
  js_val instance = js_invoke(algorithm, js_atom_c("CreateInstance"), 1, (js_val[]){ JS_B(inverse) });
  if (!js_truthy(instance)) vh_throw(js_str_c(inverse ? "Failed to create algorithm instance (inverse=true)" : "Failed to create algorithm instance (inverse=false)"));
  vh_configure(spec, plan, instance, vector);
  js_invoke(instance, js_atom_c("Feed"), 1, (js_val[]){ input });
  return vh_to_list(js_invoke(instance, js_atom_c("Result"), 0, NULL));
}
/** NULL when the vector passes, else why it fails */
static js_str* vh_check(js_val algorithm, js_val spec, js_val plan, js_val vector) {
  int inverse = js_truthy(vh_get(plan, "inverse"));
  js_val input = vh_get(vector, "input");
  js_val output = vh_run(algorithm, spec, plan, vector, inverse, input);
  if (js_truthy(vh_get(plan, "expect")) && !vh_same_bytes(output, vh_get(vector, "expected")))
    return js_str_concat(vh_cat(js_str_concat(js_str_c("output "), vh_hex(output)), " expected "), vh_hex(vh_get(vector, "expected")));
  js_val rt = vh_get(plan, "rt");
  if (rt.t == JS_T_STR && js_str_eqc(rt.u.s, "decode")) {
    js_val back = vh_run(algorithm, spec, plan, vector, !inverse, output);
    if (!vh_same_bytes(back, input))
      return js_str_concat(vh_cat(js_str_concat(js_str_c("round trip gave "), vh_hex(back)), " expected the input "), vh_hex(input));
  } else if (rt.t == JS_T_STR && js_str_eqc(rt.u.s, "stability")) {
    js_val decoded = vh_run(algorithm, spec, plan, vector, 1, output);
    js_val again = vh_run(algorithm, spec, plan, vector, 0, decoded);
    if (!vh_same_bytes(again, output))
      return js_str_concat(vh_cat(js_str_concat(js_str_c("encoding is not stable: re-encoding gave "), vh_hex(again)), " expected "), vh_hex(output));
  }
  return NULL;
}

int main(void) {
  js_try t0; JS_TRY_PUSH(t0);
  if (!JS_SETJMP(t0.jb)) { js_run_modules(JS_MODULE_LIST); JS_TRY_POP(t0); }
  else { JS_TRY_POP(t0); fprintf(stderr, "module initialisation threw: %s\n", vh_one_line(vh_describe(t0.exc))); }
  js_val SPEC = js_invoke(js_global_get(js_atom_c("JSON")), js_atom_c("parse"), 1, (js_val[]){ JS_SV(js_str_c(VH_SPEC_JSON)) });
  js_val algorithms = vh_get(SPEC, "algorithms");
  for (int64_t a = 0; a < js_len_of(algorithms); ++a) {
    js_val spec = js_idx_get(algorithms, a);
    js_val algorithm = JS_NULL;
    js_try t1; JS_TRY_PUSH(t1);
    if (!JS_SETJMP(t1.jb)) { algorithm = vh_find(vh_get(spec, "name")); JS_TRY_POP(t1); }
    else { JS_TRY_POP(t1); printf("@@ALGO %lld MISSING %s\n", (long long)a, vh_one_line(vh_describe(t1.exc))); continue; }
    if (!js_truthy(algorithm)) {
      printf("@@ALGO %lld MISSING no algorithm named '%s' is registered\n", (long long)a, vh_one_line(js_to_str(vh_get(spec, "name"))));
      continue;
    }
    js_val tests = vh_get(algorithm, "tests");
    if (!js_truthy(tests)) tests = js_arr_new(0);
    js_val vectors = vh_get(spec, "vectors");
    int64_t nt = js_len_of(tests), nv = js_len_of(vectors);
    if (nt != nv) printf("@@ALGO %lld COUNT %lld\n", (long long)a, (long long)nt);
    for (int64_t v = 0; v < nv; ++v) {
      js_str* failure = NULL;
      js_try t2; JS_TRY_PUSH(t2);
      if (!JS_SETJMP(t2.jb)) {
        failure = v < nt ? vh_check(algorithm, spec, js_idx_get(vectors, v), js_idx_get(tests, v)) : js_str_c("vector missing");
        JS_TRY_POP(t2);
      } else { JS_TRY_POP(t2); failure = vh_describe(t2.exc); }
      if (failure) printf("@@VEC %lld %lld FAIL %s\n", (long long)a, (long long)v, vh_one_line(failure));
      else printf("@@VEC %lld %lld PASS\n", (long long)a, (long long)v);
      fflush(stdout);
    }
  }
  printf("@@DONE\n");
  fflush(stdout);
  return 0;
}
