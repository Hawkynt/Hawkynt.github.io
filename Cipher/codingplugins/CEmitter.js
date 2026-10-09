/**
 * CEmitter.js - C source from the C transformer's file, with its runtime
 * (c)2006-2025 Hawkynt
 *
 * The runtime (C_RUNTIME below) gives the generated code JavaScript's values:
 * tagged numbers, strings (UTF-16), BigInt (sign and magnitude in 32-bit limbs,
 * Knuth division), objects with prototypes, arrays, typed arrays, ArrayBuffer
 * and DataView, Map and Set, closures, classes, exceptions (setjmp/longjmp),
 * regular expressions (a backtracking matcher), JSON, Math and the other
 * built-ins algorithms use. It is guarded, so bundled files include it once.
 * Build with: gcc -std=gnu17 -O1 (GNU C: statement expressions, u"" literals).
 */
(function (global) {
  'use strict';

  // @@RUNTIME-BEGIN
  const C_RUNTIME = String.raw`// JavaScript value runtime for the transpiled C code (GNU C17).
// Values are tagged (undefined, null, boolean, number, string, BigInt, object);
// objects carry their properties and a prototype; functions are closures over
// captured variable cells. Memory is never freed: a run is short-lived.
#ifndef JS_RUNTIME_INCLUDED
#define JS_RUNTIME_INCLUDED
#define __USE_MINGW_ANSI_STDIO 1
#include <stdint.h>
#include <stddef.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <setjmp.h>
#include <time.h>

typedef struct js_str js_str;
typedef struct js_obj js_obj;
typedef struct js_big js_big;
typedef struct js_func js_func;

enum { JS_T_UNDEF, JS_T_NULL, JS_T_BOOL, JS_T_NUM, JS_T_STR, JS_T_BIG, JS_T_OBJ, JS_T_HOLE };
typedef struct js_val { int32_t t; union { double n; int32_t b; js_str* s; js_obj* o; js_big* g; } u; } js_val;

#define JS_U ((js_val){ .t = JS_T_UNDEF })
#define JS_NULL ((js_val){ .t = JS_T_NULL })
#define JS_HOLE ((js_val){ .t = JS_T_HOLE })
#define JS_TRUE ((js_val){ .t = JS_T_BOOL, .u.b = 1 })
#define JS_FALSE ((js_val){ .t = JS_T_BOOL, .u.b = 0 })
#define JS_B(x) ((js_val){ .t = JS_T_BOOL, .u.b = (x) ? 1 : 0 })
#define JS_D(x) ((js_val){ .t = JS_T_NUM, .u.n = (double)(x) })
#define JS_SV(x) ((js_val){ .t = JS_T_STR, .u.s = (x) })
#define JS_O(x) ((js_val){ .t = JS_T_OBJ, .u.o = (js_obj*)(x) })
#define JS_GV(x) ((js_val){ .t = JS_T_BIG, .u.g = (x) })
#define JS_IS_UNDEF(v) ((v).t == JS_T_UNDEF)
#define JS_IS_NULLISH(v) ((v).t <= JS_T_NULL)

typedef js_val (*js_code)(js_func* f, js_val self, int argc, js_val* argv, js_val nt);
#define JS_FN(name) js_val name(js_func* __f, js_val __this, int __jsargc, js_val* __jsargv, js_val __nt)
#define JS_ARG(i) (__jsargc > (i) ? __jsargv[(i)] : JS_U)

// ---------------------------------------------------------------- memory
static char* js_heap_ptr;
static size_t js_heap_left;
static void js_oom(void) { fputs("out of memory\n", stderr); exit(3); }
static void* js_alloc(size_t n) {
  n = (n + 15) & ~(size_t)15;
  if (n > 65536) { void* p = calloc(1, n); if (!p) js_oom(); return p; }
  if (n > js_heap_left) {
    size_t chunk = (size_t)1 << 22;
    js_heap_ptr = (char*)calloc(1, chunk);
    if (!js_heap_ptr) js_oom();
    js_heap_left = chunk;
  }
  void* p = js_heap_ptr; js_heap_ptr += n; js_heap_left -= n;
  return p;
}
// memory that holds no pointers and may be large (array/string payloads)
static void* js_alloc_raw(size_t n) { return js_alloc(n ? n : 1); }

// ---------------------------------------------------------------- errors (declared)
static void js_throw(js_val v) __attribute__((noreturn));
static void js_throw_type(const char* fmt, ...) __attribute__((noreturn));
static void js_throw_range(const char* fmt, ...) __attribute__((noreturn));
static void js_throw_ref(const char* fmt, ...) __attribute__((noreturn));
static void js_throw_syntax(const char* fmt, ...) __attribute__((noreturn));

// ---------------------------------------------------------------- strings
// UTF-16 code units in a buffer that appending may share: a string ending at
// the buffer's used length appends in place (s += x in a loop is linear).
typedef struct js_sbuf { int32_t used, cap; uint16_t d[]; } js_sbuf;
struct js_str { int32_t len; uint32_t hash; uint8_t hashed, atom; js_sbuf* buf; uint16_t* d; };

static js_str* js_str_alloc(int32_t len, int32_t cap) {
  if (cap < len) cap = len;
  js_sbuf* b = (js_sbuf*)js_alloc_raw(sizeof(js_sbuf) + 2 * (size_t)cap);
  b->cap = cap; b->used = len;
  js_str* s = (js_str*)js_alloc(sizeof(js_str));
  s->len = len; s->buf = b; s->d = b->d;
  return s;
}
static js_str* js_str_new(const uint16_t* d, int32_t len) {
  js_str* s = js_str_alloc(len, len);
  if (len) memcpy(s->d, d, 2 * (size_t)len);
  return s;
}
static js_str* js_str_utf8(const char* c, size_t n) {
  js_str* s = js_str_alloc(0, (int32_t)n);
  int32_t k = 0;
  for (size_t i = 0; i < n;) {
    uint32_t ch = (uint8_t)c[i];
    int extra = ch >= 0xF0 ? 3 : ch >= 0xE0 ? 2 : ch >= 0xC0 ? 1 : 0;
    if (extra) ch &= 0x3F >> extra;
    ++i;
    for (int e = 0; e < extra && i < n; ++e, ++i) ch = (ch << 6) | ((uint8_t)c[i] & 0x3F);
    if (ch >= 0x10000) { ch -= 0x10000; s->d[k++] = (uint16_t)(0xD800 + (ch >> 10)); s->d[k++] = (uint16_t)(0xDC00 + (ch & 0x3FF)); }
    else s->d[k++] = (uint16_t)ch;
  }
  s->len = k; s->buf->used = k;
  return s;
}
static js_str* js_str_c(const char* c) { return js_str_utf8(c, strlen(c)); }
static js_str* js_str_lit(const void* lit, size_t bytes) {
  // a u"..." literal (char16_t units); bytes includes the terminator
  int32_t n = (int32_t)(bytes / 2) - 1;
  js_str* s = js_str_alloc(n, n);
  if (n) memcpy(s->d, lit, 2 * (size_t)n);
  return s;
}
/** UTF-8 form (NUL-terminated, lone surrogates as U+FFFD) */
static char* js_str_utf8z(const js_str* s) {
  char* out = (char*)js_alloc_raw(3 * (size_t)s->len + 1);
  size_t k = 0;
  for (int32_t i = 0; i < s->len; ++i) {
    uint32_t c = s->d[i];
    if (c >= 0xD800 && c < 0xDC00 && i + 1 < s->len && s->d[i + 1] >= 0xDC00 && s->d[i + 1] < 0xE000) {
      c = 0x10000 + ((c - 0xD800) << 10) + (s->d[i + 1] - 0xDC00); ++i;
    } else if (c >= 0xD800 && c < 0xE000) c = 0xFFFD;
    if (c < 0x80) out[k++] = (char)c;
    else if (c < 0x800) { out[k++] = (char)(0xC0 | (c >> 6)); out[k++] = (char)(0x80 | (c & 0x3F)); }
    else if (c < 0x10000) { out[k++] = (char)(0xE0 | (c >> 12)); out[k++] = (char)(0x80 | ((c >> 6) & 0x3F)); out[k++] = (char)(0x80 | (c & 0x3F)); }
    else { out[k++] = (char)(0xF0 | (c >> 18)); out[k++] = (char)(0x80 | ((c >> 12) & 0x3F)); out[k++] = (char)(0x80 | ((c >> 6) & 0x3F)); out[k++] = (char)(0x80 | (c & 0x3F)); }
  }
  out[k] = 0;
  return out;
}
static uint32_t js_str_hash(js_str* s) {
  if (!s->hashed) {
    uint32_t h = 2166136261u;
    for (int32_t i = 0; i < s->len; ++i) { h ^= s->d[i]; h *= 16777619u; }
    s->hash = h ? h : 1; s->hashed = 1;
  }
  return s->hash;
}
static int js_str_eq(js_str* a, js_str* b) {
  if (a == b) return 1;
  if (a->len != b->len) return 0;
  if (a->atom && b->atom) return 0;
  return memcmp(a->d, b->d, 2 * (size_t)a->len) == 0;
}
static int js_str_cmp(js_str* a, js_str* b) {
  int32_t n = a->len < b->len ? a->len : b->len;
  for (int32_t i = 0; i < n; ++i) if (a->d[i] != b->d[i]) return a->d[i] < b->d[i] ? -1 : 1;
  return a->len < b->len ? -1 : a->len > b->len ? 1 : 0;
}
static js_str* js_str_concat(js_str* a, js_str* b) {
  if (b->len == 0) return a;
  if (a->len == 0) return b;
  js_sbuf* buf = a->buf;
  if (buf && a->d + a->len == buf->d + buf->used && buf->used + b->len <= buf->cap) {
    memcpy(buf->d + buf->used, b->d, 2 * (size_t)b->len);
    buf->used += b->len;
    js_str* s = (js_str*)js_alloc(sizeof(js_str));
    s->len = a->len + b->len; s->buf = buf; s->d = a->d;
    return s;
  }
  int32_t n = a->len + b->len;
  js_str* s = js_str_alloc(n, n < 64 ? n + 32 : n * 2);
  memcpy(s->d, a->d, 2 * (size_t)a->len);
  memcpy(s->d + a->len, b->d, 2 * (size_t)b->len);
  return s;
}
static js_str* js_str_sub(js_str* s, int32_t start, int32_t end) {
  if (start < 0) start = 0;
  if (end > s->len) end = s->len;
  if (end <= start) return js_str_new(NULL, 0);
  if (start == 0 && end == s->len) return s;
  js_str* r = (js_str*)js_alloc(sizeof(js_str));
  r->len = end - start; r->buf = s->buf; r->d = s->d + start;
  return r;
}
static js_str* js_str_char(uint16_t c) {
  static js_str* cache[256];
  if (c < 256) { if (!cache[c]) cache[c] = js_str_new(&c, 1); return cache[c]; }
  return js_str_new(&c, 1);
}
static int js_str_eqc(js_str* s, const char* c) {
  size_t n = strlen(c);
  if ((size_t)s->len != n) return 0;
  for (size_t i = 0; i < n; ++i) if (s->d[i] != (uint8_t)c[i]) return 0;
  return 1;
}

// ---------------------------------------------------------------- atoms
// Property keys are interned strings: a key compares by pointer.
static js_str** js_atoms;
static uint32_t js_atom_cap, js_atom_count;
static js_str* js_intern(js_str* s) {
  if (s->atom) return s;
  if (js_atom_count * 2 >= js_atom_cap) {
    uint32_t cap = js_atom_cap ? js_atom_cap * 2 : 4096;
    js_str** t = (js_str**)calloc(cap, sizeof(js_str*));
    if (!t) js_oom();
    for (uint32_t i = 0; i < js_atom_cap; ++i) {
      js_str* a = js_atoms[i];
      if (!a) continue;
      uint32_t j = js_str_hash(a) & (cap - 1);
      while (t[j]) j = (j + 1) & (cap - 1);
      t[j] = a;
    }
    free(js_atoms); js_atoms = t; js_atom_cap = cap;
  }
  uint32_t h = js_str_hash(s), j = h & (js_atom_cap - 1);
  while (js_atoms[j]) {
    js_str* a = js_atoms[j];
    if (a->hash == h && a->len == s->len && memcmp(a->d, s->d, 2 * (size_t)s->len) == 0) return a;
    j = (j + 1) & (js_atom_cap - 1);
  }
  // an atom owns its storage: appending to a shared buffer must not reach it
  js_str* a = js_str_new(s->d, s->len);
  a->hash = h; a->hashed = 1; a->atom = 1;
  a->buf = NULL;
  js_atoms[j] = a; ++js_atom_count;
  return a;
}
static js_str* js_atom_c(const char* c) { return js_intern(js_str_c(c)); }
#define JS_STR(lit) ({ static js_str* __s_; if (!__s_) __s_ = js_str_lit(lit, sizeof(lit)); __s_; })
#define JS_ATOM(lit) ({ static js_str* __a_; if (!__a_) __a_ = js_intern(js_str_lit(lit, sizeof(lit))); __a_; })
#define JS_S(lit) JS_SV(JS_STR(lit))

// ---------------------------------------------------------------- objects
enum { K_OBJ, K_ARR, K_TYPED, K_ABUF, K_DVIEW, K_FUNC, K_MAP, K_SET, K_REGEXP, K_ITER, K_ARGS };
enum { P_ACC = 1, P_HIDDEN = 2, P_RO = 4 };
typedef struct js_prop { js_str* key; js_val v; js_obj* get; js_obj* set; uint32_t flags; } js_prop;
struct js_obj {
  uint8_t kind, frozen, sealed, noext;
  js_obj* proto;
  js_prop* p; int32_t np, cp;
  int32_t* ix; int32_t ixcap;
};

typedef struct js_arr { js_obj o; js_val* a; int64_t len, cap; } js_arr;
typedef struct js_abuf { js_obj o; uint8_t* data; int64_t len; } js_abuf;
enum { TA_I8, TA_U8, TA_U8C, TA_I16, TA_U16, TA_I32, TA_U32, TA_F32, TA_F64, TA_BI64, TA_BU64 };
typedef struct js_typed { js_obj o; int32_t tk; js_abuf* buf; int64_t off, len; } js_typed;
typedef struct js_dview { js_obj o; js_abuf* buf; int64_t off, len; } js_dview;
enum { JF_CTOR = 1, JF_CLASS = 2, JF_DERIVED = 4, JF_NATIVE_CTOR = 8, JF_ARROW = 16, JF_BOUND = 32 };
struct js_func {
  js_obj o;
  js_code code;
  js_val** env; int32_t nenv;
  js_obj* home;          // the object a method is defined on (super lookups)
  js_str* name;
  int32_t length, flags;
  void (*fields)(js_func*, js_val); // class instance field initialisers
  js_val bound_this, bound_target; js_val* bound_args; int32_t nbound;
  void* data;            // native payload
};
typedef struct js_map { js_obj o; js_val* k; js_val* v; uint8_t* live; int64_t n, cap, count; int64_t* ix; int64_t ixcap; } js_map;

static js_obj* js_Object_proto;
static js_obj* js_Function_proto;
static js_obj* js_Array_proto;
static js_obj* js_String_proto;
static js_obj* js_Number_proto;
static js_obj* js_Boolean_proto;
static js_obj* js_BigInt_proto;
static js_obj* js_Error_proto;
static js_obj* js_Map_proto;
static js_obj* js_Set_proto;
static js_obj* js_ArrayBuffer_proto;
static js_obj* js_DataView_proto;
static js_obj* js_TypedArray_proto;
static js_obj* js_typed_protos[11];
static js_obj* js_RegExp_proto;
static js_obj* js_Iterator_proto;
static js_obj* js_global;

static void js_obj_init(js_obj* o, int kind, js_obj* proto) { o->kind = (uint8_t)kind; o->proto = proto; }
static js_obj* js_obj_new(js_obj* proto) {
  js_obj* o = (js_obj*)js_alloc(sizeof(js_obj));
  js_obj_init(o, K_OBJ, proto);
  return o;
}
static js_val js_new_object(void) { return JS_O(js_obj_new(js_Object_proto)); }

static void js_ix_rebuild(js_obj* o) {
  int32_t cap = 16;
  while (cap < o->np * 3) cap *= 2;
  o->ix = (int32_t*)js_alloc_raw(sizeof(int32_t) * (size_t)cap);
  memset(o->ix, 0xFF, sizeof(int32_t) * (size_t)cap);
  o->ixcap = cap;
  for (int32_t i = 0; i < o->np; ++i) {
    if (!o->p[i].key) continue;
    uint32_t j = o->p[i].key->hash & (uint32_t)(cap - 1);
    while (o->ix[j] >= 0) j = (j + 1) & (uint32_t)(cap - 1);
    o->ix[j] = i;
  }
}
static js_prop* js_own(js_obj* o, js_str* k) {
  if (o->ix) {
    uint32_t m = (uint32_t)o->ixcap - 1, j = k->hash & m;
    for (;;) {
      int32_t i = o->ix[j];
      if (i < 0) return NULL;
      if (o->p[i].key == k) return &o->p[i];
      j = (j + 1) & m;
    }
  }
  for (int32_t i = 0; i < o->np; ++i) if (o->p[i].key == k) return &o->p[i];
  return NULL;
}
static js_prop* js_own_add(js_obj* o, js_str* k) {
  if (o->np == o->cp) {
    int32_t cap = o->cp ? o->cp * 2 : 4;
    js_prop* p = (js_prop*)js_alloc(sizeof(js_prop) * (size_t)cap);
    if (o->np) memcpy(p, o->p, sizeof(js_prop) * (size_t)o->np);
    o->p = p; o->cp = cap;
  }
  js_prop* p = &o->p[o->np++];
  memset(p, 0, sizeof *p);
  p->key = k;
  if (o->ix) {
    if (o->np * 2 > o->ixcap) js_ix_rebuild(o);
    else {
      uint32_t m = (uint32_t)o->ixcap - 1, j = k->hash & m;
      while (o->ix[j] >= 0) j = (j + 1) & m;
      o->ix[j] = o->np - 1;
    }
  } else if (o->np > 8) js_ix_rebuild(o);
  return p;
}
/** Define (or overwrite) an own data property */
static void js_define(js_obj* o, js_str* k, js_val v, uint32_t flags) {
  js_prop* p = js_own(o, k);
  if (!p) p = js_own_add(o, k);
  p->v = v; p->flags = flags; p->get = p->set = NULL;
}
static void js_define_accessor(js_obj* o, js_str* k, js_obj* get, js_obj* set, uint32_t flags) {
  js_prop* p = js_own(o, k);
  if (!p) p = js_own_add(o, k);
  if (!(p->flags & P_ACC)) { p->get = p->set = NULL; p->v = JS_U; }
  p->flags = P_ACC | flags;
  if (get) p->get = get;
  if (set) p->set = set;
}
static int js_delete_own(js_obj* o, js_str* k) {
  js_prop* p = js_own(o, k);
  if (!p) return 1;
  if (o->frozen || o->sealed) return 0;
  p->key = NULL; p->v = JS_U;
  // a deleted slot stays in the index as a dead entry; compact the list when sparse
  return 1;
}

// ---------------------------------------------------------------- arrays
static js_arr* js_arr_alloc(int64_t len, int64_t cap) {
  js_arr* a = (js_arr*)js_alloc(sizeof(js_arr));
  js_obj_init(&a->o, K_ARR, js_Array_proto);
  if (cap < len) cap = len;
  if (cap < 4) cap = 4;
  a->a = (js_val*)js_alloc(sizeof(js_val) * (size_t)cap);
  a->len = len; a->cap = cap;
  return a;
}
static js_val js_arr_new(int64_t len) { return JS_O(js_arr_alloc(len, len)); }
static js_val js_arr_of(int n, const js_val* v) {
  js_arr* a = js_arr_alloc(n, n);
  if (n) memcpy(a->a, v, sizeof(js_val) * (size_t)n);
  return JS_O(a);
}
static void js_arr_reserve(js_arr* a, int64_t cap) {
  if (cap <= a->cap) return;
  int64_t nc = a->cap * 2;
  if (nc < cap) nc = cap;
  js_val* n = (js_val*)js_alloc(sizeof(js_val) * (size_t)nc);
  memcpy(n, a->a, sizeof(js_val) * (size_t)a->len);
  a->a = n; a->cap = nc;
}
static void js_arr_setlen(js_arr* a, int64_t len) {
  if (len > a->len) {
    js_arr_reserve(a, len);
    for (int64_t i = a->len; i < len; ++i) a->a[i] = JS_HOLE;
  } else {
    for (int64_t i = len; i < a->len; ++i) a->a[i] = JS_U;
  }
  a->len = len;
}
static void js_arr_push1(js_arr* a, js_val v) {
  if (a->len == a->cap) js_arr_reserve(a, a->len + 1);
  a->a[a->len++] = v;
}

// ---------------------------------------------------------------- functions
static js_func* js_func_new(js_code code, js_str* name, int32_t length, int32_t nenv, js_val** env) {
  js_func* f = (js_func*)js_alloc(sizeof(js_func));
  js_obj_init(&f->o, K_FUNC, js_Function_proto);
  f->code = code; f->name = name; f->length = length; f->nenv = nenv;
  if (nenv) { f->env = (js_val**)js_alloc(sizeof(js_val*) * (size_t)nenv); memcpy(f->env, env, sizeof(js_val*) * (size_t)nenv); }
  return f;
}
/** A closure value: flags JF_ARROW for arrow functions, else a plain function (a constructor) */
static js_val js_closure(js_code code, js_str* name, int32_t length, int32_t flags, js_obj* home, int32_t nenv, js_val** env) {
  js_func* f = js_func_new(code, name, length, nenv, env);
  f->flags = flags;
  f->home = home;
  return JS_O(f);
}
static js_val* js_cell(js_val v) { js_val* c = (js_val*)js_alloc(sizeof(js_val)); *c = v; return c; }
static int js_is_callable(js_val v) { return v.t == JS_T_OBJ && v.u.o->kind == K_FUNC; }

// ---------------------------------------------------------------- exceptions
// GCC's builtin setjmp/longjmp: no unwinding (MinGW's longjmp unwinds through SEH)
typedef struct js_try { void* jb[5]; struct js_try* prev; js_val exc; } js_try;
#define JS_SETJMP(b) __builtin_setjmp(b)
static js_try* js_try_top;
static void js_report_uncaught(js_val v);
static void js_throw(js_val v) {
  js_try* t = js_try_top;
  if (!t) { js_report_uncaught(v); exit(1); }
  t->exc = v;
  __builtin_longjmp(t->jb, 1);
}
#define JS_TRY_PUSH(t) ((t).prev = js_try_top, js_try_top = &(t))
#define JS_TRY_POP(t) (js_try_top = (t).prev)

// ---------------------------------------------------------------- BigInt
// Arbitrary precision integers with JavaScript BigInt semantics: sign and
// magnitude in 32-bit little-endian limbs (no leading zero limb, zero never
// negative), truncating division, floor right shifts, and bitwise operators
// on the infinite two's complement form. Values are immutable.
struct js_big { int32_t n; int32_t neg; uint32_t d[]; };

static js_big* js_big_alloc(int32_t n) {
  js_big* b = (js_big*)js_alloc_raw(sizeof(js_big) + 4 * (size_t)(n ? n : 1));
  b->n = n; b->neg = 0;
  if (n) memset(b->d, 0, 4 * (size_t)n);
  return b;
}
static js_big* js_big_trim(js_big* b) {
  while (b->n && b->d[b->n - 1] == 0) --b->n;
  if (!b->n) b->neg = 0;
  return b;
}
static js_big* js_big_from_u64(uint64_t v, int neg) {
  js_big* b = js_big_alloc(2);
  b->d[0] = (uint32_t)v; b->d[1] = (uint32_t)(v >> 32); b->neg = neg;
  return js_big_trim(b);
}
static js_big* js_big_from_i64(int64_t v) { return v < 0 ? js_big_from_u64(0 - (uint64_t)v, 1) : js_big_from_u64((uint64_t)v, 0); }
static js_big* js_big_zero(void) { static js_big* z; if (!z) z = js_big_alloc(0); return z; }
static js_big* js_big_from_double(double d) {
  if (isnan(d) || isinf(d) || d != trunc(d)) js_throw_range("The number %.17g cannot be converted to a BigInt because it is not an integer", d);
  int neg = d < 0; if (neg) d = -d;
  int32_t n = 0; uint32_t limbs[40];
  while (d >= 1 && n < 40) { double q = floor(d / 4294967296.0); limbs[n++] = (uint32_t)(d - q * 4294967296.0); d = q; }
  js_big* b = js_big_alloc(n);
  memcpy(b->d, limbs, 4 * (size_t)n); b->neg = neg;
  return js_big_trim(b);
}
static int js_big_cmpmag(const js_big* a, const js_big* b) {
  if (a->n != b->n) return a->n < b->n ? -1 : 1;
  for (int32_t i = a->n; i-- > 0;) if (a->d[i] != b->d[i]) return a->d[i] < b->d[i] ? -1 : 1;
  return 0;
}
static int js_big_cmp(const js_big* a, const js_big* b) {
  if (a->neg != b->neg) return a->neg ? -1 : 1;
  int c = js_big_cmpmag(a, b);
  return a->neg ? -c : c;
}
static js_big* js_big_addmag(const js_big* a, const js_big* b, int neg) {
  if (a->n < b->n) { const js_big* t = a; a = b; b = t; }
  js_big* r = js_big_alloc(a->n + 1);
  uint64_t c = 0;
  for (int32_t i = 0; i < a->n; ++i) { c += (uint64_t)a->d[i] + (i < b->n ? b->d[i] : 0); r->d[i] = (uint32_t)c; c >>= 32; }
  r->d[a->n] = (uint32_t)c; r->neg = neg;
  return js_big_trim(r);
}
// |a| - |b| with |a| >= |b|
static js_big* js_big_submag(const js_big* a, const js_big* b, int neg) {
  js_big* r = js_big_alloc(a->n);
  int64_t br = 0;
  for (int32_t i = 0; i < a->n; ++i) {
    int64_t d = (int64_t)a->d[i] - (i < b->n ? b->d[i] : 0) - br;
    if (d < 0) { d += 4294967296LL; br = 1; } else br = 0;
    r->d[i] = (uint32_t)d;
  }
  r->neg = neg;
  return js_big_trim(r);
}
static js_big* js_big_neg(const js_big* a) {
  js_big* r = js_big_alloc(a->n);
  memcpy(r->d, a->d, 4 * (size_t)a->n);
  r->neg = a->n ? !a->neg : 0;
  return r;
}
static js_big* js_big_add(const js_big* a, const js_big* b) {
  if (a->neg == b->neg) return js_big_addmag(a, b, a->neg);
  int c = js_big_cmpmag(a, b);
  if (c == 0) return js_big_zero();
  return c > 0 ? js_big_submag(a, b, a->neg) : js_big_submag(b, a, b->neg);
}
static js_big* js_big_sub(const js_big* a, const js_big* b) {
  if (a->neg != b->neg) return js_big_addmag(a, b, a->neg);
  int c = js_big_cmpmag(a, b);
  if (c == 0) return js_big_zero();
  return c > 0 ? js_big_submag(a, b, a->neg) : js_big_submag(b, a, !a->neg);
}
static js_big* js_big_mul(const js_big* a, const js_big* b) {
  if (!a->n || !b->n) return js_big_zero();
  js_big* r = js_big_alloc(a->n + b->n);
  for (int32_t i = 0; i < a->n; ++i) {
    uint64_t c = 0, ai = a->d[i];
    if (!ai) continue;
    for (int32_t j = 0; j < b->n; ++j) { c += ai * b->d[j] + r->d[i + j]; r->d[i + j] = (uint32_t)c; c >>= 32; }
    int32_t k = i + b->n;
    while (c) { c += r->d[k]; r->d[k++] = (uint32_t)c; c >>= 32; }
  }
  r->neg = a->neg != b->neg;
  return js_big_trim(r);
}
// Knuth algorithm D on magnitudes: q = |a| / |b|, r = |a| % |b|
static void js_big_divmag(const js_big* a, const js_big* b, js_big** qo, js_big** ro) {
  if (!b->n) js_throw_range("Division by zero");
  if (js_big_cmpmag(a, b) < 0) {
    if (qo) *qo = js_big_zero();
    if (ro) { js_big* r = js_big_alloc(a->n); memcpy(r->d, a->d, 4 * (size_t)a->n); *ro = r; }
    return;
  }
  if (b->n == 1) {
    uint64_t rem = 0, d = b->d[0];
    js_big* q = js_big_alloc(a->n);
    for (int32_t i = a->n; i-- > 0;) { uint64_t cur = (rem << 32) | a->d[i]; q->d[i] = (uint32_t)(cur / d); rem = cur % d; }
    if (qo) *qo = js_big_trim(q);
    if (ro) *ro = js_big_from_u64(rem, 0);
    return;
  }
  int s = 0; uint32_t top = b->d[b->n - 1];
  while (!(top & 0x80000000u)) { top <<= 1; ++s; }
  int32_t n = b->n, m = a->n - n;
  uint32_t* bn = (uint32_t*)js_alloc_raw(4 * (size_t)n);
  uint32_t* an = (uint32_t*)js_alloc_raw(4 * (size_t)(a->n + 1));
  for (int32_t i = n; i-- > 0;) bn[i] = (b->d[i] << s) | (s && i ? (uint32_t)((uint64_t)b->d[i - 1] >> (32 - s)) : 0);
  an[a->n] = s ? (uint32_t)((uint64_t)a->d[a->n - 1] >> (32 - s)) : 0;
  for (int32_t i = a->n; i-- > 0;) an[i] = (a->d[i] << s) | (s && i ? (uint32_t)((uint64_t)a->d[i - 1] >> (32 - s)) : 0);
  js_big* q = js_big_alloc(m + 1);
  for (int32_t j = m + 1; j-- > 0;) {
    uint64_t num = ((uint64_t)an[j + n] << 32) | an[j + n - 1];
    uint64_t qhat = num / bn[n - 1], rhat = num % bn[n - 1];
    while (qhat >= 4294967296ULL || qhat * bn[n - 2] > ((rhat << 32) | an[j + n - 2])) {
      --qhat; rhat += bn[n - 1];
      if (rhat >= 4294967296ULL) break;
    }
    int64_t borrow = 0; uint64_t carry = 0;
    for (int32_t i = 0; i < n; ++i) {
      uint64_t p = qhat * bn[i] + carry; carry = p >> 32;
      int64_t t = (int64_t)an[i + j] - borrow - (int64_t)(uint32_t)p;
      an[i + j] = (uint32_t)t; borrow = t < 0 ? 1 : 0;
    }
    int64_t t = (int64_t)an[j + n] - borrow - (int64_t)carry;
    an[j + n] = (uint32_t)t;
    if (t < 0) {
      --qhat; uint64_t c = 0;
      for (int32_t i = 0; i < n; ++i) { c += (uint64_t)an[i + j] + bn[i]; an[i + j] = (uint32_t)c; c >>= 32; }
      an[j + n] += (uint32_t)c;
    }
    q->d[j] = (uint32_t)qhat;
  }
  if (qo) *qo = js_big_trim(q);
  if (ro) {
    js_big* r = js_big_alloc(n);
    for (int32_t i = 0; i < n; ++i) r->d[i] = (an[i] >> s) | (s && i + 1 <= a->n ? (uint32_t)((uint64_t)an[i + 1] << (32 - s)) : 0);
    *ro = js_big_trim(r);
  }
}
static js_big* js_big_div(const js_big* a, const js_big* b) {
  js_big* q; js_big_divmag(a, b, &q, NULL);
  if (q->n) q->neg = a->neg != b->neg;
  return q;
}
static js_big* js_big_mod(const js_big* a, const js_big* b) {
  js_big* r; js_big_divmag(a, b, NULL, &r);
  if (r->n) r->neg = a->neg;
  return r;
}
static int64_t js_big_bitlen(const js_big* a) {
  if (!a->n) return 0;
  int64_t n = (int64_t)(a->n - 1) * 32; uint32_t t = a->d[a->n - 1];
  while (t) { ++n; t >>= 1; }
  return n;
}
static int js_big_testbit(const js_big* a, int64_t i) {
  int64_t w = i / 32;
  return w < a->n && ((a->d[w] >> (i % 32)) & 1);
}
static js_big* js_big_shl(const js_big* a, int64_t n);
static js_big* js_big_shr(const js_big* a, int64_t n) {
  if (n < 0) return js_big_shl(a, -n);
  if (!a->n) return (js_big*)a;
  int64_t w = n / 32; int b = (int)(n % 32);
  int lost = 0;
  for (int64_t i = 0; i < w && i < a->n; ++i) if (a->d[i]) { lost = 1; break; }
  if (!lost && b && w < a->n && (a->d[w] & ((1u << b) - 1))) lost = 1;
  js_big* r;
  if (w < a->n) {
    r = js_big_alloc((int32_t)(a->n - w));
    for (int64_t i = w; i < a->n; ++i) {
      uint64_t v = a->d[i] >> b;
      if (b && i + 1 < a->n) v |= (uint64_t)a->d[i + 1] << (32 - b);
      r->d[i - w] = (uint32_t)v;
    }
  } else r = js_big_alloc(0);
  r->neg = a->neg;
  js_big_trim(r);
  if (a->neg && lost) r = js_big_sub(r, js_big_from_u64(1, 0));
  return r;
}
static js_big* js_big_shl(const js_big* a, int64_t n) {
  if (n < 0) return js_big_shr(a, -n);
  if (!a->n) return (js_big*)a;
  if (n > (1 << 30)) js_throw_range("Maximum BigInt size exceeded");
  int64_t w = n / 32; int b = (int)(n % 32);
  js_big* r = js_big_alloc((int32_t)(a->n + w + 1));
  for (int32_t i = 0; i < a->n; ++i) {
    uint64_t v = (uint64_t)a->d[i] << b;
    r->d[i + w] |= (uint32_t)v; r->d[i + w + 1] |= (uint32_t)(v >> 32);
  }
  r->neg = a->neg;
  return js_big_trim(r);
}
static uint32_t* js_big_twos(const js_big* a, int32_t n) {
  uint32_t* r = (uint32_t*)js_alloc_raw(4 * (size_t)n);
  memset(r, 0, 4 * (size_t)n);
  for (int32_t i = 0; i < a->n && i < n; ++i) r[i] = a->d[i];
  if (a->neg) { uint64_t c = 1; for (int32_t i = 0; i < n; ++i) { c += (uint32_t)~r[i]; r[i] = (uint32_t)c; c >>= 32; } }
  return r;
}
static js_big* js_big_from_twos(uint32_t* r, int32_t n) {
  int neg = n && (r[n - 1] & 0x80000000u);
  if (neg) { uint64_t c = 1; for (int32_t i = 0; i < n; ++i) { c += (uint32_t)~r[i]; r[i] = (uint32_t)c; c >>= 32; } }
  js_big* b = js_big_alloc(n);
  memcpy(b->d, r, 4 * (size_t)n); b->neg = neg;
  return js_big_trim(b);
}
static js_big* js_big_bitop(const js_big* a, const js_big* b, int op) {
  int32_t n = (a->n > b->n ? a->n : b->n) + 1;
  uint32_t* x = js_big_twos(a, n);
  uint32_t* y = js_big_twos(b, n);
  for (int32_t i = 0; i < n; ++i) x[i] = op == 0 ? (x[i] & y[i]) : op == 1 ? (x[i] | y[i]) : (x[i] ^ y[i]);
  return js_big_from_twos(x, n);
}
static js_big* js_big_not(const js_big* a) { return js_big_sub(js_big_neg(a), js_big_from_u64(1, 0)); }
static js_big* js_big_pow(const js_big* base, const js_big* e) {
  if (e->neg) js_throw_range("Exponent must be non-negative");
  js_big* result = js_big_from_u64(1, 0);
  js_big* b = (js_big*)base;
  int64_t bits = js_big_bitlen(e);
  for (int64_t i = 0; i < bits; ++i) {
    if (js_big_testbit(e, i)) result = js_big_mul(result, b);
    if (i + 1 < bits) b = js_big_mul(b, b);
  }
  return result;
}
static uint64_t js_big_low64(const js_big* a) {
  uint64_t v = (a->n > 0 ? a->d[0] : 0) | ((uint64_t)(a->n > 1 ? a->d[1] : 0) << 32);
  return a->neg ? 0 - v : v;
}
static double js_big_to_double(const js_big* a) {
  // round to nearest: the top 64 bits with a sticky bit for the rest
  int64_t bits = js_big_bitlen(a);
  double r;
  if (bits <= 64) r = (double)(((uint64_t)(a->n > 1 ? a->d[1] : 0) << 32) | (a->n > 0 ? a->d[0] : 0));
  else {
    js_big* top = js_big_shr(a->neg ? js_big_neg(a) : (js_big*)a, bits - 64);
    uint64_t t = ((uint64_t)top->d[1] << 32) | top->d[0];
    int sticky = 0;
    for (int64_t i = 0; i < bits - 64 && !sticky; ++i) if (js_big_testbit(a, i)) sticky = 1;
    if (sticky) t |= 1;
    // fold the low bits into a 53-bit mantissa with round-half-even, then scale
    r = ldexp((double)t, (int)(bits - 64));
  }
  return a->neg ? -r : r;
}
static js_big* js_big_as_uint(int64_t bits, const js_big* a) {
  if (bits <= 0) return js_big_zero();
  int32_t n = (int32_t)((bits + 31) / 32);
  int32_t m = n > a->n + 1 ? n : a->n + 1;
  uint32_t* r = js_big_twos(a, m);
  if (bits % 32) r[n - 1] &= (1u << (bits % 32)) - 1;
  js_big* b = js_big_alloc(n);
  memcpy(b->d, r, 4 * (size_t)n);
  return js_big_trim(b);
}
static js_big* js_big_as_int(int64_t bits, const js_big* a) {
  if (bits <= 0) return js_big_zero();
  js_big* u = js_big_as_uint(bits, a);
  if (js_big_testbit(u, bits - 1)) return js_big_sub(u, js_big_shl(js_big_from_u64(1, 0), bits));
  return u;
}
static js_str* js_big_to_str(const js_big* a, int radix) {
  if (!a->n) return js_str_char('0');
  static const char* digits = "0123456789abcdefghijklmnopqrstuvwxyz";
  uint32_t* m = (uint32_t*)js_alloc_raw(4 * (size_t)a->n);
  memcpy(m, a->d, 4 * (size_t)a->n);
  int32_t mn = a->n;
  char* buf = (char*)js_alloc_raw((size_t)a->n * 33 + 2);
  size_t k = 0;
  // peel off several digits per long division
  uint32_t chunk = (uint32_t)radix; int per = 1;
  while ((uint64_t)chunk * (uint32_t)radix < 0xFFFFFFFFu) { chunk *= (uint32_t)radix; ++per; }
  while (mn) {
    uint64_t rem = 0;
    for (int32_t i = mn; i-- > 0;) { uint64_t cur = (rem << 32) | m[i]; m[i] = (uint32_t)(cur / chunk); rem = cur % chunk; }
    while (mn && m[mn - 1] == 0) --mn;
    for (int i = 0; i < per; ++i) {
      if (!mn && !rem) break;
      buf[k++] = digits[rem % (uint32_t)radix]; rem /= (uint32_t)radix;
    }
  }
  if (a->neg) buf[k++] = '-';
  js_str* s = js_str_alloc((int32_t)k, (int32_t)k);
  for (size_t i = 0; i < k; ++i) s->d[i] = (uint8_t)buf[k - 1 - i];
  return s;
}
/** Parse a BigInt literal or StringToBigInt text; returns NULL when invalid */
static js_big* js_big_parse(const uint16_t* t, int32_t len) {
  int32_t i = 0, e = len;
  while (i < e && (t[i] == ' ' || t[i] == '\t' || t[i] == '\n' || t[i] == '\r' || t[i] == 0xA0 || t[i] == 0xFEFF)) ++i;
  while (e > i && (t[e - 1] == ' ' || t[e - 1] == '\t' || t[e - 1] == '\n' || t[e - 1] == '\r' || t[e - 1] == 0xA0 || t[e - 1] == 0xFEFF)) --e;
  if (i == e) return js_big_zero();
  int radix = 10, neg = 0;
  if (e - i > 2 && t[i] == '0' && (t[i + 1] == 'x' || t[i + 1] == 'X')) { radix = 16; i += 2; }
  else if (e - i > 2 && t[i] == '0' && (t[i + 1] == 'b' || t[i + 1] == 'B')) { radix = 2; i += 2; }
  else if (e - i > 2 && t[i] == '0' && (t[i + 1] == 'o' || t[i + 1] == 'O')) { radix = 8; i += 2; }
  else if (t[i] == '-' || t[i] == '+') { neg = t[i] == '-'; ++i; if (i == e) return NULL; }
  int32_t cap = (int32_t)((e - i) / 8 + 2);
  js_big* b = js_big_alloc(cap); b->n = 0;
  for (; i < e; ++i) {
    uint16_t c = t[i];
    int d = c >= '0' && c <= '9' ? c - '0' : c >= 'a' && c <= 'z' ? c - 'a' + 10 : c >= 'A' && c <= 'Z' ? c - 'A' + 10 : 99;
    if (d >= radix) return NULL;
    uint64_t carry = (uint64_t)d;
    for (int32_t k = 0; k < b->n; ++k) { carry += (uint64_t)b->d[k] * (uint64_t)radix; b->d[k] = (uint32_t)carry; carry >>= 32; }
    if (carry) b->d[b->n++] = (uint32_t)carry;
  }
  b->neg = neg;
  return js_big_trim(b);
}
static js_big* js_big_lit(const char* text) {
  js_str* s = js_str_c(text);
  js_big* b = js_big_parse(s->d, s->len);
  if (!b) js_throw_syntax("Cannot convert %s to a BigInt", text);
  return b;
}
#define JS_BIG(text) ({ static js_big* __b_; if (!__b_) __b_ = js_big_lit(text); JS_GV(__b_); })

// ---------------------------------------------------------------- numbers
static inline int32_t js_d2i32(double d) {
  if (d >= -2147483648.0 && d <= 2147483647.0) return (int32_t)d;
  if (!isfinite(d)) return 0;
  double t = trunc(d);
  double m = fmod(t, 4294967296.0);
  if (m < 0) m += 4294967296.0;
  return (int32_t)(uint32_t)m;
}
static inline uint32_t js_d2u32(double d) { return (uint32_t)js_d2i32(d); }

/** Number::toString(10): the shortest digits that round-trip, in JavaScript's layout */
static js_str* js_num_to_str(double x) {
  char buf[64];
  if (isnan(x)) return js_str_c("NaN");
  if (x == 0) return js_str_char('0');
  if (isinf(x)) return js_str_c(x < 0 ? "-Infinity" : "Infinity");
  if (x == trunc(x) && fabs(x) < 1e21) {
    if (fabs(x) < 9007199254740992.0) { snprintf(buf, sizeof buf, "%lld", (long long)x); return js_str_c(buf); }
  }
  char digits[32]; int exp10 = 0, nd = 0, neg = x < 0;
  double ax = neg ? -x : x;
  for (int p = 1; p <= 17; ++p) {
    snprintf(buf, sizeof buf, "%.*e", p - 1, ax);
    if (strtod(buf, NULL) == ax || p == 17) {
      // buf: d.ddde[+-]xx
      nd = 0;
      for (char* c = buf; *c && *c != 'e'; ++c) if (*c >= '0' && *c <= '9') digits[nd++] = *c;
      exp10 = atoi(strchr(buf, 'e') + 1);
      break;
    }
  }
  while (nd > 1 && digits[nd - 1] == '0') --nd;
  digits[nd] = 0;
  int n = exp10 + 1; // decimal point position
  char out[64]; int k = 0;
  if (neg) out[k++] = '-';
  if (nd <= n && n <= 21) {
    for (int i = 0; i < nd; ++i) out[k++] = digits[i];
    for (int i = nd; i < n; ++i) out[k++] = '0';
  } else if (0 < n && n <= 21) {
    for (int i = 0; i < n; ++i) out[k++] = digits[i];
    out[k++] = '.';
    for (int i = n; i < nd; ++i) out[k++] = digits[i];
  } else if (-6 < n && n <= 0) {
    out[k++] = '0'; out[k++] = '.';
    for (int i = 0; i < -n; ++i) out[k++] = '0';
    for (int i = 0; i < nd; ++i) out[k++] = digits[i];
  } else {
    out[k++] = digits[0];
    if (nd > 1) { out[k++] = '.'; for (int i = 1; i < nd; ++i) out[k++] = digits[i]; }
    k += snprintf(out + k, sizeof out - (size_t)k, "e%c%d", n - 1 >= 0 ? '+' : '-', abs(n - 1));
  }
  out[k] = 0;
  return js_str_c(out);
}
static js_str* js_num_to_radix(double x, int radix) {
  if (radix == 10) return js_num_to_str(x);
  if (isnan(x)) return js_str_c("NaN");
  if (isinf(x)) return js_str_c(x < 0 ? "-Infinity" : "Infinity");
  static const char* dg = "0123456789abcdefghijklmnopqrstuvwxyz";
  char buf[1100]; int k = 0;
  int neg = x < 0; if (neg) x = -x;
  double ip = floor(x), fp = x - ip;
  char tmp[1100]; int t = 0;
  if (ip == 0) tmp[t++] = '0';
  while (ip >= 1 && t < 1090) { double q = floor(ip / radix); int d = (int)(ip - q * radix); tmp[t++] = dg[d]; ip = q; }
  if (neg) buf[k++] = '-';
  while (t) buf[k++] = tmp[--t];
  if (fp > 0) {
    buf[k++] = '.';
    // digits until the fraction is exhausted or 52 bits of precision are spent
    double delta = 0.5 * (nextafter(x, INFINITY) - x);
    if (delta <= 0) delta = 1e-300;
    int count = 0;
    do {
      fp *= radix; delta *= radix;
      int d = (int)floor(fp);
      fp -= d;
      if (fp > 0.5 || (fp == 0.5 && (d & 1))) { if (fp + delta > 1) { // round up and stop
          ++d; buf[k++] = dg[d < radix ? d : radix - 1]; break; } }
      buf[k++] = dg[d];
      ++count;
    } while (fp >= delta && count < 1000 && k < 1090);
  }
  buf[k] = 0;
  return js_str_c(buf);
}
static int js_is_ws(uint16_t c) {
  return c == ' ' || c == '\t' || c == '\n' || c == '\r' || c == 0x0B || c == 0x0C || c == 0xA0 || c == 0xFEFF ||
    c == 0x1680 || (c >= 0x2000 && c <= 0x200A) || c == 0x2028 || c == 0x2029 || c == 0x202F || c == 0x205F || c == 0x3000;
}
/** StringToNumber: the whole (trimmed) text must be a numeric literal */
static double js_str_to_num(js_str* s) {
  int32_t i = 0, e = s->len;
  while (i < e && js_is_ws(s->d[i])) ++i;
  while (e > i && js_is_ws(s->d[e - 1])) --e;
  if (i == e) return 0;
  int32_t n = e - i;
  if (n > 2 && s->d[i] == '0') {
    int radix = s->d[i + 1] == 'x' || s->d[i + 1] == 'X' ? 16 : s->d[i + 1] == 'b' || s->d[i + 1] == 'B' ? 2 : s->d[i + 1] == 'o' || s->d[i + 1] == 'O' ? 8 : 0;
    if (radix) {
      double v = 0;
      for (int32_t k = i + 2; k < e; ++k) {
        uint16_t c = s->d[k];
        int d = c >= '0' && c <= '9' ? c - '0' : c >= 'a' && c <= 'z' ? c - 'a' + 10 : c >= 'A' && c <= 'Z' ? c - 'A' + 10 : 99;
        if (d >= radix) return NAN;
        v = v * radix + d;
      }
      return v;
    }
  }
  char* buf = (char*)js_alloc_raw((size_t)n + 1);
  for (int32_t k = 0; k < n; ++k) {
    uint16_t c = s->d[i + k];
    if (c > 127) return NAN;
    buf[k] = (char)c;
  }
  buf[n] = 0;
  const char* p = buf;
  int sign = 1;
  if (*p == '+' || *p == '-') { if (*p == '-') sign = -1; ++p; }
  if (strcmp(p, "Infinity") == 0) return sign * INFINITY;
  // only decimal literals: digits, one point, an exponent
  const char* q = p; int digits = 0;
  while (*q >= '0' && *q <= '9') { ++q; ++digits; }
  if (*q == '.') { ++q; while (*q >= '0' && *q <= '9') { ++q; ++digits; } }
  if (!digits) return NAN;
  if (*q == 'e' || *q == 'E') {
    ++q; if (*q == '+' || *q == '-') ++q;
    if (!(*q >= '0' && *q <= '9')) return NAN;
    while (*q >= '0' && *q <= '9') ++q;
  }
  if (*q) return NAN;
  return strtod(buf, NULL);
}
static double js_parse_float(js_str* s) {
  int32_t i = 0;
  while (i < s->len && js_is_ws(s->d[i])) ++i;
  char buf[400]; int k = 0;
  int32_t j = i;
  if (j < s->len && (s->d[j] == '+' || s->d[j] == '-')) buf[k++] = (char)s->d[j++];
  static const char inf[] = "Infinity";
  int m = 0;
  while (m < 8 && j + m < s->len && s->d[j + m] == (uint16_t)inf[m]) ++m;
  if (m == 8) return k && buf[0] == '-' ? -INFINITY : INFINITY;
  int digits = 0, dot = 0;
  while (j < s->len && k < 390) {
    uint16_t c = s->d[j];
    if (c >= '0' && c <= '9') { buf[k++] = (char)c; ++digits; ++j; }
    else if (c == '.' && !dot) { buf[k++] = '.'; dot = 1; ++j; }
    else break;
  }
  if (!digits) return NAN;
  if (j < s->len && (s->d[j] == 'e' || s->d[j] == 'E')) {
    int32_t save = j; int save_k = k;
    buf[k++] = 'e'; ++j;
    if (j < s->len && (s->d[j] == '+' || s->d[j] == '-')) buf[k++] = (char)s->d[j++];
    int ed = 0;
    while (j < s->len && s->d[j] >= '0' && s->d[j] <= '9' && k < 398) { buf[k++] = (char)s->d[j++]; ++ed; }
    if (!ed) { j = save; k = save_k; }
  }
  buf[k] = 0;
  return strtod(buf, NULL);
}
static double js_parse_int(js_str* s, int radix) {
  int32_t i = 0;
  while (i < s->len && js_is_ws(s->d[i])) ++i;
  int sign = 1;
  if (i < s->len && (s->d[i] == '+' || s->d[i] == '-')) { if (s->d[i] == '-') sign = -1; ++i; }
  int strip = 1;
  if (radix != 0) { if (radix < 2 || radix > 36) return NAN; if (radix != 16) strip = 0; }
  else radix = 10;
  if (strip && i + 1 < s->len && s->d[i] == '0' && (s->d[i + 1] == 'x' || s->d[i + 1] == 'X')) { i += 2; radix = 16; }
  double v = 0; int any = 0;
  for (; i < s->len; ++i) {
    uint16_t c = s->d[i];
    int d = c >= '0' && c <= '9' ? c - '0' : c >= 'a' && c <= 'z' ? c - 'a' + 10 : c >= 'A' && c <= 'Z' ? c - 'A' + 10 : 99;
    if (d >= radix) break;
    v = v * radix + d; any = 1;
  }
  return any ? sign * v : NAN;
}

// ---------------------------------------------------------------- common atoms
static js_str *A_length, *A_prototype, *A_constructor, *A_name, *A_message, *A_stack, *A_toString, *A_valueOf,
  *A_next, *A_done, *A_value, *A_exports, *A_byteLength, *A_byteOffset, *A_buffer, *A_size, *A_lastIndex,
  *A_join, *A_get, *A_set, *A_cause, *A_BYTES_PER_ELEMENT, *A_undefined, *A_null, *A_true, *A_false,
  *A_object, *A_function, *A_number, *A_string, *A_boolean, *A_bigint, *A_empty, *A_index, *A_input;
static js_obj *js_TypeError_proto, *js_RangeError_proto, *js_ReferenceError_proto, *js_SyntaxError_proto, *js_EvalError_proto, *js_URIError_proto;

static js_val js_call(js_val f, js_val self, int argc, js_val* argv);
static js_val js_get(js_val v, js_str* k);
static js_val js_set(js_val v, js_str* k, js_val x);
static js_str* js_to_str(js_val v);
static double js_to_number(js_val v);
static js_val js_invoke(js_val v, js_str* k, int argc, js_val* argv);

// ---------------------------------------------------------------- errors
static js_val js_make_error(js_obj* proto, js_str* msg) {
  js_obj* e = js_obj_new(proto);
  js_define(e, A_message, JS_SV(msg), P_HIDDEN);
  js_val name = js_get(JS_O(e), A_name);
  js_str* head = name.t == JS_T_STR ? name.u.s : js_str_c("Error");
  if (msg->len) head = js_str_concat(js_str_concat(head, js_str_c(": ")), msg);
  js_define(e, A_stack, JS_SV(js_str_concat(head, js_str_c("\n    at <transpiled C>"))), P_HIDDEN);
  return JS_O(e);
}
#include <stdarg.h>
static js_str* js_vformat(const char* fmt, va_list ap) {
  char buf[1024];
  vsnprintf(buf, sizeof buf, fmt, ap);
  return js_str_c(buf);
}
#define JS_THROWER(fn, proto) \
  static void fn(const char* fmt, ...) { va_list ap; va_start(ap, fmt); js_str* m = js_vformat(fmt, ap); va_end(ap); js_throw(js_make_error(proto, m)); }
JS_THROWER(js_throw_type, js_TypeError_proto)
JS_THROWER(js_throw_range, js_RangeError_proto)
JS_THROWER(js_throw_ref, js_ReferenceError_proto)
JS_THROWER(js_throw_syntax, js_SyntaxError_proto)
static const char* js_cstr(js_str* s) { return js_str_utf8z(s); }

// ---------------------------------------------------------------- type tests
static inline int js_is_obj(js_val v) { return v.t == JS_T_OBJ; }
static inline int js_is_kind(js_val v, int kind) { return v.t == JS_T_OBJ && v.u.o->kind == kind; }
static inline js_arr* js_as_arr(js_val v) { return (js_arr*)v.u.o; }
static inline js_typed* js_as_typed(js_val v) { return (js_typed*)v.u.o; }
static inline js_func* js_as_func(js_val v) { return (js_func*)v.u.o; }
static js_str* js_typeof_str(js_val v) {
  switch (v.t) {
    case JS_T_UNDEF: case JS_T_HOLE: return A_undefined;
    case JS_T_NULL: return A_object;
    case JS_T_BOOL: return A_boolean;
    case JS_T_NUM: return A_number;
    case JS_T_STR: return A_string;
    case JS_T_BIG: return A_bigint;
    default: return v.u.o->kind == K_FUNC ? A_function : A_object;
  }
}
static js_val js_typeof(js_val v) { return JS_SV(js_typeof_str(v)); }
static inline int js_truthy(js_val v) {
  switch (v.t) {
    case JS_T_BOOL: return v.u.b;
    case JS_T_NUM: return v.u.n != 0 && !isnan(v.u.n);
    case JS_T_STR: return v.u.s->len != 0;
    case JS_T_BIG: return v.u.g->n != 0;
    case JS_T_OBJ: return 1;
    default: return 0;
  }
}

// ---------------------------------------------------------------- typed array elements
static const int js_ta_size[11] = { 1, 1, 1, 2, 2, 4, 4, 4, 8, 8, 8 };
static const char* js_ta_names[11] = { "Int8Array", "Uint8Array", "Uint8ClampedArray", "Int16Array", "Uint16Array", "Int32Array", "Uint32Array", "Float32Array", "Float64Array", "BigInt64Array", "BigUint64Array" };
static js_big* js_to_bigint(js_val v);
static inline js_val js_typed_get(js_typed* t, int64_t i) {
  uint8_t* p = t->buf->data + t->off + i * js_ta_size[t->tk];
  switch (t->tk) {
    case TA_U8: case TA_U8C: return JS_D(*p);
    case TA_I8: return JS_D((int8_t)*p);
    case TA_I16: { int16_t v; memcpy(&v, p, 2); return JS_D(v); }
    case TA_U16: { uint16_t v; memcpy(&v, p, 2); return JS_D(v); }
    case TA_I32: { int32_t v; memcpy(&v, p, 4); return JS_D(v); }
    case TA_U32: { uint32_t v; memcpy(&v, p, 4); return JS_D(v); }
    case TA_F32: { float v; memcpy(&v, p, 4); return JS_D(v); }
    case TA_F64: { double v; memcpy(&v, p, 8); return JS_D(v); }
    case TA_BI64: { int64_t v; memcpy(&v, p, 8); return JS_GV(js_big_from_i64(v)); }
    default: { uint64_t v; memcpy(&v, p, 8); return JS_GV(js_big_from_u64(v, 0)); }
  }
}
static inline void js_typed_set_num(js_typed* t, int64_t i, double d) {
  uint8_t* p = t->buf->data + t->off + i * js_ta_size[t->tk];
  switch (t->tk) {
    case TA_U8: case TA_I8: *p = (uint8_t)js_d2i32(d); break;
    case TA_U8C: { double c = isnan(d) ? 0 : d < 0 ? 0 : d > 255 ? 255 : d; double f = floor(c); double r = c - f; uint8_t v = (uint8_t)(r > 0.5 || (r == 0.5 && ((int)f & 1)) ? f + 1 : f); *p = v; break; }
    case TA_I16: case TA_U16: { uint16_t v = (uint16_t)js_d2i32(d); memcpy(p, &v, 2); break; }
    case TA_I32: case TA_U32: { int32_t v = js_d2i32(d); memcpy(p, &v, 4); break; }
    case TA_F32: { float v = (float)d; memcpy(p, &v, 4); break; }
    case TA_F64: memcpy(p, &d, 8); break;
    default: js_throw_type("Cannot convert %.17g to a BigInt", d);
  }
}
static inline void js_typed_set(js_typed* t, int64_t i, js_val v) {
  if (t->tk >= TA_BI64) {
    uint64_t x = js_big_low64(js_to_bigint(v));
    memcpy(t->buf->data + t->off + i * 8, &x, 8);
    return;
  }
  js_typed_set_num(t, i, v.t == JS_T_NUM ? v.u.n : js_to_number(v));
}

// ---------------------------------------------------------------- conversions
static js_val js_to_primitive(js_val v, int hint_string) {
  if (v.t != JS_T_OBJ) return v;
  js_str* first = hint_string ? A_toString : A_valueOf;
  js_str* second = hint_string ? A_valueOf : A_toString;
  js_val m = js_get(v, first);
  if (js_is_callable(m)) { js_val r = js_call(m, v, 0, NULL); if (r.t != JS_T_OBJ) return r; }
  m = js_get(v, second);
  if (js_is_callable(m)) { js_val r = js_call(m, v, 0, NULL); if (r.t != JS_T_OBJ) return r; }
  js_throw_type("Cannot convert object to primitive value");
}
static double js_to_number(js_val v) {
  switch (v.t) {
    case JS_T_NUM: return v.u.n;
    case JS_T_UNDEF: case JS_T_HOLE: return NAN;
    case JS_T_NULL: return 0;
    case JS_T_BOOL: return v.u.b;
    case JS_T_STR: return js_str_to_num(v.u.s);
    case JS_T_BIG: js_throw_type("Cannot convert a BigInt value to a number");
    default: return js_to_number(js_to_primitive(v, 0));
  }
}
static js_str* js_to_str(js_val v) {
  switch (v.t) {
    case JS_T_STR: return v.u.s;
    case JS_T_NUM: return js_num_to_str(v.u.n);
    case JS_T_UNDEF: case JS_T_HOLE: return A_undefined;
    case JS_T_NULL: return A_null;
    case JS_T_BOOL: return v.u.b ? A_true : A_false;
    case JS_T_BIG: return js_big_to_str(v.u.g, 10);
    default: return js_to_str(js_to_primitive(v, 1));
  }
}
static js_val js_to_string_val(js_val v) { return v.t == JS_T_STR ? v : JS_SV(js_to_str(v)); }
static js_big* js_to_bigint(js_val v) {
  switch (v.t) {
    case JS_T_BIG: return v.u.g;
    case JS_T_BOOL: return js_big_from_u64(v.u.b, 0);
    case JS_T_STR: { js_big* b = js_big_parse(v.u.s->d, v.u.s->len); if (!b) js_throw_syntax("Cannot convert %s to a BigInt", js_cstr(v.u.s)); return b; }
    case JS_T_NUM: js_throw_type("Cannot convert %s to a BigInt", js_cstr(js_num_to_str(v.u.n)));
    case JS_T_OBJ: return js_to_bigint(js_to_primitive(v, 0));
    default: js_throw_type("Cannot convert %s to a BigInt", js_cstr(js_to_str(v)));
  }
}
static int32_t js_to_int32(js_val v) { return js_d2i32(v.t == JS_T_NUM ? v.u.n : js_to_number(v)); }
static uint32_t js_to_uint32(js_val v) { return (uint32_t)js_to_int32(v); }
static double js_to_integer(js_val v) {
  double d = v.t == JS_T_NUM ? v.u.n : js_to_number(v);
  if (isnan(d)) return 0;
  return trunc(d);
}
static js_str* js_idx_atom(int64_t i);
static js_str* js_to_key(js_val v) {
  if (v.t == JS_T_STR) return js_intern(v.u.s);
  if (v.t == JS_T_NUM) {
    double d = v.u.n;
    if (d >= 0 && d < 4294967295.0 && d == (double)(int64_t)d) return js_idx_atom((int64_t)d);
    return js_intern(js_num_to_str(d));
  }
  return js_intern(js_to_str(js_to_primitive(v, 1)));
}
static js_str* js_idx_atom(int64_t i) {
  static js_str* cache[4096];
  if (i < 4096 && cache[i]) return cache[i];
  char buf[24]; snprintf(buf, sizeof buf, "%lld", (long long)i);
  js_str* a = js_atom_c(buf);
  if (i < 4096) cache[i] = a;
  return a;
}
/** A canonical array index spelled as a property key, else -1 */
static int64_t js_key_index(js_str* k) {
  if (!k->len || k->len > 10 || k->d[0] < '0' || k->d[0] > '9') return -1;
  if (k->len > 1 && k->d[0] == '0') return -1;
  int64_t v = 0;
  for (int32_t i = 0; i < k->len; ++i) { if (k->d[i] < '0' || k->d[i] > '9') return -1; v = v * 10 + (k->d[i] - '0'); }
  return v < 4294967295LL ? v : -1;
}

// ---------------------------------------------------------------- property access
static js_val js_call_getter(js_obj* g, js_val recv) { return g ? js_call(JS_O(g), recv, 0, NULL) : JS_U; }
static js_val js_proto_get(js_obj* o, js_str* k, js_val recv) {
  for (; o; o = o->proto) {
    js_prop* p = js_own(o, k);
    if (p) return (p->flags & P_ACC) ? js_call_getter(p->get, recv) : p->v;
  }
  return JS_U;
}
static js_val js_func_prototype(js_func* f) {
  js_prop* p = js_own(&f->o, A_prototype);
  if (p) return p->v;
  if (!(f->flags & JF_CTOR)) return JS_U;
  js_obj* proto = js_obj_new(js_Object_proto);
  js_define(proto, A_constructor, JS_O(f), P_HIDDEN);
  js_define(&f->o, A_prototype, JS_O(proto), P_HIDDEN);
  return JS_O(proto);
}
/** Properties an object of a built-in kind holds outside its property list */
static int js_virtual_get(js_obj* o, js_str* k, js_val* out) {
  switch (o->kind) {
    case K_ARR: {
      js_arr* a = (js_arr*)o;
      if (k == A_length) { *out = JS_D((double)a->len); return 1; }
      int64_t i = js_key_index(k);
      if (i >= 0) { *out = i < a->len && a->a[i].t != JS_T_HOLE ? a->a[i] : JS_U; return i < a->len && a->a[i].t != JS_T_HOLE; }
      return 0;
    }
    case K_TYPED: {
      js_typed* t = (js_typed*)o;
      if (k == A_length) { *out = JS_D((double)t->len); return 1; }
      if (k == A_byteLength) { *out = JS_D((double)(t->len * js_ta_size[t->tk])); return 1; }
      if (k == A_byteOffset) { *out = JS_D((double)t->off); return 1; }
      if (k == A_buffer) { *out = JS_O(t->buf); return 1; }
      int64_t i = js_key_index(k);
      if (i >= 0) { *out = i < t->len ? js_typed_get(t, i) : JS_U; return 1; }
      return 0;
    }
    case K_ABUF: if (k == A_byteLength) { *out = JS_D((double)((js_abuf*)o)->len); return 1; } return 0;
    case K_DVIEW: {
      js_dview* d = (js_dview*)o;
      if (k == A_byteLength) { *out = JS_D((double)d->len); return 1; }
      if (k == A_byteOffset) { *out = JS_D((double)d->off); return 1; }
      if (k == A_buffer) { *out = JS_O(d->buf); return 1; }
      return 0;
    }
    case K_FUNC: {
      js_func* f = (js_func*)o;
      if (js_own(o, k)) return 0;
      if (k == A_prototype) { *out = js_func_prototype(f); return 1; }
      if (k == A_name) { *out = JS_SV(f->name ? f->name : A_empty); return 1; }
      if (k == A_length) { *out = JS_D(f->length); return 1; }
      return 0;
    }
    case K_MAP: case K_SET: if (k == A_size) { *out = JS_D((double)((js_map*)o)->count); return 1; } return 0;
    default: return 0;
  }
}
static js_val js_get_slow(js_val v, js_str* k) {
  switch (v.t) {
    case JS_T_OBJ: {
      js_obj* o = v.u.o;
      js_val r;
      if (o->kind != K_OBJ && js_virtual_get(o, k, &r)) return r;
      return js_proto_get(o, k, v);
    }
    case JS_T_STR: {
      if (k == A_length) return JS_D(v.u.s->len);
      int64_t i = js_key_index(k);
      if (i >= 0) return i < v.u.s->len ? JS_SV(js_str_char(v.u.s->d[i])) : JS_U;
      return js_proto_get(js_String_proto, k, v);
    }
    case JS_T_NUM: return js_proto_get(js_Number_proto, k, v);
    case JS_T_BOOL: return js_proto_get(js_Boolean_proto, k, v);
    case JS_T_BIG: return js_proto_get(js_BigInt_proto, k, v);
    default: js_throw_type("Cannot read properties of %s (reading '%s')", v.t == JS_T_NULL ? "null" : "undefined", js_cstr(k));
  }
}
static js_val js_get(js_val v, js_str* k) {
  if (v.t == JS_T_OBJ && v.u.o->kind == K_OBJ) {
    for (js_obj* o = v.u.o; o; o = o->proto) {
      js_prop* p = js_own(o, k);
      if (p) return (p->flags & P_ACC) ? js_call_getter(p->get, v) : p->v;
    }
    return JS_U;
  }
  return js_get_slow(v, k);
}
static void js_arr_set_index(js_arr* a, int64_t i, js_val x) {
  if (a->o.frozen) js_throw_type("Cannot assign to read only property '%lld' of object '[object Array]'", (long long)i);
  if (i < a->len) { a->a[i] = x; return; }
  if (a->o.noext || a->o.sealed) js_throw_type("Cannot add property %lld, object is not extensible", (long long)i);
  if (i == a->len) { js_arr_push1(a, x); return; }
  js_arr_setlen(a, i + 1);
  a->a[i] = x;
}
static void js_arr_set_length(js_arr* a, js_val x) {
  double d = js_to_number(x);
  if (!(d >= 0 && d <= 4294967295.0 && d == trunc(d))) js_throw_range("Invalid array length");
  if (a->o.frozen) js_throw_type("Cannot assign to read only property 'length' of object '[object Array]'");
  js_arr_setlen(a, (int64_t)d);
}
static int js_virtual_set(js_obj* o, js_str* k, js_val x) {
  switch (o->kind) {
    case K_ARR: {
      if (k == A_length) { js_arr_set_length((js_arr*)o, x); return 1; }
      int64_t i = js_key_index(k);
      if (i >= 0) { js_arr_set_index((js_arr*)o, i, x); return 1; }
      return 0;
    }
    case K_TYPED: {
      js_typed* t = (js_typed*)o;
      if (k == A_length || k == A_byteLength || k == A_byteOffset || k == A_buffer) return 1;
      int64_t i = js_key_index(k);
      if (i >= 0) { if (i < t->len) js_typed_set(t, i, x); return 1; }
      return 0;
    }
    case K_FUNC:
      if (k == A_prototype) { js_define(o, k, x, P_HIDDEN); return 1; }
      if ((k == A_name || k == A_length) && !js_own(o, k)) return 1;
      return 0;
    default: return 0;
  }
}
static js_val js_set(js_val v, js_str* k, js_val x) {
  if (v.t != JS_T_OBJ) {
    if (v.t <= JS_T_NULL || v.t == JS_T_HOLE) js_throw_type("Cannot set properties of %s (setting '%s')", v.t == JS_T_NULL ? "null" : "undefined", js_cstr(k));
    js_throw_type("Cannot create property '%s' on %s '%s'", js_cstr(k), js_cstr(js_typeof_str(v)), js_cstr(js_to_str(v)));
  }
  js_obj* o = v.u.o;
  if (o->kind != K_OBJ && js_virtual_set(o, k, x)) return x;
  js_prop* own = js_own(o, k);
  if (own) {
    if (own->flags & P_ACC) {
      if (!own->set) js_throw_type("Cannot set property %s of #<Object> which has only a getter", js_cstr(k));
      js_val a[1] = { x }; js_call(JS_O(own->set), v, 1, a);
      return x;
    }
    if (o->frozen || (own->flags & P_RO)) js_throw_type("Cannot assign to read only property '%s' of object", js_cstr(k));
    own->v = x;
    return x;
  }
  for (js_obj* p = o->proto; p; p = p->proto) {
    js_prop* pr = js_own(p, k);
    if (!pr) continue;
    if (pr->flags & P_ACC) {
      if (!pr->set) js_throw_type("Cannot set property %s of #<Object> which has only a getter", js_cstr(k));
      js_val a[1] = { x }; js_call(JS_O(pr->set), v, 1, a);
      return x;
    }
    break;
  }
  if (o->frozen || o->sealed || o->noext) js_throw_type("Cannot add property %s, object is not extensible", js_cstr(k));
  js_prop* np = js_own_add(o, k);
  np->v = x;
  return x;
}
static inline js_val js_getv(js_val v, js_val key) {
  if (key.t == JS_T_NUM && v.t == JS_T_OBJ) {
    double d = key.u.n;
    int64_t i = (int64_t)d;
    if ((double)i == d && i >= 0) {
      js_obj* o = v.u.o;
      if (o->kind == K_ARR) { js_arr* a = (js_arr*)o; if (i < a->len) { js_val r = a->a[i]; return r.t == JS_T_HOLE ? JS_U : r; } return JS_U; }
      if (o->kind == K_TYPED) { js_typed* t = (js_typed*)o; return i < t->len ? js_typed_get(t, i) : JS_U; }
    }
  } else if (key.t == JS_T_NUM && v.t == JS_T_STR) {
    double d = key.u.n; int64_t i = (int64_t)d;
    if ((double)i == d && i >= 0) return i < v.u.s->len ? JS_SV(js_str_char(v.u.s->d[i])) : JS_U;
  }
  if (v.t <= JS_T_NULL) js_throw_type("Cannot read properties of %s (reading '%s')", v.t == JS_T_NULL ? "null" : "undefined", js_cstr(js_to_str(key)));
  return js_get(v, js_to_key(key));
}
static inline js_val js_setv(js_val v, js_val key, js_val x) {
  if (key.t == JS_T_NUM && v.t == JS_T_OBJ) {
    double d = key.u.n;
    int64_t i = (int64_t)d;
    if ((double)i == d && i >= 0) {
      js_obj* o = v.u.o;
      if (o->kind == K_ARR) { js_arr* a = (js_arr*)o; if (i < a->len && !o->frozen) a->a[i] = x; else js_arr_set_index(a, i, x); return x; }
      if (o->kind == K_TYPED) { js_typed* t = (js_typed*)o; if (i < t->len) js_typed_set(t, i, x); return x; }
    }
  }
  if (v.t <= JS_T_NULL) js_throw_type("Cannot set properties of %s (setting '%s')", v.t == JS_T_NULL ? "null" : "undefined", js_cstr(js_to_str(key)));
  return js_set(v, js_to_key(key), x);
}
static int js_has_own(js_val v, js_str* k) {
  if (v.t != JS_T_OBJ) {
    if (v.t == JS_T_STR) { if (k == A_length) return 1; int64_t i = js_key_index(k); return i >= 0 && i < v.u.s->len; }
    return 0;
  }
  js_obj* o = v.u.o;
  if (o->kind == K_ARR) {
    js_arr* a = (js_arr*)o;
    if (k == A_length) return 1;
    int64_t i = js_key_index(k);
    if (i >= 0) return i < a->len && a->a[i].t != JS_T_HOLE;
  } else if (o->kind == K_TYPED) {
    int64_t i = js_key_index(k);
    if (i >= 0) return i < ((js_typed*)o)->len;
  } else if (o->kind == K_FUNC) {
    if (k == A_name || k == A_length) return 1;
    if (k == A_prototype && (((js_func*)o)->flags & JF_CTOR)) return 1;
  }
  return js_own(o, k) != NULL;
}
static int js_has_property(js_val v, js_str* k) {
  if (js_has_own(v, k)) return 1;
  if (v.t != JS_T_OBJ) return 0;
  js_val r;
  if (v.u.o->kind != K_OBJ && js_virtual_get(v.u.o, k, &r)) return 1;
  for (js_obj* o = v.u.o->proto; o; o = o->proto) if (js_own(o, k)) return 1;
  return 0;
}
static js_val js_in(js_val key, js_val obj) {
  if (obj.t != JS_T_OBJ) js_throw_type("Cannot use 'in' operator to search for '%s' in %s", js_cstr(js_to_str(key)), js_cstr(js_to_str(obj)));
  return JS_B(js_has_property(obj, js_to_key(key)));
}
static js_val js_delete(js_val v, js_val key) {
  if (v.t != JS_T_OBJ) { if (v.t <= JS_T_NULL) js_throw_type("Cannot convert undefined or null to object"); return JS_TRUE; }
  js_obj* o = v.u.o;
  js_str* k = js_to_key(key);
  if (o->kind == K_ARR) {
    int64_t i = js_key_index(k);
    if (i >= 0) { js_arr* a = (js_arr*)o; if (o->frozen || o->sealed) js_throw_type("Cannot delete property '%lld'", (long long)i); if (i < a->len) a->a[i] = JS_HOLE; return JS_TRUE; }
  }
  if (!js_delete_own(o, k)) js_throw_type("Cannot delete property '%s' of object", js_cstr(k));
  return JS_TRUE;
}

// ---------------------------------------------------------------- calls
static js_val js_call(js_val fv, js_val self, int argc, js_val* argv) {
  if (fv.t != JS_T_OBJ || fv.u.o->kind != K_FUNC) js_throw_type("%s is not a function", js_cstr(js_to_str(js_typeof(fv))));
  js_func* f = (js_func*)fv.u.o;
  if (f->flags & JF_CLASS) js_throw_type("Class constructor %s cannot be invoked without 'new'", f->name ? js_cstr(f->name) : "");
  return f->code(f, self, argc, argv, JS_U);
}
static js_val js_invoke(js_val v, js_str* k, int argc, js_val* argv) {
  js_val f = js_get(v, k);
  if (f.t != JS_T_OBJ || f.u.o->kind != K_FUNC) {
    if (v.t == JS_T_OBJ && v.u.o->kind == K_OBJ) js_throw_type("%s is not a function", js_cstr(k));
    js_throw_type("%s.%s is not a function", js_cstr(js_typeof_str(v)), js_cstr(k));
  }
  return ((js_func*)f.u.o)->flags & JF_CLASS ? js_call(f, v, argc, argv) : ((js_func*)f.u.o)->code((js_func*)f.u.o, v, argc, argv, JS_U);
}
static js_val js_invokev(js_val v, js_val key, int argc, js_val* argv) { return js_invoke(v, js_to_key(key), argc, argv); }
static js_val js_new(js_val cv, int argc, js_val* argv) {
  if (cv.t != JS_T_OBJ || cv.u.o->kind != K_FUNC || !(((js_func*)cv.u.o)->flags & JF_CTOR))
    js_throw_type("%s is not a constructor", cv.t == JS_T_OBJ && cv.u.o->kind == K_FUNC && ((js_func*)cv.u.o)->name ? js_cstr(((js_func*)cv.u.o)->name) : js_cstr(js_to_str(js_typeof(cv))));
  js_func* f = (js_func*)cv.u.o;
  if (f->flags & JF_NATIVE_CTOR) return f->code(f, JS_U, argc, argv, cv);
  js_val proto = js_get(cv, A_prototype);
  js_obj* o = js_obj_new(proto.t == JS_T_OBJ ? proto.u.o : js_Object_proto);
  js_val self = JS_O(o);
  js_val r = f->code(f, self, argc, argv, cv);
  return r.t == JS_T_OBJ ? r : self;
}
/** super(...) in a derived constructor: the parent constructor on this object, then this class's fields */
static js_val js_super_construct(js_func* f, js_val self, int argc, js_val* argv, js_val nt) {
  js_obj* parent = f->o.proto;
  if (!parent || parent->kind != K_FUNC) js_throw_type("Super constructor is not a constructor");
  js_func* pf = (js_func*)parent;
  js_val r = pf->code(pf, self, argc, argv, nt.t == JS_T_UNDEF ? JS_O(f) : nt);
  if (f->fields) f->fields(f, self);
  (void)r;
  return self;
}
static js_val js_super_get(js_func* f, js_val self, js_str* k) {
  js_obj* home = f->home;
  if (!home) js_throw_syntax("'super' keyword unexpected here");
  return js_proto_get(home->proto, k, self);
}
static js_val js_super_invoke(js_func* f, js_val self, js_str* k, int argc, js_val* argv) {
  js_val m = js_super_get(f, self, k);
  if (!js_is_callable(m)) js_throw_type("(intermediate value).%s is not a function", js_cstr(k));
  return js_call(m, self, argc, argv);
}
static js_val js_super_set(js_func* f, js_val self, js_str* k, js_val x) {
  js_obj* home = f->home;
  for (js_obj* p = home ? home->proto : NULL; p; p = p->proto) {
    js_prop* pr = js_own(p, k);
    if (pr && (pr->flags & P_ACC)) { if (pr->set) { js_val a[1] = { x }; js_call(JS_O(pr->set), self, 1, a); } return x; }
    if (pr) break;
  }
  return js_set(self, k, x);
}

// ---------------------------------------------------------------- classes
static js_val js_class_new(js_str* name, int has_parent, js_val parent, js_code ctor, int32_t length,
    int32_t nenv, js_val** env, void (*fields)(js_func*, js_val)) {
  js_obj* proto_parent = js_Object_proto;
  js_obj* ctor_parent = js_Function_proto;
  if (has_parent) {
    if (parent.t == JS_T_NULL) proto_parent = NULL;
    else if (js_is_callable(parent)) {
      ctor_parent = parent.u.o;
      js_val pp = js_get(parent, A_prototype);
      if (pp.t == JS_T_OBJ) proto_parent = pp.u.o;
      else if (pp.t == JS_T_NULL) proto_parent = NULL;
      else js_throw_type("Class extends value does not have valid prototype property");
    } else js_throw_type("Class extends value %s is not a constructor or null", js_cstr(js_to_str(parent)));
  }
  js_func* F = js_func_new(ctor, name, length, nenv, env);
  F->o.proto = ctor_parent;
  F->flags = JF_CTOR | JF_CLASS | (has_parent ? JF_DERIVED : 0);
  F->fields = fields;
  js_obj* P = js_obj_new(proto_parent);
  js_define(P, A_constructor, JS_O(F), P_HIDDEN);
  js_define(&F->o, A_prototype, JS_O(P), P_HIDDEN);
  F->home = P;
  return JS_O(F);
}
enum { JM_METHOD, JM_GET, JM_SET };
static void js_class_method(js_val cls, js_str* k, js_code code, int32_t length, int kind, int is_static) {
  js_func* F = (js_func*)cls.u.o;
  js_obj* target = is_static ? &F->o : F->home;
  js_func* m = js_func_new(code, k, length, F->nenv, F->env);
  m->home = target;
  if (kind == JM_METHOD) js_define(target, k, JS_O(m), P_HIDDEN);
  else js_define_accessor(target, k, kind == JM_GET ? &m->o : NULL, kind == JM_SET ? &m->o : NULL, P_HIDDEN);
}
/** An object literal's method, getter or setter (home object for super) */
static void js_obj_method(js_val obj, js_str* k, js_val fn, int kind) {
  js_func* m = (js_func*)fn.u.o;
  m->home = obj.u.o;
  if (kind == JM_METHOD) js_define(obj.u.o, k, fn, 0);
  else js_define_accessor(obj.u.o, k, kind == JM_GET ? &m->o : NULL, kind == JM_SET ? &m->o : NULL, 0);
}
static js_val js_instanceof(js_val v, js_val c) {
  if (!js_is_callable(c)) js_throw_type("Right-hand side of 'instanceof' is not callable");
  if (v.t != JS_T_OBJ) return JS_FALSE;
  js_val proto = js_get(c, A_prototype);
  if (proto.t != JS_T_OBJ) return JS_FALSE;
  for (js_obj* o = v.u.o->proto; o; o = o->proto) if (o == proto.u.o) return JS_TRUE;
  return JS_FALSE;
}

// ---------------------------------------------------------------- globals
static js_val js_global_get(js_str* k) {
  js_prop* p = js_own(js_global, k);
  if (!p) js_throw_ref("%s is not defined", js_cstr(k));
  return (p->flags & P_ACC) ? js_call_getter(p->get, JS_O(js_global)) : p->v;
}
static js_val js_global_typeof(js_str* k) {
  js_prop* p = js_own(js_global, k);
  return p ? js_typeof(p->v) : JS_SV(A_undefined);
}
static js_val js_global_set(js_str* k, js_val v) { js_define(js_global, k, v, 0); return v; }
#define JS_GLOBAL(lit) js_global_get(JS_ATOM(lit))

// ---------------------------------------------------------------- operators
static void js_mix_error(void) __attribute__((noreturn));
static void js_mix_error(void) { js_throw_type("Cannot mix BigInt and other types, use explicit conversions"); }
static js_val js_to_numeric(js_val v) {
  if (v.t == JS_T_NUM || v.t == JS_T_BIG) return v;
  if (v.t == JS_T_OBJ) v = js_to_primitive(v, 0);
  if (v.t == JS_T_BIG) return v;
  return JS_D(js_to_number(v));
}
static js_val js_add_slow(js_val a, js_val b) {
  a = js_to_primitive(a, 0); b = js_to_primitive(b, 0);
  if (a.t == JS_T_STR || b.t == JS_T_STR) return JS_SV(js_str_concat(js_to_str(a), js_to_str(b)));
  if (a.t == JS_T_BIG || b.t == JS_T_BIG) {
    if (a.t != JS_T_BIG || b.t != JS_T_BIG) js_mix_error();
    return JS_GV(js_big_add(a.u.g, b.u.g));
  }
  return JS_D(js_to_number(a) + js_to_number(b));
}
static inline js_val js_add(js_val a, js_val b) {
  if (a.t == JS_T_NUM && b.t == JS_T_NUM) return JS_D(a.u.n + b.u.n);
  if (a.t == JS_T_STR && b.t == JS_T_STR) return JS_SV(js_str_concat(a.u.s, b.u.s));
  return js_add_slow(a, b);
}
enum { OP_SUB, OP_MUL, OP_DIV, OP_MOD, OP_POW, OP_AND, OP_OR, OP_XOR, OP_SHL, OP_SAR, OP_SHR };
static double js_pow_num(double a, double b) {
  if (isnan(b)) return NAN;
  if ((a == 1 || a == -1) && isinf(b)) return NAN;
  return pow(a, b);
}
static double js_mod_num(double a, double b) { return fmod(a, b); }
static js_val js_numop_slow(int op, js_val a, js_val b) {
  a = js_to_numeric(a); b = js_to_numeric(b);
  if (a.t == JS_T_BIG || b.t == JS_T_BIG) {
    if (a.t != JS_T_BIG || b.t != JS_T_BIG) js_mix_error();
    js_big *x = a.u.g, *y = b.u.g;
    switch (op) {
      case OP_SUB: return JS_GV(js_big_sub(x, y));
      case OP_MUL: return JS_GV(js_big_mul(x, y));
      case OP_DIV: return JS_GV(js_big_div(x, y));
      case OP_MOD: return JS_GV(js_big_mod(x, y));
      case OP_POW: return JS_GV(js_big_pow(x, y));
      case OP_AND: return JS_GV(js_big_bitop(x, y, 0));
      case OP_OR: return JS_GV(js_big_bitop(x, y, 1));
      case OP_XOR: return JS_GV(js_big_bitop(x, y, 2));
      case OP_SHL: {
        if (js_big_bitlen(y) > 40) { if (y->neg) return JS_GV(x->neg ? js_big_from_i64(-1) : js_big_zero()); js_throw_range("Maximum BigInt size exceeded"); }
        return JS_GV(js_big_shl(x, (int64_t)js_big_low64(y)));
      }
      case OP_SAR: {
        if (js_big_bitlen(y) > 40) { if (!y->neg) return JS_GV(x->neg ? js_big_from_i64(-1) : js_big_zero()); js_throw_range("Maximum BigInt size exceeded"); }
        return JS_GV(js_big_shr(x, (int64_t)js_big_low64(y)));
      }
      default: js_throw_type("BigInts have no unsigned right shift, use >> instead");
    }
  }
  double x = a.u.n, y = b.u.n;
  switch (op) {
    case OP_SUB: return JS_D(x - y);
    case OP_MUL: return JS_D(x * y);
    case OP_DIV: return JS_D(x / y);
    case OP_MOD: return JS_D(js_mod_num(x, y));
    case OP_POW: return JS_D(js_pow_num(x, y));
    case OP_AND: return JS_D(js_d2i32(x) & js_d2i32(y));
    case OP_OR: return JS_D(js_d2i32(x) | js_d2i32(y));
    case OP_XOR: return JS_D(js_d2i32(x) ^ js_d2i32(y));
    case OP_SHL: return JS_D((int32_t)((uint32_t)js_d2i32(x) << (js_d2u32(y) & 31)));
    case OP_SAR: return JS_D(js_d2i32(x) >> (js_d2u32(y) & 31));
    default: return JS_D((double)(js_d2u32(x) >> (js_d2u32(y) & 31)));
  }
}
#define JS_NUMOP(name, op, expr) \
  static inline js_val name(js_val a, js_val b) { if (a.t == JS_T_NUM && b.t == JS_T_NUM) { double x = a.u.n, y = b.u.n; return JS_D(expr); } return js_numop_slow(op, a, b); }
JS_NUMOP(js_sub, OP_SUB, x - y)
JS_NUMOP(js_mul, OP_MUL, x * y)
JS_NUMOP(js_div, OP_DIV, x / y)
JS_NUMOP(js_mod, OP_MOD, js_mod_num(x, y))
JS_NUMOP(js_pow, OP_POW, js_pow_num(x, y))
JS_NUMOP(js_band, OP_AND, js_d2i32(x) & js_d2i32(y))
JS_NUMOP(js_bor, OP_OR, js_d2i32(x) | js_d2i32(y))
JS_NUMOP(js_bxor, OP_XOR, js_d2i32(x) ^ js_d2i32(y))
JS_NUMOP(js_shl, OP_SHL, (int32_t)((uint32_t)js_d2i32(x) << (js_d2u32(y) & 31)))
JS_NUMOP(js_sar, OP_SAR, js_d2i32(x) >> (js_d2u32(y) & 31))
JS_NUMOP(js_shr, OP_SHR, (double)(js_d2u32(x) >> (js_d2u32(y) & 31)))
static inline js_val js_neg(js_val a) {
  if (a.t == JS_T_NUM) return JS_D(-a.u.n);
  a = js_to_numeric(a);
  return a.t == JS_T_BIG ? JS_GV(js_big_neg(a.u.g)) : JS_D(-a.u.n);
}
static inline js_val js_pos(js_val a) { return a.t == JS_T_NUM ? a : JS_D(js_to_number(a)); }
static inline js_val js_bnot(js_val a) {
  if (a.t == JS_T_NUM) return JS_D(~js_d2i32(a.u.n));
  a = js_to_numeric(a);
  return a.t == JS_T_BIG ? JS_GV(js_big_not(a.u.g)) : JS_D(~js_d2i32(a.u.n));
}
static inline js_val js_not(js_val a) { return JS_B(!js_truthy(a)); }
/** ++/-- on a value: the numeric value plus one (BigInt stays BigInt) */
static inline js_val js_inc(js_val a) {
  if (a.t == JS_T_NUM) return JS_D(a.u.n + 1);
  a = js_to_numeric(a);
  return a.t == JS_T_BIG ? JS_GV(js_big_add(a.u.g, js_big_from_u64(1, 0))) : JS_D(a.u.n + 1);
}
static inline js_val js_dec(js_val a) {
  if (a.t == JS_T_NUM) return JS_D(a.u.n - 1);
  a = js_to_numeric(a);
  return a.t == JS_T_BIG ? JS_GV(js_big_sub(a.u.g, js_big_from_u64(1, 0))) : JS_D(a.u.n - 1);
}
static inline js_val js_tonum_update(js_val a) { return a.t == JS_T_NUM ? a : js_to_numeric(a); }

// ---------------------------------------------------------------- equality and order
static int js_strict_eq(js_val a, js_val b) {
  if (a.t == JS_T_HOLE) a.t = JS_T_UNDEF;
  if (b.t == JS_T_HOLE) b.t = JS_T_UNDEF;
  if (a.t != b.t) return 0;
  switch (a.t) {
    case JS_T_UNDEF: case JS_T_NULL: return 1;
    case JS_T_BOOL: return a.u.b == b.u.b;
    case JS_T_NUM: return a.u.n == b.u.n;
    case JS_T_STR: return js_str_eq(a.u.s, b.u.s);
    case JS_T_BIG: return js_big_cmp(a.u.g, b.u.g) == 0;
    default: return a.u.o == b.u.o;
  }
}
static inline js_val js_seq(js_val a, js_val b) {
  if (a.t == JS_T_NUM && b.t == JS_T_NUM) return JS_B(a.u.n == b.u.n);
  return JS_B(js_strict_eq(a, b));
}
static inline js_val js_sne(js_val a, js_val b) {
  if (a.t == JS_T_NUM && b.t == JS_T_NUM) return JS_B(a.u.n != b.u.n);
  return JS_B(!js_strict_eq(a, b));
}
static int js_big_num_cmp(js_big* g, double d) {
  // -1, 0, 1, or 2 when d is NaN
  if (isnan(d)) return 2;
  if (isinf(d)) return d > 0 ? -1 : 1;
  double gd = js_big_to_double(g);
  if (gd < d) return -1;
  if (gd > d) return 1;
  // equal as doubles: compare exactly
  if (d != trunc(d)) { return gd < d ? -1 : 1; }
  return js_big_cmp(g, js_big_from_double(d));
}
static int js_loose_eq(js_val a, js_val b) {
  if (a.t == JS_T_HOLE) a.t = JS_T_UNDEF;
  if (b.t == JS_T_HOLE) b.t = JS_T_UNDEF;
  if (a.t == b.t) return js_strict_eq(a, b);
  if (a.t <= JS_T_NULL && b.t <= JS_T_NULL) return 1;
  if (a.t <= JS_T_NULL || b.t <= JS_T_NULL) return 0;
  if (a.t == JS_T_NUM && b.t == JS_T_STR) return a.u.n == js_str_to_num(b.u.s);
  if (a.t == JS_T_STR && b.t == JS_T_NUM) return js_str_to_num(a.u.s) == b.u.n;
  if (a.t == JS_T_BIG && b.t == JS_T_STR) { js_big* g = js_big_parse(b.u.s->d, b.u.s->len); return g && js_big_cmp(a.u.g, g) == 0; }
  if (a.t == JS_T_STR && b.t == JS_T_BIG) return js_loose_eq(b, a);
  if (a.t == JS_T_BOOL) return js_loose_eq(JS_D(a.u.b), b);
  if (b.t == JS_T_BOOL) return js_loose_eq(a, JS_D(b.u.b));
  if (a.t == JS_T_OBJ) return js_loose_eq(js_to_primitive(a, 0), b);
  if (b.t == JS_T_OBJ) return js_loose_eq(a, js_to_primitive(b, 0));
  if (a.t == JS_T_BIG && b.t == JS_T_NUM) return js_big_num_cmp(a.u.g, b.u.n) == 0;
  if (a.t == JS_T_NUM && b.t == JS_T_BIG) return js_big_num_cmp(b.u.g, a.u.n) == 0;
  return 0;
}
static js_val js_eq(js_val a, js_val b) { return JS_B(js_loose_eq(a, b)); }
static js_val js_ne(js_val a, js_val b) { return JS_B(!js_loose_eq(a, b)); }
/** a < b: 1, 0, or -1 for undefined (NaN) */
static int js_less(js_val a, js_val b, int left_first) {
  if (left_first) { a = js_to_primitive(a, 0); b = js_to_primitive(b, 0); }
  else { b = js_to_primitive(b, 0); a = js_to_primitive(a, 0); }
  if (a.t == JS_T_STR && b.t == JS_T_STR) return js_str_cmp(a.u.s, b.u.s) < 0;
  if (a.t == JS_T_BIG && b.t == JS_T_STR) { js_big* g = js_big_parse(b.u.s->d, b.u.s->len); if (!g) return -1; return js_big_cmp(a.u.g, g) < 0; }
  if (a.t == JS_T_STR && b.t == JS_T_BIG) { js_big* g = js_big_parse(a.u.s->d, a.u.s->len); if (!g) return -1; return js_big_cmp(g, b.u.g) < 0; }
  js_val x = js_to_numeric(a), y = js_to_numeric(b);
  if (x.t == JS_T_BIG && y.t == JS_T_BIG) return js_big_cmp(x.u.g, y.u.g) < 0;
  if (x.t == JS_T_BIG) { int c = js_big_num_cmp(x.u.g, y.u.n); return c == 2 ? -1 : c < 0; }
  if (y.t == JS_T_BIG) { int c = js_big_num_cmp(y.u.g, x.u.n); return c == 2 ? -1 : c > 0; }
  if (isnan(x.u.n) || isnan(y.u.n)) return -1;
  return x.u.n < y.u.n;
}
static inline js_val js_lt(js_val a, js_val b) { if (a.t == JS_T_NUM && b.t == JS_T_NUM) return JS_B(a.u.n < b.u.n); return JS_B(js_less(a, b, 1) == 1); }
static inline js_val js_gt(js_val a, js_val b) { if (a.t == JS_T_NUM && b.t == JS_T_NUM) return JS_B(a.u.n > b.u.n); return JS_B(js_less(b, a, 0) == 1); }
static inline js_val js_le(js_val a, js_val b) { if (a.t == JS_T_NUM && b.t == JS_T_NUM) return JS_B(a.u.n <= b.u.n); return JS_B(js_less(b, a, 0) == 0); }
static inline js_val js_ge(js_val a, js_val b) { if (a.t == JS_T_NUM && b.t == JS_T_NUM) return JS_B(a.u.n >= b.u.n); return JS_B(js_less(a, b, 1) == 0); }
/** SameValueZero (Map keys, includes) */
static int js_same_value_zero(js_val a, js_val b) {
  if (a.t == JS_T_NUM && b.t == JS_T_NUM) return a.u.n == b.u.n || (isnan(a.u.n) && isnan(b.u.n));
  return js_strict_eq(a, b);
}

// ---------------------------------------------------------------- native helpers
#define JS_NATIVE(name) static js_val name(js_func* f, js_val self, int argc, js_val* argv, js_val nt)
#define NARG(i) (argc > (i) ? argv[(i)] : JS_U)
static js_val js_native_fn(js_code code, const char* name, int length) {
  js_func* f = js_func_new(code, js_atom_c(name), length, 0, NULL);
  return JS_O(f);
}
static js_val js_method(js_obj* target, const char* name, js_code code, int length) {
  js_val fn = js_native_fn(code, name, length);
  js_define(target, js_atom_c(name), fn, P_HIDDEN);
  return fn;
}
static js_val js_ctor(const char* name, js_code code, int length, js_obj* proto) {
  js_func* f = js_func_new(code, js_atom_c(name), length, 0, NULL);
  f->flags = JF_CTOR | JF_NATIVE_CTOR;
  if (proto) {
    js_define(&f->o, A_prototype, JS_O(proto), P_HIDDEN);
    js_define(proto, A_constructor, JS_O(f), P_HIDDEN);
  }
  js_define(js_global, js_atom_c(name), JS_O(f), P_HIDDEN);
  return JS_O(f);
}
/** The prototype a native constructor gives its object: new.target's, else its own */
static js_obj* js_proto_from(js_val nt, js_obj* fallback) {
  if (nt.t == JS_T_OBJ) { js_val p = js_get(nt, A_prototype); if (p.t == JS_T_OBJ) return p.u.o; }
  return fallback;
}
static int64_t js_len_of(js_val v) {
  if (v.t == JS_T_OBJ) {
    if (v.u.o->kind == K_ARR) return ((js_arr*)v.u.o)->len;
    if (v.u.o->kind == K_TYPED) return ((js_typed*)v.u.o)->len;
  } else if (v.t == JS_T_STR) return v.u.s->len;
  double d = js_to_integer(js_get(v, A_length));
  return d < 0 ? 0 : d > 9007199254740991.0 ? 9007199254740991LL : (int64_t)d;
}
static inline js_val js_idx_get(js_val v, int64_t i) { return js_getv(v, JS_D((double)i)); }
static inline void js_idx_set(js_val v, int64_t i, js_val x) { js_setv(v, JS_D((double)i), x); }
static int64_t js_rel_index(js_val v, int64_t len, int64_t dflt) {
  if (v.t == JS_T_UNDEF) return dflt;
  double d = js_to_integer(v);
  if (d < 0) { d += (double)len; return d < 0 ? 0 : (int64_t)d; }
  return d > (double)len ? len : (int64_t)d;
}
static js_val js_cb(js_val cb, js_val this_arg, js_val a, int64_t i, js_val o) {
  js_val args[3] = { a, JS_D((double)i), o };
  return js_call(cb, this_arg, 3, args);
}
static void js_need_callable(js_val v, const char* what) { if (!js_is_callable(v)) js_throw_type("%s is not a function", what); }
static js_str* js_join(js_val arr, js_str* sep);

// ---------------------------------------------------------------- iteration (for-of, spread, Array.from)
typedef struct js_iterobj { js_obj o; js_val src; int32_t mode; int64_t i; } js_iterobj; // mode 0 keys, 1 values, 2 entries
typedef struct js_iter { js_val src; int kind; int64_t i; js_iterobj* it; } js_iter;
static js_val js_iterobj_new(js_val src, int mode) {
  js_iterobj* it = (js_iterobj*)js_alloc(sizeof(js_iterobj));
  js_obj_init(&it->o, K_ITER, js_Iterator_proto);
  it->src = src; it->mode = mode;
  return JS_O(it);
}
static void js_iter_init(js_iter* it, js_val v) {
  it->src = v; it->i = 0; it->it = NULL;
  if (v.t == JS_T_STR) { it->kind = 1; return; }
  if (v.t == JS_T_OBJ) {
    switch (v.u.o->kind) {
      case K_ARR: case K_TYPED: case K_ARGS: it->kind = 0; return;
      case K_MAP: it->it = (js_iterobj*)js_iterobj_new(v, 2).u.o; it->kind = 2; return;
      case K_SET: it->it = (js_iterobj*)js_iterobj_new(v, 1).u.o; it->kind = 2; return;
      case K_ITER: it->it = (js_iterobj*)v.u.o; it->kind = 2; return;
    }
    // an object with a next() method
    js_val next = js_get(v, A_next);
    if (js_is_callable(next)) { it->kind = 3; return; }
  }
  js_throw_type("%s is not iterable", js_cstr(js_to_str(js_typeof(v))));
}
static int js_iterobj_step(js_iterobj* it, js_val* out) {
  js_val src = it->src;
  if (src.t == JS_T_STR) {
    js_str* s = src.u.s;
    if (it->i >= s->len) return 0;
    int32_t i = (int32_t)it->i;
    int32_t n = s->d[i] >= 0xD800 && s->d[i] < 0xDC00 && i + 1 < s->len && s->d[i + 1] >= 0xDC00 && s->d[i + 1] < 0xE000 ? 2 : 1;
    *out = JS_SV(js_str_sub(s, i, i + n)); it->i += n;
    return 1;
  }
  js_obj* o = src.u.o;
  if (o->kind == K_MAP || o->kind == K_SET) {
    js_map* m = (js_map*)o;
    while (it->i < m->n && !m->live[it->i]) ++it->i;
    if (it->i >= m->n) return 0;
    int64_t i = it->i++;
    if (o->kind == K_SET) { *out = it->mode == 2 ? js_arr_of(2, (js_val[]){ m->k[i], m->k[i] }) : m->k[i]; return 1; }
    *out = it->mode == 0 ? m->k[i] : it->mode == 1 ? m->v[i] : js_arr_of(2, (js_val[]){ m->k[i], m->v[i] });
    return 1;
  }
  int64_t len = js_len_of(src);
  if (it->i >= len) return 0;
  int64_t i = it->i++;
  *out = it->mode == 0 ? JS_D((double)i) : it->mode == 1 ? js_idx_get(src, i) : js_arr_of(2, (js_val[]){ JS_D((double)i), js_idx_get(src, i) });
  return 1;
}
static int js_iter_next(js_iter* it, js_val* out) {
  switch (it->kind) {
    case 0: {
      if (it->i >= js_len_of(it->src)) return 0;
      *out = js_idx_get(it->src, it->i++);
      return 1;
    }
    case 1: {
      js_str* s = it->src.u.s;
      if (it->i >= s->len) return 0;
      int32_t i = (int32_t)it->i;
      int32_t n = s->d[i] >= 0xD800 && s->d[i] < 0xDC00 && i + 1 < s->len && s->d[i + 1] >= 0xDC00 && s->d[i + 1] < 0xE000 ? 2 : 1;
      *out = JS_SV(js_str_sub(s, i, i + n)); it->i += n;
      return 1;
    }
    case 2: return js_iterobj_step(it->it, out);
    default: {
      js_val r = js_invoke(it->src, A_next, 0, NULL);
      if (js_truthy(js_get(r, A_done))) return 0;
      *out = js_get(r, A_value);
      return 1;
    }
  }
}
/** The values of an iterable as a new array (spread, Array.from) */
static js_val js_iter_to_array(js_val v) {
  js_arr* r = js_arr_alloc(0, 8);
  js_iter it; js_val x;
  js_iter_init(&it, v);
  while (js_iter_next(&it, &x)) js_arr_push1(r, x);
  return JS_O(r);
}
JS_NATIVE(n_iter_next) {
  js_val r = js_new_object();
  js_val x;
  if (self.t == JS_T_OBJ && self.u.o->kind == K_ITER && js_iterobj_step((js_iterobj*)self.u.o, &x)) {
    js_set(r, A_value, x); js_set(r, A_done, JS_FALSE);
  } else { js_set(r, A_value, JS_U); js_set(r, A_done, JS_TRUE); }
  return r;
}
/** Keys a for-in loop visits: enumerable string keys, own then inherited */
static js_val js_for_in_keys(js_val v) {
  js_arr* r = js_arr_alloc(0, 8);
  if (v.t == JS_T_STR) { for (int32_t i = 0; i < v.u.s->len; ++i) js_arr_push1(r, JS_SV(js_idx_atom(i))); return JS_O(r); }
  if (v.t != JS_T_OBJ) return JS_O(r);
  js_obj* o = v.u.o;
  if (o->kind == K_ARR) { js_arr* a = (js_arr*)o; for (int64_t i = 0; i < a->len; ++i) if (a->a[i].t != JS_T_HOLE) js_arr_push1(r, JS_SV(js_idx_atom(i))); }
  if (o->kind == K_TYPED) { for (int64_t i = 0; i < ((js_typed*)o)->len; ++i) js_arr_push1(r, JS_SV(js_idx_atom(i))); }
  for (js_obj* p = o; p; p = p->proto) {
    // integer keys first (ascending), then the others in insertion order
    int64_t start = r->len;
    for (int pass = 0; pass < 2; ++pass)
      for (int32_t i = 0; i < p->np; ++i) {
        js_prop* pr = &p->p[i];
        if (!pr->key || (pr->flags & P_HIDDEN)) continue;
        if ((js_key_index(pr->key) >= 0) != (pass == 0)) continue;
        int dup = 0;
        for (int64_t j = 0; j < r->len; ++j) if (r->a[j].u.s == pr->key) { dup = 1; break; }
        if (!dup) js_arr_push1(r, JS_SV(pr->key));
      }
    // sort the integer keys of this level
    int64_t e = start;
    while (e < r->len && js_key_index(r->a[e].u.s) >= 0) ++e;
    for (int64_t i = start + 1; i < e; ++i) {
      js_val k = r->a[i]; int64_t ki = js_key_index(k.u.s), j = i - 1;
      while (j >= start && js_key_index(r->a[j].u.s) > ki) { r->a[j + 1] = r->a[j]; --j; }
      r->a[j + 1] = k;
    }
  }
  return JS_O(r);
}
/** Own enumerable string keys in property order (Object.keys) */
static js_val js_own_keys(js_val v) {
  js_arr* r = js_arr_alloc(0, 8);
  if (v.t == JS_T_STR) { for (int32_t i = 0; i < v.u.s->len; ++i) js_arr_push1(r, JS_SV(js_idx_atom(i))); return JS_O(r); }
  if (v.t != JS_T_OBJ) { if (v.t <= JS_T_NULL) js_throw_type("Cannot convert undefined or null to object"); return JS_O(r); }
  js_obj* o = v.u.o;
  if (o->kind == K_ARR) { js_arr* a = (js_arr*)o; for (int64_t i = 0; i < a->len; ++i) if (a->a[i].t != JS_T_HOLE) js_arr_push1(r, JS_SV(js_idx_atom(i))); }
  if (o->kind == K_TYPED) { for (int64_t i = 0; i < ((js_typed*)o)->len; ++i) js_arr_push1(r, JS_SV(js_idx_atom(i))); }
  int64_t start = r->len;
  for (int32_t i = 0; i < o->np; ++i) { js_prop* pr = &o->p[i]; if (pr->key && !(pr->flags & P_HIDDEN) && js_key_index(pr->key) >= 0) js_arr_push1(r, JS_SV(pr->key)); }
  for (int64_t i = start + 1; i < r->len; ++i) {
    js_val k = r->a[i]; int64_t ki = js_key_index(k.u.s), j = i - 1;
    while (j >= start && js_key_index(r->a[j].u.s) > ki) { r->a[j + 1] = r->a[j]; --j; }
    r->a[j + 1] = k;
  }
  for (int32_t i = 0; i < o->np; ++i) { js_prop* pr = &o->p[i]; if (pr->key && !(pr->flags & P_HIDDEN) && js_key_index(pr->key) < 0) js_arr_push1(r, JS_SV(pr->key)); }
  return JS_O(r);
}

// ---------------------------------------------------------------- Object
JS_NATIVE(n_object_ctor) {
  js_val v = NARG(0);
  if (v.t == JS_T_OBJ) return v;
  return JS_O(js_obj_new(js_proto_from(nt, js_Object_proto)));
}
JS_NATIVE(n_object_keys) { return js_own_keys(NARG(0)); }
JS_NATIVE(n_object_values) {
  js_val keys = js_own_keys(NARG(0));
  js_arr* k = js_as_arr(keys);
  for (int64_t i = 0; i < k->len; ++i) k->a[i] = js_get(NARG(0), k->a[i].u.s);
  return keys;
}
JS_NATIVE(n_object_entries) {
  js_val keys = js_own_keys(NARG(0));
  js_arr* k = js_as_arr(keys);
  for (int64_t i = 0; i < k->len; ++i) k->a[i] = js_arr_of(2, (js_val[]){ k->a[i], js_get(NARG(0), k->a[i].u.s) });
  return keys;
}
static void js_assign_from(js_val target, js_val src) {
  if (src.t <= JS_T_NULL) return;
  js_val keys = js_own_keys(src);
  js_arr* k = js_as_arr(keys);
  for (int64_t i = 0; i < k->len; ++i) js_set(target, k->a[i].u.s, js_get(src, k->a[i].u.s));
}
JS_NATIVE(n_object_assign) {
  js_val t = NARG(0);
  if (t.t <= JS_T_NULL) js_throw_type("Cannot convert undefined or null to object");
  for (int i = 1; i < argc; ++i) js_assign_from(t, argv[i]);
  return t;
}
JS_NATIVE(n_object_freeze) { js_val v = NARG(0); if (v.t == JS_T_OBJ) { v.u.o->frozen = 1; v.u.o->sealed = 1; v.u.o->noext = 1; } return v; }
JS_NATIVE(n_object_seal) { js_val v = NARG(0); if (v.t == JS_T_OBJ) { v.u.o->sealed = 1; v.u.o->noext = 1; } return v; }
JS_NATIVE(n_object_prevent) { js_val v = NARG(0); if (v.t == JS_T_OBJ) v.u.o->noext = 1; return v; }
JS_NATIVE(n_object_isfrozen) { js_val v = NARG(0); return JS_B(v.t != JS_T_OBJ || v.u.o->frozen); }
JS_NATIVE(n_object_issealed) { js_val v = NARG(0); return JS_B(v.t != JS_T_OBJ || v.u.o->sealed); }
JS_NATIVE(n_object_create) {
  js_val p = NARG(0);
  if (p.t != JS_T_OBJ && p.t != JS_T_NULL) js_throw_type("Object prototype may only be an Object or null");
  js_val o = JS_O(js_obj_new(p.t == JS_T_OBJ ? p.u.o : NULL));
  if (argc > 1 && argv[1].t == JS_T_OBJ) {
    js_val keys = js_own_keys(argv[1]);
    js_arr* k = js_as_arr(keys);
    for (int64_t i = 0; i < k->len; ++i) {
      js_val d = js_get(argv[1], k->a[i].u.s);
      js_define(o.u.o, k->a[i].u.s, js_get(d, A_value), 0);
    }
  }
  return o;
}
JS_NATIVE(n_object_getproto) {
  js_val v = NARG(0);
  if (v.t == JS_T_OBJ) return v.u.o->proto ? JS_O(v.u.o->proto) : JS_NULL;
  switch (v.t) { case JS_T_STR: return JS_O(js_String_proto); case JS_T_NUM: return JS_O(js_Number_proto); case JS_T_BOOL: return JS_O(js_Boolean_proto); case JS_T_BIG: return JS_O(js_BigInt_proto); }
  js_throw_type("Cannot convert undefined or null to object");
}
JS_NATIVE(n_object_setproto) {
  js_val v = NARG(0), p = NARG(1);
  if (v.t == JS_T_OBJ) v.u.o->proto = p.t == JS_T_OBJ ? p.u.o : NULL;
  return v;
}
JS_NATIVE(n_object_defprop) {
  js_val o = NARG(0), d = NARG(2);
  if (o.t != JS_T_OBJ) js_throw_type("Object.defineProperty called on non-object");
  js_str* k = js_to_key(NARG(1));
  js_val g = js_get(d, A_get), s = js_get(d, A_set);
  if (js_is_callable(g) || js_is_callable(s)) js_define_accessor(o.u.o, k, js_is_callable(g) ? g.u.o : NULL, js_is_callable(s) ? s.u.o : NULL, js_truthy(js_get(d, js_atom_c("enumerable"))) ? 0 : P_HIDDEN);
  else {
    uint32_t fl = (js_truthy(js_get(d, js_atom_c("enumerable"))) ? 0 : P_HIDDEN) | (js_truthy(js_get(d, js_atom_c("writable"))) ? 0 : P_RO);
    if (o.u.o->kind == K_OBJ || !js_virtual_set(o.u.o, k, js_get(d, A_value))) js_define(o.u.o, k, js_get(d, A_value), fl);
  }
  return o;
}
JS_NATIVE(n_object_names) {
  js_val v = NARG(0);
  js_val keys = js_own_keys(v);
  if (v.t == JS_T_OBJ) {
    js_arr* r = js_as_arr(keys);
    if (v.u.o->kind == K_ARR || v.u.o->kind == K_TYPED) js_arr_push1(r, JS_SV(A_length));
    for (int32_t i = 0; i < v.u.o->np; ++i) { js_prop* p = &v.u.o->p[i]; if (p->key && (p->flags & P_HIDDEN)) js_arr_push1(r, JS_SV(p->key)); }
  }
  return keys;
}
JS_NATIVE(n_object_fromentries) {
  js_val o = js_new_object();
  js_iter it; js_val e;
  js_iter_init(&it, NARG(0));
  while (js_iter_next(&it, &e)) js_setv(o, js_idx_get(e, 0), js_idx_get(e, 1));
  return o;
}
JS_NATIVE(n_object_hasown) { return JS_B(js_has_own(NARG(0), js_to_key(NARG(1)))); }
JS_NATIVE(n_object_is) {
  js_val a = NARG(0), b = NARG(1);
  if (a.t == JS_T_NUM && b.t == JS_T_NUM) { if (isnan(a.u.n) && isnan(b.u.n)) return JS_TRUE; if (a.u.n == 0 && b.u.n == 0) return JS_B(signbit(a.u.n) == signbit(b.u.n)); }
  return JS_B(js_strict_eq(a, b));
}
JS_NATIVE(n_objproto_hasown) { return JS_B(js_has_own(self, js_to_key(NARG(0)))); }
JS_NATIVE(n_objproto_isproto) {
  js_val v = NARG(0);
  if (v.t != JS_T_OBJ || self.t != JS_T_OBJ) return JS_FALSE;
  for (js_obj* o = v.u.o->proto; o; o = o->proto) if (o == self.u.o) return JS_TRUE;
  return JS_FALSE;
}
JS_NATIVE(n_objproto_tostring) {
  if (self.t == JS_T_UNDEF) return JS_S(u"[object Undefined]");
  if (self.t == JS_T_NULL) return JS_S(u"[object Null]");
  if (self.t == JS_T_OBJ) {
    switch (self.u.o->kind) {
      case K_ARR: return JS_S(u"[object Array]");
      case K_FUNC: return JS_S(u"[object Function]");
      case K_MAP: return JS_S(u"[object Map]");
      case K_SET: return JS_S(u"[object Set]");
      case K_TYPED: return JS_SV(js_str_concat(js_str_concat(js_str_c("[object "), js_str_c(js_ta_names[((js_typed*)self.u.o)->tk])), js_str_c("]")));
    }
    for (js_obj* o = self.u.o; o; o = o->proto) if (o == js_Error_proto) return JS_S(u"[object Error]");
    return JS_S(u"[object " u"Object]");
  }
  if (self.t == JS_T_NUM) return JS_S(u"[object Number]");
  if (self.t == JS_T_STR) return JS_S(u"[object String]");
  if (self.t == JS_T_BOOL) return JS_S(u"[object Boolean]");
  return JS_S(u"[object BigInt]");
}
JS_NATIVE(n_objproto_valueof) { return self; }
JS_NATIVE(n_objproto_tolocale) { return js_invoke(self, A_toString, 0, NULL); }

// ---------------------------------------------------------------- Function
JS_NATIVE(n_func_call) {
  return js_call(self, NARG(0), argc > 1 ? argc - 1 : 0, argv + (argc > 1 ? 1 : argc));
}
static js_val* js_list_args(js_val list, int* n) {
  if (list.t <= JS_T_NULL) { *n = 0; return NULL; }
  if (list.t != JS_T_OBJ) js_throw_type("CreateListFromArrayLike called on non-object");
  int64_t len = js_len_of(list);
  js_val* a = (js_val*)js_alloc(sizeof(js_val) * (size_t)(len ? len : 1));
  for (int64_t i = 0; i < len; ++i) a[i] = js_idx_get(list, i);
  *n = (int)len;
  return a;
}
JS_NATIVE(n_func_apply) {
  int n; js_val* a = js_list_args(NARG(1), &n);
  return js_call(self, NARG(0), n, a);
}
static js_val n_bound_call(js_func* f, js_val self, int argc, js_val* argv, js_val nt) {
  int n = f->nbound + argc;
  js_val* a = (js_val*)js_alloc(sizeof(js_val) * (size_t)(n ? n : 1));
  if (f->nbound) memcpy(a, f->bound_args, sizeof(js_val) * (size_t)f->nbound);
  if (argc) memcpy(a + f->nbound, argv, sizeof(js_val) * (size_t)argc);
  if (nt.t != JS_T_UNDEF) return js_new(f->bound_target, n, a);
  return js_call(f->bound_target, f->bound_this, n, a);
}
JS_NATIVE(n_func_bind) {
  js_need_callable(self, "Bind target");
  js_func* b = js_func_new(n_bound_call, ((js_func*)self.u.o)->name, 0, 0, NULL);
  b->bound_target = self; b->bound_this = NARG(0);
  b->nbound = argc > 1 ? argc - 1 : 0;
  if (b->nbound) { b->bound_args = (js_val*)js_alloc(sizeof(js_val) * (size_t)b->nbound); memcpy(b->bound_args, argv + 1, sizeof(js_val) * (size_t)b->nbound); }
  b->flags = ((js_func*)self.u.o)->flags & JF_CTOR ? JF_CTOR | JF_NATIVE_CTOR : 0;
  return JS_O(b);
}
JS_NATIVE(n_func_tostring) {
  js_str* name = self.t == JS_T_OBJ && self.u.o->kind == K_FUNC && ((js_func*)self.u.o)->name ? ((js_func*)self.u.o)->name : A_empty;
  return JS_SV(js_str_concat(js_str_concat(js_str_c("function "), name), js_str_c("() { [native code] }")));
}

// ---------------------------------------------------------------- Array
static js_val js_array_from_ctor_args(int argc, js_val* argv) {
  if (argc == 1 && argv[0].t == JS_T_NUM) {
    double d = argv[0].u.n;
    if (!(d >= 0 && d <= 4294967295.0 && d == trunc(d))) js_throw_range("Invalid array length");
    js_arr* a = js_arr_alloc(0, (int64_t)d);
    js_arr_setlen(a, (int64_t)d);
    return JS_O(a);
  }
  return js_arr_of(argc, argv);
}
JS_NATIVE(n_array_ctor) { return js_array_from_ctor_args(argc, argv); }
JS_NATIVE(n_array_isarray) { return JS_B(js_is_kind(NARG(0), K_ARR)); }
JS_NATIVE(n_array_of) { return js_arr_of(argc, argv); }
JS_NATIVE(n_array_from) {
  js_val src = NARG(0), map = NARG(1);
  if (src.t <= JS_T_NULL) js_throw_type("%s is not iterable", src.t == JS_T_NULL ? "null" : "undefined");
  js_val r;
  int iterable = src.t == JS_T_STR || (src.t == JS_T_OBJ && (src.u.o->kind == K_ARR || src.u.o->kind == K_TYPED || src.u.o->kind == K_MAP || src.u.o->kind == K_SET || src.u.o->kind == K_ITER));
  if (iterable) r = js_iter_to_array(src);
  else {
    int64_t len = js_len_of(src);
    js_arr* a = js_arr_alloc(len, len);
    for (int64_t i = 0; i < len; ++i) a->a[i] = js_idx_get(src, i);
    r = JS_O(a);
  }
  if (map.t != JS_T_UNDEF) {
    js_need_callable(map, "map function");
    js_arr* a = js_as_arr(r);
    for (int64_t i = 0; i < a->len; ++i) { js_val args[2] = { a->a[i], JS_D((double)i) }; a->a[i] = js_call(map, NARG(2), 2, args); }
  }
  return r;
}
static js_arr* js_this_arr(js_val self, const char* name) {
  if (!js_is_kind(self, K_ARR)) js_throw_type("Array.prototype.%s called on a non-array", name);
  return (js_arr*)self.u.o;
}
static void js_arr_mutable(js_arr* a) { if (a->o.frozen) js_throw_type("Cannot add property %lld, object is not extensible", (long long)a->len); }
JS_NATIVE(n_array_push) {
  js_arr* a = js_this_arr(self, "push");
  if (a->o.frozen || a->o.noext) js_arr_mutable(a);
  js_arr_reserve(a, a->len + argc);
  for (int i = 0; i < argc; ++i) a->a[a->len++] = argv[i];
  return JS_D((double)a->len);
}
JS_NATIVE(n_array_pop) {
  js_arr* a = js_this_arr(self, "pop");
  if (!a->len) return JS_U;
  if (a->o.frozen) js_arr_mutable(a);
  js_val v = a->a[--a->len]; a->a[a->len] = JS_U;
  return v.t == JS_T_HOLE ? JS_U : v;
}
JS_NATIVE(n_array_shift) {
  js_arr* a = js_this_arr(self, "shift");
  if (!a->len) return JS_U;
  if (a->o.frozen) js_arr_mutable(a);
  js_val v = a->a[0];
  memmove(a->a, a->a + 1, sizeof(js_val) * (size_t)(a->len - 1));
  a->a[--a->len] = JS_U;
  return v.t == JS_T_HOLE ? JS_U : v;
}
JS_NATIVE(n_array_unshift) {
  js_arr* a = js_this_arr(self, "unshift");
  if (a->o.frozen) js_arr_mutable(a);
  js_arr_reserve(a, a->len + argc);
  memmove(a->a + argc, a->a, sizeof(js_val) * (size_t)a->len);
  for (int i = 0; i < argc; ++i) a->a[i] = argv[i];
  a->len += argc;
  return JS_D((double)a->len);
}
JS_NATIVE(n_array_slice) {
  js_arr* a = js_this_arr(self, "slice");
  int64_t s = js_rel_index(NARG(0), a->len, 0), e = js_rel_index(NARG(1), a->len, a->len);
  int64_t n = e > s ? e - s : 0;
  js_arr* r = js_arr_alloc(n, n);
  if (n) memcpy(r->a, a->a + s, sizeof(js_val) * (size_t)n);
  return JS_O(r);
}
JS_NATIVE(n_array_splice) {
  js_arr* a = js_this_arr(self, "splice");
  int64_t s = js_rel_index(NARG(0), a->len, 0);
  int64_t del;
  if (argc == 0) del = 0;
  else if (argc == 1) del = a->len - s;
  else { double d = js_to_integer(argv[1]); del = d < 0 ? 0 : d > (double)(a->len - s) ? a->len - s : (int64_t)d; }
  int ins = argc > 2 ? argc - 2 : 0;
  if (a->o.frozen && (del || ins)) js_arr_mutable(a);
  js_arr* removed = js_arr_alloc(del, del);
  if (del) memcpy(removed->a, a->a + s, sizeof(js_val) * (size_t)del);
  int64_t nl = a->len - del + ins;
  js_arr_reserve(a, nl);
  memmove(a->a + s + ins, a->a + s + del, sizeof(js_val) * (size_t)(a->len - s - del));
  for (int i = 0; i < ins; ++i) a->a[s + i] = argv[2 + i];
  for (int64_t i = nl; i < a->len; ++i) a->a[i] = JS_U;
  a->len = nl;
  return JS_O(removed);
}
static void js_concat_into(js_arr* r, js_val v) {
  if (js_is_kind(v, K_ARR)) {
    js_arr* b = (js_arr*)v.u.o;
    js_arr_reserve(r, r->len + b->len);
    memcpy(r->a + r->len, b->a, sizeof(js_val) * (size_t)b->len);
    r->len += b->len;
  } else js_arr_push1(r, v);
}
JS_NATIVE(n_array_concat) {
  js_arr* a = js_this_arr(self, "concat");
  js_arr* r = js_arr_alloc(0, a->len + 4);
  js_concat_into(r, self);
  for (int i = 0; i < argc; ++i) js_concat_into(r, argv[i]);
  return JS_O(r);
}
static js_str* js_join(js_val arr, js_str* sep) {
  int64_t len = js_len_of(arr);
  if (!len) return A_empty;
  js_str* r = NULL;
  for (int64_t i = 0; i < len; ++i) {
    js_val v = js_idx_get(arr, i);
    js_str* s = v.t <= JS_T_NULL || v.t == JS_T_HOLE ? A_empty : js_to_str(v);
    r = r ? js_str_concat(js_str_concat(r, sep), s) : js_str_concat(js_str_new(NULL, 0), s);
  }
  return r;
}
JS_NATIVE(n_array_join) {
  js_val sep = NARG(0);
  return JS_SV(js_join(self, sep.t == JS_T_UNDEF ? js_str_char(',') : js_to_str(sep)));
}
JS_NATIVE(n_array_tostring) { return JS_SV(js_join(self, js_str_char(','))); }
JS_NATIVE(n_array_reverse) {
  int64_t len = js_len_of(self);
  for (int64_t i = 0, j = len - 1; i < j; ++i, --j) { js_val t = js_idx_get(self, i); js_idx_set(self, i, js_idx_get(self, j)); js_idx_set(self, j, t); }
  return self;
}
JS_NATIVE(n_array_indexof) {
  int64_t len = js_len_of(self);
  int64_t i = js_rel_index(NARG(1), len, 0);
  for (; i < len; ++i) {
    if (js_is_kind(self, K_ARR) && ((js_arr*)self.u.o)->a[i].t == JS_T_HOLE) continue;
    if (js_strict_eq(js_idx_get(self, i), NARG(0))) return JS_D((double)i);
  }
  return JS_D(-1);
}
JS_NATIVE(n_array_lastindexof) {
  int64_t len = js_len_of(self);
  int64_t i = argc > 1 ? (int64_t)js_to_integer(argv[1]) : len - 1;
  if (i < 0) i += len;
  if (i >= len) i = len - 1;
  for (; i >= 0; --i) if (js_strict_eq(js_idx_get(self, i), NARG(0))) return JS_D((double)i);
  return JS_D(-1);
}
JS_NATIVE(n_array_includes) {
  int64_t len = js_len_of(self);
  for (int64_t i = js_rel_index(NARG(1), len, 0); i < len; ++i) if (js_same_value_zero(js_idx_get(self, i), NARG(0))) return JS_TRUE;
  return JS_FALSE;
}
JS_NATIVE(n_array_fill) {
  int64_t len = js_len_of(self);
  int64_t s = js_rel_index(NARG(1), len, 0), e = js_rel_index(NARG(2), len, len);
  if (js_is_kind(self, K_ARR)) { js_arr* a = (js_arr*)self.u.o; if (a->o.frozen && s < e) js_arr_mutable(a); for (int64_t i = s; i < e; ++i) a->a[i] = NARG(0); }
  else for (int64_t i = s; i < e; ++i) js_idx_set(self, i, NARG(0));
  return self;
}
static int js_arr_hole(js_val self, int64_t i) { return js_is_kind(self, K_ARR) && i < ((js_arr*)self.u.o)->len && ((js_arr*)self.u.o)->a[i].t == JS_T_HOLE; }
JS_NATIVE(n_array_foreach) {
  js_need_callable(NARG(0), "forEach callback");
  int64_t len = js_len_of(self);
  for (int64_t i = 0; i < len && i < js_len_of(self); ++i) { if (js_arr_hole(self, i)) continue; js_cb(NARG(0), NARG(1), js_idx_get(self, i), i, self); }
  return JS_U;
}
JS_NATIVE(n_array_map) {
  js_need_callable(NARG(0), "map callback");
  int64_t len = js_len_of(self);
  js_arr* r = js_arr_alloc(len, len);
  for (int64_t i = 0; i < len; ++i) { if (js_arr_hole(self, i)) { r->a[i] = JS_HOLE; continue; } r->a[i] = js_cb(NARG(0), NARG(1), js_idx_get(self, i), i, self); }
  return JS_O(r);
}
JS_NATIVE(n_array_filter) {
  js_need_callable(NARG(0), "filter callback");
  int64_t len = js_len_of(self);
  js_arr* r = js_arr_alloc(0, 4);
  for (int64_t i = 0; i < len; ++i) { if (js_arr_hole(self, i)) continue; js_val v = js_idx_get(self, i); if (js_truthy(js_cb(NARG(0), NARG(1), v, i, self))) js_arr_push1(r, v); }
  return JS_O(r);
}
JS_NATIVE(n_array_some) {
  js_need_callable(NARG(0), "some callback");
  int64_t len = js_len_of(self);
  for (int64_t i = 0; i < len; ++i) { if (js_arr_hole(self, i)) continue; if (js_truthy(js_cb(NARG(0), NARG(1), js_idx_get(self, i), i, self))) return JS_TRUE; }
  return JS_FALSE;
}
JS_NATIVE(n_array_every) {
  js_need_callable(NARG(0), "every callback");
  int64_t len = js_len_of(self);
  for (int64_t i = 0; i < len; ++i) { if (js_arr_hole(self, i)) continue; if (!js_truthy(js_cb(NARG(0), NARG(1), js_idx_get(self, i), i, self))) return JS_FALSE; }
  return JS_TRUE;
}
JS_NATIVE(n_array_find) {
  js_need_callable(NARG(0), "find callback");
  int64_t len = js_len_of(self);
  for (int64_t i = 0; i < len; ++i) { js_val v = js_idx_get(self, i); if (js_truthy(js_cb(NARG(0), NARG(1), v, i, self))) return v; }
  return JS_U;
}
JS_NATIVE(n_array_findindex) {
  js_need_callable(NARG(0), "findIndex callback");
  int64_t len = js_len_of(self);
  for (int64_t i = 0; i < len; ++i) if (js_truthy(js_cb(NARG(0), NARG(1), js_idx_get(self, i), i, self))) return JS_D((double)i);
  return JS_D(-1);
}
JS_NATIVE(n_array_findlast) {
  js_need_callable(NARG(0), "findLast callback");
  for (int64_t i = js_len_of(self) - 1; i >= 0; --i) { js_val v = js_idx_get(self, i); if (js_truthy(js_cb(NARG(0), NARG(1), v, i, self))) return v; }
  return JS_U;
}
JS_NATIVE(n_array_findlastindex) {
  js_need_callable(NARG(0), "findLastIndex callback");
  for (int64_t i = js_len_of(self) - 1; i >= 0; --i) if (js_truthy(js_cb(NARG(0), NARG(1), js_idx_get(self, i), i, self))) return JS_D((double)i);
  return JS_D(-1);
}
JS_NATIVE(n_array_reduce) {
  js_need_callable(NARG(0), "reduce callback");
  int64_t len = js_len_of(self), i = 0;
  js_val acc;
  if (argc > 1) acc = argv[1];
  else {
    while (i < len && js_arr_hole(self, i)) ++i;
    if (i >= len) js_throw_type("Reduce of empty array with no initial value");
    acc = js_idx_get(self, i++);
  }
  for (; i < len; ++i) { if (js_arr_hole(self, i)) continue; js_val args[4] = { acc, js_idx_get(self, i), JS_D((double)i), self }; acc = js_call(NARG(0), JS_U, 4, args); }
  return acc;
}
JS_NATIVE(n_array_reduceright) {
  js_need_callable(NARG(0), "reduceRight callback");
  int64_t i = js_len_of(self) - 1;
  js_val acc;
  if (argc > 1) acc = argv[1];
  else { if (i < 0) js_throw_type("Reduce of empty array with no initial value"); acc = js_idx_get(self, i--); }
  for (; i >= 0; --i) { js_val args[4] = { acc, js_idx_get(self, i), JS_D((double)i), self }; acc = js_call(NARG(0), JS_U, 4, args); }
  return acc;
}
static js_val js_sort_cmp_fn;
static int js_sort_default(js_val a, js_val b) {
  if (a.t == JS_T_UNDEF) return b.t == JS_T_UNDEF ? 0 : 1;
  if (b.t == JS_T_UNDEF) return -1;
  return js_str_cmp(js_to_str(a), js_to_str(b));
}
static int js_sort_compare(js_val cmp, js_val a, js_val b) {
  if (cmp.t == JS_T_UNDEF) return js_sort_default(a, b);
  if (a.t == JS_T_UNDEF) return b.t == JS_T_UNDEF ? 0 : 1;
  if (b.t == JS_T_UNDEF) return -1;
  js_val args[2] = { a, b };
  double d = js_to_number(js_call(cmp, JS_U, 2, args));
  return d < 0 ? -1 : d > 0 ? 1 : 0;
}
/** Stable merge sort of a value list with a JavaScript comparator */
static void js_merge_sort(js_val* a, int64_t n, js_val cmp, js_val* tmp) {
  if (n < 2) return;
  if (n <= 8) {
    for (int64_t i = 1; i < n; ++i) { js_val k = a[i]; int64_t j = i - 1; while (j >= 0 && js_sort_compare(cmp, a[j], k) > 0) { a[j + 1] = a[j]; --j; } a[j + 1] = k; }
    return;
  }
  int64_t m = n / 2;
  js_merge_sort(a, m, cmp, tmp);
  js_merge_sort(a + m, n - m, cmp, tmp);
  int64_t i = 0, j = m, k = 0;
  while (i < m && j < n) tmp[k++] = js_sort_compare(cmp, a[j], a[i]) < 0 ? a[j++] : a[i++];
  while (i < m) tmp[k++] = a[i++];
  while (j < n) tmp[k++] = a[j++];
  memcpy(a, tmp, sizeof(js_val) * (size_t)n);
}
JS_NATIVE(n_array_sort) {
  js_arr* a = js_this_arr(self, "sort");
  js_val cmp = NARG(0);
  if (cmp.t != JS_T_UNDEF && !js_is_callable(cmp)) js_throw_type("The comparison function must be either a function or undefined");
  // holes go last, as undefined values before them
  int64_t n = 0;
  for (int64_t i = 0; i < a->len; ++i) if (a->a[i].t != JS_T_HOLE) a->a[n++] = a->a[i];
  int64_t holes = a->len - n;
  js_val* tmp = (js_val*)js_alloc(sizeof(js_val) * (size_t)(n ? n : 1));
  js_merge_sort(a->a, n, cmp, tmp);
  for (int64_t i = 0; i < holes; ++i) a->a[n + i] = JS_HOLE;
  return self;
}
JS_NATIVE(n_array_at) {
  int64_t len = js_len_of(self);
  double d = js_to_integer(NARG(0));
  if (d < 0) d += (double)len;
  if (d < 0 || d >= (double)len) return JS_U;
  return js_idx_get(self, (int64_t)d);
}
JS_NATIVE(n_array_flat) {
  js_arr* a = js_this_arr(self, "flat");
  double depth = NARG(0).t == JS_T_UNDEF ? 1 : js_to_integer(NARG(0));
  js_arr* r = js_arr_alloc(0, a->len);
  for (int64_t i = 0; i < a->len; ++i) {
    js_val v = a->a[i];
    if (v.t == JS_T_HOLE) continue;
    if (depth >= 1 && js_is_kind(v, K_ARR)) {
      js_val inner = depth > 1 ? n_array_flat(f, v, 1, (js_val[]){ JS_D(depth - 1) }, JS_U) : v;
      js_concat_into(r, inner);
    } else js_arr_push1(r, v);
  }
  return JS_O(r);
}
JS_NATIVE(n_array_flatmap) {
  js_val mapped = n_array_map(f, self, argc, argv, nt);
  return n_array_flat(f, mapped, 0, NULL, JS_U);
}
JS_NATIVE(n_array_copywithin) {
  int64_t len = js_len_of(self);
  int64_t to = js_rel_index(NARG(0), len, 0), from = js_rel_index(NARG(1), len, 0), e = js_rel_index(NARG(2), len, len);
  int64_t count = e - from < len - to ? e - from : len - to;
  if (count <= 0) return self;
  js_val* tmp = (js_val*)js_alloc(sizeof(js_val) * (size_t)count);
  for (int64_t i = 0; i < count; ++i) tmp[i] = js_idx_get(self, from + i);
  for (int64_t i = 0; i < count; ++i) js_idx_set(self, to + i, tmp[i]);
  return self;
}
JS_NATIVE(n_array_keys) { return js_iterobj_new(self, 0); }
JS_NATIVE(n_array_values) { return js_iterobj_new(self, 1); }
JS_NATIVE(n_array_entries) { return js_iterobj_new(self, 2); }

// ---------------------------------------------------------------- ArrayBuffer and typed arrays
static js_abuf* js_abuf_new(int64_t len) {
  if (len < 0 || len > ((int64_t)1 << 40)) js_throw_range("Array buffer allocation failed");
  js_abuf* b = (js_abuf*)js_alloc(sizeof(js_abuf));
  js_obj_init(&b->o, K_ABUF, js_ArrayBuffer_proto);
  b->data = (uint8_t*)js_alloc_raw((size_t)len);
  memset(b->data, 0, (size_t)len);
  b->len = len;
  return b;
}
static js_typed* js_typed_new(int tk, js_abuf* buf, int64_t off, int64_t len) {
  js_typed* t = (js_typed*)js_alloc(sizeof(js_typed));
  js_obj_init(&t->o, K_TYPED, js_typed_protos[tk]);
  t->tk = tk; t->buf = buf; t->off = off; t->len = len;
  return t;
}
static js_val js_typed_alloc(int tk, int64_t len) {
  if (len < 0) js_throw_range("Invalid typed array length: %lld", (long long)len);
  return JS_O(js_typed_new(tk, js_abuf_new(len * js_ta_size[tk]), 0, len));
}
static js_val js_typed_from_values(int tk, js_val src) {
  js_val list = src;
  if (!(src.t == JS_T_OBJ && (src.u.o->kind == K_ARR || src.u.o->kind == K_TYPED))) {
    int iterable = src.t == JS_T_STR || (src.t == JS_T_OBJ && (src.u.o->kind == K_MAP || src.u.o->kind == K_SET || src.u.o->kind == K_ITER));
    if (iterable) list = js_iter_to_array(src);
  }
  int64_t len = js_len_of(list);
  js_val r = js_typed_alloc(tk, len);
  js_typed* t = js_as_typed(r);
  if (js_is_kind(list, K_TYPED) && (js_as_typed(list)->tk >= TA_BI64) != (tk >= TA_BI64))
    js_throw_type("Cannot mix BigInt and other types, use explicit conversions");
  for (int64_t i = 0; i < len; ++i) js_typed_set(t, i, js_idx_get(list, i));
  return r;
}
static js_val js_typed_construct(int tk, int argc, js_val* argv, js_val nt) {
  if (nt.t == JS_T_UNDEF) js_throw_type("Constructor %s requires 'new'", js_ta_names[tk]);
  js_val a = argc > 0 ? argv[0] : JS_U;
  js_val r;
  if (a.t != JS_T_OBJ) {
    double d = a.t == JS_T_UNDEF ? 0 : js_to_number(a);
    if (!(d >= 0 && d == trunc(d) && d < 9007199254740992.0)) js_throw_range("Invalid typed array length: %s", js_cstr(js_to_str(a)));
    r = js_typed_alloc(tk, (int64_t)d);
  } else if (a.u.o->kind == K_ABUF) {
    js_abuf* b = (js_abuf*)a.u.o;
    int64_t off = argc > 1 && argv[1].t != JS_T_UNDEF ? (int64_t)js_to_integer(argv[1]) : 0;
    int sz = js_ta_size[tk];
    if (off % sz) js_throw_range("start offset of %s should be a multiple of %d", js_ta_names[tk], sz);
    int64_t len;
    if (argc > 2 && argv[2].t != JS_T_UNDEF) { len = (int64_t)js_to_integer(argv[2]); if (off + len * sz > b->len) js_throw_range("Invalid typed array length: %lld", (long long)len); }
    else { if ((b->len - off) % sz) js_throw_range("byte length of %s should be a multiple of %d", js_ta_names[tk], sz); len = (b->len - off) / sz; if (len < 0) js_throw_range("Start offset %lld is outside the bounds of the buffer", (long long)off); }
    r = JS_O(js_typed_new(tk, b, off, len));
  } else r = js_typed_from_values(tk, a);
  js_obj* proto = js_proto_from(nt, js_typed_protos[tk]);
  r.u.o->proto = proto;
  return r;
}
#define JS_TYPED_CTOR(tk) JS_NATIVE(n_typed_ctor_##tk) { return js_typed_construct(tk, argc, argv, nt); }
JS_TYPED_CTOR(0) JS_TYPED_CTOR(1) JS_TYPED_CTOR(2) JS_TYPED_CTOR(3) JS_TYPED_CTOR(4) JS_TYPED_CTOR(5)
JS_TYPED_CTOR(6) JS_TYPED_CTOR(7) JS_TYPED_CTOR(8) JS_TYPED_CTOR(9) JS_TYPED_CTOR(10)
static int js_ctor_tk(js_func* f) { return (int)(intptr_t)f->data; }
JS_NATIVE(n_typed_from) {
  int tk = js_ctor_tk(js_as_func(self));
  js_val r = js_typed_from_values(tk, NARG(0));
  if (NARG(1).t != JS_T_UNDEF) {
    js_typed* t = js_as_typed(r);
    js_val src = js_is_kind(NARG(0), K_ARR) || js_is_kind(NARG(0), K_TYPED) ? NARG(0) : js_iter_to_array(NARG(0));
    for (int64_t i = 0; i < t->len; ++i) { js_val args[2] = { js_idx_get(src, i), JS_D((double)i) }; js_typed_set(t, i, js_call(NARG(1), NARG(2), 2, args)); }
  }
  return r;
}
JS_NATIVE(n_typed_of) {
  int tk = js_ctor_tk(js_as_func(self));
  js_val r = js_typed_alloc(tk, argc);
  for (int i = 0; i < argc; ++i) js_typed_set(js_as_typed(r), i, argv[i]);
  return r;
}
static js_typed* js_this_typed(js_val self, const char* name) {
  if (!js_is_kind(self, K_TYPED)) js_throw_type("this is not a typed array (%s)", name);
  return (js_typed*)self.u.o;
}
JS_NATIVE(n_typed_set) {
  js_typed* t = js_this_typed(self, "set");
  js_val src = NARG(0);
  int64_t off = (int64_t)js_to_integer(NARG(1));
  if (off < 0) js_throw_range("offset is out of bounds");
  int64_t len = js_len_of(src);
  if (off + len > t->len) js_throw_range("offset is out of bounds");
  if (js_is_kind(src, K_TYPED) && js_as_typed(src)->tk == t->tk) {
    js_typed* s = js_as_typed(src);
    int sz = js_ta_size[t->tk];
    memmove(t->buf->data + t->off + off * sz, s->buf->data + s->off, (size_t)(len * sz));
    return JS_U;
  }
  if (js_is_kind(src, K_TYPED) && js_as_typed(src)->buf == t->buf) src = js_typed_from_values(js_as_typed(src)->tk, src);
  for (int64_t i = 0; i < len; ++i) js_typed_set(t, off + i, js_idx_get(src, i));
  return JS_U;
}
JS_NATIVE(n_typed_subarray) {
  js_typed* t = js_this_typed(self, "subarray");
  int64_t s = js_rel_index(NARG(0), t->len, 0), e = js_rel_index(NARG(1), t->len, t->len);
  int64_t n = e > s ? e - s : 0;
  js_typed* r = js_typed_new(t->tk, t->buf, t->off + s * js_ta_size[t->tk], n);
  r->o.proto = t->o.proto;
  return JS_O(r);
}
JS_NATIVE(n_typed_slice) {
  js_typed* t = js_this_typed(self, "slice");
  int64_t s = js_rel_index(NARG(0), t->len, 0), e = js_rel_index(NARG(1), t->len, t->len);
  int64_t n = e > s ? e - s : 0;
  js_val r = js_typed_alloc(t->tk, n);
  int sz = js_ta_size[t->tk];
  if (n) memcpy(js_as_typed(r)->buf->data, t->buf->data + t->off + s * sz, (size_t)(n * sz));
  return r;
}
JS_NATIVE(n_typed_map) {
  js_typed* t = js_this_typed(self, "map");
  js_need_callable(NARG(0), "map callback");
  js_val r = js_typed_alloc(t->tk, t->len);
  for (int64_t i = 0; i < t->len; ++i) js_typed_set(js_as_typed(r), i, js_cb(NARG(0), NARG(1), js_typed_get(t, i), i, self));
  return r;
}
JS_NATIVE(n_typed_filter) {
  js_typed* t = js_this_typed(self, "filter");
  js_need_callable(NARG(0), "filter callback");
  js_arr* keep = js_arr_alloc(0, 8);
  for (int64_t i = 0; i < t->len; ++i) { js_val v = js_typed_get(t, i); if (js_truthy(js_cb(NARG(0), NARG(1), v, i, self))) js_arr_push1(keep, v); }
  return js_typed_from_values(t->tk, JS_O(keep));
}
static int js_typed_cmp(js_val a, js_val b) {
  if (a.t == JS_T_BIG) return js_big_cmp(a.u.g, b.u.g);
  double x = a.u.n, y = b.u.n;
  if (isnan(x)) return isnan(y) ? 0 : 1;
  if (isnan(y)) return -1;
  if (x < y) return -1;
  if (x > y) return 1;
  if (x == 0 && y == 0) return signbit(x) && !signbit(y) ? -1 : !signbit(x) && signbit(y) ? 1 : 0;
  return 0;
}
JS_NATIVE(n_typed_sort) {
  js_typed* t = js_this_typed(self, "sort");
  js_val cmp = NARG(0);
  js_val* vals = (js_val*)js_alloc(sizeof(js_val) * (size_t)(t->len ? t->len : 1));
  for (int64_t i = 0; i < t->len; ++i) vals[i] = js_typed_get(t, i);
  // insertion into a merge sort with the numeric order when no comparator
  js_val* tmp = (js_val*)js_alloc(sizeof(js_val) * (size_t)(t->len ? t->len : 1));
  if (cmp.t == JS_T_UNDEF) {
    // simple merge sort with js_typed_cmp
    int64_t n = t->len;
    for (int64_t w = 1; w < n; w *= 2) {
      for (int64_t lo = 0; lo < n; lo += 2 * w) {
        int64_t mid = lo + w < n ? lo + w : n, hi = lo + 2 * w < n ? lo + 2 * w : n, i = lo, j = mid, k = lo;
        while (i < mid && j < hi) tmp[k++] = js_typed_cmp(vals[j], vals[i]) < 0 ? vals[j++] : vals[i++];
        while (i < mid) tmp[k++] = vals[i++];
        while (j < hi) tmp[k++] = vals[j++];
      }
      js_val* sw = vals; vals = tmp; tmp = sw;
    }
  } else js_merge_sort(vals, t->len, cmp, tmp);
  for (int64_t i = 0; i < t->len; ++i) js_typed_set(t, i, vals[i]);
  return self;
}
JS_NATIVE(n_typed_tostring) { return JS_SV(js_join(self, js_str_char(','))); }
JS_NATIVE(n_abuf_ctor) {
  if (nt.t == JS_T_UNDEF) js_throw_type("Constructor ArrayBuffer requires 'new'");
  double d = js_to_integer(NARG(0));
  js_abuf* b = js_abuf_new((int64_t)d);
  b->o.proto = js_proto_from(nt, js_ArrayBuffer_proto);
  return JS_O(b);
}
JS_NATIVE(n_abuf_isview) { js_val v = NARG(0); return JS_B(v.t == JS_T_OBJ && (v.u.o->kind == K_TYPED || v.u.o->kind == K_DVIEW)); }
JS_NATIVE(n_abuf_slice) {
  if (!js_is_kind(self, K_ABUF)) js_throw_type("not an ArrayBuffer");
  js_abuf* b = (js_abuf*)self.u.o;
  int64_t s = js_rel_index(NARG(0), b->len, 0), e = js_rel_index(NARG(1), b->len, b->len);
  int64_t n = e > s ? e - s : 0;
  js_abuf* r = js_abuf_new(n);
  if (n) memcpy(r->data, b->data + s, (size_t)n);
  return JS_O(r);
}

// ---------------------------------------------------------------- DataView
JS_NATIVE(n_dview_ctor) {
  if (nt.t == JS_T_UNDEF) js_throw_type("Constructor DataView requires 'new'");
  js_val b = NARG(0);
  if (!js_is_kind(b, K_ABUF)) js_throw_type("First argument to DataView constructor must be an ArrayBuffer");
  js_abuf* buf = (js_abuf*)b.u.o;
  int64_t off = (int64_t)js_to_integer(NARG(1));
  if (off < 0 || off > buf->len) js_throw_range("Start offset %lld is outside the bounds of the buffer", (long long)off);
  int64_t len = NARG(2).t == JS_T_UNDEF ? buf->len - off : (int64_t)js_to_integer(NARG(2));
  if (len < 0 || off + len > buf->len) js_throw_range("Invalid DataView length %lld", (long long)len);
  js_dview* d = (js_dview*)js_alloc(sizeof(js_dview));
  js_obj_init(&d->o, K_DVIEW, js_proto_from(nt, js_DataView_proto));
  d->buf = buf; d->off = off; d->len = len;
  return JS_O(d);
}
static uint8_t* js_dview_at(js_val self, js_val idx, int size) {
  if (!js_is_kind(self, K_DVIEW)) js_throw_type("not a DataView");
  js_dview* d = (js_dview*)self.u.o;
  double i = js_to_integer(idx);
  if (i < 0 || i + size > (double)d->len) js_throw_range("Offset is outside the bounds of the DataView");
  return d->buf->data + d->off + (int64_t)i;
}
static uint64_t js_dview_read(uint8_t* p, int size, int little) {
  uint64_t v = 0;
  for (int i = 0; i < size; ++i) v |= (uint64_t)p[little ? i : size - 1 - i] << (8 * i);
  return v;
}
static void js_dview_write(uint8_t* p, int size, int little, uint64_t v) {
  for (int i = 0; i < size; ++i) p[little ? i : size - 1 - i] = (uint8_t)(v >> (8 * i));
}
#define JS_DV_GET(name, size, expr) JS_NATIVE(name) { uint64_t raw = js_dview_read(js_dview_at(self, NARG(0), size), size, js_truthy(NARG(1))); return expr; }
JS_DV_GET(n_dv_getint8, 1, JS_D((int8_t)raw))
JS_DV_GET(n_dv_getuint8, 1, JS_D((uint8_t)raw))
JS_DV_GET(n_dv_getint16, 2, JS_D((int16_t)raw))
JS_DV_GET(n_dv_getuint16, 2, JS_D((uint16_t)raw))
JS_DV_GET(n_dv_getint32, 4, JS_D((int32_t)raw))
JS_DV_GET(n_dv_getuint32, 4, JS_D((uint32_t)raw))
JS_DV_GET(n_dv_getfloat32, 4, ({ uint32_t u = (uint32_t)raw; float fl; memcpy(&fl, &u, 4); JS_D(fl); }))
JS_DV_GET(n_dv_getfloat64, 8, ({ double dd; memcpy(&dd, &raw, 8); JS_D(dd); }))
JS_DV_GET(n_dv_getbigint64, 8, JS_GV(js_big_from_i64((int64_t)raw)))
JS_DV_GET(n_dv_getbiguint64, 8, JS_GV(js_big_from_u64(raw, 0)))
#define JS_DV_SET(name, size, conv) JS_NATIVE(name) { uint8_t* p = js_dview_at(self, NARG(0), size); js_val v = NARG(1); uint64_t raw = conv; js_dview_write(p, size, js_truthy(NARG(2)), raw); return JS_U; }
JS_DV_SET(n_dv_setint8, 1, (uint64_t)(uint32_t)js_to_int32(v))
JS_DV_SET(n_dv_setuint8, 1, (uint64_t)(uint32_t)js_to_int32(v))
JS_DV_SET(n_dv_setint16, 2, (uint64_t)(uint32_t)js_to_int32(v))
JS_DV_SET(n_dv_setuint16, 2, (uint64_t)(uint32_t)js_to_int32(v))
JS_DV_SET(n_dv_setint32, 4, (uint64_t)(uint32_t)js_to_int32(v))
JS_DV_SET(n_dv_setuint32, 4, (uint64_t)(uint32_t)js_to_int32(v))
JS_DV_SET(n_dv_setfloat32, 4, ({ float fl = (float)js_to_number(v); uint32_t u; memcpy(&u, &fl, 4); (uint64_t)u; }))
JS_DV_SET(n_dv_setfloat64, 8, ({ double dd = js_to_number(v); uint64_t u; memcpy(&u, &dd, 8); u; }))
JS_DV_SET(n_dv_setbigint64, 8, js_big_low64(js_to_bigint(v)))
JS_DV_SET(n_dv_setbiguint64, 8, js_big_low64(js_to_bigint(v)))

// ---------------------------------------------------------------- Map and Set
static uint64_t js_val_hash(js_val v) {
  switch (v.t) {
    case JS_T_NUM: {
      double d = v.u.n;
      if (d == 0) d = 0;
      if (isnan(d)) return 0x7FF8000000000000ULL;
      uint64_t b; memcpy(&b, &d, 8);
      return b ^ (b >> 29) ^ 0x9E3779B97F4A7C15ULL;
    }
    case JS_T_STR: return js_str_hash(v.u.s) * 0x100000001B3ULL;
    case JS_T_BIG: { uint64_t h = (uint64_t)v.u.g->neg; for (int32_t i = 0; i < v.u.g->n; ++i) h = h * 31 + v.u.g->d[i]; return h * 0x9E3779B97F4A7C15ULL; }
    case JS_T_OBJ: { uint64_t p = (uint64_t)(uintptr_t)v.u.o; return (p >> 4) * 0x9E3779B97F4A7C15ULL; }
    case JS_T_BOOL: return 0x1234 + (uint64_t)v.u.b;
    default: return (uint64_t)v.t * 0x51ED27;
  }
}
static js_map* js_map_alloc(int kind, js_obj* proto) {
  js_map* m = (js_map*)js_alloc(sizeof(js_map));
  js_obj_init(&m->o, kind, proto);
  return m;
}
static void js_map_reindex(js_map* m) {
  int64_t cap = 16;
  while (cap < m->n * 2 + 2) cap *= 2;
  m->ix = (int64_t*)js_alloc_raw(sizeof(int64_t) * (size_t)cap);
  for (int64_t i = 0; i < cap; ++i) m->ix[i] = -1;
  m->ixcap = cap;
  for (int64_t i = 0; i < m->n; ++i) {
    if (!m->live[i]) continue;
    uint64_t j = js_val_hash(m->k[i]) & (uint64_t)(cap - 1);
    while (m->ix[j] != -1) j = (j + 1) & (uint64_t)(cap - 1);
    m->ix[j] = i;
  }
}
static int64_t js_map_find(js_map* m, js_val k) {
  if (!m->ixcap) return -1;
  uint64_t mask = (uint64_t)m->ixcap - 1, j = js_val_hash(k) & mask;
  for (;;) {
    int64_t i = m->ix[j];
    if (i == -1) return -1;
    if (i >= 0 && m->live[i] && js_same_value_zero(m->k[i], k)) return i;
    j = (j + 1) & mask;
  }
}
static void js_map_put(js_map* m, js_val k, js_val v) {
  if (k.t == JS_T_NUM && k.u.n == 0) k.u.n = 0; // -0 becomes +0
  int64_t i = js_map_find(m, k);
  if (i >= 0) { m->v[i] = v; return; }
  if (m->n == m->cap) {
    int64_t cap = m->cap ? m->cap * 2 : 8;
    js_val* nk = (js_val*)js_alloc(sizeof(js_val) * (size_t)cap);
    js_val* nv = (js_val*)js_alloc(sizeof(js_val) * (size_t)cap);
    uint8_t* nl = (uint8_t*)js_alloc_raw((size_t)cap);
    if (m->n) { memcpy(nk, m->k, sizeof(js_val) * (size_t)m->n); memcpy(nv, m->v, sizeof(js_val) * (size_t)m->n); memcpy(nl, m->live, (size_t)m->n); }
    m->k = nk; m->v = nv; m->live = nl; m->cap = cap;
  }
  i = m->n++;
  m->k[i] = k; m->v[i] = v; m->live[i] = 1; ++m->count;
  if (m->n * 2 > m->ixcap) js_map_reindex(m);
  else {
    uint64_t mask = (uint64_t)m->ixcap - 1, j = js_val_hash(k) & mask;
    while (m->ix[j] != -1) j = (j + 1) & mask;
    m->ix[j] = i;
  }
}
static int js_map_remove(js_map* m, js_val k) {
  int64_t i = js_map_find(m, k);
  if (i < 0) return 0;
  m->live[i] = 0; m->k[i] = JS_U; m->v[i] = JS_U; --m->count;
  return 1;
}
static js_map* js_this_map(js_val self, int kind, const char* name) {
  if (!js_is_kind(self, kind)) js_throw_type("Method %s called on incompatible receiver", name);
  return (js_map*)self.u.o;
}
JS_NATIVE(n_map_ctor) {
  if (nt.t == JS_T_UNDEF) js_throw_type("Constructor Map requires 'new'");
  js_map* m = js_map_alloc(K_MAP, js_proto_from(nt, js_Map_proto));
  if (NARG(0).t > JS_T_NULL) {
    js_iter it; js_val e;
    js_iter_init(&it, NARG(0));
    while (js_iter_next(&it, &e)) js_map_put(m, js_idx_get(e, 0), js_idx_get(e, 1));
  }
  return JS_O(m);
}
JS_NATIVE(n_map_get) { js_map* m = js_this_map(self, K_MAP, "Map.prototype.get"); int64_t i = js_map_find(m, NARG(0)); return i >= 0 ? m->v[i] : JS_U; }
JS_NATIVE(n_map_set) { js_map_put(js_this_map(self, K_MAP, "Map.prototype.set"), NARG(0), NARG(1)); return self; }
JS_NATIVE(n_map_has) { return JS_B(js_map_find(js_this_map(self, self.t == JS_T_OBJ && self.u.o->kind == K_SET ? K_SET : K_MAP, "has"), NARG(0)) >= 0); }
JS_NATIVE(n_map_delete) { return JS_B(js_map_remove(js_this_map(self, self.t == JS_T_OBJ && self.u.o->kind == K_SET ? K_SET : K_MAP, "delete"), NARG(0))); }
JS_NATIVE(n_map_clear) {
  js_map* m = js_this_map(self, self.t == JS_T_OBJ && self.u.o->kind == K_SET ? K_SET : K_MAP, "clear");
  for (int64_t i = 0; i < m->n; ++i) { m->live[i] = 0; m->k[i] = JS_U; m->v[i] = JS_U; }
  m->count = 0;
  return JS_U;
}
JS_NATIVE(n_map_foreach) {
  int kind = self.t == JS_T_OBJ && self.u.o->kind == K_SET ? K_SET : K_MAP;
  js_map* m = js_this_map(self, kind, "forEach");
  js_need_callable(NARG(0), "forEach callback");
  for (int64_t i = 0; i < m->n; ++i) {
    if (!m->live[i]) continue;
    js_val args[3] = { kind == K_SET ? m->k[i] : m->v[i], m->k[i], self };
    js_call(NARG(0), NARG(1), 3, args);
  }
  return JS_U;
}
JS_NATIVE(n_map_keys) { return js_iterobj_new(self, 0); }
JS_NATIVE(n_map_values) { return js_iterobj_new(self, self.t == JS_T_OBJ && self.u.o->kind == K_SET ? 0 : 1); }
JS_NATIVE(n_map_entries) { return js_iterobj_new(self, 2); }
JS_NATIVE(n_set_ctor) {
  if (nt.t == JS_T_UNDEF) js_throw_type("Constructor Set requires 'new'");
  js_map* m = js_map_alloc(K_SET, js_proto_from(nt, js_Set_proto));
  if (NARG(0).t > JS_T_NULL) {
    js_iter it; js_val e;
    js_iter_init(&it, NARG(0));
    while (js_iter_next(&it, &e)) js_map_put(m, e, JS_U);
  }
  return JS_O(m);
}
JS_NATIVE(n_set_add) { js_map_put(js_this_map(self, K_SET, "Set.prototype.add"), NARG(0), JS_U); return self; }

// ---------------------------------------------------------------- String
static js_str* js_this_str(js_val self, const char* name) {
  if (self.t == JS_T_STR) return self.u.s;
  if (self.t <= JS_T_NULL) js_throw_type("String.prototype.%s called on null or undefined", name);
  return js_to_str(self);
}
JS_NATIVE(n_string_fn) {
  if (argc == 0) return JS_SV(A_empty);
  return JS_SV(js_to_str(argv[0]));
}
JS_NATIVE(n_string_fromcharcode) {
  js_str* s = js_str_alloc(argc, argc);
  for (int i = 0; i < argc; ++i) s->d[i] = (uint16_t)js_to_uint32(argv[i]);
  return JS_SV(s);
}
JS_NATIVE(n_string_fromcodepoint) {
  js_str* s = js_str_alloc(0, 2 * argc + 1);
  int32_t k = 0;
  for (int i = 0; i < argc; ++i) {
    double d = js_to_number(argv[i]);
    if (!(d >= 0 && d <= 0x10FFFF && d == trunc(d))) js_throw_range("Invalid code point %s", js_cstr(js_to_str(argv[i])));
    uint32_t c = (uint32_t)d;
    if (c >= 0x10000) { c -= 0x10000; s->d[k++] = (uint16_t)(0xD800 + (c >> 10)); s->d[k++] = (uint16_t)(0xDC00 + (c & 0x3FF)); }
    else s->d[k++] = (uint16_t)c;
  }
  s->len = k; s->buf->used = k;
  return JS_SV(s);
}
JS_NATIVE(n_str_charat) {
  js_str* s = js_this_str(self, "charAt");
  double i = js_to_integer(NARG(0));
  return i >= 0 && i < s->len ? JS_SV(js_str_char(s->d[(int64_t)i])) : JS_SV(A_empty);
}
JS_NATIVE(n_str_charcodeat) {
  js_str* s = js_this_str(self, "charCodeAt");
  double i = js_to_integer(NARG(0));
  return i >= 0 && i < s->len ? JS_D(s->d[(int64_t)i]) : JS_D(NAN);
}
JS_NATIVE(n_str_codepointat) {
  js_str* s = js_this_str(self, "codePointAt");
  double d = js_to_integer(NARG(0));
  if (!(d >= 0 && d < s->len)) return JS_U;
  int32_t i = (int32_t)d;
  uint16_t c = s->d[i];
  if (c >= 0xD800 && c < 0xDC00 && i + 1 < s->len && s->d[i + 1] >= 0xDC00 && s->d[i + 1] < 0xE000)
    return JS_D(0x10000 + ((c - 0xD800) << 10) + (s->d[i + 1] - 0xDC00));
  return JS_D(c);
}
JS_NATIVE(n_str_at) {
  js_str* s = js_this_str(self, "at");
  double i = js_to_integer(NARG(0));
  if (i < 0) i += s->len;
  return i >= 0 && i < s->len ? JS_SV(js_str_char(s->d[(int64_t)i])) : JS_U;
}
static int32_t js_str_find(js_str* s, js_str* p, int32_t from) {
  if (from < 0) from = 0;
  for (int32_t i = from; i + p->len <= s->len; ++i)
    if (!memcmp(s->d + i, p->d, 2 * (size_t)p->len)) return i;
  return -1;
}
JS_NATIVE(n_str_indexof) {
  js_str* s = js_this_str(self, "indexOf");
  js_str* p = js_to_str(NARG(0));
  double from = js_to_integer(NARG(1));
  if (from > s->len) from = s->len;
  return JS_D(js_str_find(s, p, (int32_t)from));
}
JS_NATIVE(n_str_lastindexof) {
  js_str* s = js_this_str(self, "lastIndexOf");
  js_str* p = js_to_str(NARG(0));
  double fd = NARG(1).t == JS_T_UNDEF ? INFINITY : js_to_number(NARG(1));
  int32_t from = isnan(fd) || fd > s->len - p->len ? s->len - p->len : fd < 0 ? 0 : (int32_t)fd;
  for (int32_t i = from; i >= 0; --i) if (!memcmp(s->d + i, p->d, 2 * (size_t)p->len)) return JS_D(i);
  return JS_D(-1);
}
JS_NATIVE(n_str_includes) {
  js_str* s = js_this_str(self, "includes");
  if (js_is_kind(NARG(0), K_REGEXP)) js_throw_type("First argument to String.prototype.includes must not be a regular expression");
  double from = js_to_integer(NARG(1));
  return JS_B(js_str_find(s, js_to_str(NARG(0)), (int32_t)(from > s->len ? s->len : from)) >= 0);
}
JS_NATIVE(n_str_startswith) {
  js_str* s = js_this_str(self, "startsWith");
  js_str* p = js_to_str(NARG(0));
  double pos = js_to_integer(NARG(1));
  int32_t at = pos < 0 ? 0 : pos > s->len ? s->len : (int32_t)pos;
  return JS_B(at + p->len <= s->len && !memcmp(s->d + at, p->d, 2 * (size_t)p->len));
}
JS_NATIVE(n_str_endswith) {
  js_str* s = js_this_str(self, "endsWith");
  js_str* p = js_to_str(NARG(0));
  double e = NARG(1).t == JS_T_UNDEF ? s->len : js_to_integer(NARG(1));
  int32_t end = e < 0 ? 0 : e > s->len ? s->len : (int32_t)e;
  int32_t at = end - p->len;
  return JS_B(at >= 0 && !memcmp(s->d + at, p->d, 2 * (size_t)p->len));
}
JS_NATIVE(n_str_slice) {
  js_str* s = js_this_str(self, "slice");
  int64_t a = js_rel_index(NARG(0), s->len, 0), b = js_rel_index(NARG(1), s->len, s->len);
  return JS_SV(js_str_sub(s, (int32_t)a, (int32_t)b));
}
JS_NATIVE(n_str_substring) {
  js_str* s = js_this_str(self, "substring");
  double a = js_to_integer(NARG(0)), b = NARG(1).t == JS_T_UNDEF ? s->len : js_to_integer(NARG(1));
  a = a < 0 ? 0 : a > s->len ? s->len : a;
  b = b < 0 ? 0 : b > s->len ? s->len : b;
  if (a > b) { double t = a; a = b; b = t; }
  return JS_SV(js_str_sub(s, (int32_t)a, (int32_t)b));
}
JS_NATIVE(n_str_substr) {
  js_str* s = js_this_str(self, "substr");
  double a = js_to_integer(NARG(0));
  if (a < 0) { a += s->len; if (a < 0) a = 0; }
  if (a > s->len) a = s->len;
  double n = NARG(1).t == JS_T_UNDEF ? s->len - a : js_to_integer(NARG(1));
  if (n < 0) n = 0;
  if (a + n > s->len) n = s->len - a;
  return JS_SV(js_str_sub(s, (int32_t)a, (int32_t)(a + n)));
}
static uint16_t js_upper(uint16_t c) {
  if (c >= 'a' && c <= 'z') return (uint16_t)(c - 32);
  if (c < 0x80) return c;
  if (c == 0xB5) return 0x39C;
  if ((c >= 0xE0 && c <= 0xFE && c != 0xF7)) return (uint16_t)(c - 32);
  if (c == 0xFF) return 0x178;
  if (c >= 0x100 && c <= 0x17F && c != 0x130 && c != 0x131 && c != 0x138 && c != 0x149 && c != 0x17F) {
    if ((c >= 0x139 && c <= 0x148) || (c >= 0x179 && c <= 0x17E)) return (c & 1) ? c : (uint16_t)(c - 1);
    return (c & 1) ? (uint16_t)(c - 1) : c;
  }
  if (c >= 0x3B1 && c <= 0x3C9 && c != 0x3C2) return (uint16_t)(c - 32);
  if (c >= 0x430 && c <= 0x44F) return (uint16_t)(c - 32);
  if (c >= 0x450 && c <= 0x45F) return (uint16_t)(c - 80);
  return c;
}
static uint16_t js_lower(uint16_t c) {
  if (c >= 'A' && c <= 'Z') return (uint16_t)(c + 32);
  if (c < 0x80) return c;
  if (c >= 0xC0 && c <= 0xDE && c != 0xD7) return (uint16_t)(c + 32);
  if (c == 0x178) return 0xFF;
  if (c >= 0x100 && c <= 0x17F && c != 0x130 && c != 0x131 && c != 0x138 && c != 0x149 && c != 0x17F) {
    if ((c >= 0x139 && c <= 0x148) || (c >= 0x179 && c <= 0x17E)) return (c & 1) ? (uint16_t)(c + 1) : c;
    return (c & 1) ? c : (uint16_t)(c + 1);
  }
  if (c >= 0x391 && c <= 0x3A9 && c != 0x3A2) return (uint16_t)(c + 32);
  if (c >= 0x410 && c <= 0x42F) return (uint16_t)(c + 32);
  if (c >= 0x400 && c <= 0x40F) return (uint16_t)(c + 80);
  return c;
}
JS_NATIVE(n_str_toupper) {
  js_str* s = js_this_str(self, "toUpperCase");
  js_str* r = js_str_alloc(s->len, s->len);
  for (int32_t i = 0; i < s->len; ++i) r->d[i] = js_upper(s->d[i]);
  return JS_SV(r);
}
JS_NATIVE(n_str_tolower) {
  js_str* s = js_this_str(self, "toLowerCase");
  js_str* r = js_str_alloc(s->len, s->len);
  for (int32_t i = 0; i < s->len; ++i) r->d[i] = js_lower(s->d[i]);
  return JS_SV(r);
}
static js_val js_trim(js_val self, int start, int end) {
  js_str* s = js_this_str(self, "trim");
  int32_t a = 0, b = s->len;
  if (start) while (a < b && js_is_ws(s->d[a])) ++a;
  if (end) while (b > a && js_is_ws(s->d[b - 1])) --b;
  return JS_SV(js_str_sub(s, a, b));
}
JS_NATIVE(n_str_trim) { return js_trim(self, 1, 1); }
JS_NATIVE(n_str_trimstart) { return js_trim(self, 1, 0); }
JS_NATIVE(n_str_trimend) { return js_trim(self, 0, 1); }
static js_val js_pad(js_val self, int argc, js_val* argv, int at_start) {
  js_str* s = js_this_str(self, "pad");
  double target = js_to_integer(NARG(0));
  js_str* fill = NARG(1).t == JS_T_UNDEF ? js_str_char(' ') : js_to_str(NARG(1));
  if (target <= s->len || !fill->len) return JS_SV(s);
  int32_t n = (int32_t)target - s->len;
  js_str* pad = js_str_alloc(n, n);
  for (int32_t i = 0; i < n; ++i) pad->d[i] = fill->d[i % fill->len];
  return JS_SV(at_start ? js_str_concat(pad, s) : js_str_concat(js_str_concat(js_str_new(NULL, 0), s), pad));
}
JS_NATIVE(n_str_padstart) { return js_pad(self, argc, argv, 1); }
JS_NATIVE(n_str_padend) { return js_pad(self, argc, argv, 0); }
JS_NATIVE(n_str_repeat) {
  js_str* s = js_this_str(self, "repeat");
  double n = js_to_integer(NARG(0));
  if (n < 0 || isinf(n)) js_throw_range("Invalid count value: %s", js_cstr(js_to_str(NARG(0))));
  if ((double)s->len * n > 536870888.0) js_throw_range("Invalid string length");
  int32_t k = (int32_t)n;
  js_str* r = js_str_alloc(s->len * k, s->len * k);
  for (int32_t i = 0; i < k; ++i) memcpy(r->d + (size_t)i * s->len, s->d, 2 * (size_t)s->len);
  return JS_SV(r);
}
JS_NATIVE(n_str_concat) {
  js_str* s = js_this_str(self, "concat");
  for (int i = 0; i < argc; ++i) s = js_str_concat(s, js_to_str(argv[i]));
  return JS_SV(s);
}
JS_NATIVE(n_str_localecompare) {
  int c = js_str_cmp(js_this_str(self, "localeCompare"), js_to_str(NARG(0)));
  return JS_D(c);
}
JS_NATIVE(n_str_tostring) { if (self.t != JS_T_STR) js_throw_type("String.prototype.toString requires that 'this' be a String"); return self; }
JS_NATIVE(n_str_normalize) { return JS_SV(js_this_str(self, "normalize")); }
JS_NATIVE(n_str_iterator) { return js_iterobj_new(JS_SV(js_this_str(self, "iterator")), 1); }
static js_val js_regexp_split(js_val re, js_str* s, int64_t limit);
static js_val js_regexp_replace(js_val re, js_str* s, js_val with, int all);
static js_val js_regexp_match(js_val re, js_str* s);
static js_val js_regexp_search(js_val re, js_str* s);
JS_NATIVE(n_str_split) {
  js_str* s = js_this_str(self, "split");
  js_val sep = NARG(0);
  int64_t limit = NARG(1).t == JS_T_UNDEF ? 4294967295LL : (int64_t)js_to_uint32(NARG(1));
  if (js_is_kind(sep, K_REGEXP)) return js_regexp_split(sep, s, limit);
  js_arr* r = js_arr_alloc(0, 8);
  if (!limit) return JS_O(r);
  if (sep.t == JS_T_UNDEF) { js_arr_push1(r, JS_SV(s)); return JS_O(r); }
  js_str* p = js_to_str(sep);
  if (!p->len) {
    for (int32_t i = 0; i < s->len && r->len < limit; ++i) js_arr_push1(r, JS_SV(js_str_char(s->d[i])));
    return JS_O(r);
  }
  int32_t start = 0;
  for (;;) {
    int32_t at = js_str_find(s, p, start);
    if (at < 0) break;
    js_arr_push1(r, JS_SV(js_str_sub(s, start, at)));
    if (r->len >= limit) return JS_O(r);
    start = at + p->len;
  }
  js_arr_push1(r, JS_SV(js_str_sub(s, start, s->len)));
  return JS_O(r);
}
/** GetSubstitution for a string pattern match ($$, $&, the prefix and suffix patterns) */
static js_str* js_substitute(js_str* matched, js_str* s, int32_t pos, js_str* repl, js_val* groups, int ngroups) {
  js_str* out = js_str_new(NULL, 0);
  for (int32_t i = 0; i < repl->len; ++i) {
    uint16_t c = repl->d[i];
    if (c == '$' && i + 1 < repl->len) {
      uint16_t n = repl->d[i + 1];
      if (n == '$') { out = js_str_concat(out, js_str_char('$')); ++i; continue; }
      if (n == '&') { out = js_str_concat(out, matched); ++i; continue; }
      if (n == 0x60) { out = js_str_concat(out, js_str_sub(s, 0, pos)); ++i; continue; }
      if (n == '\'') { out = js_str_concat(out, js_str_sub(s, pos + matched->len, s->len)); ++i; continue; }
      if (n >= '0' && n <= '9' && ngroups > 0) {
        int g = n - '0', used = 2;
        if (i + 2 < repl->len && repl->d[i + 2] >= '0' && repl->d[i + 2] <= '9' && g * 10 + (repl->d[i + 2] - '0') <= ngroups) { g = g * 10 + (repl->d[i + 2] - '0'); used = 3; }
        if (g >= 1 && g <= ngroups) {
          if (groups[g - 1].t == JS_T_STR) out = js_str_concat(out, groups[g - 1].u.s);
          i += used - 1; continue;
        }
      }
    }
    out = js_str_concat(out, js_str_char(c));
  }
  return out;
}
static js_val js_str_replace(js_val self, int argc, js_val* argv, int all) {
  js_str* s = js_this_str(self, "replace");
  js_val pat = NARG(0), with = NARG(1);
  if (js_is_kind(pat, K_REGEXP)) return js_regexp_replace(pat, s, with, all);
  js_str* p = js_to_str(pat);
  js_str* out = js_str_new(NULL, 0);
  int32_t start = 0, pos;
  int any = 0;
  while ((pos = js_str_find(s, p, start)) >= 0 || (p->len == 0 && start <= s->len && !any)) {
    if (pos < 0) pos = start;
    out = js_str_concat(out, js_str_sub(s, start, pos));
    js_str* rep;
    if (js_is_callable(with)) { js_val args[3] = { JS_SV(p), JS_D(pos), JS_SV(s) }; rep = js_to_str(js_call(with, JS_U, 3, args)); }
    else rep = js_substitute(p, s, pos, js_to_str(with), NULL, 0);
    out = js_str_concat(out, rep);
    any = 1;
    if (p->len == 0) {
      if (pos < s->len) out = js_str_concat(out, js_str_char(s->d[pos]));
      start = pos + 1;
      if (!all || start > s->len) break;
      if (start == s->len) { out = js_str_concat(out, js_str_sub(s, 0, 0)); }
      continue;
    }
    start = pos + p->len;
    if (!all) break;
  }
  if (start < s->len) out = js_str_concat(out, js_str_sub(s, start, s->len));
  return JS_SV(out);
}
JS_NATIVE(n_str_replace) { return js_str_replace(self, argc, argv, 0); }
JS_NATIVE(n_str_replaceall) { return js_str_replace(self, argc, argv, 1); }
static js_val js_regexp_new_val(js_str* src, js_str* flags);
JS_NATIVE(n_str_match) {
  js_str* s = js_this_str(self, "match");
  js_val re = NARG(0);
  if (!js_is_kind(re, K_REGEXP)) re = js_regexp_new_val(re.t == JS_T_UNDEF ? A_empty : js_to_str(re), A_empty);
  return js_regexp_match(re, s);
}
JS_NATIVE(n_str_search) {
  js_str* s = js_this_str(self, "search");
  js_val re = NARG(0);
  if (!js_is_kind(re, K_REGEXP)) re = js_regexp_new_val(re.t == JS_T_UNDEF ? A_empty : js_to_str(re), A_empty);
  return js_regexp_search(re, s);
}

// ---------------------------------------------------------------- Number, Boolean, BigInt
JS_NATIVE(n_number_fn) {
  if (argc == 0) return JS_D(0);
  js_val v = js_to_numeric(argv[0]);
  return v.t == JS_T_BIG ? JS_D(js_big_to_double(v.u.g)) : v;
}
static double js_this_num(js_val self) {
  if (self.t == JS_T_NUM) return self.u.n;
  js_throw_type("Number.prototype method called on an incompatible receiver");
}
JS_NATIVE(n_num_tostring) {
  double x = js_this_num(self);
  int radix = NARG(0).t == JS_T_UNDEF ? 10 : (int)js_to_integer(NARG(0));
  if (radix < 2 || radix > 36) js_throw_range("toString() radix must be between 2 and 36");
  return JS_SV(js_num_to_radix(x, radix));
}
JS_NATIVE(n_num_tofixed) {
  double x = js_this_num(self);
  double fd = js_to_integer(NARG(0));
  if (fd < 0 || fd > 100) js_throw_range("toFixed() digits argument must be between 0 and 100");
  if (isnan(x)) return JS_S(u"NaN");
  if (fabs(x) >= 1e21 || isinf(x)) return JS_SV(js_num_to_str(x));
  int d = (int)fd;
  // exact decimal expansion, rounded half up (away from zero) as the spec's "larger n"
  char buf[1200];
  snprintf(buf, sizeof buf, "%.*f", d + 30, fabs(x));
  char* dot = strchr(buf, '.');
  int ip = (int)(dot - buf);
  char digits[1200]; int nd = 0;
  for (char* c = buf; *c; ++c) if (*c != '.') digits[nd++] = *c;
  int keep = ip + d;
  int roundup = digits[keep] >= '5';
  digits[keep] = 0;
  if (roundup) {
    int i = keep - 1;
    while (i >= 0) { if (digits[i] == '9') { digits[i] = '0'; --i; } else { ++digits[i]; break; } }
    if (i < 0) { memmove(digits + 1, digits, (size_t)keep + 1); digits[0] = '1'; ++ip; ++keep; }
  }
  char out[1300]; int k = 0;
  int neg = x < 0;
  int allzero = 1;
  for (int i = 0; i < keep; ++i) if (digits[i] != '0') allzero = 0;
  if (neg && !allzero) out[k++] = '-';
  for (int i = 0; i < ip; ++i) out[k++] = digits[i];
  if (ip == 0) out[k++] = '0';
  if (d > 0) { out[k++] = '.'; for (int i = ip; i < keep; ++i) out[k++] = digits[i]; }
  out[k] = 0;
  return JS_SV(js_str_c(out));
}
JS_NATIVE(n_num_toprecision) {
  double x = js_this_num(self);
  if (NARG(0).t == JS_T_UNDEF) return JS_SV(js_num_to_str(x));
  int p = (int)js_to_integer(NARG(0));
  if (p < 1 || p > 100) js_throw_range("toPrecision() argument must be between 1 and 100");
  if (!isfinite(x)) return JS_SV(js_num_to_str(x));
  char buf[256];
  snprintf(buf, sizeof buf, "%.*e", p - 1, x);
  int e = atoi(strchr(buf, 'e') + 1);
  if (e < -6 || e >= p) {
    char* ep = strchr(buf, 'e');
    char out[300]; int k = (int)(ep - buf);
    memcpy(out, buf, (size_t)k);
    k += snprintf(out + k, sizeof out - (size_t)k, "e%c%d", e >= 0 ? '+' : '-', abs(e));
    out[k] = 0;
    return JS_SV(js_str_c(out));
  }
  snprintf(buf, sizeof buf, "%.*f", p - 1 - e > 0 ? p - 1 - e : 0, x);
  return JS_SV(js_str_c(buf));
}
JS_NATIVE(n_num_valueof) { return JS_D(js_this_num(self)); }
JS_NATIVE(n_number_isinteger) { js_val v = NARG(0); return JS_B(v.t == JS_T_NUM && isfinite(v.u.n) && v.u.n == trunc(v.u.n)); }
JS_NATIVE(n_number_issafe) { js_val v = NARG(0); return JS_B(v.t == JS_T_NUM && isfinite(v.u.n) && v.u.n == trunc(v.u.n) && fabs(v.u.n) <= 9007199254740991.0); }
JS_NATIVE(n_number_isfinite) { js_val v = NARG(0); return JS_B(v.t == JS_T_NUM && isfinite(v.u.n)); }
JS_NATIVE(n_number_isnan) { js_val v = NARG(0); return JS_B(v.t == JS_T_NUM && isnan(v.u.n)); }
JS_NATIVE(n_parseint) {
  js_str* s = js_to_str(NARG(0));
  int radix = (int)js_to_int32(NARG(1));
  return JS_D(js_parse_int(s, radix));
}
JS_NATIVE(n_parsefloat) { return JS_D(js_parse_float(js_to_str(NARG(0)))); }
JS_NATIVE(n_isnan) { return JS_B(isnan(js_to_number(NARG(0)))); }
JS_NATIVE(n_isfinite) { return JS_B(isfinite(js_to_number(NARG(0)))); }
JS_NATIVE(n_boolean_fn) { return JS_B(js_truthy(NARG(0))); }
JS_NATIVE(n_bool_tostring) { return JS_SV(self.t == JS_T_BOOL && self.u.b ? A_true : A_false); }
JS_NATIVE(n_bool_valueof) { return self; }
JS_NATIVE(n_bigint_fn) {
  if (nt.t != JS_T_UNDEF) js_throw_type("BigInt is not a constructor");
  js_val v = js_to_primitive(NARG(0), 0);
  if (v.t == JS_T_NUM) return JS_GV(js_big_from_double(v.u.n));
  return JS_GV(js_to_bigint(v));
}
JS_NATIVE(n_bigint_asuintn) { double b = js_to_integer(NARG(0)); return JS_GV(js_big_as_uint((int64_t)b, js_to_bigint(NARG(1)))); }
JS_NATIVE(n_bigint_asintn) { double b = js_to_integer(NARG(0)); return JS_GV(js_big_as_int((int64_t)b, js_to_bigint(NARG(1)))); }
JS_NATIVE(n_big_tostring) {
  if (self.t != JS_T_BIG) js_throw_type("BigInt.prototype.toString requires that 'this' be a BigInt");
  int radix = NARG(0).t == JS_T_UNDEF ? 10 : (int)js_to_integer(NARG(0));
  if (radix < 2 || radix > 36) js_throw_range("toString() radix must be between 2 and 36");
  return JS_SV(js_big_to_str(self.u.g, radix));
}
JS_NATIVE(n_big_valueof) { return self; }

// ---------------------------------------------------------------- Math
#define JS_MATH1(name, expr) JS_NATIVE(name) { double x = js_to_number(NARG(0)); return JS_D(expr); }
JS_MATH1(n_math_abs, fabs(x))
JS_MATH1(n_math_acos, acos(x))
JS_MATH1(n_math_acosh, acosh(x))
JS_MATH1(n_math_asin, asin(x))
JS_MATH1(n_math_asinh, asinh(x))
JS_MATH1(n_math_atan, atan(x))
JS_MATH1(n_math_atanh, atanh(x))
JS_MATH1(n_math_cbrt, cbrt(x))
JS_MATH1(n_math_ceil, ceil(x))
JS_MATH1(n_math_cos, cos(x))
JS_MATH1(n_math_cosh, cosh(x))
JS_MATH1(n_math_exp, exp(x))
JS_MATH1(n_math_expm1, expm1(x))
JS_MATH1(n_math_floor, floor(x))
JS_MATH1(n_math_fround, (double)(float)x)
JS_MATH1(n_math_log, log(x))
JS_MATH1(n_math_log1p, log1p(x))
JS_MATH1(n_math_log10, log10(x))
JS_MATH1(n_math_log2, log2(x))
JS_MATH1(n_math_sin, sin(x))
JS_MATH1(n_math_sinh, sinh(x))
JS_MATH1(n_math_sqrt, sqrt(x))
JS_MATH1(n_math_tan, tan(x))
JS_MATH1(n_math_tanh, tanh(x))
JS_MATH1(n_math_trunc, trunc(x))
JS_MATH1(n_math_sign, isnan(x) ? NAN : x > 0 ? 1 : x < 0 ? -1 : x)
JS_MATH1(n_math_clz32, ({ uint32_t u = js_d2u32(x); u ? __builtin_clz(u) : 32; }))
static double js_round(double x) {
  if (!isfinite(x) || x == 0) return x;
  if (x > 0 && x < 0.5) return 0;
  if (x < 0 && x >= -0.5) return -0.0;
  double r = floor(x);
  if (x - r >= 0.5) r += 1;
  return r;
}
JS_MATH1(n_math_round, js_round(x))
JS_NATIVE(n_math_atan2) { return JS_D(atan2(js_to_number(NARG(0)), js_to_number(NARG(1)))); }
JS_NATIVE(n_math_pow) { return JS_D(js_pow_num(js_to_number(NARG(0)), js_to_number(NARG(1)))); }
JS_NATIVE(n_math_imul) { return JS_D((int32_t)((uint32_t)js_to_int32(NARG(0)) * (uint32_t)js_to_int32(NARG(1)))); }
JS_NATIVE(n_math_max) {
  double r = -INFINITY;
  for (int i = 0; i < argc; ++i) { double x = js_to_number(argv[i]); if (isnan(x)) r = NAN; else if (!isnan(r) && (x > r || (x == 0 && r == 0 && !signbit(x)))) r = x; }
  return JS_D(r);
}
JS_NATIVE(n_math_min) {
  double r = INFINITY;
  for (int i = 0; i < argc; ++i) { double x = js_to_number(argv[i]); if (isnan(x)) r = NAN; else if (!isnan(r) && (x < r || (x == 0 && r == 0 && signbit(x)))) r = x; }
  return JS_D(r);
}
JS_NATIVE(n_math_hypot) {
  double s = 0; int inf = 0, nan = 0;
  for (int i = 0; i < argc; ++i) { double x = js_to_number(argv[i]); if (isinf(x)) inf = 1; else if (isnan(x)) nan = 1; else s = hypot(s, x); }
  return JS_D(inf ? INFINITY : nan ? NAN : s);
}
static uint64_t js_rng_state[2] = { 0x9E3779B97F4A7C15ULL, 0xBF58476D1CE4E5B9ULL };
JS_NATIVE(n_math_random) {
  uint64_t s1 = js_rng_state[0], s0 = js_rng_state[1];
  js_rng_state[0] = s0; s1 ^= s1 << 23;
  js_rng_state[1] = s1 ^ s0 ^ (s1 >> 17) ^ (s0 >> 26);
  return JS_D((double)((js_rng_state[1] + s0) >> 11) / 9007199254740992.0);
}

// ---------------------------------------------------------------- Error
static js_val js_error_construct(js_obj* proto, js_val self, int argc, js_val* argv, js_val nt) {
  js_obj* o;
  if (self.t == JS_T_OBJ) o = self.u.o;
  else o = js_obj_new(js_proto_from(nt, proto));
  js_val msg = NARG(0);
  if (msg.t != JS_T_UNDEF) js_define(o, A_message, JS_SV(js_to_str(msg)), P_HIDDEN);
  js_val opts = NARG(1);
  if (opts.t == JS_T_OBJ && js_has_property(opts, A_cause)) js_define(o, A_cause, js_get(opts, A_cause), P_HIDDEN);
  js_val name = js_get(JS_O(o), A_name);
  js_val m = js_get(JS_O(o), A_message);
  js_str* head = name.t == JS_T_STR ? name.u.s : js_str_c("Error");
  if (m.t == JS_T_STR && m.u.s->len) head = js_str_concat(js_str_concat(head, js_str_c(": ")), m.u.s);
  js_define(o, A_stack, JS_SV(js_str_concat(head, js_str_c("\n    at <transpiled C>"))), P_HIDDEN);
  return JS_O(o);
}
JS_NATIVE(n_error_ctor) { return js_error_construct(js_Error_proto, self, argc, argv, nt); }
JS_NATIVE(n_typeerror_ctor) { return js_error_construct(js_TypeError_proto, self, argc, argv, nt); }
JS_NATIVE(n_rangeerror_ctor) { return js_error_construct(js_RangeError_proto, self, argc, argv, nt); }
JS_NATIVE(n_referror_ctor) { return js_error_construct(js_ReferenceError_proto, self, argc, argv, nt); }
JS_NATIVE(n_syntaxerror_ctor) { return js_error_construct(js_SyntaxError_proto, self, argc, argv, nt); }
JS_NATIVE(n_evalerror_ctor) { return js_error_construct(js_EvalError_proto, self, argc, argv, nt); }
JS_NATIVE(n_urierror_ctor) { return js_error_construct(js_URIError_proto, self, argc, argv, nt); }
JS_NATIVE(n_error_tostring) {
  if (self.t != JS_T_OBJ) js_throw_type("Error.prototype.toString requires that 'this' be an Object");
  js_val name = js_get(self, A_name), msg = js_get(self, A_message);
  js_str* n = name.t == JS_T_UNDEF ? js_str_c("Error") : js_to_str(name);
  js_str* m = msg.t == JS_T_UNDEF ? A_empty : js_to_str(msg);
  if (!n->len) return JS_SV(m);
  if (!m->len) return JS_SV(n);
  return JS_SV(js_str_concat(js_str_concat(n, js_str_c(": ")), m));
}

// ---------------------------------------------------------------- crypto.getRandomValues
static uint64_t js_entropy_state;
static uint64_t js_entropy_next(void) {
  if (!js_entropy_state) {
    struct timespec ts; timespec_get(&ts, TIME_UTC);
    js_entropy_state = ((uint64_t)ts.tv_sec * 1000000007ULL) ^ (uint64_t)ts.tv_nsec ^ (uint64_t)(uintptr_t)&ts ^ (uint64_t)clock() << 32;
  }
  uint64_t z = (js_entropy_state += 0x9E3779B97F4A7C15ULL);
  z = (z ^ (z >> 30)) * 0xBF58476D1CE4E5B9ULL;
  z = (z ^ (z >> 27)) * 0x94D049BB133111EBULL;
  return z ^ (z >> 31);
}
JS_NATIVE(n_crypto_getrandomvalues) {
  js_val a = NARG(0);
  if (!js_is_kind(a, K_TYPED)) js_throw_type("The data argument must be an integer-type TypedArray");
  js_typed* t = js_as_typed(a);
  int64_t n = t->len * js_ta_size[t->tk];
  uint8_t* p = t->buf->data + t->off;
  for (int64_t i = 0; i < n; ++i) p[i] = (uint8_t)(js_entropy_next() >> 56);
  return a;
}

// ---------------------------------------------------------------- TextEncoder, TextDecoder (UTF-8)
static js_obj* js_TextEncoder_proto;
static js_obj* js_TextDecoder_proto;
JS_NATIVE(n_textencoder_ctor) { return JS_O(js_obj_new(js_proto_from(nt, js_TextEncoder_proto))); }
JS_NATIVE(n_textdecoder_ctor) { return JS_O(js_obj_new(js_proto_from(nt, js_TextDecoder_proto))); }
JS_NATIVE(n_textencoder_encode) {
  js_str* s = NARG(0).t == JS_T_UNDEF ? A_empty : js_to_str(NARG(0));
  char* u = js_str_utf8z(s);
  size_t n = strlen(u);
  // a lone surrogate is U+FFFD, as js_str_utf8z spells it; NUL characters are kept
  int nul = 0;
  for (int32_t i = 0; i < s->len; ++i) if (!s->d[i]) nul = 1;
  if (nul) {
    js_arr* bytes = js_arr_alloc(0, s->len * 3);
    for (int32_t i = 0; i < s->len; ++i) {
      js_str* one = js_str_sub(s, i, i + 1);
      if (s->d[i] >= 0xD800 && s->d[i] < 0xDC00 && i + 1 < s->len) one = js_str_sub(s, i, i + 2);
      if (one->len == 2) ++i;
      if (!one->d[0]) { js_arr_push1(bytes, JS_D(0)); continue; }
      char* b = js_str_utf8z(one);
      for (char* c = b; *c; ++c) js_arr_push1(bytes, JS_D((uint8_t)*c));
    }
    return js_typed_from_values(TA_U8, JS_O(bytes));
  }
  js_val r = js_typed_alloc(TA_U8, (int64_t)n);
  memcpy(js_as_typed(r)->buf->data, u, n);
  return r;
}
JS_NATIVE(n_textdecoder_decode) {
  js_val src = NARG(0);
  int64_t n = src.t <= JS_T_NULL ? 0 : js_len_of(src);
  uint8_t* b = (uint8_t*)js_alloc_raw((size_t)n + 1);
  if (js_is_kind(src, K_ABUF)) memcpy(b, ((js_abuf*)src.u.o)->data, (size_t)n);
  else for (int64_t i = 0; i < n; ++i) b[i] = (uint8_t)js_to_int32(js_idx_get(src, i));
  js_str* s = js_str_alloc(0, (int32_t)n + 1);
  int32_t k = 0;
  for (int64_t i = 0; i < n;) {
    uint32_t c = b[i];
    int extra = c >= 0xF0 && c < 0xF8 ? 3 : c >= 0xE0 && c < 0xF0 ? 2 : c >= 0xC2 && c < 0xE0 ? 1 : c < 0x80 ? 0 : -1;
    if (extra < 0) { s->d[k++] = 0xFFFD; ++i; continue; }
    uint32_t cp = extra ? c & (0x3F >> extra) : c;
    int ok = 1;
    for (int e = 1; e <= extra; ++e) { if (i + e >= n || (b[i + e] & 0xC0) != 0x80) { ok = 0; break; } cp = (cp << 6) | (b[i + e] & 0x3F); }
    if (ok && extra == 2 && (cp < 0x800 || (cp >= 0xD800 && cp < 0xE000))) ok = 0;
    if (ok && extra == 3 && (cp < 0x10000 || cp > 0x10FFFF)) ok = 0;
    if (!ok) { s->d[k++] = 0xFFFD; ++i; continue; }
    if (cp >= 0x10000) { cp -= 0x10000; s->d[k++] = (uint16_t)(0xD800 + (cp >> 10)); s->d[k++] = (uint16_t)(0xDC00 + (cp & 0x3FF)); }
    else s->d[k++] = (uint16_t)cp;
    i += extra + 1;
  }
  s->len = k; s->buf->used = k;
  return JS_SV(s);
}

// ---------------------------------------------------------------- console, time
static js_str* js_inspect(js_val v, int depth);
static js_str* js_inspect(js_val v, int depth) {
  if (v.t == JS_T_STR) return depth ? js_str_concat(js_str_concat(js_str_char('\''), v.u.s), js_str_char('\'')) : v.u.s;
  if (v.t == JS_T_BIG) return js_str_concat(js_big_to_str(v.u.g, 10), js_str_char('n'));
  if (v.t != JS_T_OBJ) return js_to_str(v);
  js_obj* o = v.u.o;
  if (depth > 2) return js_str_c(o->kind == K_ARR ? "[Array]" : "[Object]");
  if (o->kind == K_ARR || o->kind == K_TYPED) {
    int64_t len = js_len_of(v);
    js_str* s = o->kind == K_TYPED ? js_str_concat(js_str_c(js_ta_names[((js_typed*)o)->tk]), js_str_c(len ? "(" : "(0) [")) : js_str_c(len ? "[ " : "[");
    if (o->kind == K_TYPED && len) { char b[32]; snprintf(b, sizeof b, "%lld) [ ", (long long)len); s = js_str_concat(s, js_str_c(b)); }
    for (int64_t i = 0; i < len && i < 100; ++i) { if (i) s = js_str_concat(s, js_str_c(", ")); s = js_str_concat(s, js_inspect(js_idx_get(v, i), depth + 1)); }
    if (len > 100) s = js_str_concat(s, js_str_c(", ..."));
    return js_str_concat(s, js_str_c(len ? " ]" : "]"));
  }
  if (o->kind == K_FUNC) return js_str_concat(js_str_concat(js_str_c("[Function: "), ((js_func*)o)->name ? ((js_func*)o)->name : js_str_c("(anonymous)")), js_str_c("]"));
  for (js_obj* p = o; p; p = p->proto) if (p == js_Error_proto) { js_val st = js_get(v, A_stack); return st.t == JS_T_STR ? st.u.s : js_to_str(v); }
  js_val keys = js_own_keys(v);
  js_arr* k = js_as_arr(keys);
  js_str* s = js_str_c(k->len ? "{ " : "{");
  for (int64_t i = 0; i < k->len; ++i) {
    if (i) s = js_str_concat(s, js_str_c(", "));
    s = js_str_concat(js_str_concat(js_str_concat(s, k->a[i].u.s), js_str_c(": ")), js_inspect(js_get(v, k->a[i].u.s), depth + 1));
  }
  return js_str_concat(s, js_str_c(k->len ? " }" : "}"));
}
static void js_console_out(FILE* out, int argc, js_val* argv) {
  for (int i = 0; i < argc; ++i) {
    if (i) fputc(' ', out);
    fputs(js_str_utf8z(js_inspect(argv[i], 0)), out);
  }
  fputc('\n', out);
  fflush(out);
}
JS_NATIVE(n_console_log) { js_console_out(stdout, argc, argv); return JS_U; }
JS_NATIVE(n_console_err) { js_console_out(stderr, argc, argv); return JS_U; }
static double js_now_ms(void) {
  struct timespec ts;
  timespec_get(&ts, TIME_UTC);
  return floor((double)ts.tv_sec * 1000.0 + (double)ts.tv_nsec / 1e6);
}
JS_NATIVE(n_date_now) { return JS_D(js_now_ms()); }
JS_NATIVE(n_perf_now) {
  struct timespec ts;
  timespec_get(&ts, TIME_UTC);
  return JS_D((double)ts.tv_sec * 1000.0 + (double)ts.tv_nsec / 1e6);
}
static js_obj* js_Date_proto;
JS_NATIVE(n_date_ctor) {
  double t = argc > 0 ? js_to_number(argv[0]) : js_now_ms();
  if (nt.t == JS_T_UNDEF) return js_invoke(JS_O(js_obj_new(js_Date_proto)), A_toString, 0, NULL);
  js_obj* o = js_obj_new(js_proto_from(nt, js_Date_proto));
  js_define(o, js_atom_c("__time"), JS_D(t), P_HIDDEN);
  return JS_O(o);
}
JS_NATIVE(n_date_gettime) { return js_get(self, js_atom_c("__time")); }
JS_NATIVE(n_date_tostring) { return JS_SV(js_num_to_str(js_to_number(js_get(self, js_atom_c("__time"))))); }

// ---------------------------------------------------------------- JSON
static js_str* js_json_quote(js_str* s) {
  js_str* out = js_str_alloc(0, s->len + 2);
  js_str* r = js_str_concat(js_str_new(NULL, 0), js_str_char('"'));
  (void)out;
  int32_t start = 0;
  for (int32_t i = 0; i < s->len; ++i) {
    uint16_t c = s->d[i];
    const char* esc = NULL; char buf[8];
    if (c == '"') esc = "\\\""; else if (c == '\\') esc = "\\\\"; else if (c == '\n') esc = "\\n"; else if (c == '\r') esc = "\\r";
    else if (c == '\t') esc = "\\t"; else if (c == '\b') esc = "\\b"; else if (c == '\f') esc = "\\f";
    else if (c < 0x20 || (c >= 0xD800 && c < 0xE000 && !((c < 0xDC00 && i + 1 < s->len && s->d[i + 1] >= 0xDC00 && s->d[i + 1] < 0xE000) || (c >= 0xDC00 && i > 0 && s->d[i - 1] >= 0xD800 && s->d[i - 1] < 0xDC00)))) { snprintf(buf, sizeof buf, "\\u%04x", c); esc = buf; }
    if (esc) { r = js_str_concat(js_str_concat(r, js_str_sub(s, start, i)), js_str_c(esc)); start = i + 1; }
  }
  r = js_str_concat(r, js_str_sub(s, start, s->len));
  return js_str_concat(r, js_str_char('"'));
}
static int js_json_value(js_val v, js_str* indent, js_str* cur, js_str** out, int depth) {
  if (depth > 200) js_throw_type("Converting circular structure to JSON");
  if (v.t == JS_T_OBJ) {
    js_val tj = js_get(v, js_atom_c("toJSON"));
    if (js_is_callable(tj)) v = js_call(tj, v, 0, NULL);
  }
  switch (v.t) {
    case JS_T_NULL: *out = js_str_concat(*out, A_null); return 1;
    case JS_T_BOOL: *out = js_str_concat(*out, v.u.b ? A_true : A_false); return 1;
    case JS_T_NUM: *out = js_str_concat(*out, isfinite(v.u.n) ? js_num_to_str(v.u.n) : A_null); return 1;
    case JS_T_STR: *out = js_str_concat(*out, js_json_quote(v.u.s)); return 1;
    case JS_T_BIG: js_throw_type("Do not know how to serialize a BigInt");
    case JS_T_OBJ: break;
    default: return 0;
  }
  if (v.u.o->kind == K_FUNC) return 0;
  js_str* inner = indent->len ? js_str_concat(js_str_concat(js_str_new(NULL, 0), cur), indent) : cur;
  js_str* sep = indent->len ? js_str_concat(js_str_c(",\n"), inner) : js_str_char(',');
  js_str* open_nl = indent->len ? js_str_concat(js_str_char('\n'), inner) : A_empty;
  js_str* close_nl = indent->len ? js_str_concat(js_str_char('\n'), cur) : A_empty;
  if (v.u.o->kind == K_ARR) {
    int64_t len = js_len_of(v);
    if (!len) { *out = js_str_concat(*out, js_str_c("[]")); return 1; }
    *out = js_str_concat(js_str_concat(*out, js_str_char('[')), open_nl);
    for (int64_t i = 0; i < len; ++i) {
      if (i) *out = js_str_concat(*out, sep);
      if (!js_json_value(js_idx_get(v, i), indent, inner, out, depth + 1)) *out = js_str_concat(*out, A_null);
    }
    *out = js_str_concat(js_str_concat(*out, close_nl), js_str_char(']'));
    return 1;
  }
  js_val keys = js_own_keys(v);
  js_arr* k = js_as_arr(keys);
  int any = 0;
  js_str* body = js_str_new(NULL, 0);
  for (int64_t i = 0; i < k->len; ++i) {
    js_str* part = js_str_new(NULL, 0);
    js_str* key = js_json_quote(k->a[i].u.s);
    part = js_str_concat(js_str_concat(part, key), js_str_c(indent->len ? ": " : ":"));
    if (!js_json_value(js_get(v, k->a[i].u.s), indent, inner, &part, depth + 1)) continue;
    if (any) body = js_str_concat(body, sep);
    body = js_str_concat(body, part);
    any = 1;
  }
  if (!any) { *out = js_str_concat(*out, js_str_c("{}")); return 1; }
  *out = js_str_concat(js_str_concat(js_str_concat(js_str_concat(*out, js_str_char('{')), open_nl), body), close_nl);
  *out = js_str_concat(*out, js_str_char('}'));
  return 1;
}
JS_NATIVE(n_json_stringify) {
  js_val space = NARG(2);
  js_str* indent = A_empty;
  if (space.t == JS_T_NUM) { int n = (int)space.u.n; if (n > 10) n = 10; if (n > 0) { indent = js_str_alloc(n, n); for (int i = 0; i < n; ++i) indent->d[i] = ' '; } }
  else if (space.t == JS_T_STR) indent = js_str_sub(space.u.s, 0, 10);
  js_str* out = js_str_new(NULL, 0);
  if (!js_json_value(NARG(0), indent, A_empty, &out, 0)) return JS_U;
  return JS_SV(out);
}
typedef struct js_jp { js_str* s; int32_t i; } js_jp;
static void js_jp_ws(js_jp* p) { while (p->i < p->s->len && (p->s->d[p->i] == ' ' || p->s->d[p->i] == '\t' || p->s->d[p->i] == '\n' || p->s->d[p->i] == '\r')) ++p->i; }
static void js_jp_fail(js_jp* p) __attribute__((noreturn));
static void js_jp_fail(js_jp* p) { js_throw_syntax("Unexpected token in JSON at position %d", p->i); }
static js_val js_jp_value(js_jp* p);
static js_str* js_jp_string(js_jp* p) {
  ++p->i;
  js_str* r = js_str_new(NULL, 0);
  int32_t start = p->i;
  while (p->i < p->s->len && p->s->d[p->i] != '"') {
    if (p->s->d[p->i] == '\\') {
      r = js_str_concat(r, js_str_sub(p->s, start, p->i));
      ++p->i;
      if (p->i >= p->s->len) js_jp_fail(p);
      uint16_t c = p->s->d[p->i++];
      switch (c) {
        case 'n': c = '\n'; break; case 't': c = '\t'; break; case 'r': c = '\r'; break; case 'b': c = '\b'; break; case 'f': c = '\f'; break;
        case 'u': {
          if (p->i + 4 > p->s->len) js_jp_fail(p);
          uint32_t v = 0;
          for (int k = 0; k < 4; ++k) { uint16_t h = p->s->d[p->i++]; v = v * 16 + (h >= '0' && h <= '9' ? h - '0' : h >= 'a' && h <= 'f' ? h - 'a' + 10 : h >= 'A' && h <= 'F' ? h - 'A' + 10 : 0); }
          c = (uint16_t)v; break;
        }
        default: break;
      }
      r = js_str_concat(r, js_str_char(c));
      start = p->i;
    } else ++p->i;
  }
  if (p->i >= p->s->len) js_jp_fail(p);
  r = js_str_concat(r, js_str_sub(p->s, start, p->i));
  ++p->i;
  return r;
}
static js_val js_jp_value(js_jp* p) {
  js_jp_ws(p);
  if (p->i >= p->s->len) js_jp_fail(p);
  uint16_t c = p->s->d[p->i];
  if (c == '{') {
    ++p->i;
    js_val o = js_new_object();
    js_jp_ws(p);
    if (p->i < p->s->len && p->s->d[p->i] == '}') { ++p->i; return o; }
    for (;;) {
      js_jp_ws(p);
      if (p->i >= p->s->len || p->s->d[p->i] != '"') js_jp_fail(p);
      js_str* k = js_jp_string(p);
      js_jp_ws(p);
      if (p->i >= p->s->len || p->s->d[p->i] != ':') js_jp_fail(p);
      ++p->i;
      js_val v = js_jp_value(p);
      js_define(o.u.o, js_intern(k), v, 0);
      js_jp_ws(p);
      if (p->i < p->s->len && p->s->d[p->i] == ',') { ++p->i; continue; }
      if (p->i < p->s->len && p->s->d[p->i] == '}') { ++p->i; return o; }
      js_jp_fail(p);
    }
  }
  if (c == '[') {
    ++p->i;
    js_arr* a = js_arr_alloc(0, 8);
    js_jp_ws(p);
    if (p->i < p->s->len && p->s->d[p->i] == ']') { ++p->i; return JS_O(a); }
    for (;;) {
      js_arr_push1(a, js_jp_value(p));
      js_jp_ws(p);
      if (p->i < p->s->len && p->s->d[p->i] == ',') { ++p->i; continue; }
      if (p->i < p->s->len && p->s->d[p->i] == ']') { ++p->i; return JS_O(a); }
      js_jp_fail(p);
    }
  }
  if (c == '"') return JS_SV(js_jp_string(p));
  if (c == 't' && p->i + 4 <= p->s->len && js_str_eq(js_str_sub(p->s, p->i, p->i + 4), A_true)) { p->i += 4; return JS_TRUE; }
  if (c == 'f' && p->i + 5 <= p->s->len && js_str_eq(js_str_sub(p->s, p->i, p->i + 5), A_false)) { p->i += 5; return JS_FALSE; }
  if (c == 'n' && p->i + 4 <= p->s->len && js_str_eq(js_str_sub(p->s, p->i, p->i + 4), A_null)) { p->i += 4; return JS_NULL; }
  if (c == '-' || (c >= '0' && c <= '9')) {
    char buf[64]; int k = 0;
    while (p->i < p->s->len && k < 63) {
      uint16_t d = p->s->d[p->i];
      if ((d >= '0' && d <= '9') || d == '-' || d == '+' || d == '.' || d == 'e' || d == 'E') { buf[k++] = (char)d; ++p->i; }
      else break;
    }
    buf[k] = 0;
    return JS_D(strtod(buf, NULL));
  }
  js_jp_fail(p);
}
JS_NATIVE(n_json_parse) {
  js_jp p = { js_to_str(NARG(0)), 0 };
  js_val v = js_jp_value(&p);
  js_jp_ws(&p);
  if (p.i != p.s->len) js_jp_fail(&p);
  return v;
}

// ---------------------------------------------------------------- regular expressions
// A backtracking matcher for the ECMAScript pattern syntax algorithms use:
// literals and escapes, classes, . ^ $ \b \B, groups (capturing, non-capturing,
// named, lookahead), alternation, greedy and lazy quantifiers, back references.
enum { RX_CHAR, RX_ANY, RX_CLASS, RX_BOL, RX_EOL, RX_WORDB, RX_NWORDB, RX_GROUP, RX_GROUPEND, RX_ALT, RX_QUANT, RX_LOOP, RX_BACKREF, RX_LOOK, RX_ACCEPT };
typedef struct rx_node rx_node;
struct rx_node {
  int type;
  rx_node* next;
  uint16_t c;
  int neg;               // negated class / negative lookahead
  uint32_t* ranges; int nranges; int classes; // classes: bit set of \d\w\s\D\W\S\pL
  int min, max, greedy, id;
  rx_node* body;
  rx_node** alts; int nalts;
  int group;
  rx_node* quant;        // RX_LOOP: its quantifier
};
typedef struct rx_prog { rx_node* start; int ngroups, nquants, icase, multi, dotall, unicode; js_str** names; } rx_prog;
typedef struct rx_parser { const uint16_t* p; int32_t i, n; rx_prog* prog; const char* err; } rx_parser;
enum { RXC_D = 1, RXC_ND = 2, RXC_W = 4, RXC_NW = 8, RXC_S = 16, RXC_NS = 32, RXC_L = 64, RXC_NL = 128 };

static rx_node* rx_new(int type) { rx_node* n = (rx_node*)js_alloc(sizeof(rx_node)); n->type = type; n->max = -1; return n; }
static int rx_is_digit(uint32_t c) { return c >= '0' && c <= '9'; }
static int rx_is_word(uint32_t c) { return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || rx_is_digit(c) || c == '_'; }
static int rx_is_letter(uint32_t c) {
  if ((c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z')) return 1;
  if (c == 0xAA || c == 0xB5 || c == 0xBA) return 1;
  if (c >= 0xC0 && c <= 0xFF) return c != 0xD7 && c != 0xF7;
  return c > 0xFF && !(c >= 0x2000 && c <= 0x206F) && !(c >= 0x3000 && c <= 0x303F) && !(c >= 0xD800 && c < 0xE000);
}
static int rx_class_bits(uint32_t c, int classes) {
  if ((classes & RXC_D) && rx_is_digit(c)) return 1;
  if ((classes & RXC_ND) && !rx_is_digit(c)) return 1;
  if ((classes & RXC_W) && rx_is_word(c)) return 1;
  if ((classes & RXC_NW) && !rx_is_word(c)) return 1;
  if ((classes & RXC_S) && js_is_ws((uint16_t)c)) return 1;
  if ((classes & RXC_NS) && !js_is_ws((uint16_t)c)) return 1;
  if ((classes & RXC_L) && rx_is_letter(c)) return 1;
  if ((classes & RXC_NL) && !rx_is_letter(c)) return 1;
  return 0;
}
static int rx_peek(rx_parser* P) { return P->i < P->n ? P->p[P->i] : -1; }
static uint32_t rx_hex(rx_parser* P, int digits) {
  uint32_t v = 0;
  for (int k = 0; k < digits; ++k) {
    int h = rx_peek(P);
    int d = h >= '0' && h <= '9' ? h - '0' : h >= 'a' && h <= 'f' ? h - 'a' + 10 : h >= 'A' && h <= 'F' ? h - 'A' + 10 : -1;
    if (d < 0) { P->err = "Invalid escape"; return 0; }
    v = v * 16 + (uint32_t)d; ++P->i;
  }
  return v;
}
/** An escape after the backslash: a character, or a class (returned in *classes) */
static uint32_t rx_escape(rx_parser* P, int* classes) {
  int c = rx_peek(P);
  ++P->i;
  *classes = 0;
  switch (c) {
    case 'd': *classes = RXC_D; return 0;
    case 'D': *classes = RXC_ND; return 0;
    case 'w': *classes = RXC_W; return 0;
    case 'W': *classes = RXC_NW; return 0;
    case 's': *classes = RXC_S; return 0;
    case 'S': *classes = RXC_NS; return 0;
    case 'n': return '\n';
    case 'r': return '\r';
    case 't': return '\t';
    case 'v': return 0x0B;
    case 'f': return 0x0C;
    case '0': return 0;
    case 'x': return rx_hex(P, 2);
    case 'u':
      if (rx_peek(P) == '{') { ++P->i; uint32_t v = 0; while (rx_peek(P) != '}' && rx_peek(P) >= 0) v = v * 16 + rx_hex(P, 1); ++P->i; return v; }
      return rx_hex(P, 4);
    case 'p': case 'P': {
      if (rx_peek(P) == '{') { while (rx_peek(P) != '}' && rx_peek(P) >= 0) ++P->i; ++P->i; }
      *classes = c == 'p' ? RXC_L : RXC_NL;
      return 0;
    }
    case 'c': { int l = rx_peek(P); ++P->i; return (uint32_t)(l % 32); }
    case -1: P->err = "\\ at end of pattern"; return 0;
    default: return (uint32_t)c;
  }
}
static rx_node* rx_parse_alt(rx_parser* P);
static rx_node* rx_parse_class(rx_parser* P) {
  rx_node* n = rx_new(RX_CLASS);
  ++P->i; // [
  if (rx_peek(P) == '^') { n->neg = 1; ++P->i; }
  int cap = 8;
  n->ranges = (uint32_t*)js_alloc_raw(sizeof(uint32_t) * 2 * (size_t)cap);
  while (rx_peek(P) >= 0 && rx_peek(P) != ']') {
    uint32_t lo; int cls = 0;
    if (rx_peek(P) == '\\') { ++P->i; if (rx_peek(P) == 'b') { ++P->i; lo = 8; } else lo = rx_escape(P, &cls); }
    else lo = (uint32_t)P->p[P->i++];
    if (cls) { n->classes |= cls; continue; }
    uint32_t hi = lo;
    if (rx_peek(P) == '-' && P->i + 1 < P->n && P->p[P->i + 1] != ']') {
      ++P->i;
      int cls2 = 0;
      if (rx_peek(P) == '\\') { ++P->i; hi = rx_escape(P, &cls2); }
      else hi = (uint32_t)P->p[P->i++];
      if (cls2) { // [a-\d]: a, -, and the class
        n->classes |= cls2;
        if (n->nranges + 2 > cap) { cap *= 2; uint32_t* r = (uint32_t*)js_alloc_raw(sizeof(uint32_t) * 2 * (size_t)cap); memcpy(r, n->ranges, sizeof(uint32_t) * 2 * (size_t)n->nranges); n->ranges = r; }
        n->ranges[2 * n->nranges] = lo; n->ranges[2 * n->nranges + 1] = lo; ++n->nranges;
        n->ranges[2 * n->nranges] = '-'; n->ranges[2 * n->nranges + 1] = '-'; ++n->nranges;
        continue;
      }
      if (hi < lo) { P->err = "Range out of order in character class"; return n; }
    }
    if (n->nranges + 1 > cap) { cap *= 2; uint32_t* r = (uint32_t*)js_alloc_raw(sizeof(uint32_t) * 2 * (size_t)cap); memcpy(r, n->ranges, sizeof(uint32_t) * 2 * (size_t)n->nranges); n->ranges = r; }
    n->ranges[2 * n->nranges] = lo; n->ranges[2 * n->nranges + 1] = hi; ++n->nranges;
  }
  if (rx_peek(P) != ']') { P->err = "Unterminated character class"; return n; }
  ++P->i;
  return n;
}
/** Link the tail of a node list to a continuation */
static void rx_link(rx_node* list, rx_node* to) {
  if (!list) return;
  while (list->next) list = list->next;
  list->next = to;
}
static rx_node* rx_parse_atom(rx_parser* P) {
  int c = rx_peek(P);
  switch (c) {
    case '^': ++P->i; return rx_new(RX_BOL);
    case '$': ++P->i; return rx_new(RX_EOL);
    case '.': ++P->i; return rx_new(RX_ANY);
    case '[': return rx_parse_class(P);
    case '(': {
      ++P->i;
      rx_node* g;
      if (rx_peek(P) == '?') {
        ++P->i;
        int k = rx_peek(P);
        if (k == ':') { ++P->i; g = rx_new(RX_GROUP); g->group = -1; }
        else if (k == '=' || k == '!') { ++P->i; g = rx_new(RX_LOOK); g->neg = k == '!'; }
        else if (k == '<' && P->i + 1 < P->n && P->p[P->i + 1] != '=' && P->p[P->i + 1] != '!') {
          ++P->i;
          int32_t s = P->i;
          while (rx_peek(P) >= 0 && rx_peek(P) != '>') ++P->i;
          js_str* name = js_str_new(P->p + s, P->i - s);
          ++P->i;
          g = rx_new(RX_GROUP); g->group = P->prog->ngroups++;
          js_str** names = (js_str**)js_alloc(sizeof(js_str*) * (size_t)P->prog->ngroups);
          if (P->prog->names) memcpy(names, P->prog->names, sizeof(js_str*) * (size_t)(P->prog->ngroups - 1));
          names[g->group] = name; P->prog->names = names;
        } else { P->err = "Invalid group"; return rx_new(RX_ANY); }
      } else { g = rx_new(RX_GROUP); g->group = P->prog->ngroups++; if (P->prog->names) { js_str** names = (js_str**)js_alloc(sizeof(js_str*) * (size_t)P->prog->ngroups); memcpy(names, P->prog->names, sizeof(js_str*) * (size_t)(P->prog->ngroups - 1)); P->prog->names = names; } }
      g->body = rx_parse_alt(P);
      if (rx_peek(P) != ')') { P->err = "Unterminated group"; return g; }
      ++P->i;
      if (g->type == RX_LOOK) rx_link(g->body, rx_new(RX_ACCEPT));
      else { rx_node* end = rx_new(RX_GROUPEND); end->group = g->group; rx_link(g->body, end); if (!g->body) g->body = end; g->quant = end; }
      return g;
    }
    case '\\': {
      ++P->i;
      int k = rx_peek(P);
      if (k == 'b') { ++P->i; return rx_new(RX_WORDB); }
      if (k == 'B') { ++P->i; return rx_new(RX_NWORDB); }
      if (k >= '1' && k <= '9') {
        int v = 0;
        while (rx_peek(P) >= '0' && rx_peek(P) <= '9') v = v * 10 + (P->p[P->i++] - '0');
        rx_node* b = rx_new(RX_BACKREF); b->group = v - 1;
        return b;
      }
      int cls;
      uint32_t ch = rx_escape(P, &cls);
      if (cls) { rx_node* n = rx_new(RX_CLASS); n->classes = cls; return n; }
      rx_node* n = rx_new(RX_CHAR); n->c = (uint16_t)ch;
      return n;
    }
    default: {
      ++P->i;
      rx_node* n = rx_new(RX_CHAR); n->c = (uint16_t)c;
      return n;
    }
  }
}
static rx_node* rx_parse_seq(rx_parser* P) {
  rx_node* head = NULL; rx_node* tail = NULL;
  while (rx_peek(P) >= 0 && rx_peek(P) != '|' && rx_peek(P) != ')' && !P->err) {
    rx_node* a = rx_parse_atom(P);
    int q = rx_peek(P);
    if (q == '*' || q == '+' || q == '?' || (q == '{' && P->i + 1 < P->n && rx_is_digit(P->p[P->i + 1]))) {
      rx_node* n = rx_new(RX_QUANT);
      ++P->i;
      if (q == '*') { n->min = 0; n->max = -1; }
      else if (q == '+') { n->min = 1; n->max = -1; }
      else if (q == '?') { n->min = 0; n->max = 1; }
      else {
        int v = 0; while (rx_is_digit((uint32_t)rx_peek(P))) v = v * 10 + (P->p[P->i++] - '0');
        n->min = v; n->max = v;
        if (rx_peek(P) == ',') { ++P->i; if (rx_peek(P) == '}') n->max = -1; else { v = 0; while (rx_is_digit((uint32_t)rx_peek(P))) v = v * 10 + (P->p[P->i++] - '0'); n->max = v; } }
        if (rx_peek(P) != '}') { P->err = "Incomplete quantifier"; return head; }
        ++P->i;
      }
      n->greedy = 1;
      if (rx_peek(P) == '?') { n->greedy = 0; ++P->i; }
      n->id = P->prog->nquants++;
      n->body = a;
      rx_node* loop = rx_new(RX_LOOP); loop->quant = n;
      rx_link(a, loop);
      a = n;
    }
    if (!head) head = a; else tail->next = a;
    tail = a;
    // a group's or quantifier's own tail is linked internally; keep the outer chain on the atom
  }
  return head;
}
static rx_node* rx_parse_alt(rx_parser* P) {
  rx_node* first = rx_parse_seq(P);
  if (rx_peek(P) != '|') return first;
  rx_node* alt = rx_new(RX_ALT);
  int cap = 4;
  alt->alts = (rx_node**)js_alloc(sizeof(rx_node*) * (size_t)cap);
  alt->alts[alt->nalts++] = first;
  while (rx_peek(P) == '|') {
    ++P->i;
    rx_node* s = rx_parse_seq(P);
    if (alt->nalts == cap) { cap *= 2; rx_node** a = (rx_node**)js_alloc(sizeof(rx_node*) * (size_t)cap); memcpy(a, alt->alts, sizeof(rx_node*) * (size_t)alt->nalts); alt->alts = a; }
    alt->alts[alt->nalts++] = s;
  }
  return alt;
}
/** Resolve the continuations: every sequence's tail continues with what follows its container */
static void rx_resolve(rx_node* n, rx_node* cont) {
  for (; n; n = n->next) {
    rx_node* after = n->next ? n->next : cont;
    switch (n->type) {
      case RX_GROUP: rx_resolve(n->body, NULL); if (n->quant) n->quant->next = after; break; // quant holds the GROUPEND
      case RX_LOOK: rx_resolve(n->body, NULL); break;
      case RX_QUANT: rx_resolve(n->body, NULL); break;
      case RX_ALT: for (int i = 0; i < n->nalts; ++i) if (n->alts[i]) rx_resolve(n->alts[i], after); break;
    }
    if (!n->next) { n->next = cont; break; }
  }
}
typedef struct rx_ctx { rx_prog* prog; const uint16_t* s; int32_t len; int32_t* caps; int* counts; int32_t* qstart; int depth; } rx_ctx;
static int rx_m(rx_ctx* x, rx_node* n, int32_t pos);
static int rx_char_eq(rx_ctx* x, uint16_t a, uint16_t b) { return a == b || (x->prog->icase && js_upper(a) == js_upper(b)); }
static int rx_class_match(rx_ctx* x, rx_node* n, uint16_t c) {
  int hit = n->classes && rx_class_bits(c, n->classes);
  for (int i = 0; !hit && i < n->nranges; ++i) {
    if (c >= n->ranges[2 * i] && c <= n->ranges[2 * i + 1]) hit = 1;
    else if (x->prog->icase) {
      uint16_t u = js_upper(c), l = js_lower(c);
      if ((u >= n->ranges[2 * i] && u <= n->ranges[2 * i + 1]) || (l >= n->ranges[2 * i] && l <= n->ranges[2 * i + 1])) hit = 1;
    }
  }
  return n->neg ? !hit : hit;
}
static int rx_single(rx_ctx* x, rx_node* n, int32_t pos) {
  if (pos >= x->len) return 0;
  uint16_t c = x->s[pos];
  switch (n->type) {
    case RX_CHAR: return rx_char_eq(x, c, n->c);
    case RX_ANY: return x->prog->dotall || !(c == '\n' || c == '\r' || c == 0x2028 || c == 0x2029);
    case RX_CLASS: return rx_class_match(x, n, c);
    default: return 0;
  }
}
static int rx_quant_step(rx_ctx* x, rx_node* q, int32_t pos, int c) {
  int saved_c = x->counts[q->id]; int32_t saved_s = x->qstart[q->id];
  if (c < q->min) {
    x->counts[q->id] = c + 1; x->qstart[q->id] = pos;
    if (rx_m(x, q->body, pos)) return 1;
    x->counts[q->id] = saved_c; x->qstart[q->id] = saved_s;
    return 0;
  }
  if (q->greedy) {
    if (q->max < 0 || c < q->max) {
      x->counts[q->id] = c + 1; x->qstart[q->id] = pos;
      if (rx_m(x, q->body, pos)) return 1;
      x->counts[q->id] = saved_c; x->qstart[q->id] = saved_s;
    }
    return rx_m(x, q->next, pos);
  }
  if (rx_m(x, q->next, pos)) return 1;
  if (q->max < 0 || c < q->max) {
    x->counts[q->id] = c + 1; x->qstart[q->id] = pos;
    if (rx_m(x, q->body, pos)) return 1;
    x->counts[q->id] = saved_c; x->qstart[q->id] = saved_s;
  }
  return 0;
}
static int rx_m(rx_ctx* x, rx_node* n, int32_t pos) {
  if (++x->depth > 200000) js_throw_range("Maximum call stack size exceeded");
  int r = 0;
  for (;;) {
    if (!n) { x->caps[1] = pos; r = 1; break; }
    switch (n->type) {
      case RX_CHAR: case RX_ANY: case RX_CLASS:
        if (!rx_single(x, n, pos)) goto done;
        ++pos; n = n->next; continue;
      case RX_BOL:
        if (!(pos == 0 || (x->prog->multi && (x->s[pos - 1] == '\n' || x->s[pos - 1] == '\r')))) goto done;
        n = n->next; continue;
      case RX_EOL:
        if (!(pos == x->len || (x->prog->multi && (x->s[pos] == '\n' || x->s[pos] == '\r')))) goto done;
        n = n->next; continue;
      case RX_WORDB: case RX_NWORDB: {
        int a = pos > 0 && rx_is_word(x->s[pos - 1]), b = pos < x->len && rx_is_word(x->s[pos]);
        if ((a != b) != (n->type == RX_WORDB)) goto done;
        n = n->next; continue;
      }
      case RX_GROUP: {
        if (n->group < 0) { n = n->body; continue; }
        int32_t old = x->caps[2 * n->group + 2], olde = x->caps[2 * n->group + 3];
        x->caps[2 * n->group + 2] = pos;
        if (rx_m(x, n->body, pos)) { r = 1; goto done; }
        x->caps[2 * n->group + 2] = old; x->caps[2 * n->group + 3] = olde;
        goto done;
      }
      case RX_GROUPEND: {
        if (n->group < 0) { n = n->next; continue; }
        int32_t old = x->caps[2 * n->group + 3];
        x->caps[2 * n->group + 3] = pos;
        if (rx_m(x, n->next, pos)) { r = 1; goto done; }
        x->caps[2 * n->group + 3] = old;
        goto done;
      }
      case RX_ALT:
        for (int i = 0; i < n->nalts; ++i) if (rx_m(x, n->alts[i] ? n->alts[i] : n->next, pos)) { r = 1; goto done; }
        goto done;
      case RX_QUANT: {
        rx_node* b = n->body;
        if (b && b->next && b->next->type == RX_LOOP && (b->type == RX_CHAR || b->type == RX_ANY || b->type == RX_CLASS)) {
          // a single-character body: count the run, then back off
          int32_t k = 0;
          while ((n->max < 0 || k < n->max) && rx_single(x, b, pos + k)) ++k;
          if (k < n->min) goto done;
          if (n->greedy) { for (int32_t j = k; j >= n->min; --j) if (rx_m(x, n->next, pos + j)) { r = 1; goto done; } }
          else { for (int32_t j = n->min; j <= k; ++j) if (rx_m(x, n->next, pos + j)) { r = 1; goto done; } }
          goto done;
        }
        r = rx_quant_step(x, n, pos, 0);
        goto done;
      }
      case RX_LOOP: {
        rx_node* q = n->quant;
        int c = x->counts[q->id];
        if (pos == x->qstart[q->id] && c > q->min) goto done; // an empty iteration ends the loop
        r = rx_quant_step(x, q, pos, c);
        goto done;
      }
      case RX_BACKREF: {
        int g = n->group;
        if (g < 0 || g >= x->prog->ngroups || x->caps[2 * g + 2] < 0 || x->caps[2 * g + 3] < 0) { n = n->next; continue; }
        int32_t s = x->caps[2 * g + 2], e = x->caps[2 * g + 3];
        if (pos + (e - s) > x->len) goto done;
        for (int32_t i = 0; i < e - s; ++i) if (!rx_char_eq(x, x->s[pos + i], x->s[s + i])) goto done;
        pos += e - s; n = n->next; continue;
      }
      case RX_LOOK: {
        int32_t save1 = x->caps[1];
        int ok = rx_m(x, n->body, pos);
        x->caps[1] = save1;
        if (ok == n->neg) goto done;
        n = n->next; continue;
      }
      case RX_ACCEPT: r = 1; goto done;
    }
  }
done:
  --x->depth;
  return r;
}
typedef struct js_regexp { js_obj o; js_str* source; js_str* flags; rx_prog* prog; int global, sticky; } js_regexp;
static rx_prog* rx_compile(js_str* src, js_str* flags) {
  rx_prog* prog = (rx_prog*)js_alloc(sizeof(rx_prog));
  for (int32_t i = 0; i < flags->len; ++i) {
    uint16_t f = flags->d[i];
    if (f == 'i') prog->icase = 1; else if (f == 'm') prog->multi = 1; else if (f == 's') prog->dotall = 1; else if (f == 'u' || f == 'v') prog->unicode = 1;
    else if (f != 'g' && f != 'y' && f != 'd') js_throw_syntax("Invalid regular expression flags");
  }
  rx_parser P = { src->d, 0, src->len, prog, NULL };
  rx_node* start = rx_parse_alt(&P);
  if (!P.err && P.i < P.n) P.err = "Unmatched ')'";
  if (P.err) js_throw_syntax("Invalid regular expression: /%s/: %s", js_cstr(src), P.err);
  rx_resolve(start, NULL);
  prog->start = start;
  return prog;
}
static js_val js_regexp_new_val(js_str* src, js_str* flags) {
  js_regexp* r = (js_regexp*)js_alloc(sizeof(js_regexp));
  js_obj_init(&r->o, K_REGEXP, js_RegExp_proto);
  r->source = src; r->flags = flags;
  r->prog = rx_compile(src, flags);
  for (int32_t i = 0; i < flags->len; ++i) { if (flags->d[i] == 'g') r->global = 1; if (flags->d[i] == 'y') r->sticky = 1; }
  js_define(&r->o, A_lastIndex, JS_D(0), P_HIDDEN);
  return JS_O(r);
}
/** Match at or after from; caps receives 2 * (ngroups + 1) positions */
static int rx_exec_at(js_regexp* re, js_str* s, int32_t from, int sticky, int32_t* caps) {
  rx_prog* prog = re->prog;
  int ncap = 2 * (prog->ngroups + 1);
  rx_ctx x;
  x.prog = prog; x.s = s->d; x.len = s->len; x.caps = caps; x.depth = 0;
  x.counts = (int*)js_alloc_raw(sizeof(int) * (size_t)(prog->nquants + 1));
  x.qstart = (int32_t*)js_alloc_raw(sizeof(int32_t) * (size_t)(prog->nquants + 1));
  for (int32_t start = from; start <= s->len; ++start) {
    for (int i = 0; i < ncap; ++i) caps[i] = -1;
    memset(x.counts, 0, sizeof(int) * (size_t)(prog->nquants + 1));
    caps[0] = start;
    if (rx_m(&x, prog->start, start)) return 1;
    if (sticky) break;
  }
  return 0;
}
static js_val rx_result(js_regexp* re, js_str* s, int32_t* caps) {
  int ng = re->prog->ngroups;
  js_arr* a = js_arr_alloc(ng + 1, ng + 1);
  for (int g = 0; g <= ng; ++g) a->a[g] = caps[2 * g] >= 0 && caps[2 * g + 1] >= 0 ? JS_SV(js_str_sub(s, caps[2 * g], caps[2 * g + 1])) : JS_U;
  js_define(&a->o, A_index, JS_D(caps[0]), 0);
  js_define(&a->o, A_input, JS_SV(s), 0);
  js_val groups = JS_U;
  if (re->prog->names) {
    groups = js_new_object();
    for (int g = 0; g < ng; ++g) if (re->prog->names[g]) js_set(groups, js_intern(re->prog->names[g]), a->a[g + 1]);
  }
  js_define(&a->o, js_atom_c("groups"), groups, 0);
  return JS_O(a);
}
static js_regexp* js_this_regexp(js_val v) {
  if (!js_is_kind(v, K_REGEXP)) js_throw_type("not a RegExp");
  return (js_regexp*)v.u.o;
}
static js_val js_regexp_exec(js_val rv, js_str* s) {
  js_regexp* re = js_this_regexp(rv);
  int32_t from = 0;
  if (re->global || re->sticky) {
    double li = js_to_integer(js_get(rv, A_lastIndex));
    if (li > s->len) { js_set(rv, A_lastIndex, JS_D(0)); return JS_NULL; }
    from = (int32_t)(li < 0 ? 0 : li);
  }
  int32_t* caps = (int32_t*)js_alloc_raw(sizeof(int32_t) * (size_t)(2 * (re->prog->ngroups + 1)));
  if (!rx_exec_at(re, s, from, re->sticky, caps)) {
    if (re->global || re->sticky) js_set(rv, A_lastIndex, JS_D(0));
    return JS_NULL;
  }
  if (re->global || re->sticky) js_set(rv, A_lastIndex, JS_D(caps[1]));
  return rx_result(re, s, caps);
}
JS_NATIVE(n_regexp_ctor) {
  js_val p = NARG(0), fl = NARG(1);
  if (js_is_kind(p, K_REGEXP)) {
    js_regexp* o = (js_regexp*)p.u.o;
    return js_regexp_new_val(o->source, fl.t == JS_T_UNDEF ? o->flags : js_to_str(fl));
  }
  return js_regexp_new_val(p.t == JS_T_UNDEF ? js_str_c("(?:)") : js_to_str(p), fl.t == JS_T_UNDEF ? A_empty : js_to_str(fl));
}
JS_NATIVE(n_regexp_exec) { return js_regexp_exec(self, js_to_str(NARG(0))); }
JS_NATIVE(n_regexp_test) { return JS_B(js_regexp_exec(self, js_to_str(NARG(0))).t != JS_T_NULL); }
JS_NATIVE(n_regexp_tostring) {
  js_regexp* re = js_this_regexp(self);
  return JS_SV(js_str_concat(js_str_concat(js_str_concat(js_str_char('/'), re->source), js_str_char('/')), re->flags));
}
static js_val js_regexp_match(js_val rv, js_str* s) {
  js_regexp* re = js_this_regexp(rv);
  if (!re->global) return js_regexp_exec(rv, s);
  js_arr* all = js_arr_alloc(0, 8);
  int32_t* caps = (int32_t*)js_alloc_raw(sizeof(int32_t) * (size_t)(2 * (re->prog->ngroups + 1)));
  int32_t from = 0;
  while (from <= s->len && rx_exec_at(re, s, from, re->sticky, caps)) {
    js_arr_push1(all, JS_SV(js_str_sub(s, caps[0], caps[1])));
    from = caps[1] > caps[0] ? caps[1] : caps[1] + 1;
  }
  js_set(rv, A_lastIndex, JS_D(0));
  return all->len ? JS_O(all) : JS_NULL;
}
static js_val js_regexp_search(js_val rv, js_str* s) {
  js_regexp* re = js_this_regexp(rv);
  int32_t* caps = (int32_t*)js_alloc_raw(sizeof(int32_t) * (size_t)(2 * (re->prog->ngroups + 1)));
  return JS_D(rx_exec_at(re, s, 0, re->sticky, caps) ? caps[0] : -1);
}
static js_val js_regexp_replace(js_val rv, js_str* s, js_val with, int all) {
  js_regexp* re = js_this_regexp(rv);
  int global = re->global;
  if (all && !global) js_throw_type("replaceAll must be called with a global RegExp");
  int ng = re->prog->ngroups;
  int32_t* caps = (int32_t*)js_alloc_raw(sizeof(int32_t) * (size_t)(2 * (ng + 1)));
  js_str* out = js_str_new(NULL, 0);
  int32_t from = global ? 0 : (re->sticky ? (int32_t)js_to_integer(js_get(rv, A_lastIndex)) : 0), last = 0;
  js_str* repl = js_is_callable(with) ? NULL : js_to_str(with);
  while (from <= s->len && rx_exec_at(re, s, from, re->sticky, caps)) {
    js_str* matched = js_str_sub(s, caps[0], caps[1]);
    js_val* groups = (js_val*)js_alloc(sizeof(js_val) * (size_t)(ng + 1));
    for (int g = 0; g < ng; ++g) groups[g] = caps[2 * g + 2] >= 0 && caps[2 * g + 3] >= 0 ? JS_SV(js_str_sub(s, caps[2 * g + 2], caps[2 * g + 3])) : JS_U;
    js_str* rep;
    if (!repl) {
      js_val* args = (js_val*)js_alloc(sizeof(js_val) * (size_t)(ng + 3));
      args[0] = JS_SV(matched);
      for (int g = 0; g < ng; ++g) args[g + 1] = groups[g];
      args[ng + 1] = JS_D(caps[0]); args[ng + 2] = JS_SV(s);
      rep = js_to_str(js_call(with, JS_U, ng + 3, args));
    } else rep = js_substitute(matched, s, caps[0], repl, groups, ng);
    out = js_str_concat(js_str_concat(out, js_str_sub(s, last, caps[0])), rep);
    last = caps[1];
    if (!global) break;
    from = caps[1] > caps[0] ? caps[1] : caps[1] + 1;
  }
  if (global) js_set(rv, A_lastIndex, JS_D(0));
  out = js_str_concat(out, js_str_sub(s, last, s->len));
  return JS_SV(out);
}
static js_val js_regexp_split(js_val rv, js_str* s, int64_t limit) {
  js_regexp* re = js_this_regexp(rv);
  int ng = re->prog->ngroups;
  js_arr* r = js_arr_alloc(0, 8);
  if (!limit) return JS_O(r);
  int32_t* caps = (int32_t*)js_alloc_raw(sizeof(int32_t) * (size_t)(2 * (ng + 1)));
  if (!s->len) {
    if (!rx_exec_at(re, s, 0, 1, caps)) js_arr_push1(r, JS_SV(s));
    return JS_O(r);
  }
  int32_t p = 0, q = 0;
  while (q < s->len) {
    if (!rx_exec_at(re, s, q, 1, caps) || caps[1] == p || (caps[1] == caps[0] && caps[0] >= s->len)) { ++q; continue; }
    int32_t e = caps[1];
    if (e == p) { ++q; continue; }
    js_arr_push1(r, JS_SV(js_str_sub(s, p, q)));
    if (r->len >= limit) return JS_O(r);
    for (int g = 0; g < ng; ++g) {
      js_arr_push1(r, caps[2 * g + 2] >= 0 && caps[2 * g + 3] >= 0 ? JS_SV(js_str_sub(s, caps[2 * g + 2], caps[2 * g + 3])) : JS_U);
      if (r->len >= limit) return JS_O(r);
    }
    p = e; q = p == q ? q + 1 : p;
    if (caps[0] == caps[1]) q = p + (p == caps[1] ? 1 : 0);
  }
  js_arr_push1(r, JS_SV(js_str_sub(s, p, s->len)));
  return JS_O(r);
}

// ---------------------------------------------------------------- generated-code helpers
static js_val js_opcodes;
static void js_arr_push_spread(js_arr* a, js_val v) {
  if (js_is_kind(v, K_ARR)) {
    js_arr* b = (js_arr*)v.u.o;
    js_arr_reserve(a, a->len + b->len);
    for (int64_t i = 0; i < b->len; ++i) a->a[a->len++] = b->a[i].t == JS_T_HOLE ? JS_U : b->a[i];
    return;
  }
  js_iter it; js_val x;
  js_iter_init(&it, v);
  while (js_iter_next(&it, &x)) js_arr_push1(a, x);
}
static js_val js_call_array(js_val f, js_val self, js_val args) {
  js_arr* a = js_as_arr(args);
  return js_call(f, self, (int)a->len, a->a);
}
static js_val js_invoke_array(js_val v, js_str* k, js_val args) {
  js_arr* a = js_as_arr(args);
  return js_invoke(v, k, (int)a->len, a->a);
}
static js_val js_new_array(js_val c, js_val args) {
  js_arr* a = js_as_arr(args);
  return js_new(c, (int)a->len, a->a);
}
static js_val js_super_construct_array(js_func* f, js_val self, js_val args, js_val nt) {
  js_arr* a = js_as_arr(args);
  return js_super_construct(f, self, (int)a->len, a->a, nt);
}
/** A template literal: its parts are strings already */
static js_val js_template(int n, js_val* parts) {
  js_str* s = js_str_new(NULL, 0);
  for (int i = 0; i < n; ++i) s = js_str_concat(s, parts[i].u.s);
  return JS_SV(s);
}
static js_val js_unsupported(const char* what) {
  js_throw(js_make_error(js_Error_proto, js_str_concat(js_str_c(what), js_str_c(" is not supported by the C target"))));
}
static void js_glue_init(void) {
  js_opcodes = js_new_object();
  js_define(js_global, js_atom_c("OpCodes"), js_opcodes, P_HIDDEN);
}

// ---------------------------------------------------------------- start-up
static void js_report_uncaught(js_val v) {
  js_str* s;
  if (v.t == JS_T_OBJ) { js_val st = js_get(v, A_stack); s = st.t == JS_T_STR ? st.u.s : js_to_str(v); }
  else s = js_to_str(v);
  fprintf(stderr, "Uncaught %s\n", js_str_utf8z(s));
}
static js_obj* js_error_proto_new(js_obj* parent, const char* name, js_code ctor) {
  js_obj* p = js_obj_new(parent);
  js_define(p, A_name, JS_SV(js_atom_c(name)), P_HIDDEN);
  js_define(p, A_message, JS_SV(A_empty), P_HIDDEN);
  js_val c = js_ctor(name, ctor, 1, p);
  (void)c;
  return p;
}
static js_obj* js_namespace(const char* name) {
  js_obj* o = js_obj_new(js_Object_proto);
  js_define(js_global, js_atom_c(name), JS_O(o), P_HIDDEN);
  return o;
}
static void js_rt_init(void) {
  static int done;
  if (done) return;
  done = 1;
  A_length = js_atom_c("length"); A_prototype = js_atom_c("prototype"); A_constructor = js_atom_c("constructor");
  A_name = js_atom_c("name"); A_message = js_atom_c("message"); A_stack = js_atom_c("stack");
  A_toString = js_atom_c("toString"); A_valueOf = js_atom_c("valueOf"); A_next = js_atom_c("next");
  A_done = js_atom_c("done"); A_value = js_atom_c("value"); A_exports = js_atom_c("exports");
  A_byteLength = js_atom_c("byteLength"); A_byteOffset = js_atom_c("byteOffset"); A_buffer = js_atom_c("buffer");
  A_size = js_atom_c("size"); A_lastIndex = js_atom_c("lastIndex"); A_join = js_atom_c("join");
  A_get = js_atom_c("get"); A_set = js_atom_c("set"); A_cause = js_atom_c("cause");
  A_BYTES_PER_ELEMENT = js_atom_c("BYTES_PER_ELEMENT"); A_undefined = js_atom_c("undefined"); A_null = js_atom_c("null");
  A_true = js_atom_c("true"); A_false = js_atom_c("false"); A_object = js_atom_c("object"); A_function = js_atom_c("function");
  A_number = js_atom_c("number"); A_string = js_atom_c("string"); A_boolean = js_atom_c("boolean"); A_bigint = js_atom_c("bigint");
  A_empty = js_atom_c(""); A_index = js_atom_c("index"); A_input = js_atom_c("input");

  js_Object_proto = js_obj_new(NULL);
  js_Function_proto = js_obj_new(js_Object_proto);
  js_global = js_obj_new(js_Object_proto);
  js_Array_proto = js_obj_new(js_Object_proto);
  js_String_proto = js_obj_new(js_Object_proto);
  js_Number_proto = js_obj_new(js_Object_proto);
  js_Boolean_proto = js_obj_new(js_Object_proto);
  js_BigInt_proto = js_obj_new(js_Object_proto);
  js_Error_proto = js_obj_new(js_Object_proto);
  js_Map_proto = js_obj_new(js_Object_proto);
  js_Set_proto = js_obj_new(js_Object_proto);
  js_ArrayBuffer_proto = js_obj_new(js_Object_proto);
  js_DataView_proto = js_obj_new(js_Object_proto);
  js_TypedArray_proto = js_obj_new(js_Object_proto);
  js_RegExp_proto = js_obj_new(js_Object_proto);
  js_Iterator_proto = js_obj_new(js_Object_proto);
  js_Date_proto = js_obj_new(js_Object_proto);

  js_define(js_global, js_atom_c("globalThis"), JS_O(js_global), P_HIDDEN);
  js_define(js_global, js_atom_c("NaN"), JS_D(NAN), P_HIDDEN);
  js_define(js_global, js_atom_c("Infinity"), JS_D(INFINITY), P_HIDDEN);
  js_define(js_global, A_undefined, JS_U, P_HIDDEN);

  // Object
  js_val Object = js_ctor("Object", n_object_ctor, 1, js_Object_proto);
  js_obj* O = Object.u.o;
  js_method(O, "keys", n_object_keys, 1); js_method(O, "values", n_object_values, 1); js_method(O, "entries", n_object_entries, 1);
  js_method(O, "assign", n_object_assign, 2); js_method(O, "freeze", n_object_freeze, 1); js_method(O, "seal", n_object_seal, 1);
  js_method(O, "preventExtensions", n_object_prevent, 1); js_method(O, "isFrozen", n_object_isfrozen, 1); js_method(O, "isSealed", n_object_issealed, 1);
  js_method(O, "create", n_object_create, 2); js_method(O, "getPrototypeOf", n_object_getproto, 1); js_method(O, "setPrototypeOf", n_object_setproto, 2);
  js_method(O, "defineProperty", n_object_defprop, 3); js_method(O, "getOwnPropertyNames", n_object_names, 1);
  js_method(O, "fromEntries", n_object_fromentries, 1); js_method(O, "hasOwn", n_object_hasown, 2); js_method(O, "is", n_object_is, 2);
  js_method(js_Object_proto, "hasOwnProperty", n_objproto_hasown, 1); js_method(js_Object_proto, "isPrototypeOf", n_objproto_isproto, 1);
  js_method(js_Object_proto, "toString", n_objproto_tostring, 0); js_method(js_Object_proto, "valueOf", n_objproto_valueof, 0);
  js_method(js_Object_proto, "toLocaleString", n_objproto_tolocale, 0);
  // Function
  js_val Function = js_ctor("Function", n_func_tostring, 1, js_Function_proto);
  (void)Function;
  js_method(js_Function_proto, "call", n_func_call, 1); js_method(js_Function_proto, "apply", n_func_apply, 2);
  js_method(js_Function_proto, "bind", n_func_bind, 1); js_method(js_Function_proto, "toString", n_func_tostring, 0);
  // Array
  js_val Array = js_ctor("Array", n_array_ctor, 1, js_Array_proto);
  js_obj* AR = Array.u.o;
  js_method(AR, "isArray", n_array_isarray, 1); js_method(AR, "of", n_array_of, 0); js_method(AR, "from", n_array_from, 1);
  struct { const char* n; js_code c; int l; } am[] = {
    { "push", n_array_push, 1 }, { "pop", n_array_pop, 0 }, { "shift", n_array_shift, 0 }, { "unshift", n_array_unshift, 1 },
    { "slice", n_array_slice, 2 }, { "splice", n_array_splice, 2 }, { "concat", n_array_concat, 1 }, { "join", n_array_join, 1 },
    { "toString", n_array_tostring, 0 }, { "reverse", n_array_reverse, 0 }, { "indexOf", n_array_indexof, 1 },
    { "lastIndexOf", n_array_lastindexof, 1 }, { "includes", n_array_includes, 1 }, { "fill", n_array_fill, 1 },
    { "forEach", n_array_foreach, 1 }, { "map", n_array_map, 1 }, { "filter", n_array_filter, 1 }, { "some", n_array_some, 1 },
    { "every", n_array_every, 1 }, { "find", n_array_find, 1 }, { "findIndex", n_array_findindex, 1 },
    { "findLast", n_array_findlast, 1 }, { "findLastIndex", n_array_findlastindex, 1 }, { "reduce", n_array_reduce, 1 },
    { "reduceRight", n_array_reduceright, 1 }, { "sort", n_array_sort, 1 }, { "at", n_array_at, 1 }, { "flat", n_array_flat, 0 },
    { "flatMap", n_array_flatmap, 1 }, { "copyWithin", n_array_copywithin, 2 }, { "keys", n_array_keys, 0 },
    { "values", n_array_values, 0 }, { "entries", n_array_entries, 0 } };
  for (size_t i = 0; i < sizeof am / sizeof am[0]; ++i) js_method(js_Array_proto, am[i].n, am[i].c, am[i].l);
  js_method(js_Iterator_proto, "next", n_iter_next, 0);
  // typed arrays: generic methods shared with Array.prototype, the rest their own
  const char* shared[] = { "join", "reverse", "indexOf", "lastIndexOf", "includes", "fill", "forEach", "some", "every", "find",
    "findIndex", "findLast", "findLastIndex", "reduce", "reduceRight", "at", "copyWithin", "keys", "values", "entries" };
  for (size_t i = 0; i < sizeof shared / sizeof shared[0]; ++i) js_define(js_TypedArray_proto, js_atom_c(shared[i]), js_get(JS_O(js_Array_proto), js_atom_c(shared[i])), P_HIDDEN);
  js_method(js_TypedArray_proto, "set", n_typed_set, 1); js_method(js_TypedArray_proto, "subarray", n_typed_subarray, 2);
  js_method(js_TypedArray_proto, "slice", n_typed_slice, 2); js_method(js_TypedArray_proto, "map", n_typed_map, 1);
  js_method(js_TypedArray_proto, "filter", n_typed_filter, 1); js_method(js_TypedArray_proto, "sort", n_typed_sort, 1);
  js_method(js_TypedArray_proto, "toString", n_typed_tostring, 0);
  js_code tctors[11] = { n_typed_ctor_0, n_typed_ctor_1, n_typed_ctor_2, n_typed_ctor_3, n_typed_ctor_4, n_typed_ctor_5,
    n_typed_ctor_6, n_typed_ctor_7, n_typed_ctor_8, n_typed_ctor_9, n_typed_ctor_10 };
  for (int tk = 0; tk < 11; ++tk) {
    js_typed_protos[tk] = js_obj_new(js_TypedArray_proto);
    js_val C = js_ctor(js_ta_names[tk], tctors[tk], 3, js_typed_protos[tk]);
    js_as_func(C)->data = (void*)(intptr_t)tk;
    js_method(C.u.o, "from", n_typed_from, 1); js_method(C.u.o, "of", n_typed_of, 0);
    js_define(C.u.o, A_BYTES_PER_ELEMENT, JS_D(js_ta_size[tk]), P_HIDDEN);
    js_define(js_typed_protos[tk], A_BYTES_PER_ELEMENT, JS_D(js_ta_size[tk]), P_HIDDEN);
  }
  js_val AB = js_ctor("ArrayBuffer", n_abuf_ctor, 1, js_ArrayBuffer_proto);
  js_method(AB.u.o, "isView", n_abuf_isview, 1);
  js_method(js_ArrayBuffer_proto, "slice", n_abuf_slice, 2);
  js_ctor("DataView", n_dview_ctor, 1, js_DataView_proto);
  struct { const char* n; js_code c; int l; } dm[] = {
    { "getInt8", n_dv_getint8, 1 }, { "getUint8", n_dv_getuint8, 1 }, { "getInt16", n_dv_getint16, 1 }, { "getUint16", n_dv_getuint16, 1 },
    { "getInt32", n_dv_getint32, 1 }, { "getUint32", n_dv_getuint32, 1 }, { "getFloat32", n_dv_getfloat32, 1 }, { "getFloat64", n_dv_getfloat64, 1 },
    { "getBigInt64", n_dv_getbigint64, 1 }, { "getBigUint64", n_dv_getbiguint64, 1 },
    { "setInt8", n_dv_setint8, 2 }, { "setUint8", n_dv_setuint8, 2 }, { "setInt16", n_dv_setint16, 2 }, { "setUint16", n_dv_setuint16, 2 },
    { "setInt32", n_dv_setint32, 2 }, { "setUint32", n_dv_setuint32, 2 }, { "setFloat32", n_dv_setfloat32, 2 }, { "setFloat64", n_dv_setfloat64, 2 },
    { "setBigInt64", n_dv_setbigint64, 2 }, { "setBigUint64", n_dv_setbiguint64, 2 } };
  for (size_t i = 0; i < sizeof dm / sizeof dm[0]; ++i) js_method(js_DataView_proto, dm[i].n, dm[i].c, dm[i].l);
  // Map, Set
  js_ctor("Map", n_map_ctor, 0, js_Map_proto);
  js_method(js_Map_proto, "get", n_map_get, 1); js_method(js_Map_proto, "set", n_map_set, 2); js_method(js_Map_proto, "has", n_map_has, 1);
  js_method(js_Map_proto, "delete", n_map_delete, 1); js_method(js_Map_proto, "clear", n_map_clear, 0); js_method(js_Map_proto, "forEach", n_map_foreach, 1);
  js_method(js_Map_proto, "keys", n_map_keys, 0); js_method(js_Map_proto, "values", n_map_values, 0); js_method(js_Map_proto, "entries", n_map_entries, 0);
  js_ctor("Set", n_set_ctor, 0, js_Set_proto);
  js_method(js_Set_proto, "add", n_set_add, 1); js_method(js_Set_proto, "has", n_map_has, 1); js_method(js_Set_proto, "delete", n_map_delete, 1);
  js_method(js_Set_proto, "clear", n_map_clear, 0); js_method(js_Set_proto, "forEach", n_map_foreach, 1);
  js_method(js_Set_proto, "keys", n_map_values, 0); js_method(js_Set_proto, "values", n_map_values, 0); js_method(js_Set_proto, "entries", n_map_entries, 0);
  // String
  js_val String = js_ctor("String", n_string_fn, 1, js_String_proto);
  js_as_func(String)->flags = 0;
  js_method(String.u.o, "fromCharCode", n_string_fromcharcode, 1); js_method(String.u.o, "fromCodePoint", n_string_fromcodepoint, 1);
  struct { const char* n; js_code c; int l; } sm[] = {
    { "charAt", n_str_charat, 1 }, { "charCodeAt", n_str_charcodeat, 1 }, { "codePointAt", n_str_codepointat, 1 }, { "at", n_str_at, 1 },
    { "indexOf", n_str_indexof, 1 }, { "lastIndexOf", n_str_lastindexof, 1 }, { "includes", n_str_includes, 1 },
    { "startsWith", n_str_startswith, 1 }, { "endsWith", n_str_endswith, 1 }, { "slice", n_str_slice, 2 },
    { "substring", n_str_substring, 2 }, { "substr", n_str_substr, 2 }, { "toUpperCase", n_str_toupper, 0 },
    { "toLowerCase", n_str_tolower, 0 }, { "toLocaleUpperCase", n_str_toupper, 0 }, { "toLocaleLowerCase", n_str_tolower, 0 },
    { "trim", n_str_trim, 0 }, { "trimStart", n_str_trimstart, 0 }, { "trimEnd", n_str_trimend, 0 },
    { "padStart", n_str_padstart, 2 }, { "padEnd", n_str_padend, 2 }, { "repeat", n_str_repeat, 1 }, { "concat", n_str_concat, 1 },
    { "localeCompare", n_str_localecompare, 1 }, { "toString", n_str_tostring, 0 }, { "valueOf", n_str_tostring, 0 },
    { "normalize", n_str_normalize, 0 }, { "split", n_str_split, 2 }, { "replace", n_str_replace, 2 },
    { "replaceAll", n_str_replaceall, 2 }, { "match", n_str_match, 1 }, { "search", n_str_search, 1 } };
  for (size_t i = 0; i < sizeof sm / sizeof sm[0]; ++i) js_method(js_String_proto, sm[i].n, sm[i].c, sm[i].l);
  // Number, Boolean, BigInt
  js_val Number = js_ctor("Number", n_number_fn, 1, js_Number_proto);
  js_as_func(Number)->flags = 0;
  js_obj* N = Number.u.o;
  js_method(N, "isInteger", n_number_isinteger, 1); js_method(N, "isSafeInteger", n_number_issafe, 1);
  js_method(N, "isFinite", n_number_isfinite, 1); js_method(N, "isNaN", n_number_isnan, 1);
  js_val pi = js_method(N, "parseInt", n_parseint, 2), pf = js_method(N, "parseFloat", n_parsefloat, 1);
  js_define(js_global, js_atom_c("parseInt"), pi, P_HIDDEN); js_define(js_global, js_atom_c("parseFloat"), pf, P_HIDDEN);
  js_define(N, js_atom_c("MAX_SAFE_INTEGER"), JS_D(9007199254740991.0), P_HIDDEN);
  js_define(N, js_atom_c("MIN_SAFE_INTEGER"), JS_D(-9007199254740991.0), P_HIDDEN);
  js_define(N, js_atom_c("EPSILON"), JS_D(2.220446049250313e-16), P_HIDDEN);
  js_define(N, js_atom_c("MAX_VALUE"), JS_D(1.7976931348623157e308), P_HIDDEN);
  js_define(N, js_atom_c("MIN_VALUE"), JS_D(5e-324), P_HIDDEN);
  js_define(N, js_atom_c("POSITIVE_INFINITY"), JS_D(INFINITY), P_HIDDEN);
  js_define(N, js_atom_c("NEGATIVE_INFINITY"), JS_D(-INFINITY), P_HIDDEN);
  js_define(N, js_atom_c("NaN"), JS_D(NAN), P_HIDDEN);
  js_method(js_Number_proto, "toString", n_num_tostring, 1); js_method(js_Number_proto, "toFixed", n_num_tofixed, 1);
  js_method(js_Number_proto, "toPrecision", n_num_toprecision, 1); js_method(js_Number_proto, "valueOf", n_num_valueof, 0);
  js_method(js_Number_proto, "toLocaleString", n_num_tostring, 0);
  js_method(js_global, "isNaN", n_isnan, 1); js_method(js_global, "isFinite", n_isfinite, 1);
  js_val Boolean = js_ctor("Boolean", n_boolean_fn, 1, js_Boolean_proto);
  js_as_func(Boolean)->flags = 0;
  js_method(js_Boolean_proto, "toString", n_bool_tostring, 0); js_method(js_Boolean_proto, "valueOf", n_bool_valueof, 0);
  js_val BigInt = js_ctor("BigInt", n_bigint_fn, 1, js_BigInt_proto);
  js_as_func(BigInt)->flags = 0;
  js_method(BigInt.u.o, "asUintN", n_bigint_asuintn, 2); js_method(BigInt.u.o, "asIntN", n_bigint_asintn, 2);
  js_method(js_BigInt_proto, "toString", n_big_tostring, 0); js_method(js_BigInt_proto, "valueOf", n_big_valueof, 0);
  js_method(js_BigInt_proto, "toLocaleString", n_big_tostring, 0);
  // Math
  js_obj* M = js_namespace("Math");
  struct { const char* n; js_code c; int l; } mm[] = {
    { "abs", n_math_abs, 1 }, { "acos", n_math_acos, 1 }, { "acosh", n_math_acosh, 1 }, { "asin", n_math_asin, 1 },
    { "asinh", n_math_asinh, 1 }, { "atan", n_math_atan, 1 }, { "atanh", n_math_atanh, 1 }, { "atan2", n_math_atan2, 2 },
    { "cbrt", n_math_cbrt, 1 }, { "ceil", n_math_ceil, 1 }, { "clz32", n_math_clz32, 1 }, { "cos", n_math_cos, 1 },
    { "cosh", n_math_cosh, 1 }, { "exp", n_math_exp, 1 }, { "expm1", n_math_expm1, 1 }, { "floor", n_math_floor, 1 },
    { "fround", n_math_fround, 1 }, { "hypot", n_math_hypot, 2 }, { "imul", n_math_imul, 2 }, { "log", n_math_log, 1 },
    { "log1p", n_math_log1p, 1 }, { "log10", n_math_log10, 1 }, { "log2", n_math_log2, 1 }, { "max", n_math_max, 2 },
    { "min", n_math_min, 2 }, { "pow", n_math_pow, 2 }, { "random", n_math_random, 0 }, { "round", n_math_round, 1 },
    { "sign", n_math_sign, 1 }, { "sin", n_math_sin, 1 }, { "sinh", n_math_sinh, 1 }, { "sqrt", n_math_sqrt, 1 },
    { "tan", n_math_tan, 1 }, { "tanh", n_math_tanh, 1 }, { "trunc", n_math_trunc, 1 } };
  for (size_t i = 0; i < sizeof mm / sizeof mm[0]; ++i) js_method(M, mm[i].n, mm[i].c, mm[i].l);
  js_define(M, js_atom_c("PI"), JS_D(3.141592653589793), P_HIDDEN); js_define(M, js_atom_c("E"), JS_D(2.718281828459045), P_HIDDEN);
  js_define(M, js_atom_c("LN2"), JS_D(0.6931471805599453), P_HIDDEN); js_define(M, js_atom_c("LN10"), JS_D(2.302585092994046), P_HIDDEN);
  js_define(M, js_atom_c("LOG2E"), JS_D(1.4426950408889634), P_HIDDEN); js_define(M, js_atom_c("LOG10E"), JS_D(0.4342944819032518), P_HIDDEN);
  js_define(M, js_atom_c("SQRT2"), JS_D(1.4142135623730951), P_HIDDEN); js_define(M, js_atom_c("SQRT1_2"), JS_D(0.7071067811865476), P_HIDDEN);
  // JSON
  js_obj* J = js_namespace("JSON");
  js_method(J, "stringify", n_json_stringify, 3); js_method(J, "parse", n_json_parse, 2);
  // Errors
  js_define(js_Error_proto, A_name, JS_SV(js_atom_c("Error")), P_HIDDEN);
  js_define(js_Error_proto, A_message, JS_SV(A_empty), P_HIDDEN);
  js_method(js_Error_proto, "toString", n_error_tostring, 0);
  js_ctor("Error", n_error_ctor, 1, js_Error_proto);
  js_TypeError_proto = js_error_proto_new(js_Error_proto, "TypeError", n_typeerror_ctor);
  js_RangeError_proto = js_error_proto_new(js_Error_proto, "RangeError", n_rangeerror_ctor);
  js_ReferenceError_proto = js_error_proto_new(js_Error_proto, "ReferenceError", n_referror_ctor);
  js_SyntaxError_proto = js_error_proto_new(js_Error_proto, "SyntaxError", n_syntaxerror_ctor);
  js_EvalError_proto = js_error_proto_new(js_Error_proto, "EvalError", n_evalerror_ctor);
  js_URIError_proto = js_error_proto_new(js_Error_proto, "URIError", n_urierror_ctor);
  // error constructors inherit from Error (static inheritance)
  js_val ErrorC = js_get(JS_O(js_global), js_atom_c("Error"));
  const char* errs[] = { "TypeError", "RangeError", "ReferenceError", "SyntaxError", "EvalError", "URIError" };
  for (int i = 0; i < 6; ++i) js_get(JS_O(js_global), js_atom_c(errs[i])).u.o->proto = ErrorC.u.o;
  // RegExp
  js_ctor("RegExp", n_regexp_ctor, 2, js_RegExp_proto);
  js_method(js_RegExp_proto, "exec", n_regexp_exec, 1); js_method(js_RegExp_proto, "test", n_regexp_test, 1);
  js_method(js_RegExp_proto, "toString", n_regexp_tostring, 0);
  // console, time
  js_obj* C = js_namespace("console");
  js_method(C, "log", n_console_log, 0); js_method(C, "info", n_console_log, 0); js_method(C, "debug", n_console_log, 0);
  js_method(C, "warn", n_console_err, 0); js_method(C, "error", n_console_err, 0); js_method(C, "trace", n_console_err, 0);
  js_val Date = js_ctor("Date", n_date_ctor, 7, js_Date_proto);
  js_method(Date.u.o, "now", n_date_now, 0);
  js_method(js_Date_proto, "getTime", n_date_gettime, 0); js_method(js_Date_proto, "valueOf", n_date_gettime, 0);
  js_method(js_Date_proto, "toString", n_date_tostring, 0);
  js_obj* P = js_namespace("performance");
  js_method(P, "now", n_perf_now, 0);
  js_obj* CR = js_namespace("crypto");
  js_method(CR, "getRandomValues", n_crypto_getrandomvalues, 1);
  js_TextEncoder_proto = js_obj_new(js_Object_proto);
  js_TextDecoder_proto = js_obj_new(js_Object_proto);
  js_ctor("TextEncoder", n_textencoder_ctor, 0, js_TextEncoder_proto);
  js_ctor("TextDecoder", n_textdecoder_ctor, 0, js_TextDecoder_proto);
  js_method(js_TextEncoder_proto, "encode", n_textencoder_encode, 1);
  js_method(js_TextDecoder_proto, "decode", n_textdecoder_decode, 1);
}

// ---------------------------------------------------------------- modules
// Each transpiled file registers an initialiser; they run in file order after
// the runtime. A file's module object collects what it exports (a library's
// exports are then bound to the name an algorithm's factory takes them by).
typedef struct js_module_node { void (*init)(void); struct js_module_node* prev; } js_module_node;
#define JS_MODULE_LIST NULL
static js_val js_last_exports;
static void js_begin_module(void) {
  js_val m = js_new_object();
  js_set(m, A_exports, js_new_object());
  js_define(js_global, js_atom_c("module"), m, P_HIDDEN);
  js_define(js_global, A_exports, js_get(m, A_exports), P_HIDDEN);
}
static void js_end_module(void) {
  js_val m = js_get(JS_O(js_global), js_atom_c("module"));
  js_last_exports = m.t == JS_T_OBJ ? js_get(m, A_exports) : JS_U;
}
static void js_bind_module(const char* name, js_val v) { js_define(js_global, js_atom_c(name), v, P_HIDDEN); }
/** A module that exported nothing exports its top-level names */
static void js_module_autoexport(int n, const char** names, js_val* values) {
  js_val m = js_get(JS_O(js_global), js_atom_c("module"));
  if (m.t != JS_T_OBJ) return;
  js_val ex = js_get(m, A_exports);
  if (ex.t != JS_T_OBJ || ex.u.o->kind != K_OBJ || js_as_arr(js_own_keys(ex))->len) return;
  for (int i = 0; i < n; ++i) js_define(ex.u.o, js_atom_c(names[i]), values[i], 0);
}
/** A module's top-level return (an unwrapped factory's result) is what it exports */
static void js_module_return(js_val v) {
  if (v.t == JS_T_UNDEF) return;
  js_val m = js_get(JS_O(js_global), js_atom_c("module"));
  if (m.t == JS_T_OBJ) js_set(m, A_exports, v);
}
static void js_framework_init(void);
static void js_run_modules(js_module_node* last) {
  js_rt_init();
  js_glue_init();
  js_framework_init();
  int n = 0;
  for (js_module_node* m = last; m; m = m->prev) ++n;
  js_module_node** order = (js_module_node**)js_alloc(sizeof(js_module_node*) * (size_t)(n ? n : 1));
  int k = n;
  for (js_module_node* m = last; m; m = m->prev) order[--k] = m;
  for (int i = 0; i < n; ++i) order[i]->init();
}

#endif // JS_RUNTIME_INCLUDED
`;
  // @@RUNTIME-END

  class CEmitter {
    constructor(options = {}) { this.options = options; }

    /**
     * @param {object} file - CAST.CFile
     * @returns {string} C source
     */
    emit(file) {
      const nl = this.options.lineEnding || '\n';
      const parts = [C_RUNTIME];
      for (const s of file.sections || []) if (s && s.text) parts.push(s.text);
      const text = parts.join('\n');
      return nl === '\n' ? text : text.replace(/\n/g, nl);
    }
  }

  const exports = { CEmitter, C_RUNTIME };
  if (typeof module !== 'undefined' && module.exports) module.exports = exports;
  if (typeof global !== 'undefined') global.CEmitter = CEmitter;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
