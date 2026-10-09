/**
 * CppEmitter.js - C++ Code Emitter
 * Prints the C++ AST CppTransformer builds, after the JavaScript runtime the
 * transpiled code runs on (namespace js: strings, arrays, BigInt, the dynamic
 * value, the AlgorithmFramework classes and the OpCodes helpers).
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';

  // The runtime prelude (C++20). Embedded verbatim ahead of every translation
  // unit; its include guard keeps one copy when files are bundled.
  // @@RUNTIME-BEGIN
  const CPP_RUNTIME = String.raw`// JavaScript runtime for code transpiled from the SynthelicZ Cipher collection.
// One copy per program: bundled files repeat it, the guard keeps the first.
#ifndef JS_RUNTIME_INCLUDED
#define JS_RUNTIME_INCLUDED
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <cmath>
#include <string>
#include <vector>
#include <memory>
#include <functional>
#include <algorithm>
#include <utility>
#include <type_traits>
#include <typeinfo>
#include <initializer_list>
#include <optional>
#include <exception>

namespace js {

// ---------------------------------------------------------------- BigInt
// Arbitrary precision signed integer with JavaScript BigInt semantics:
// truncating division, remainder with the dividend's sign, floor right
// shifts, and bitwise operators on the infinite two's complement form.
class BigInt {
public:
  std::vector<uint32_t> mag; // little-endian limbs, no leading zero limb
  bool neg = false;          // never true for zero

  BigInt() {}
  BigInt(int v) { setI64(v); }
  BigInt(long v) { setI64(v); }
  BigInt(long long v) { setI64(v); }
  BigInt(unsigned v) { setU64(v); }
  BigInt(unsigned long v) { setU64(v); }
  BigInt(unsigned long long v) { setU64(v); }
  explicit BigInt(double d) {
    if (std::isnan(d) || std::isinf(d)) throwRange("The number cannot be converted to a BigInt because it is not an integer");
    d = std::trunc(d);
    bool n = d < 0; if (n) d = -d;
    std::vector<uint32_t> m;
    while (d >= 1) { double q = std::floor(d / 4294967296.0); m.push_back((uint32_t)(d - q * 4294967296.0)); d = q; }
    mag = m; neg = n; trim();
  }
  static BigInt fromMag(std::vector<uint32_t> m, bool n) { BigInt r; r.mag = std::move(m); r.neg = n; r.trim(); return r; }

  void setU64(uint64_t v) { mag.clear(); neg = false; while (v) { mag.push_back((uint32_t)v); v >>= 32; } }
  void setI64(int64_t v) { if (v < 0) { setU64(0 - (uint64_t)v); neg = true; } else setU64((uint64_t)v); }
  void trim() { while (!mag.empty() && mag.back() == 0) mag.pop_back(); if (mag.empty()) neg = false; }
  bool isZero() const { return mag.empty(); }
  [[noreturn]] static void throwRange(const char* msg);

  static int cmpMag(const std::vector<uint32_t>& a, const std::vector<uint32_t>& b) {
    if (a.size() != b.size()) return a.size() < b.size() ? -1 : 1;
    for (size_t i = a.size(); i-- > 0;) if (a[i] != b[i]) return a[i] < b[i] ? -1 : 1;
    return 0;
  }
  static std::vector<uint32_t> addMag(const std::vector<uint32_t>& a, const std::vector<uint32_t>& b) {
    const std::vector<uint32_t>& x = a.size() >= b.size() ? a : b;
    const std::vector<uint32_t>& y = a.size() >= b.size() ? b : a;
    std::vector<uint32_t> r(x.size() + 1);
    uint64_t c = 0;
    for (size_t i = 0; i < x.size(); ++i) { c += (uint64_t)x[i] + (i < y.size() ? y[i] : 0); r[i] = (uint32_t)c; c >>= 32; }
    r[x.size()] = (uint32_t)c;
    while (!r.empty() && r.back() == 0) r.pop_back();
    return r;
  }
  // a - b with |a| >= |b|
  static std::vector<uint32_t> subMag(const std::vector<uint32_t>& a, const std::vector<uint32_t>& b) {
    std::vector<uint32_t> r(a.size());
    int64_t br = 0;
    for (size_t i = 0; i < a.size(); ++i) {
      int64_t d = (int64_t)a[i] - (i < b.size() ? b[i] : 0) - br;
      if (d < 0) { d += 4294967296LL; br = 1; } else br = 0;
      r[i] = (uint32_t)d;
    }
    while (!r.empty() && r.back() == 0) r.pop_back();
    return r;
  }
  static std::vector<uint32_t> mulMag(const std::vector<uint32_t>& a, const std::vector<uint32_t>& b) {
    if (a.empty() || b.empty()) return {};
    std::vector<uint32_t> r(a.size() + b.size());
    for (size_t i = 0; i < a.size(); ++i) {
      uint64_t c = 0, ai = a[i];
      if (!ai) continue;
      for (size_t j = 0; j < b.size(); ++j) { c += ai * b[j] + r[i + j]; r[i + j] = (uint32_t)c; c >>= 32; }
      size_t k = i + b.size();
      while (c) { c += r[k]; r[k++] = (uint32_t)c; c >>= 32; }
    }
    while (!r.empty() && r.back() == 0) r.pop_back();
    return r;
  }
  // Knuth algorithm D: q = a / b, r = a % b (magnitudes)
  static void divMag(const std::vector<uint32_t>& a, const std::vector<uint32_t>& b, std::vector<uint32_t>& q, std::vector<uint32_t>& r) {
    if (b.empty()) throwRange("Division by zero");
    if (cmpMag(a, b) < 0) { q.clear(); r = a; return; }
    if (b.size() == 1) {
      uint64_t rem = 0, d = b[0];
      q.assign(a.size(), 0);
      for (size_t i = a.size(); i-- > 0;) { uint64_t cur = (rem << 32) | a[i]; q[i] = (uint32_t)(cur / d); rem = cur % d; }
      while (!q.empty() && q.back() == 0) q.pop_back();
      r.clear(); if (rem) r.push_back((uint32_t)rem);
      return;
    }
    int s = 0; uint32_t top = b.back(); while (!(top & 0x80000000u)) { top <<= 1; ++s; }
    std::vector<uint32_t> bn(b.size()), an(a.size() + 1);
    for (size_t i = b.size(); i-- > 0;) bn[i] = (b[i] << s) | (s && i ? (uint32_t)((uint64_t)b[i - 1] >> (32 - s)) : 0);
    an[a.size()] = s ? (uint32_t)((uint64_t)a.back() >> (32 - s)) : 0;
    for (size_t i = a.size(); i-- > 0;) an[i] = (a[i] << s) | (s && i ? (uint32_t)((uint64_t)a[i - 1] >> (32 - s)) : 0);
    size_t n = bn.size(), m = a.size() - n;
    q.assign(m + 1, 0);
    for (size_t j = m + 1; j-- > 0;) {
      uint64_t num = ((uint64_t)an[j + n] << 32) | an[j + n - 1];
      uint64_t qhat = num / bn[n - 1], rhat = num % bn[n - 1];
      while (qhat >= 4294967296ULL || qhat * bn[n - 2] > ((rhat << 32) | an[j + n - 2])) {
        --qhat; rhat += bn[n - 1]; if (rhat >= 4294967296ULL) break;
      }
      int64_t borrow = 0; uint64_t carry = 0;
      for (size_t i = 0; i < n; ++i) {
        uint64_t p = qhat * bn[i] + carry; carry = p >> 32;
        int64_t t = (int64_t)an[i + j] - borrow - (int64_t)(uint32_t)p;
        an[i + j] = (uint32_t)t; borrow = t < 0 ? 1 : 0;
      }
      int64_t t = (int64_t)an[j + n] - borrow - (int64_t)carry;
      an[j + n] = (uint32_t)t;
      if (t < 0) {
        --qhat; uint64_t c = 0;
        for (size_t i = 0; i < n; ++i) { c += (uint64_t)an[i + j] + bn[i]; an[i + j] = (uint32_t)c; c >>= 32; }
        an[j + n] += (uint32_t)c;
      }
      q[j] = (uint32_t)qhat;
    }
    while (!q.empty() && q.back() == 0) q.pop_back();
    r.assign(n, 0);
    for (size_t i = 0; i < n; ++i) r[i] = (an[i] >> s) | (s && i + 1 < an.size() ? (uint32_t)((uint64_t)an[i + 1] << (32 - s)) : 0);
    while (!r.empty() && r.back() == 0) r.pop_back();
  }

  friend BigInt operator-(const BigInt& a) { BigInt r = a; if (!r.isZero()) r.neg = !r.neg; return r; }
  friend BigInt operator+(const BigInt& a, const BigInt& b) {
    if (a.neg == b.neg) return fromMag(addMag(a.mag, b.mag), a.neg);
    int c = cmpMag(a.mag, b.mag);
    if (c == 0) return BigInt();
    return c > 0 ? fromMag(subMag(a.mag, b.mag), a.neg) : fromMag(subMag(b.mag, a.mag), b.neg);
  }
  friend BigInt operator-(const BigInt& a, const BigInt& b) { return a + (-b); }
  friend BigInt operator*(const BigInt& a, const BigInt& b) { return fromMag(mulMag(a.mag, b.mag), a.neg != b.neg); }
  friend BigInt operator/(const BigInt& a, const BigInt& b) { std::vector<uint32_t> q, r; divMag(a.mag, b.mag, q, r); return fromMag(q, a.neg != b.neg); }
  friend BigInt operator%(const BigInt& a, const BigInt& b) { std::vector<uint32_t> q, r; divMag(a.mag, b.mag, q, r); return fromMag(r, a.neg); }
  BigInt pow(const BigInt& e) const {
    if (e.neg) throwRange("Exponent must be non-negative");
    BigInt result(1), base = *this;
    size_t bits = e.bitLength();
    for (size_t i = 0; i < bits; ++i) { if (e.testBit(i)) result = result * base; if (i + 1 < bits) base = base * base; }
    return result;
  }
  size_t bitLength() const { if (mag.empty()) return 0; size_t n = (mag.size() - 1) * 32; uint32_t t = mag.back(); while (t) { ++n; t >>= 1; } return n; }
  bool testBit(size_t i) const { size_t w = i / 32; return w < mag.size() && ((mag[w] >> (i % 32)) & 1); }

  BigInt shl(int64_t n) const {
    if (n < 0) return shr(-n);
    if (isZero()) return *this;
    size_t w = (size_t)(n / 32), b = (size_t)(n % 32);
    std::vector<uint32_t> r(mag.size() + w + 1, 0);
    for (size_t i = 0; i < mag.size(); ++i) {
      uint64_t v = (uint64_t)mag[i] << b;
      r[i + w] |= (uint32_t)v; r[i + w + 1] |= (uint32_t)(v >> 32);
    }
    return fromMag(r, neg);
  }
  // floor(this / 2^n)
  BigInt shr(int64_t n) const {
    if (n < 0) return shl(-n);
    if (isZero()) return *this;
    size_t w = (size_t)(n / 32), b = (size_t)(n % 32);
    bool lost = false;
    for (size_t i = 0; i < std::min(w, mag.size()); ++i) if (mag[i]) { lost = true; break; }
    if (!lost && b && w < mag.size() && (mag[w] & ((1u << b) - 1))) lost = true;
    std::vector<uint32_t> r;
    if (w < mag.size()) {
      r.assign(mag.size() - w, 0);
      for (size_t i = w; i < mag.size(); ++i) {
        uint64_t v = mag[i] >> b;
        if (b && i + 1 < mag.size()) v |= (uint64_t)mag[i + 1] << (32 - b);
        r[i - w] = (uint32_t)v;
      }
    }
    BigInt res = fromMag(r, neg);
    if (neg && lost) res = res - BigInt(1);
    return res;
  }
  // two's complement limbs of length n (n large enough)
  std::vector<uint32_t> twos(size_t n) const {
    std::vector<uint32_t> r(n, 0);
    for (size_t i = 0; i < mag.size() && i < n; ++i) r[i] = mag[i];
    if (neg) { uint64_t c = 1; for (size_t i = 0; i < n; ++i) { c += (uint32_t)~r[i]; r[i] = (uint32_t)c; c >>= 32; } }
    return r;
  }
  static BigInt fromTwos(std::vector<uint32_t> r) {
    bool n = !r.empty() && (r.back() & 0x80000000u);
    if (n) { uint64_t c = 1; for (size_t i = 0; i < r.size(); ++i) { c += (uint32_t)~r[i]; r[i] = (uint32_t)c; c >>= 32; } }
    return fromMag(r, n);
  }
  template <class F> static BigInt bitwise(const BigInt& a, const BigInt& b, F f) {
    size_t n = std::max(a.mag.size(), b.mag.size()) + 1;
    std::vector<uint32_t> x = a.twos(n), y = b.twos(n);
    for (size_t i = 0; i < n; ++i) x[i] = f(x[i], y[i]);
    return fromTwos(x);
  }
  friend BigInt operator&(const BigInt& a, const BigInt& b) {
    if (!a.neg && !b.neg) { std::vector<uint32_t> r(std::min(a.mag.size(), b.mag.size())); for (size_t i = 0; i < r.size(); ++i) r[i] = a.mag[i] & b.mag[i]; return fromMag(r, false); }
    return bitwise(a, b, [](uint32_t x, uint32_t y) { return x & y; });
  }
  friend BigInt operator|(const BigInt& a, const BigInt& b) {
    if (!a.neg && !b.neg) { std::vector<uint32_t> r(std::max(a.mag.size(), b.mag.size())); for (size_t i = 0; i < r.size(); ++i) r[i] = (i < a.mag.size() ? a.mag[i] : 0) | (i < b.mag.size() ? b.mag[i] : 0); return fromMag(r, false); }
    return bitwise(a, b, [](uint32_t x, uint32_t y) { return x | y; });
  }
  friend BigInt operator^(const BigInt& a, const BigInt& b) {
    if (!a.neg && !b.neg) { std::vector<uint32_t> r(std::max(a.mag.size(), b.mag.size())); for (size_t i = 0; i < r.size(); ++i) r[i] = (i < a.mag.size() ? a.mag[i] : 0) ^ (i < b.mag.size() ? b.mag[i] : 0); return fromMag(r, false); }
    return bitwise(a, b, [](uint32_t x, uint32_t y) { return x ^ y; });
  }
  friend BigInt operator~(const BigInt& a) { return -a - BigInt(1); }
  friend BigInt operator<<(const BigInt& a, const BigInt& n) { return a.shl(n.toI64()); }
  friend BigInt operator>>(const BigInt& a, const BigInt& n) { return a.shr(n.toI64()); }
  static int cmp(const BigInt& a, const BigInt& b) {
    if (a.neg != b.neg) return a.neg ? -1 : 1;
    int c = cmpMag(a.mag, b.mag);
    return a.neg ? -c : c;
  }
  friend bool operator==(const BigInt& a, const BigInt& b) { return a.neg == b.neg && a.mag == b.mag; }
  friend bool operator!=(const BigInt& a, const BigInt& b) { return !(a == b); }
  friend bool operator<(const BigInt& a, const BigInt& b) { return cmp(a, b) < 0; }
  friend bool operator<=(const BigInt& a, const BigInt& b) { return cmp(a, b) <= 0; }
  friend bool operator>(const BigInt& a, const BigInt& b) { return cmp(a, b) > 0; }
  friend bool operator>=(const BigInt& a, const BigInt& b) { return cmp(a, b) >= 0; }
  explicit operator bool() const { return !isZero(); }

  uint64_t lowU64() const { uint64_t v = (mag.size() > 0 ? mag[0] : 0) | ((uint64_t)(mag.size() > 1 ? mag[1] : 0) << 32); return neg ? 0 - v : v; }
  int64_t toI64() const { return (int64_t)lowU64(); }
  uint64_t toU64() const { return lowU64(); }
  double toDouble() const {
    double r = 0;
    for (size_t i = mag.size(); i-- > 0;) r = r * 4294967296.0 + mag[i];
    return neg ? -r : r;
  }
  BigInt asUintN(int64_t bits) const {
    if (bits <= 0) return BigInt();
    size_t n = (size_t)((bits + 31) / 32);
    std::vector<uint32_t> r = twos(std::max(n, mag.size() + 1));
    r.resize(n);
    if (bits % 32) r[n - 1] &= (1u << (bits % 32)) - 1;
    return fromMag(r, false);
  }
  BigInt asIntN(int64_t bits) const {
    if (bits <= 0) return BigInt();
    BigInt u = asUintN(bits);
    if (u.testBit((size_t)bits - 1)) return u - BigInt(1).shl(bits);
    return u;
  }
  std::string toStdString(int radix = 10) const {
    if (isZero()) return "0";
    static const char* digits = "0123456789abcdefghijklmnopqrstuvwxyz";
    std::vector<uint32_t> m = mag, q, r;
    std::string s;
    std::vector<uint32_t> div{(uint32_t)radix};
    while (!m.empty()) {
      // divide by radix
      uint64_t rem = 0;
      for (size_t i = m.size(); i-- > 0;) { uint64_t cur = (rem << 32) | m[i]; m[i] = (uint32_t)(cur / (uint64_t)radix); rem = cur % (uint64_t)radix; }
      while (!m.empty() && m.back() == 0) m.pop_back();
      s.push_back(digits[rem]);
    }
    if (neg) s.push_back('-');
    std::reverse(s.begin(), s.end());
    return s;
  }
  static bool parse(const std::string& text, BigInt& out) {
    std::string t;
    for (char c : text) if (!std::isspace((unsigned char)c)) t.push_back(c);
    int radix = 10; size_t i = 0; bool n = false;
    if (t.size() > 2 && t[0] == '0' && (t[1] == 'x' || t[1] == 'X')) { radix = 16; i = 2; }
    else if (t.size() > 2 && t[0] == '0' && (t[1] == 'b' || t[1] == 'B')) { radix = 2; i = 2; }
    else if (t.size() > 2 && t[0] == '0' && (t[1] == 'o' || t[1] == 'O')) { radix = 8; i = 2; }
    else if (!t.empty() && (t[0] == '-' || t[0] == '+')) { n = t[0] == '-'; i = 1; }
    if (i >= t.size()) { out = BigInt(); return t.empty(); }
    BigInt r;
    std::vector<uint32_t> m;
    for (; i < t.size(); ++i) {
      char c = (char)std::tolower((unsigned char)t[i]);
      int d = c >= '0' && c <= '9' ? c - '0' : c >= 'a' && c <= 'z' ? c - 'a' + 10 : 99;
      if (d >= radix) return false;
      uint64_t carry = (uint64_t)d;
      for (size_t k = 0; k < m.size(); ++k) { carry += (uint64_t)m[k] * (uint64_t)radix; m[k] = (uint32_t)carry; carry >>= 32; }
      if (carry) m.push_back((uint32_t)carry);
    }
    out = fromMag(m, n);
    return true;
  }
  static BigInt fromString(const char* text) { BigInt r; if (!parse(text, r)) throwSyntax(text); return r; }
  [[noreturn]] static void throwSyntax(const std::string& text);
};

// ---------------------------------------------------------------- forward declarations
struct Object;
class Any;
class String;
struct ArrayBase;
template <class E> class Array;
using Fun = std::function<Any(std::vector<Any>&)>;

[[noreturn]] void throwError(const char16_t* type, const std::u16string& message);
[[noreturn]] inline void throwTypeError(const std::u16string& message) { throwError(u"TypeError", message); }
[[noreturn]] inline void throwRangeError(const std::u16string& message) { throwError(u"RangeError", message); }
std::u16string fromUtf8(const std::string& s);
std::string toUtf8(const std::u16string& s);

[[noreturn]] inline void BigInt::throwRange(const char* msg) { throwError(u"RangeError", fromUtf8(msg)); }
[[noreturn]] inline void BigInt::throwSyntax(const std::string& text) { throwError(u"SyntaxError", u"Cannot convert " + fromUtf8(text) + u" to a BigInt"); }

// ---------------------------------------------------------------- numbers
// JavaScript ToInt32/ToUint32 and their wider relatives, for doubles
inline int64_t d2i64(double d) {
  if (!std::isfinite(d)) return 0;
  d = std::trunc(d);
  if (d >= -9223372036854775808.0 && d < 9223372036854775808.0) return (int64_t)d;
  double m = std::fmod(d, 18446744073709551616.0);
  if (m < 0) m += 18446744073709551616.0;
  return (int64_t)(uint64_t)m;
}
inline uint64_t d2u64(double d) {
  if (!std::isfinite(d)) return 0;
  d = std::trunc(d);
  if (d >= 0 && d < 18446744073709551616.0) return (uint64_t)d;
  return (uint64_t)d2i64(d);
}
inline int32_t toInt32(double d) {
  if (!std::isfinite(d)) return 0;
  double t = std::trunc(d);
  if (t >= -2147483648.0 && t <= 2147483647.0) return (int32_t)t;
  double m = std::fmod(t, 4294967296.0);
  if (m < 0) m += 4294967296.0;
  return (int32_t)(uint32_t)m;
}
inline uint32_t toUint32(double d) { return (uint32_t)toInt32(d); }

// A number of any C++ arithmetic type to another, the way a JavaScript store
// into a typed site wraps it: integers modulo 2^n, doubles truncated first.
template <class T, class F> inline T num(F v) {
  if constexpr (std::is_same_v<T, bool>) return v != 0;
  else if constexpr (std::is_floating_point_v<T>) return (T)v;
  else if constexpr (std::is_floating_point_v<F>) {
    if constexpr (sizeof(T) == 8) { if constexpr (std::is_signed_v<T>) return (T)d2i64((double)v); else return (T)d2u64((double)v); }
    else return (T)(uint32_t)toInt32((double)v);
  }
  else return (T)v;
}

struct boolbox {
  bool v;
  boolbox(bool b = false) : v(b) {}
  operator bool() const { return v; }
  boolbox& operator=(bool b) { v = b; return *this; }
  boolbox& operator^=(bool b) { v = v ^ b; return *this; }
  boolbox& operator|=(bool b) { v = v | b; return *this; }
  boolbox& operator&=(bool b) { v = v & b; return *this; }
};

// ---------------------------------------------------------------- strings
class String {
public:
  std::shared_ptr<const std::u16string> p;
  String() {}
  String(std::nullptr_t) {}
  String(const char16_t* s) : p(std::make_shared<const std::u16string>(s)) {}
  String(const char16_t* s, size_t n) : p(std::make_shared<const std::u16string>(s, n)) {}
  String(std::u16string s) : p(std::make_shared<const std::u16string>(std::move(s))) {}
  static String latin1(const std::string& s) { std::u16string u; u.reserve(s.size()); for (unsigned char c : s) u.push_back(c); return String(std::move(u)); }
  bool isNull() const { return !p; }
  const std::u16string& s() const { static const std::u16string empty; return p ? *p : empty; }
  int32_t length() const { return (int32_t)s().size(); }
  explicit operator bool() const { return p && !p->empty(); }
  int32_t charCodeAt(int64_t i) const { const auto& x = s(); return i >= 0 && (uint64_t)i < x.size() ? (int32_t)x[(size_t)i] : 0; }
  int32_t codePointAt(int64_t i) const {
    const auto& x = s();
    if (i < 0 || (uint64_t)i >= x.size()) return 0;
    char16_t c = x[(size_t)i];
    if (c >= 0xD800 && c < 0xDC00 && (size_t)i + 1 < x.size()) { char16_t d = x[(size_t)i + 1]; if (d >= 0xDC00 && d < 0xE000) return 0x10000 + ((c - 0xD800) << 10) + (d - 0xDC00); }
    return c;
  }
  String charAt(int64_t i) const { const auto& x = s(); return i >= 0 && (uint64_t)i < x.size() ? String(std::u16string(1, x[(size_t)i])) : String(u""); }
  String at(int64_t i) const { const auto& x = s(); if (i < 0) i += (int64_t)x.size(); return i >= 0 && (uint64_t)i < x.size() ? String(std::u16string(1, x[(size_t)i])) : String(); }
  int32_t indexOf(const String& t, int64_t from = 0) const {
    const auto& x = s(); if (from < 0) from = 0; if ((uint64_t)from > x.size()) from = (int64_t)x.size();
    size_t r = x.find(t.s(), (size_t)from); return r == std::u16string::npos ? -1 : (int32_t)r;
  }
  int32_t lastIndexOf(const String& t) const { size_t r = s().rfind(t.s()); return r == std::u16string::npos ? -1 : (int32_t)r; }
  int32_t lastIndexOf(const String& t, int64_t from) const { if (from < 0) from = 0; size_t r = s().rfind(t.s(), (size_t)from); return r == std::u16string::npos ? -1 : (int32_t)r; }
  bool includes(const String& t) const { return s().find(t.s()) != std::u16string::npos; }
  bool startsWith(const String& t) const { return s().compare(0, t.s().size(), t.s()) == 0 && s().size() >= t.s().size(); }
  bool endsWith(const String& t) const { const auto& x = s(); const auto& y = t.s(); return x.size() >= y.size() && x.compare(x.size() - y.size(), y.size(), y) == 0; }
  static int64_t clampIndex(double v, int64_t len) { if (std::isnan(v)) return 0; if (v < 0) return 0; if (v > (double)len) return len; return (int64_t)v; }
  String substring(double a) const { return substring(a, (double)length()); }
  String substring(double a, double b) const {
    int64_t n = length(); int64_t x = clampIndex(a, n), y = clampIndex(b, n);
    if (x > y) std::swap(x, y);
    return String(s().substr((size_t)x, (size_t)(y - x)));
  }
  String substr(double a) const { return substr(a, (double)length()); }
  String substr(double a, double l) const {
    int64_t n = length(); int64_t x = (int64_t)a; if (a < 0) x = std::max<int64_t>(0, n + (int64_t)a); if (x > n) x = n;
    int64_t c = std::isnan(l) ? 0 : (int64_t)std::min<double>(std::max<double>(l, 0), (double)(n - x));
    return String(s().substr((size_t)x, (size_t)c));
  }
  static int64_t relIndex(double v, int64_t len) { if (std::isnan(v)) return 0; int64_t k = v < 0 ? (int64_t)std::max<double>((double)len + v, 0) : (int64_t)std::min<double>(v, (double)len); return k; }
  String slice(double a) const { return slice(a, (double)length()); }
  String slice(double a, double b) const {
    int64_t n = length(); int64_t x = relIndex(a, n), y = relIndex(b, n);
    if (y < x) y = x;
    return String(s().substr((size_t)x, (size_t)(y - x)));
  }
  String toUpperCase() const { std::u16string r = s(); for (auto& c : r) if ((c >= u'a' && c <= u'z') || (c >= 0xE0 && c <= 0xFE && c != 0xF7)) c = (char16_t)(c - 32); return String(std::move(r)); }
  String toLowerCase() const { std::u16string r = s(); for (auto& c : r) if ((c >= u'A' && c <= u'Z') || (c >= 0xC0 && c <= 0xDE && c != 0xD7)) c = (char16_t)(c + 32); return String(std::move(r)); }
  static bool isSpace(char16_t c) { return c == u' ' || c == u'\t' || c == u'\n' || c == u'\r' || c == 0x0B || c == 0x0C || c == 0xA0 || c == 0xFEFF || c == 0x2028 || c == 0x2029; }
  String trim() const { const auto& x = s(); size_t a = 0, b = x.size(); while (a < b && isSpace(x[a])) ++a; while (b > a && isSpace(x[b - 1])) --b; return String(x.substr(a, b - a)); }
  String trimStart() const { const auto& x = s(); size_t a = 0; while (a < x.size() && isSpace(x[a])) ++a; return String(x.substr(a)); }
  String trimEnd() const { const auto& x = s(); size_t b = x.size(); while (b > 0 && isSpace(x[b - 1])) --b; return String(x.substr(0, b)); }
  String repeat(double n) const { if (n < 0) throwRangeError(u"Invalid count value"); std::u16string r; for (int64_t i = 0; i < (int64_t)n; ++i) r += s(); return String(std::move(r)); }
  String padStart(double n, const String& f = String(u" ")) const {
    std::u16string x = s(); if ((double)x.size() >= n || f.s().empty()) return *this;
    std::u16string pad; while ((double)(pad.size() + x.size()) < n) pad += f.s();
    pad.resize((size_t)n - x.size()); return String(pad + x);
  }
  String padEnd(double n, const String& f = String(u" ")) const {
    std::u16string x = s(); if ((double)x.size() >= n || f.s().empty()) return *this;
    while ((double)x.size() < n) x += f.s();
    x.resize((size_t)n); return String(x);
  }
  String replaceFirst(const String& a, const String& b) const { std::u16string x = s(); size_t k = x.find(a.s()); if (k != std::u16string::npos) x.replace(k, a.s().size(), b.s()); return String(x); }
  String replaceAll(const String& a, const String& b) const {
    if (a.s().empty()) return *this;
    std::u16string x = s(), r; size_t k = 0, f;
    while ((f = x.find(a.s(), k)) != std::u16string::npos) { r += x.substr(k, f - k); r += b.s(); k = f + a.s().size(); }
    r += x.substr(k); return String(r);
  }
  Array<String> split(const String& sep) const;
  Array<String> split() const;
  String concat(const String& b) const { return String(s() + b.s()); }
  std::string utf8() const { return p ? toUtf8(*p) : std::string("null"); }
  friend bool operator==(const String& a, const String& b) { if (!a.p || !b.p) return !a.p && !b.p; return a.p == b.p || *a.p == *b.p; }
  friend bool operator!=(const String& a, const String& b) { return !(a == b); }
  friend bool operator<(const String& a, const String& b) { return a.s() < b.s(); }
  friend bool operator>(const String& a, const String& b) { return a.s() > b.s(); }
  friend bool operator<=(const String& a, const String& b) { return a.s() <= b.s(); }
  friend bool operator>=(const String& a, const String& b) { return a.s() >= b.s(); }
  friend String operator+(const String& a, const String& b) { return String(a.s() + b.s()); }
};

inline std::u16string fromUtf8(const std::string& s) {
  std::u16string r;
  for (size_t i = 0; i < s.size();) {
    unsigned char c = s[i];
    uint32_t cp; int n;
    if (c < 0x80) { cp = c; n = 1; } else if ((c >> 5) == 6) { cp = c & 0x1F; n = 2; } else if ((c >> 4) == 14) { cp = c & 0x0F; n = 3; } else { cp = c & 0x07; n = 4; }
    for (int k = 1; k < n && i + k < s.size(); ++k) cp = (cp << 6) | (s[i + k] & 0x3F);
    i += n;
    if (cp >= 0x10000) { cp -= 0x10000; r.push_back((char16_t)(0xD800 + (cp >> 10))); r.push_back((char16_t)(0xDC00 + (cp & 0x3FF))); }
    else r.push_back((char16_t)cp);
  }
  return r;
}
inline std::string toUtf8(const std::u16string& s) {
  std::string r;
  for (size_t i = 0; i < s.size(); ++i) {
    uint32_t cp = s[i];
    if (cp >= 0xD800 && cp < 0xDC00 && i + 1 < s.size() && s[i + 1] >= 0xDC00 && s[i + 1] < 0xE000) { cp = 0x10000 + ((cp - 0xD800) << 10) + (s[i + 1] - 0xDC00); ++i; }
    if (cp < 0x80) r.push_back((char)cp);
    else if (cp < 0x800) { r.push_back((char)(0xC0 | (cp >> 6))); r.push_back((char)(0x80 | (cp & 0x3F))); }
    else if (cp < 0x10000) { r.push_back((char)(0xE0 | (cp >> 12))); r.push_back((char)(0x80 | ((cp >> 6) & 0x3F))); r.push_back((char)(0x80 | (cp & 0x3F))); }
    else { r.push_back((char)(0xF0 | (cp >> 18))); r.push_back((char)(0x80 | ((cp >> 12) & 0x3F))); r.push_back((char)(0x80 | ((cp >> 6) & 0x3F))); r.push_back((char)(0x80 | (cp & 0x3F))); }
  }
  return r;
}

// Number.prototype.toString
inline std::u16string numberText(double d, int radix = 10) {
  if (std::isnan(d)) return u"NaN";
  if (std::isinf(d)) return d < 0 ? u"-Infinity" : u"Infinity";
  if (d == 0) return u"0";
  if (radix != 10) {
    bool neg = d < 0; if (neg) d = -d;
    double ip = std::floor(d), fp = d - ip;
    std::string s;
    static const char* digits = "0123456789abcdefghijklmnopqrstuvwxyz";
    if (ip == 0) s = "0";
    while (ip >= 1) { double q = std::floor(ip / radix); s.push_back(digits[(int)(ip - q * radix)]); ip = q; }
    std::reverse(s.begin(), s.end());
    if (fp > 0) { s.push_back('.'); for (int k = 0; k < 52 && fp > 0; ++k) { fp *= radix; int dg = (int)fp; s.push_back(digits[dg]); fp -= dg; } }
    if (neg) s.insert(s.begin(), '-');
    return fromUtf8(s);
  }
  char buf[64];
  int prec = 1;
  for (; prec <= 17; ++prec) { std::snprintf(buf, sizeof buf, "%.*e", prec - 1, d); if (std::strtod(buf, nullptr) == d) break; }
  // buf = [-]d.ddddde[+-]xx
  std::string m(buf);
  bool neg = m[0] == '-'; if (neg) m = m.substr(1);
  size_t e = m.find('e');
  int exp = std::atoi(m.c_str() + e + 1);
  std::string digits;
  for (size_t i = 0; i < e; ++i) if (m[i] != '.') digits.push_back(m[i]);
  while (digits.size() > 1 && digits.back() == '0') digits.pop_back();
  int k = (int)digits.size(), n = exp + 1;
  std::string r;
  if (k <= n && n <= 21) { r = digits + std::string(n - k, '0'); }
  else if (0 < n && n <= 21) { r = digits.substr(0, n) + "." + digits.substr(n); }
  else if (-6 < n && n <= 0) { r = "0." + std::string(-n, '0') + digits; }
  else {
    std::string ex = (n - 1 >= 0 ? "+" : "-") + std::to_string(std::abs(n - 1));
    r = k == 1 ? digits + "e" + ex : digits.substr(0, 1) + "." + digits.substr(1) + "e" + ex;
  }
  if (neg) r = "-" + r;
  return fromUtf8(r);
}
inline String str(double d) { return String(numberText(d)); }
inline String str(float d) { return String(numberText(d)); }
template <class T, std::enable_if_t<std::is_integral_v<T> && !std::is_same_v<T, bool>, int> = 0>
inline String str(T v) { return String(fromUtf8(std::to_string(v))); }
inline String str(bool b) { return String(b ? u"true" : u"false"); }
inline String str(const String& s) { return s.isNull() ? String(u"null") : s; }
inline String str(const BigInt& b) { return String(fromUtf8(b.toStdString())); }
inline String str(const char16_t* s) { return String(s); }
template <class T> inline String str(T* o);
String str(const Any& a);
template <class E> String str(const Array<E>& a);

// ---------------------------------------------------------------- dynamic values
enum class Tag : uint8_t { Undef, Null, Bool, Num, I64, U64, Str, Big, Arr, Obj, Fn };

class Any {
public:
  Tag tag = Tag::Undef;
  union { bool b; double d; int64_t i; uint64_t u; Object* o; };
  std::shared_ptr<void> r; // Str: const std::u16string, Big: BigInt, Arr: ArrayBase, Fn: Fun
  Any() : i(0) {}
  Any(std::nullptr_t) : tag(Tag::Null), i(0) {}
  static Any undefined() { return Any(); }
  Any(bool v) : tag(Tag::Bool), i(0) { b = v; }
  Any(boolbox v) : tag(Tag::Bool), i(0) { b = v.v; }
  Any(double v) : tag(Tag::Num), d(v) {}
  Any(float v) : tag(Tag::Num), d(v) {}
  Any(int8_t v) : tag(Tag::I64), i(v) {}
  Any(uint8_t v) : tag(Tag::I64), i(v) {}
  Any(int16_t v) : tag(Tag::I64), i(v) {}
  Any(uint16_t v) : tag(Tag::I64), i(v) {}
  Any(int32_t v) : tag(Tag::I64), i(v) {}
  Any(uint32_t v) : tag(Tag::I64), i(v) {}
  Any(long v) : tag(Tag::I64), i(v) {}
  Any(unsigned long v) : tag(Tag::U64), u(v) {}
  Any(long long v) : tag(Tag::I64), i(v) {}
  Any(unsigned long long v) : tag(Tag::U64), u(v) {}
  Any(const String& s) : tag(s.isNull() ? Tag::Null : Tag::Str), i(0) { if (!s.isNull()) r = std::const_pointer_cast<std::u16string>(s.p); }
  Any(const char16_t* s) : Any(String(s)) {}
  Any(const BigInt& v) : tag(Tag::Big), i(0), r(std::make_shared<BigInt>(v)) {}
  template <class E> Any(const Array<E>& a);
  template <class T, std::enable_if_t<std::is_base_of_v<Object, T>, int> = 0>
  Any(T* p) : tag(p ? Tag::Obj : Tag::Null), o(p) {}
  Any(const Fun& f) : tag(f ? Tag::Fn : Tag::Null), i(0) { if (f) r = std::make_shared<Fun>(f); }

  bool isUndef() const { return tag == Tag::Undef; }
  bool isNullish() const { return tag == Tag::Undef || tag == Tag::Null; }
  bool isNumber() const { return tag == Tag::Num || tag == Tag::I64 || tag == Tag::U64; }
  String asString() const { String s; if (tag == Tag::Str) s.p = std::static_pointer_cast<const std::u16string>(r); return s; }
  const BigInt& asBig() const { return *std::static_pointer_cast<BigInt>(r); }
  ArrayBase* asArr() const { return tag == Tag::Arr ? (ArrayBase*)r.get() : nullptr; }
  Fun* asFun() const { return tag == Tag::Fn ? (Fun*)r.get() : nullptr; }
  double toNumber() const;
  bool truthy() const;
  String typeOf() const;
  // dynamic member access
  Any get(const String& key) const;
  void set(const String& key, const Any& v) const;
  Any index(const Any& key) const;
  void setIndex(const Any& key, const Any& v) const;
  int32_t length() const;
  Any call(std::vector<Any> args) const;
  Any callMethod(const String& name, std::vector<Any> args) const;
};

// ---------------------------------------------------------------- objects
// Base of every class instance and dynamic object. Instances are never freed
// (JavaScript object graphs are garbage collected; the programs here are short).
struct Object {
  std::vector<std::pair<std::u16string, Any>>* __expando = nullptr;
  virtual ~Object() {}
  Object* __ctor() { return this; }
  virtual const char16_t* __className() const { return u"Object"; }
  Any* __expandoSlot(const std::u16string& k, bool create) {
    if (__expando) for (auto& kv : *__expando) if (kv.first == k) return &kv.second;
    if (!create) return nullptr;
    if (!__expando) __expando = new std::vector<std::pair<std::u16string, Any>>();
    __expando->emplace_back(k, Any());
    return &__expando->back().second;
  }
  // a property's value, false when the object has none of that name
  virtual bool __get(const std::u16string& k, Any& out) { Any* s = __expandoSlot(k, false); if (!s) return false; out = *s; return true; }
  // assign a property (a field, an accessor's setter, or a new own property)
  virtual bool __set(const std::u16string& k, const Any& v) { *__expandoSlot(k, true) = v; return true; }
  // "k in object": own fields, accessors and methods
  virtual bool __has(const std::u16string& k) { return __expandoSlot(k, false) != nullptr; }
  virtual bool __hasMethod(const std::u16string& k) { Any* s = __expandoSlot(k, false); return s && s->tag == Tag::Fn; }
  virtual bool __call(const std::u16string& k, std::vector<Any>& args, Any& out) {
    Any* s = __expandoSlot(k, false);
    if (s && s->tag == Tag::Fn) { out = (*s->asFun())(args); return true; }
    return false;
  }
  // own enumerable property names, in definition order
  virtual void __keys(std::vector<String>& out) { if (__expando) for (auto& kv : *__expando) out.push_back(String(kv.first)); }
  bool __delete(const std::u16string& k) {
    if (!__expando) return true;
    for (size_t i = 0; i < __expando->size(); ++i) if ((*__expando)[i].first == k) { __expando->erase(__expando->begin() + i); break; }
    return true;
  }
};

// An object literal or other dynamic object
struct DynObject : Object {
  bool frozen = false;
  bool __set(const std::u16string& k, const Any& v) override { if (frozen) return true; return Object::__set(k, v); }
};
inline DynObject* newObject() { return new DynObject(); }
inline DynObject* newObject(std::initializer_list<std::pair<const char16_t*, Any>> props) {
  DynObject* o = new DynObject();
  for (auto& kv : props) *o->__expandoSlot(kv.first, true) = kv.second;
  return o;
}

struct Error : Object {
  String name, message;
  Error(const String& n, const String& m) : name(n), message(m) {}
  const char16_t* __className() const override { return u"Error"; }
  bool __get(const std::u16string& k, Any& out) override {
    if (k == u"name") { out = name; return true; }
    if (k == u"message") { out = message; return true; }
    if (k == u"stack") { out = String(name.s() + u": " + message.s()); return true; }
    return Object::__get(k, out);
  }
  bool __set(const std::u16string& k, const Any& v) override {
    if (k == u"name") { name = v.asString(); return true; }
    if (k == u"message") { message = v.asString(); return true; }
    return Object::__set(k, v);
  }
  bool __has(const std::u16string& k) override { return k == u"name" || k == u"message" || k == u"stack" || Object::__has(k); }
};
inline Error* newError(const char16_t* type, const String& message) { return new Error(String(type), message.isNull() ? String(u"") : message); }

// A thrown JavaScript value
struct Throw { Any value; };
[[noreturn]] inline void throwError(const char16_t* type, const std::u16string& message) { throw Throw{Any(newError(type, String(message)))}; }
[[noreturn]] inline void throwValue(const Any& v) { throw Throw{v}; }
inline std::u16string describe(const Any& v);

// ---------------------------------------------------------------- arrays
struct ArrayBase {
  bool typed = false; // a typed array: fixed length, out-of-range writes dropped
  virtual ~ArrayBase() {}
  virtual int32_t length() const = 0;
  virtual Any getAny(int64_t i) const = 0;
  virtual void setAny(int64_t i, const Any& v) = 0;
  virtual void pushAny(const Any& v) = 0;
  virtual const std::type_info& elementType() const = 0;
};

template <class E> struct Storage { using T = E; };
template <> struct Storage<bool> { using T = boolbox; };

template <class E> E fromAny(const Any& v);
template <class E> Array<E> anyArray(const Any& v);

template <class E> struct ArrayData : ArrayBase {
  using S = typename Storage<E>::T;
  std::vector<S> v;
  std::shared_ptr<ArrayData<E>> base; // a typed array view (subarray) shares its base's storage
  S* ptr = nullptr;
  int32_t n = 0;
  S scratch{};
  void sync() { if (!base) { ptr = v.data(); n = (int32_t)v.size(); } }
  int32_t length() const override { return n; }
  Any getAny(int64_t i) const override { return i >= 0 && i < n ? Any((E)ptr[i]) : Any(); }
  void setAny(int64_t i, const Any& x) override { at(i) = fromAny<E>(x); }
  void pushAny(const Any& x) override { push(fromAny<E>(x)); }
  const std::type_info& elementType() const override { return typeid(E); }
  S& at(int64_t i) {
    if (i >= 0 && i < n) return ptr[i];
    if (typed || base || i < 0 || i > 100000000) { scratch = S{}; return scratch; }
    v.resize((size_t)i + 1); sync();
    return ptr[i];
  }
  void push(const E& x) { if (base || typed) throwTypeError(u"Cannot add property, object is not extensible"); v.push_back(x); sync(); }
  void resize(int64_t len) { if (base) return; v.resize((size_t)std::max<int64_t>(len, 0)); sync(); }
};

[[noreturn]] inline void nullArray() { throwTypeError(u"Cannot read properties of null (reading an array)"); }

template <class E> class Array {
public:
  using S = typename Storage<E>::T;
  std::shared_ptr<ArrayData<E>> p;
  Array() {}
  Array(std::nullptr_t) {}
  explicit Array(std::shared_ptr<ArrayData<E>> d) : p(std::move(d)) {}
  Array(std::initializer_list<E> items) : p(std::make_shared<ArrayData<E>>()) { p->v.assign(items.begin(), items.end()); p->sync(); }
  static Array create(int64_t n = 0, bool typed = false) {
    if (n < 0 || n > 0x7FFFFFFF) throwRangeError(u"Invalid array length");
    Array a(std::make_shared<ArrayData<E>>()); a.p->v.resize((size_t)n); a.p->typed = typed; a.p->sync(); return a;
  }
  static Array from(std::vector<E> items, bool typed = false) { Array a(std::make_shared<ArrayData<E>>()); a.p->v.assign(items.begin(), items.end()); a.p->typed = typed; a.p->sync(); return a; }
  static Array fromAny(const Any& v) { return anyArray<E>(v); }
  bool isNull() const { return !p; }
  explicit operator bool() const { return (bool)p; }
  ArrayData<E>& d() const { if (!p) nullArray(); return *p; }
  int32_t length() const { return d().n; }
  bool typed() const { return d().typed; }
  E get(int64_t i) const { auto& x = d(); return i >= 0 && i < x.n ? (E)x.ptr[i] : E(); }
  S& at(int64_t i) const { return d().at(i); }
  S* begin() const { return d().ptr; }
  S* end() const { auto& x = d(); return x.ptr + x.n; }
  void setLength(int64_t n) const { d().resize(n); }
  int32_t push(const E& x) const { d().push(x); return length(); }
  template <class... R> int32_t push(const E& x, const R&... rest) const { d().push(x); return push(rest...); }
  void pushAll(const Array& o) const { auto& x = d(); if (o.p.get() == p.get()) { std::vector<S> c(x.ptr, x.ptr + x.n); for (auto& e : c) x.push((E)e); return; } for (int32_t i = 0; i < o.length(); ++i) x.push(o.get(i)); }
  E pop() const { auto& x = d(); if (x.n == 0) return E(); E r = (E)x.ptr[x.n - 1]; x.resize(x.n - 1); return r; }
  E shift() const { auto& x = d(); if (x.n == 0 || x.base) return E(); E r = (E)x.v.front(); x.v.erase(x.v.begin()); x.sync(); return r; }
  int32_t unshift(const E& e) const { auto& x = d(); if (x.base) return x.n; x.v.insert(x.v.begin(), e); x.sync(); return x.n; }
  static int64_t rel(double v, int64_t len) { if (std::isnan(v)) return 0; return v < 0 ? (int64_t)std::max<double>((double)len + v, 0) : (int64_t)std::min<double>(v, (double)len); }
  Array slice(double a = 0) const { return slice(a, (double)length()); }
  Array slice(double a, double b) const {
    auto& x = d(); int64_t s = rel(a, x.n), e = rel(b, x.n);
    Array r = create(std::max<int64_t>(e - s, 0), x.typed);
    for (int64_t i = s; i < e; ++i) r.p->ptr[i - s] = x.ptr[i];
    return r;
  }
  Array subarray(double a = 0) const { return subarray(a, (double)length()); }
  Array subarray(double a, double b) const {
    auto& x = d(); int64_t s = rel(a, x.n), e = std::max(rel(b, x.n), s);
    auto v = std::make_shared<ArrayData<E>>();
    v->typed = true; v->base = x.base ? x.base : p; v->ptr = x.ptr + s; v->n = (int32_t)(e - s);
    return Array(v);
  }
  Array copy() const { return slice(0); }
  template <class... A> Array concat(const A&... others) const {
    Array r = slice(0); r.p->typed = false;
    (r.concatOne(others), ...);
    return r;
  }
  void concatOne(const Array& o) const { if (o.isNull()) { p->push(E()); return; } for (int32_t i = 0; i < o.length(); ++i) p->push(o.get(i)); }
  void concatOne(const E& e) const { p->push(e); }
  template <class X, std::enable_if_t<!std::is_convertible_v<X, E> && !std::is_same_v<X, Array>, int> = 0>
  void concatOne(const X& o) const { for (int32_t i = 0; i < o.length(); ++i) p->push(num<E>(o.get(i))); }
  const Array& fill(const E& v) const { return fill(v, 0, (double)length()); }
  const Array& fill(const E& v, double a) const { return fill(v, a, (double)length()); }
  const Array& fill(const E& v, double a, double b) const { auto& x = d(); int64_t s = rel(a, x.n), e = rel(b, x.n); for (int64_t i = s; i < e; ++i) x.ptr[i] = v; return *this; }
  const Array& reverse() const { auto& x = d(); std::reverse(x.ptr, x.ptr + x.n); return *this; }
  int32_t indexOf(const E& v, double from = 0) const { auto& x = d(); for (int64_t i = rel(from, x.n); i < x.n; ++i) if ((E)x.ptr[i] == v) return (int32_t)i; return -1; }
  int32_t lastIndexOf(const E& v) const { auto& x = d(); for (int64_t i = x.n; i-- > 0;) if ((E)x.ptr[i] == v) return (int32_t)i; return -1; }
  bool includes(const E& v) const { return indexOf(v) >= 0; }
  void set(const Array& src, double offset = 0) const {
    auto& x = d(); int64_t o = (int64_t)offset;
    if (o < 0 || o + src.length() > x.n) throwRangeError(u"offset is out of bounds");
    std::vector<S> tmp(src.begin(), src.end());
    for (size_t i = 0; i < tmp.size(); ++i) x.ptr[o + (int64_t)i] = tmp[i];
  }
  template <class F> void set(const Array<F>& src, double offset = 0) const {
    auto& x = d(); int64_t o = (int64_t)offset;
    if (o < 0 || o + src.length() > x.n) throwRangeError(u"offset is out of bounds");
    for (int32_t i = 0; i < src.length(); ++i) x.ptr[o + i] = num<E>(src.get(i));
  }
  Array splice(double start) const { return splice(start, (double)length()); }
  Array splice(double start, double count, std::vector<E> items = {}) const {
    auto& x = d(); if (x.base || x.typed) throwTypeError(u"Cannot splice a typed array");
    int64_t s = rel(start, x.n); int64_t c = std::isnan(count) ? 0 : std::min<int64_t>(std::max<int64_t>((int64_t)count, 0), x.n - s);
    Array removed = create(c);
    for (int64_t i = 0; i < c; ++i) removed.p->ptr[i] = x.ptr[s + i];
    x.v.erase(x.v.begin() + s, x.v.begin() + s + c);
    x.v.insert(x.v.begin() + s, items.begin(), items.end());
    x.sync();
    return removed;
  }
  String join(const String& sep = String(u",")) const {
    auto& x = d(); std::u16string r;
    for (int32_t i = 0; i < x.n; ++i) { if (i) r += sep.s(); r += joinPart((E)x.ptr[i]); }
    return String(r);
  }
  static std::u16string joinPart(const E& e);
  template <class F> const Array& sort(F cmp) const {
    auto& x = d(); std::vector<E> tmp(x.ptr, x.ptr + x.n);
    std::stable_sort(tmp.begin(), tmp.end(), [&](const E& a, const E& b) { return cmp(a, b) < 0; });
    for (int32_t i = 0; i < x.n; ++i) x.ptr[i] = tmp[i];
    return *this;
  }
  const Array& sort() const;
};

inline Array<String> String::split(const String& sep) const {
  Array<String> r = Array<String>::create(0);
  const auto& x = s();
  if (sep.isNull()) { r.push(*this); return r; }
  const auto& t = sep.s();
  if (t.empty()) { for (char16_t c : x) r.push(String(std::u16string(1, c))); return r; }
  size_t k = 0, f;
  while ((f = x.find(t, k)) != std::u16string::npos) { r.push(String(x.substr(k, f - k))); k = f + t.size(); }
  r.push(String(x.substr(k)));
  return r;
}
inline Array<String> String::split() const { Array<String> r = Array<String>::create(0); r.push(*this); return r; }

template <class E> inline Any::Any(const Array<E>& a) : tag(a.isNull() ? Tag::Null : Tag::Arr), i(0) { if (a.p) r = std::static_pointer_cast<void>(std::static_pointer_cast<ArrayBase>(a.p)); }

template <class E> inline Array<E> anyArray(const Any& v) {
  if (v.tag != Tag::Arr) {
    if (v.isNullish()) return Array<E>();
    throwTypeError(u"value is not an array: " + describe(v));
  }
  ArrayBase* b = v.asArr();
  if (b->elementType() == typeid(E)) return Array<E>(std::static_pointer_cast<ArrayData<E>>(v.r));
  Array<E> out = Array<E>::create(b->length(), b->typed);
  for (int32_t i = 0; i < b->length(); ++i) out.p->ptr[i] = fromAny<E>(b->getAny(i));
  return out;
}

// An array of one element type as another (shared when the types agree)
template <class To, class From> inline Array<To> arrayAs(const Array<From>& a) {
  if constexpr (std::is_same_v<To, From>) return a;
  else {
    if (a.isNull()) return Array<To>();
    Array<To> out = Array<To>::create(a.length(), a.typed());
    for (int32_t i = 0; i < a.length(); ++i) out.p->ptr[i] = fromAny<To>(Any(a.get(i)));
    return out;
  }
}

// ---------------------------------------------------------------- Any operations
inline double Any::toNumber() const {
  switch (tag) {
    case Tag::Undef: return NAN;
    case Tag::Null: return 0;
    case Tag::Bool: return b ? 1 : 0;
    case Tag::Num: return d;
    case Tag::I64: return (double)i;
    case Tag::U64: return (double)u;
    case Tag::Big: return asBig().toDouble();
    case Tag::Str: {
      String s = asString().trim();
      if (s.s().empty()) return 0;
      std::string t = toUtf8(s.s());
      if (t.size() > 2 && t[0] == '0' && (t[1] == 'x' || t[1] == 'X')) return (double)std::strtoull(t.c_str() + 2, nullptr, 16);
      char* end = nullptr; double r = std::strtod(t.c_str(), &end);
      return end && *end == 0 ? r : NAN;
    }
    case Tag::Arr: { ArrayBase* a = asArr(); if (a->length() == 0) return 0; if (a->length() == 1) return a->getAny(0).toNumber(); return NAN; }
    default: return NAN;
  }
}
inline bool Any::truthy() const {
  switch (tag) {
    case Tag::Undef: case Tag::Null: return false;
    case Tag::Bool: return b;
    case Tag::Num: return d != 0 && !std::isnan(d);
    case Tag::I64: return i != 0;
    case Tag::U64: return u != 0;
    case Tag::Str: return !((const std::u16string*)r.get())->empty();
    case Tag::Big: return !asBig().isZero();
    default: return true;
  }
}
inline String Any::typeOf() const {
  switch (tag) {
    case Tag::Undef: return String(u"undefined");
    case Tag::Bool: return String(u"boolean");
    case Tag::Num: case Tag::I64: case Tag::U64: return String(u"number");
    case Tag::Str: return String(u"string");
    case Tag::Big: return String(u"bigint");
    case Tag::Fn: return String(u"function");
    default: return String(u"object");
  }
}
inline std::u16string describe(const Any& v) {
  switch (v.tag) {
    case Tag::Undef: return u"undefined";
    case Tag::Null: return u"null";
    case Tag::Obj: {
      Error* e = dynamic_cast<Error*>(v.o);
      if (e) return e->name.s() + u": " + e->message.s();
      return std::u16string(u"[object ") + v.o->__className() + u"]";
    }
    default: return str(v).s();
  }
}

inline Any Any::get(const String& key) const {
  switch (tag) {
    case Tag::Obj: { Any out; o->__get(key.s(), out); return out; }
    case Tag::Arr: if (key.s() == u"length") return Any(asArr()->length()); return Any();
    case Tag::Str: if (key.s() == u"length") return Any(asString().length()); return Any();
    case Tag::Undef: case Tag::Null: throwTypeError(u"Cannot read properties of " + describe(*this) + u" (reading '" + key.s() + u"')");
    default: return Any();
  }
}
inline void Any::set(const String& key, const Any& v) const {
  switch (tag) {
    case Tag::Obj: o->__set(key.s(), v); return;
    case Tag::Arr: if (key.s() == u"length") { (void)v; } return;
    case Tag::Undef: case Tag::Null: throwTypeError(u"Cannot set properties of " + describe(*this) + u" (setting '" + key.s() + u"')");
    default: return;
  }
}
inline Any Any::index(const Any& key) const {
  if (tag == Tag::Arr && key.isNumber()) return asArr()->getAny((int64_t)key.toNumber());
  if (tag == Tag::Str && key.isNumber()) return asString().at((int64_t)key.toNumber()).isNull() ? Any() : Any(asString().charAt((int64_t)key.toNumber()));
  return get(key.tag == Tag::Str ? key.asString() : str(key));
}
inline void Any::setIndex(const Any& key, const Any& v) const {
  if (tag == Tag::Arr && key.isNumber()) { asArr()->setAny((int64_t)key.toNumber(), v); return; }
  set(key.tag == Tag::Str ? key.asString() : str(key), v);
}
inline int32_t Any::length() const {
  if (tag == Tag::Arr) return asArr()->length();
  if (tag == Tag::Str) return asString().length();
  return (int32_t)get(String(u"length")).toNumber();
}
inline Any Any::call(std::vector<Any> args) const {
  if (tag != Tag::Fn) throwTypeError(describe(*this) + u" is not a function");
  return (*asFun())(args);
}
inline Any Any::callMethod(const String& name, std::vector<Any> args) const {
  if (tag == Tag::Obj) { Any out; if (o->__call(name.s(), args, out)) return out; }
  Any f = get(name);
  if (f.tag == Tag::Fn) return (*f.asFun())(args);
  throwTypeError(describe(*this) + u"." + name.s() + u" is not a function");
}

// ---------------------------------------------------------------- conversions
template <class E> inline E fromAny(const Any& v) {
  if constexpr (std::is_same_v<E, Any>) return v;
  else if constexpr (std::is_same_v<E, bool> || std::is_same_v<E, boolbox>) return v.truthy();
  else if constexpr (std::is_arithmetic_v<E>) {
    switch (v.tag) {
      case Tag::I64: return (E)v.i;
      case Tag::U64: return (E)v.u;
      case Tag::Big: if constexpr (std::is_floating_point_v<E>) return (E)v.asBig().toDouble(); else return (E)v.asBig().lowU64();
      case Tag::Bool: return (E)(v.b ? 1 : 0);
      default: return num<E>(v.toNumber());
    }
  }
  else if constexpr (std::is_same_v<E, String>) {
    if (v.tag == Tag::Str) return v.asString();
    if (v.isNullish()) return String();
    return str(v);
  }
  else if constexpr (std::is_same_v<E, BigInt>) {
    switch (v.tag) {
      case Tag::Big: return v.asBig();
      case Tag::I64: return BigInt((long long)v.i);
      case Tag::U64: return BigInt((unsigned long long)v.u);
      case Tag::Bool: return BigInt(v.b ? 1 : 0);
      case Tag::Str: return BigInt::fromString(toUtf8(v.asString().s()).c_str());
      default: return BigInt(v.toNumber());
    }
  }
  else if constexpr (std::is_same_v<E, Fun>) { return v.tag == Tag::Fn ? *v.asFun() : Fun(); }
  else if constexpr (std::is_pointer_v<E>) {
    using T = std::remove_pointer_t<E>;
    if (v.tag != Tag::Obj) { if (v.isNullish()) return nullptr; throwTypeError(u"value is not an object: " + describe(v)); }
    if constexpr (std::is_same_v<T, Object>) return v.o;
    else {
      T* t = dynamic_cast<T*>(v.o);
      if (!t) {
        if constexpr (std::is_constructible_v<T, Object*>) return new T(v.o); // a record built from a dynamic object
        else throwTypeError(std::u16string(u"value is not a ") + T::__staticClassName() + u": " + describe(v));
      }
      return t;
    }
  }
  else return E::fromAny(v); // Array<E> and other wrappers
}

template <class E> struct ArrayFromAny;
template <class E> inline Array<E> Array_fromAny(const Any& v) { return anyArray<E>(v); }

inline String str(const Any& a) {
  switch (a.tag) {
    case Tag::Undef: return String(u"undefined");
    case Tag::Null: return String(u"null");
    case Tag::Bool: return str(a.b);
    case Tag::Num: return str(a.d);
    case Tag::I64: return str((long long)a.i);
    case Tag::U64: return str((unsigned long long)a.u);
    case Tag::Str: return a.asString();
    case Tag::Big: return str(a.asBig());
    case Tag::Arr: {
      ArrayBase* b = a.asArr(); std::u16string r;
      for (int32_t i = 0; i < b->length(); ++i) { if (i) r += u","; Any e = b->getAny(i); if (!e.isNullish()) r += str(e).s(); }
      return String(r);
    }
    case Tag::Obj: {
      Error* e = dynamic_cast<Error*>(a.o);
      if (e) return String(e->name.s() + (e->message.s().empty() ? u"" : u": " + e->message.s()));
      Any ts;
      if (a.o->__hasMethod(u"toString")) { std::vector<Any> none; Any out; if (a.o->__call(u"toString", none, out)) return str(out); }
      return String(u"[object " u"Object]");
    }
    case Tag::Fn: return String(u"function () { [native code] }");
  }
  return String(u"");
}
template <class E> inline String str(const Array<E>& a) { return a.isNull() ? String(u"null") : a.join(String(u",")); }
template <class T> inline String str(T* o) { return str(Any(o)); }
template <class E> inline std::u16string Array<E>::joinPart(const E& e) {
  if constexpr (std::is_same_v<E, Any>) return e.isNullish() ? std::u16string() : str(e).s();
  else if constexpr (std::is_same_v<E, String>) return e.isNull() ? std::u16string() : e.s();
  else return str(e).s();
}
template <class E> inline const Array<E>& Array<E>::sort() const {
  auto& x = d(); std::vector<E> tmp(x.ptr, x.ptr + x.n);
  std::stable_sort(tmp.begin(), tmp.end(), [](const E& a, const E& b) { return str(a).s() < str(b).s(); });
  for (int32_t i = 0; i < x.n; ++i) x.ptr[i] = tmp[i];
  return *this;
}

// Any from a typed value (the identity for Any)
template <class T> inline Any toAny(const T& v) { return Any(v); }
inline Any toAny(const Any& v) { return v; }

// JavaScript truthiness of a typed value
template <class T> inline bool truthy(const T& v) {
  if constexpr (std::is_same_v<T, Any>) return v.truthy();
  else if constexpr (std::is_floating_point_v<T>) return v != 0 && !std::isnan(v);
  else if constexpr (std::is_arithmetic_v<T>) return v != 0;
  else if constexpr (std::is_same_v<T, boolbox>) return v.v;
  else if constexpr (std::is_pointer_v<T>) return v != nullptr;
  else if constexpr (std::is_same_v<T, Fun>) return (bool)v;
  else return (bool)v; // String, Array, BigInt
}

// ---------------------------------------------------------------- equality and order
template <class A, class B> inline bool strictEq(const A& a, const B& b);
inline bool anyEq(const Any& a, const Any& b, bool strict) {
  if (a.isNumber() && b.isNumber()) {
    if (a.tag == Tag::Num || b.tag == Tag::Num) return a.toNumber() == b.toNumber();
    if (a.tag == Tag::I64 && b.tag == Tag::I64) return a.i == b.i;
    if (a.tag == Tag::U64 && b.tag == Tag::U64) return a.u == b.u;
    return a.tag == Tag::I64 ? std::cmp_equal(a.i, b.u) : std::cmp_equal(a.u, b.i);
  }
  if (a.isNullish() || b.isNullish()) return strict ? a.tag == b.tag : (a.isNullish() && b.isNullish());
  if (a.tag == Tag::Big && b.tag == Tag::Big) return a.asBig() == b.asBig();
  if (a.tag == Tag::Big && b.isNumber()) return !strict && a.asBig().toDouble() == b.toNumber();
  if (b.tag == Tag::Big && a.isNumber()) return !strict && b.asBig().toDouble() == a.toNumber();
  if (a.tag != b.tag) {
    if (strict) return false;
    if (a.tag == Tag::Bool || b.tag == Tag::Bool || a.isNumber() || b.isNumber()) return a.toNumber() == b.toNumber();
    return false;
  }
  switch (a.tag) {
    case Tag::Bool: return a.b == b.b;
    case Tag::Str: return a.asString() == b.asString();
    case Tag::Obj: return a.o == b.o;
    default: return a.r == b.r;
  }
}

template <class T> struct is_array : std::false_type {};
template <class E> struct is_array<Array<E>> : std::true_type { using elem = E; };

// whether a reference-like value is set (not null)
template <class T> inline bool truthyRef(const T& v) {
  if constexpr (std::is_same_v<T, String>) return !v.isNull();
  else if constexpr (is_array<T>::value) return !v.isNull();
  else if constexpr (std::is_pointer_v<T>) return v != nullptr;
  else if constexpr (std::is_same_v<T, Fun>) return (bool)v;
  else if constexpr (std::is_same_v<T, Any>) return !v.isNullish();
  else return true;
}

template <class A, class B> inline bool strictEq(const A& a, const B& b) {
  if constexpr (std::is_same_v<A, Any> || std::is_same_v<B, Any>) return anyEq(toAny(a), toAny(b), true);
  else if constexpr (std::is_arithmetic_v<A> && std::is_arithmetic_v<B>) {
    if constexpr (std::is_floating_point_v<A> || std::is_floating_point_v<B>) return (double)a == (double)b;
    else if constexpr (std::is_same_v<A, bool> || std::is_same_v<B, bool>) return (bool)a == (bool)b && std::is_same_v<A, B>;
    else return std::cmp_equal(a, b);
  }
  else if constexpr (std::is_same_v<A, BigInt> && std::is_same_v<B, BigInt>) return a == b;
  else if constexpr (std::is_same_v<A, BigInt> && std::is_arithmetic_v<B>) { if constexpr (std::is_floating_point_v<B>) return a.toDouble() == b; else return a == BigInt(b); }
  else if constexpr (std::is_arithmetic_v<A> && std::is_same_v<B, BigInt>) return strictEq(b, a);
  else if constexpr (std::is_same_v<A, String> && std::is_same_v<B, String>) return a == b;
  else if constexpr (is_array<A>::value && is_array<B>::value) return (const void*)a.p.get() == (const void*)b.p.get();
  else if constexpr (std::is_pointer_v<A> && std::is_pointer_v<B>) return (const void*)a == (const void*)b;
  else if constexpr (std::is_same_v<A, std::nullptr_t>) { if constexpr (std::is_arithmetic_v<B>) return false; else return !truthyRef(b); }
  else if constexpr (std::is_same_v<B, std::nullptr_t>) { if constexpr (std::is_arithmetic_v<A>) return false; else return !truthyRef(a); }
  else return false;
}
template <class A, class B> inline bool looseEq(const A& a, const B& b) {
  if constexpr (std::is_same_v<A, Any> || std::is_same_v<B, Any>) return anyEq(toAny(a), toAny(b), false);
  else if constexpr (std::is_same_v<A, String> && std::is_arithmetic_v<B>) return Any(a).toNumber() == (double)b;
  else if constexpr (std::is_arithmetic_v<A> && std::is_same_v<B, String>) return (double)a == Any(b).toNumber();
  else if constexpr (std::is_same_v<A, bool> && std::is_arithmetic_v<B>) return (double)a == (double)b;
  else if constexpr (std::is_arithmetic_v<A> && std::is_same_v<B, bool>) return (double)a == (double)b;
  else return strictEq(a, b);
}

// a < b with mathematical (not C++) semantics for mixed signedness
template <class A, class B> inline bool lt(const A& a, const B& b) {
  if constexpr (std::is_same_v<A, Any> || std::is_same_v<B, Any>) {
    Any x = toAny(a), y = toAny(b);
    if (x.tag == Tag::Str && y.tag == Tag::Str) return x.asString() < y.asString();
    if (x.tag == Tag::Big || y.tag == Tag::Big) return fromAny<BigInt>(x) < fromAny<BigInt>(y);
    return x.toNumber() < y.toNumber();
  }
  else if constexpr (std::is_integral_v<A> && std::is_integral_v<B>) return std::cmp_less(a, b);
  else if constexpr (std::is_arithmetic_v<A> && std::is_arithmetic_v<B>) return (double)a < (double)b;
  else if constexpr (std::is_same_v<A, BigInt> && std::is_same_v<B, BigInt>) return a < b;
  else if constexpr (std::is_same_v<A, BigInt>) { if constexpr (std::is_floating_point_v<B>) return a.toDouble() < b; else return a < BigInt(b); }
  else if constexpr (std::is_same_v<B, BigInt>) { if constexpr (std::is_floating_point_v<A>) return a < b.toDouble(); else return BigInt(a) < b; }
  else if constexpr (std::is_same_v<A, String> && std::is_same_v<B, String>) return a < b;
  else return toAny(a).toNumber() < toAny(b).toNumber();
}
template <class A, class B> inline bool gt(const A& a, const B& b) { return lt(b, a); }
template <class A, class B> inline bool le(const A& a, const B& b) {
  if constexpr (std::is_floating_point_v<A> || std::is_floating_point_v<B>) { if constexpr (std::is_arithmetic_v<A> && std::is_arithmetic_v<B>) return (double)a <= (double)b; }
  if constexpr (std::is_same_v<A, Any> || std::is_same_v<B, Any>) { Any x = toAny(a), y = toAny(b); if (x.tag != Tag::Str && x.tag != Tag::Big && y.tag != Tag::Big) { double p = x.toNumber(), q = y.toNumber(); return p <= q; } }
  return !lt(b, a);
}
template <class A, class B> inline bool ge(const A& a, const B& b) { return le(b, a); }

// ---------------------------------------------------------------- string building
template <class A, class B> inline String concat(const A& a, const B& b) { return String(str(a).s() + str(b).s()); }

// ---------------------------------------------------------------- arithmetic helpers
// JavaScript operators on C++ values. The transpiler picks the operand types;
// these keep JavaScript's results where C++ would differ (division by zero,
// shift counts, signed shifts).
inline int32_t i32(double v) { return toInt32(v); }
inline int32_t i32(float v) { return toInt32(v); }
template <class T, std::enable_if_t<std::is_integral_v<T>, int> = 0> inline int32_t i32(T v) { return (int32_t)(uint32_t)v; }
inline int32_t i32(const BigInt& v) { return (int32_t)(uint32_t)v.lowU64(); }
inline int32_t i32(const Any& v) { return fromAny<int32_t>(v); }
inline int32_t i32(boolbox v) { return v.v ? 1 : 0; }
template <class T> inline uint32_t u32(const T& v) { return (uint32_t)i32(v); }

inline int32_t shl32(int32_t a, uint32_t n) { return (int32_t)((uint32_t)a << (n & 31)); }
inline int32_t sar32(int32_t a, uint32_t n) { return a >> (n & 31); }
inline uint32_t shr32(uint32_t a, uint32_t n) { return a >> (n & 31); }
template <class T> inline T shl64(T a, int64_t n) { return n >= 64 || n < 0 ? (T)0 : (T)((uint64_t)a << n); }
template <class T> inline T shr64(T a, int64_t n) {
  if constexpr (std::is_signed_v<T>) return n >= 64 || n < 0 ? (a < 0 ? (T)-1 : (T)0) : (T)(a >> n);
  else return n >= 64 || n < 0 ? (T)0 : (T)(a >> n);
}
template <class T> inline T idiv(T a, T b) {
  if (b == 0) throwRangeError(u"Division by zero");
  if constexpr (std::is_signed_v<T>) if (b == -1) return (T)(0 - (std::make_unsigned_t<T>)a);
  return a / b;
}
template <class T> inline T imod(T a, T b) {
  if constexpr (std::is_floating_point_v<T>) return std::fmod(a, b);
  else {
    if (b == 0) return 0; // NaN in JavaScript, 0 once stored in an integer
    if constexpr (std::is_signed_v<T>) if (b == -1) return 0;
    return a % b;
  }
}
inline BigInt bdiv(const BigInt& a, const BigInt& b) { return a / b; }
inline BigInt bmod(const BigInt& a, const BigInt& b) { return a % b; }
inline BigInt bpow(const BigInt& a, const BigInt& b) { return a.pow(b); }

// ---------------------------------------------------------------- dynamic operators (on Any)
inline Any dynBinary(const char* op, const Any& a, const Any& b);
inline Any dynAdd(const Any& a, const Any& b) {
  if (a.tag == Tag::Str || b.tag == Tag::Str || a.tag == Tag::Arr || b.tag == Tag::Arr || a.tag == Tag::Obj || b.tag == Tag::Obj) return Any(String(str(a).s() + str(b).s()));
  if (a.tag == Tag::Big && b.tag == Tag::Big) return Any(a.asBig() + b.asBig());
  if (a.tag == Tag::I64 && b.tag == Tag::I64) return Any((long long)(a.i + b.i));
  return Any(a.toNumber() + b.toNumber());
}
inline Any dynBinary(const char* op, const Any& a, const Any& b) {
  std::string o(op);
  if (o == "+") return dynAdd(a, b);
  if (a.tag == Tag::Big && b.tag == Tag::Big) {
    const BigInt &x = a.asBig(), &y = b.asBig();
    if (o == "-") return Any(x - y); if (o == "*") return Any(x * y); if (o == "/") return Any(x / y); if (o == "%") return Any(x % y);
    if (o == "&") return Any(x & y); if (o == "|") return Any(x | y); if (o == "^") return Any(x ^ y);
    if (o == "<<") return Any(x << y); if (o == ">>") return Any(x >> y); if (o == "**") return Any(x.pow(y));
    throwTypeError(u"BigInts have no unsigned right shift, use >> instead");
  }
  double x = a.toNumber(), y = b.toNumber();
  if (o == "-") return Any(x - y); if (o == "*") return Any(x * y); if (o == "/") return Any(x / y);
  if (o == "%") return Any(std::fmod(x, y)); if (o == "**") return Any(std::pow(x, y));
  if (o == "&") return Any(toInt32(x) & toInt32(y)); if (o == "|") return Any(toInt32(x) | toInt32(y)); if (o == "^") return Any(toInt32(x) ^ toInt32(y));
  if (o == "<<") return Any(shl32(toInt32(x), toUint32(y))); if (o == ">>") return Any(sar32(toInt32(x), toUint32(y)));
  if (o == ">>>") return Any(shr32(toUint32(x), toUint32(y)));
  throwTypeError(u"unsupported operator");
}

// ---------------------------------------------------------------- Math
namespace Math {
inline double floor(double v) { return std::floor(v); }
inline double ceil(double v) { return std::ceil(v); }
inline double trunc(double v) { return std::trunc(v); }
inline double round(double v) { if (std::isnan(v) || std::isinf(v)) return v; double f = std::floor(v); return v - f >= 0.5 ? f + 1 : f; }
inline double abs(double v) { return std::fabs(v); }
inline double sign(double v) { return std::isnan(v) ? v : v > 0 ? 1 : v < 0 ? -1 : v; }
inline double pow(double a, double b) { return std::pow(a, b); }
inline double sqrt(double v) { return std::sqrt(v); }
inline double cbrt(double v) { return std::cbrt(v); }
inline double log(double v) { return std::log(v); }
inline double log2(double v) { return std::log2(v); }
inline double log10(double v) { return std::log10(v); }
inline double exp(double v) { return std::exp(v); }
inline double sin(double v) { return std::sin(v); }
inline double cos(double v) { return std::cos(v); }
inline double tan(double v) { return std::tan(v); }
inline double asin(double v) { return std::asin(v); }
inline double acos(double v) { return std::acos(v); }
inline double atan(double v) { return std::atan(v); }
inline double atan2(double a, double b) { return std::atan2(a, b); }
inline double sinh(double v) { return std::sinh(v); }
inline double cosh(double v) { return std::cosh(v); }
inline double tanh(double v) { return std::tanh(v); }
inline double hypot(double a, double b) { return std::hypot(a, b); }
inline double fround(double v) { return (double)(float)v; }
inline int32_t clz32(uint32_t v) { if (!v) return 32; int32_t n = 0; while (!(v & 0x80000000u)) { v <<= 1; ++n; } return n; }
inline int32_t imul(int32_t a, int32_t b) { return (int32_t)((uint32_t)a * (uint32_t)b); }
inline uint64_t& rngState() { static uint64_t s = 0x2545F4914F6CDD1DULL; return s; }
inline double random() { uint64_t& s = rngState(); s ^= s << 13; s ^= s >> 7; s ^= s << 17; return (double)(s >> 11) / 9007199254740992.0; }
template <class T> inline T minOf(T a) { return a; }
template <class T, class... R> inline T minOf(T a, R... rest) {
  T b = minOf<T>((T)rest...);
  if constexpr (std::is_floating_point_v<T>) { if (std::isnan(a) || std::isnan(b)) return NAN; }
  return b < a ? b : a;
}
template <class T> inline T maxOf(T a) { return a; }
template <class T, class... R> inline T maxOf(T a, R... rest) {
  T b = maxOf<T>((T)rest...);
  if constexpr (std::is_floating_point_v<T>) { if (std::isnan(a) || std::isnan(b)) return NAN; }
  return b > a ? b : a;
}
template <class T, class E> inline T minArr(const Array<E>& a) { if (a.length() == 0) return (T)INFINITY; T r = (T)a.get(0); for (int32_t i = 1; i < a.length(); ++i) if ((T)a.get(i) < r) r = (T)a.get(i); return r; }
template <class T, class E> inline T maxArr(const Array<E>& a) { if (a.length() == 0) return (T)-INFINITY; T r = (T)a.get(0); for (int32_t i = 1; i < a.length(); ++i) if ((T)a.get(i) > r) r = (T)a.get(i); return r; }
}

inline bool isInteger(double v) { return std::isfinite(v) && std::trunc(v) == v; }
inline double parseFloat(const String& s) { std::string t = toUtf8(s.trim().s()); char* end; double r = std::strtod(t.c_str(), &end); return end == t.c_str() ? NAN : r; }
inline double parseInt(const String& s, int radix = 10) {
  std::u16string t = s.trim().s(); size_t i = 0; bool neg = false;
  if (i < t.size() && (t[i] == u'-' || t[i] == u'+')) { neg = t[i] == u'-'; ++i; }
  if ((radix == 16 || radix == 0) && i + 1 < t.size() && t[i] == u'0' && (t[i + 1] == u'x' || t[i + 1] == u'X')) { i += 2; radix = 16; }
  if (radix == 0) radix = 10;
  double r = 0; bool any = false;
  for (; i < t.size(); ++i) {
    char16_t c = t[i];
    int d = c >= u'0' && c <= u'9' ? c - u'0' : c >= u'a' && c <= u'z' ? c - u'a' + 10 : c >= u'A' && c <= u'Z' ? c - u'A' + 10 : 99;
    if (d >= radix) break;
    r = r * radix + d; any = true;
  }
  if (!any) return NAN;
  return neg ? -r : r;
}
inline double parseInt(const String& s, double radix) { return parseInt(s, (int)radix); }
inline double toNumber(const String& s) { return Any(s).toNumber(); }

// String.fromCharCode
template <class... T> inline String fromCharCode(T... codes) { std::u16string r; (r.push_back((char16_t)u32(codes)), ...); return String(r); }
template <class E> inline String fromCharCodes(const Array<E>& codes) { std::u16string r; for (int32_t i = 0; i < codes.length(); ++i) r.push_back((char16_t)u32(codes.get(i))); return String(r); }
inline String fromCodePoint(uint32_t cp) { std::u16string r; if (cp >= 0x10000) { cp -= 0x10000; r.push_back((char16_t)(0xD800 + (cp >> 10))); r.push_back((char16_t)(0xDC00 + (cp & 0x3FF))); } else r.push_back((char16_t)cp); return String(r); }

// ---------------------------------------------------------------- collections
struct Map : Object {
  std::vector<std::pair<Any, Any>> entries;
  const char16_t* __className() const override { return u"Map"; }
  int32_t find(const Any& k) const { for (size_t i = 0; i < entries.size(); ++i) if (anyEq(entries[i].first, k, true)) return (int32_t)i; return -1; }
  Map* set(const Any& k, const Any& v) { int32_t i = find(k); if (i >= 0) entries[i].second = v; else entries.emplace_back(k, v); return this; }
  Any get(const Any& k) const { int32_t i = find(k); return i >= 0 ? entries[i].second : Any(); }
  bool has(const Any& k) const { return find(k) >= 0; }
  bool remove(const Any& k) { int32_t i = find(k); if (i < 0) return false; entries.erase(entries.begin() + i); return true; }
  void clear() { entries.clear(); }
  int32_t size() const { return (int32_t)entries.size(); }
  bool __get(const std::u16string& k, Any& out) override { if (k == u"size") { out = Any(size()); return true; } return Object::__get(k, out); }
};
struct Set : Object {
  std::vector<Any> items;
  const char16_t* __className() const override { return u"Set"; }
  int32_t find(const Any& k) const { for (size_t i = 0; i < items.size(); ++i) if (anyEq(items[i], k, true)) return (int32_t)i; return -1; }
  Set* add(const Any& k) { if (find(k) < 0) items.push_back(k); return this; }
  bool has(const Any& k) const { return find(k) >= 0; }
  bool remove(const Any& k) { int32_t i = find(k); if (i < 0) return false; items.erase(items.begin() + i); return true; }
  void clear() { items.clear(); }
  int32_t size() const { return (int32_t)items.size(); }
};

// Object.keys / values / entries of a dynamic value
inline Array<String> keysOf(const Any& v) {
  Array<String> r = Array<String>::create(0);
  if (v.tag == Tag::Obj) { std::vector<String> k; v.o->__keys(k); for (auto& s : k) r.push(s); }
  else if (v.tag == Tag::Arr) for (int32_t i = 0; i < v.asArr()->length(); ++i) r.push(str(i));
  return r;
}
inline Array<Any> valuesOf(const Any& v) {
  Array<Any> r = Array<Any>::create(0);
  if (v.tag == Tag::Obj) { std::vector<String> k; v.o->__keys(k); for (auto& s : k) r.push(v.get(s)); }
  else if (v.tag == Tag::Arr) for (int32_t i = 0; i < v.asArr()->length(); ++i) r.push(v.asArr()->getAny(i));
  return r;
}
inline Any freeze(const Any& v) { if (v.tag == Tag::Obj) { DynObject* d = dynamic_cast<DynObject*>(v.o); if (d) d->frozen = true; } return v; }
template <class T> inline T freezeT(const T& v) { return v; }
inline bool hasProperty(const Any& o, const String& k) {
  if (o.tag == Tag::Obj) return o.o->__has(k.s());
  if (o.tag == Tag::Arr) { double n = Any(k).toNumber(); return n >= 0 && n < o.asArr()->length(); }
  return false;
}

// ---------------------------------------------------------------- byte helpers (OpCodes)
inline Array<uint8_t> hexToBytes(const String& hex) {
  const auto& s = hex.s();
  for (char16_t c : s) if (!((c >= u'0' && c <= u'9') || (c >= u'a' && c <= u'f') || (c >= u'A' && c <= u'F'))) throwError(u"Error", u"Hex8ToBytes: Invalid hex characters found");
  Array<uint8_t> r = Array<uint8_t>::create((int64_t)((s.size() + 1) / 2));
  auto val = [](char16_t c) -> int { return c <= u'9' ? c - u'0' : (c | 0x20) - u'a' + 10; };
  for (size_t i = 0; i < s.size(); i += 2) r.at((int64_t)(i / 2)) = (uint8_t)(i + 1 < s.size() ? val(s[i]) * 16 + val(s[i + 1]) : val(s[i]));
  return r;
}
template <class E> inline String bytesToHex(const Array<E>& a) {
  static const char16_t* d = u"0123456789abcdef"; std::u16string r;
  for (int32_t i = 0; i < a.length(); ++i) { uint32_t b = u32(a.get(i)) & 0xFF; r.push_back(d[b >> 4]); r.push_back(d[b & 15]); }
  return String(r);
}
// String <-> bytes: each char masked by 0x7F (OpCodes.AnsiToBytes/BytesToAnsi)
// or 0xFF (AsciiToBytes), or UTF-8 for mask 0
inline Array<uint8_t> stringToBytes(const String& s, int mask) {
  Array<uint8_t> r = Array<uint8_t>::create(0);
  if (!mask) { std::string u = toUtf8(s.s()); for (unsigned char c : u) r.push(c); }
  else for (char16_t c : s.s()) r.push((uint8_t)(c & mask));
  return r;
}
template <class E> inline String bytesToString(const Array<E>& a, int mask) {
  if (!mask) { std::string u; for (int32_t i = 0; i < a.length(); ++i) u.push_back((char)u32(a.get(i))); return String(fromUtf8(u)); }
  std::u16string r; for (int32_t i = 0; i < a.length(); ++i) r.push_back((char16_t)(u32(a.get(i)) & (uint32_t)mask)); return String(r);
}
inline uint32_t pack16(uint32_t hi, uint32_t lo) { return ((hi & 0xFF) << 8) | (lo & 0xFF); }
inline uint32_t pack32(uint32_t b0, uint32_t b1, uint32_t b2, uint32_t b3) { return ((b0 & 0xFF) << 24) | ((b1 & 0xFF) << 16) | ((b2 & 0xFF) << 8) | (b3 & 0xFF); }
inline uint64_t pack64(uint64_t b0, uint64_t b1, uint64_t b2, uint64_t b3, uint64_t b4, uint64_t b5, uint64_t b6, uint64_t b7) {
  return ((b0 & 0xFF) << 56) | ((b1 & 0xFF) << 48) | ((b2 & 0xFF) << 40) | ((b3 & 0xFF) << 32) | ((b4 & 0xFF) << 24) | ((b5 & 0xFF) << 16) | ((b6 & 0xFF) << 8) | (b7 & 0xFF);
}
inline Array<uint8_t> unpack(uint64_t v, int bytes, bool big) {
  Array<uint8_t> r = Array<uint8_t>::create(bytes);
  for (int i = 0; i < bytes; ++i) r.at(big ? bytes - 1 - i : i) = (uint8_t)(v >> (8 * i));
  return r;
}
template <class T> inline T rotl(T v, int64_t n, int bits) {
  using U = std::make_unsigned_t<T>;
  U x = (U)v; if (bits < (int)(8 * sizeof(U))) x &= (U)(((U)1 << bits) - 1);
  n &= bits - 1; if (!n) return (T)x;
  U r = (U)(x << n) | (U)(x >> (bits - n));
  if (bits < (int)(8 * sizeof(U))) r &= (U)(((U)1 << bits) - 1);
  return (T)r;
}
template <class T> inline T rotr(T v, int64_t n, int bits) { n &= bits - 1; return rotl<T>(v, (bits - n) & (bits - 1), bits); }
inline BigInt rotlBig(const BigInt& v, int64_t n, int bits) {
  BigInt mask = BigInt(1).shl(bits) - BigInt(1);
  BigInt x = v & mask; n &= bits - 1; if (!n) return x;
  return ((x.shl(n)) | (x.shr(bits - n))) & mask;
}
inline BigInt rotrBig(const BigInt& v, int64_t n, int bits) { n &= bits - 1; return rotlBig(v, (bits - n) & (bits - 1), bits); }
template <class A, class B> inline Array<uint8_t> xorArrays(const Array<A>& a, const Array<B>& b) {
  int32_t n = std::min(a.length(), b.length());
  Array<uint8_t> r = Array<uint8_t>::create(n);
  for (int32_t i = 0; i < n; ++i) r.at(i) = (uint8_t)((u32(a.get(i)) ^ u32(b.get(i))) & 0xFF);
  return r;
}
template <class E> inline void clearArray(const Array<E>& a) { if (a.isNull()) return; for (int32_t i = 0; i < a.length(); ++i) a.at(i) = E(); }

namespace OpCodes {
template <class E> inline Array<E> CreateArray(int64_t n, E v = E()) { Array<E> r = Array<E>::create(n); for (int64_t i = 0; i < n; ++i) r.at(i) = v; return r; }
inline uint32_t GetByte(uint32_t w, int32_t k) { return (w >> ((k * 8) & 31)) & 0xFF; }
template <class A, class B> inline bool SecureCompare(const Array<A>& a, const Array<B>& b) {
  if (a.length() != b.length()) return false;
  uint32_t r = 0; for (int32_t i = 0; i < a.length(); ++i) r |= u32(a.get(i)) ^ u32(b.get(i)); return r == 0;
}
inline bool GetBit(uint32_t v, int32_t i) { return ((v >> (i & 31)) & 1) != 0; }
inline Array<uint32_t> Hex32ToDWords(const String& hex) {
  Array<uint32_t> r = Array<uint32_t>::create(0);
  for (int32_t i = 0; i < hex.length(); i += 8) r.push((uint32_t)d2u64(parseInt(hex.substr(i, 8), 16)));
  return r;
}
template <class A, class B> inline bool ConstantTimeCompare(const Array<A>& a, const Array<B>& b, int32_t len = 0) {
  if (!len) len = std::min(a.length(), b.length());
  uint32_t r = 0;
  for (int32_t i = 0; i < len; ++i) r |= (i < a.length() ? u32(a.get(i)) : 0) ^ (i < b.length() ? u32(b.get(i)) : 0);
  r |= (uint32_t)(a.length() ^ b.length());
  return r == 0;
}
inline uint32_t GF256Mul(uint32_t a, uint32_t b) {
  uint32_t r = 0; a &= 0xFF; b &= 0xFF;
  for (int i = 0; i < 8; ++i) { if (b & 1) r ^= a; uint32_t hb = a & 0x80; a = (a << 1) & 0xFF; if (hb) a ^= 0x1B; b >>= 1; }
  return r & 0xFF;
}
inline uint32_t SetBit(uint32_t v, int32_t i, bool bit) { return bit ? (v | (1u << (i & 31))) : (v & ~(1u << (i & 31))); }
template <class E> inline Array<E> CopyArray(const Array<E>& a) { Array<E> r = a.slice(0); r.p->typed = false; return r; }
template <class E> inline String BytesToChars(const Array<E>& a) { return fromCharCodes(a); }
template <class E> inline Array<E> ConcatArrays(const Array<Array<E>>& arrays) {
  Array<E> r = Array<E>::create(0);
  for (int32_t i = 0; i < arrays.length(); ++i) { Array<E> x = arrays.get(i); for (int32_t j = 0; j < x.length(); ++j) r.push(x.get(j)); }
  return r;
}
inline uint32_t BitMask(int32_t bits) { if (bits >= 32) return 0xFFFFFFFFu; if (bits <= 0) return 0; return (1u << bits) - 1; }
inline int32_t Shr32Signed(int32_t v, int32_t n) { return v >> (n & 31); }
inline Array<uint8_t> SecureRandomBytes(int32_t n) { Array<uint8_t> r = Array<uint8_t>::create(n); for (int32_t i = 0; i < n; ++i) r.at(i) = (uint8_t)(Math::random() * 256); return r; }
inline uint32_t GFMul(uint32_t a, uint32_t b, uint32_t irr, int32_t width) {
  uint32_t r = 0, mask = width >= 32 ? 0xFFFFFFFFu : (1u << width) - 1;
  while (b) { if (b & 1) r ^= a; uint64_t a2 = (uint64_t)a << 1; if (width < 64 && (a2 >> width) & 1) a2 ^= irr; a = (uint32_t)(a2 & mask); b >>= 1; }
  return r;
}
inline uint32_t MulHi32(uint32_t a, uint32_t b) { return (uint32_t)(((uint64_t)a * b) >> 32); }
inline BigInt GcdN(BigInt a, BigInt b) { if (a.neg) a = -a; if (b.neg) b = -b; while (!b.isZero()) { BigInt t = b; b = a % b; a = t; } return a; }
inline int32_t BitCountN(const BigInt& v) { if (v.isZero()) return 1; return (int32_t)v.bitLength(); }
inline int32_t PopCount(uint32_t v) { int32_t c = 0; while (v) { c += v & 1; v >>= 1; } return c; }
inline int32_t PopCountFast(uint32_t v) { int32_t c = 0; while (v) { v &= v - 1; ++c; } return c; }
inline Array<uint8_t> EncodeMsgLength64LE(double bits) {
  uint64_t v = d2u64(bits); Array<uint8_t> r = Array<uint8_t>::create(8);
  for (int i = 0; i < 8; ++i) r.at(i) = (uint8_t)(v >> (8 * i)); return r;
}
inline Any RotL64_HL(uint32_t high, uint32_t low, int32_t n) {
  n &= 63; uint32_t h, l;
  if (n == 0) { h = high; l = low; } else if (n == 32) { h = low; l = high; }
  else if (n < 32) { h = (high << n) | (low >> (32 - n)); l = (low << n) | (high >> (32 - n)); }
  else { n -= 32; h = (low << n) | (high >> (32 - n)); l = (high << n) | (low >> (32 - n)); }
  return Any(newObject({{u"h", Any(h)}, {u"l", Any(l)}}));
}
inline BigInt GetBitN(const BigInt& v, int32_t i) { return v.shr(i) & BigInt(1); }
template <class T> inline T AddMod(T a, T b, T m) { return imod<T>((T)(imod<T>(a, m) + imod<T>(b, m)), m); }
inline BigInt AddMod(const BigInt& a, const BigInt& b, const BigInt& m) { return ((a % m) + (b % m)) % m; }
template <class T> inline T SubMod(T a, T b, T m) { return imod<T>((T)(imod<T>(a, m) - imod<T>(b, m) + m), m); }
inline BigInt SubMod(const BigInt& a, const BigInt& b, const BigInt& m) { return ((a % m) - (b % m) + m) % m; }
inline BigInt MulModN(const BigInt& a, const BigInt& b, const BigInt& m) { return ((a % m) * (b % m)) % m; }
template <class E> inline Array<uint8_t> Words32ToBytesBE(const Array<E>& w) {
  Array<uint8_t> r = Array<uint8_t>::create(0);
  for (int32_t i = 0; i < w.length(); ++i) { uint32_t x = u32(w.get(i)); r.push((uint8_t)(x >> 24)); r.push((uint8_t)(x >> 16)); r.push((uint8_t)(x >> 8)); r.push((uint8_t)x); }
  return r;
}
template <class E> inline Array<uint32_t> BytesToWords32BE(const Array<E>& b) {
  Array<uint32_t> r = Array<uint32_t>::create(0);
  for (int32_t i = 0; i < b.length(); i += 4) {
    auto g = [&](int32_t k) -> uint32_t { return k < b.length() ? u32(b.get(k)) & 0xFF : 0; };
    r.push(pack32(g(i), g(i + 1), g(i + 2), g(i + 3)));
  }
  return r;
}
inline double Add3L64(uint32_t a, uint32_t b, uint32_t c) { return (double)a + (double)b + (double)c; }
inline int32_t Add3H64(double low, int32_t a, int32_t b, int32_t c) { return toInt32((double)a + b + c + (double)toInt32(low / 4294967296.0)); }
template <class A, class B> inline Array<uint8_t> GHashMul(const Array<A>& x, const Array<B>& y) {
  if (x.isNull() || x.length() != 16 || y.isNull() || y.length() != 16) throwError(u"Error", u"GHashMul requires 16-byte arrays");
  uint8_t z[16] = {0}, v[16];
  for (int i = 0; i < 16; ++i) v[i] = (uint8_t)u32(y.get(i));
  for (int i = 0; i < 16; ++i) {
    uint32_t xi = u32(x.get(i));
    for (int j = 7; j >= 0; --j) {
      if (xi & (1u << j)) for (int k = 0; k < 16; ++k) z[k] ^= v[k];
      uint8_t lsb = v[15] & 1;
      for (int k = 15; k >= 1; --k) v[k] = (uint8_t)((v[k] >> 1) | ((v[k - 1] & 1) << 7));
      v[0] >>= 1;
      if (lsb) v[0] ^= 0xE1;
    }
  }
  Array<uint8_t> r = Array<uint8_t>::create(16); for (int i = 0; i < 16; ++i) r.at(i) = z[i]; return r;
}
inline Any Split64(double v) { return Any(newObject({{u"high32", Any((uint32_t)d2u64(std::floor(v / 4294967296.0)))}, {u"low32", Any((uint32_t)d2u64(v))}})); }
inline Array<Array<uint32_t>> CreateUint64ArrayFromHex(const Array<String>& hex) {
  Array<Array<uint32_t>> r = Array<Array<uint32_t>>::create(hex.length());
  for (int32_t i = 0; i < hex.length(); ++i) {
    String h = hex.get(i); if (h.startsWith(String(u"0x")) || h.startsWith(String(u"0X"))) h = h.substring(2);
    h = h.padStart(16, String(u"0"));
    r.at(i) = Array<uint32_t>{(uint32_t)d2u64(parseInt(h.substring(0, 8), 16)), (uint32_t)d2u64(parseInt(h.substring(8, 16), 16))};
  }
  return r;
}
inline BigInt ModN(const BigInt& a, const BigInt& m) { if (m <= BigInt(0)) throwRangeError(u"ModN requires a positive modulus"); BigInt r = a % m; return r.neg ? r + m : r; }
inline BigInt ModInverseN(const BigInt& a, const BigInt& m) {
  BigInt oldR = ModN(a, m), r = m, oldS(1), s(0);
  while (!r.isZero()) { BigInt q = oldR / r; BigInt nr = oldR - q * r; oldR = r; r = nr; BigInt ns = oldS - q * s; oldS = s; s = ns; }
  if (oldR != BigInt(1)) throwRangeError(u"ModInverseN: value has no inverse modulo m");
  return ModN(oldS, m);
}
inline BigInt ModPowN(BigInt base, BigInt e, const BigInt& m) {
  if (m == BigInt(1)) return BigInt(0);
  if (e.isZero()) return BigInt(1);
  BigInt r(1); base = base % m;
  while (e > BigInt(0)) { if (e.testBit(0)) r = (r * base) % m; e = e.shr(1); base = (base * base) % m; }
  return r;
}
inline BigInt SquareModN(const BigInt& a, const BigInt& m) { BigInt r = a % m; return (r * r) % m; }
template <class A, class B> inline bool ArraysEqual(const Array<A>& a, const Array<B>& b) { return SecureCompare(a, b); }
template <class E> inline Array<uint8_t> XorArrayWithByte(const Array<E>& a, uint32_t v) {
  Array<uint8_t> r = Array<uint8_t>::create(a.length()); v &= 0xFF;
  for (int32_t i = 0; i < a.length(); ++i) r.at(i) = (uint8_t)((u32(a.get(i)) ^ v) & 0xFF); return r;
}
template <class E> inline Array<E> GCMIncrement(const Array<E>& c) {
  if (c.isNull() || c.length() != 16) throwError(u"Error", u"GCMIncrement requires 16-byte counter");
  uint32_t carry = 1;
  for (int i = 15; i >= 12; --i) { uint32_t s = u32(c.get(i)) + carry; c.at(i) = (E)(s & 0xFF); carry = s >> 8; }
  return c;
}
inline BigInt RotL64n(const BigInt& v, int32_t n) { return rotlBig(v, n, 64); }
inline BigInt RotR64n(const BigInt& v, int32_t n) { return rotrBig(v, n, 64); }
inline uint64_t RotL64n(uint64_t v, int32_t n) { return rotl<uint64_t>(v, n, 64); }
inline uint64_t RotR64n(uint64_t v, int32_t n) { return rotr<uint64_t>(v, n, 64); }
inline BigInt RotL128n(const BigInt& v, int32_t n) { return rotlBig(v, n, 128); }
inline BigInt RotR128n(const BigInt& v, int32_t n) { return rotrBig(v, n, 128); }
inline BigInt ToLong(const BigInt& v) { return v.asIntN(64); }
inline int32_t ToShort(int32_t v) { v &= 0xFFFF; return v > 32767 ? v - 65536 : v; }
template <class E> inline Array<E> ArraySlice(const Array<E>& a, double s, double e) { return a.slice(s, e); }
template <class E> inline Array<E> ArraySlice(const Array<E>& a, double s) { return a.slice(s); }
}

// ---------------------------------------------------------------- DataView
struct DataView : Object {
  Array<uint8_t> buffer; int32_t offset = 0, length = 0;
  DataView(Array<uint8_t> b, int32_t off = 0, int32_t len = -1) : buffer(b), offset(off), length(len < 0 ? b.length() - off : len) {}
  uint64_t read(int64_t at, int bytes, bool little) const {
    uint64_t v = 0;
    for (int i = 0; i < bytes; ++i) { uint64_t b = buffer.get(offset + at + (little ? i : bytes - 1 - i)); v |= b << (8 * i); }
    return v;
  }
  void write(int64_t at, int bytes, uint64_t v, bool little) const {
    for (int i = 0; i < bytes; ++i) buffer.at(offset + at + (little ? i : bytes - 1 - i)) = (uint8_t)(v >> (8 * i));
  }
};

// ---------------------------------------------------------------- module initialisation
// Every transpiled file registers the function that runs its top-level code;
// the harness runs them in definition order before it looks up algorithms.
inline std::vector<void (*)()>& moduleInits() { static std::vector<void (*)()> v; return v; }
struct ModuleInit { ModuleInit(void (*f)()) { moduleInits().push_back(f); } };
inline void runModuleInits() { static bool done = false; if (done) return; done = true; for (auto f : moduleInits()) f(); }

inline void debugOutput(const std::vector<Any>& args) {
  std::u16string line;
  for (size_t i = 0; i < args.size(); ++i) { if (i) line += u" "; line += str(args[i]).s(); }
  std::fprintf(stderr, "%s\n", toUtf8(line).c_str());
}

// ---------------------------------------------------------------- language support
// A construct the transpiler has no translation for: compiles, throws when reached
[[noreturn]] inline Any unsupported(const char16_t* what) { throwError(u"TypeError", std::u16string(u"not supported by the C++ translation: ") + what); }

// The value a catch clause binds
inline Any caught() {
  try { throw; }
  catch (Throw& t) { return t.value; }
  catch (std::exception& e) { return Any(newError(u"Error", String(fromUtf8(e.what())))); }
  catch (...) { return Any(newError(u"Error", String(u"unknown C++ exception"))); }
}

// try/finally: the finalizer runs when the scope ends, normally or by a throw
struct Finally {
  std::function<void()> f;
  explicit Finally(std::function<void()> fn) : f(std::move(fn)) {}
  ~Finally() noexcept(false) { if (f) f(); }
};

// A class pointer to a derived class (null when the object is not one)
template <class T, class F> inline T* downcast(F* p) { return p ? dynamic_cast<T*>(p) : nullptr; }

template <class T> inline bool instanceOf(const Any& v) { return v.tag == Tag::Obj && dynamic_cast<T*>(v.o) != nullptr; }

// Copy the own properties of a dynamic object into a class instance (an object
// literal standing where the IL types a class)
inline void copyMembers(Object* from, Object* to) {
  if (!from) return;
  std::vector<String> keys; from->__keys(keys);
  for (auto& k : keys) { Any v; from->__get(k.s(), v); to->__set(k.s(), v); }
}
inline void assignProps(Object* to, const Any& from) {
  if (from.tag != Tag::Obj) return;
  copyMembers(from.o, to);
}
inline Any assignAll(const Any& target, const Any& a = Any(), const Any& b = Any(), const Any& c = Any()) {
  if (target.tag != Tag::Obj) return target;
  assignProps(target.o, a); assignProps(target.o, b); assignProps(target.o, c);
  return target;
}
inline Any defineValue(const Any& o, const String& k, const Any& desc) { if (o.tag == Tag::Obj) o.o->__set(k.s(), desc.get(String(u"value"))); return o; }
inline bool deleteProperty(const Any& o, const String& k) { if (o.tag == Tag::Obj) return o.o->__delete(k.s()); return true; }
inline Array<Array<Any>> entriesOf(const Any& v) {
  Array<Array<Any>> r = Array<Array<Any>>::create(0);
  if (v.tag == Tag::Obj) { std::vector<String> k; v.o->__keys(k); for (auto& s : k) r.push(Array<Any>{Any(s), v.get(s)}); }
  return r;
}
inline std::vector<Any> toVector(const Any& v) { std::vector<Any> r; if (v.tag == Tag::Arr) for (int32_t i = 0; i < v.asArr()->length(); ++i) r.push_back(v.asArr()->getAny(i)); return r; }

inline String jsonQuote(const String& s) {
  std::u16string r = u"\"";
  for (char16_t c : s.s()) {
    if (c == u'"') r += u"\\\""; else if (c == u'\\') r += u"\\\\"; else if (c == u'\n') r += u"\\n";
    else if (c < 0x20) { char b[8]; std::snprintf(b, sizeof b, "\\u%04x", (unsigned)c); r += fromUtf8(b); }
    else r.push_back(c);
  }
  return String(r + u"\"");
}
inline String jsonStringify(const Any& v) {
  switch (v.tag) {
    case Tag::Undef: return String();
    case Tag::Null: return String(u"null");
    case Tag::Str: return jsonQuote(v.asString());
    case Tag::Arr: {
      std::u16string r = u"["; ArrayBase* a = v.asArr();
      for (int32_t i = 0; i < a->length(); ++i) { if (i) r += u","; String e = jsonStringify(a->getAny(i)); r += e.isNull() ? u"null" : e.s(); }
      return String(r + u"]");
    }
    case Tag::Obj: {
      std::u16string r = u"{"; std::vector<String> keys; v.o->__keys(keys); bool first = true;
      for (auto& k : keys) { Any x; v.o->__get(k.s(), x); String e = jsonStringify(x); if (e.isNull()) continue; if (!first) r += u","; first = false; r += jsonQuote(k).s() + u":" + e.s(); }
      return String(r + u"}");
    }
    case Tag::Big: throwTypeError(u"Do not know how to serialize a BigInt");
    default: return str(v);
  }
}

// ---------------------------------------------------------------- collections from values
inline Map* newMap(const Any& entries) {
  Map* m = new Map();
  if (entries.tag == Tag::Arr) for (int32_t i = 0; i < entries.asArr()->length(); ++i) { Any e = entries.asArr()->getAny(i); m->set(e.index(Any(0)), e.index(Any(1))); }
  return m;
}
inline Set* newSet(const Any& values) {
  Set* s = new Set();
  if (values.tag == Tag::Arr) for (int32_t i = 0; i < values.asArr()->length(); ++i) s->add(values.asArr()->getAny(i));
  else if (values.tag == Tag::Str) { String t = values.asString(); for (int32_t i = 0; i < t.length(); ++i) s->add(Any(t.charAt(i))); }
  return s;
}
inline Array<Any> mapKeys(Map* m) { Array<Any> r = Array<Any>::create(0); for (auto& e : m->entries) r.push(e.first); return r; }
inline Array<Any> mapValues(Map* m) { Array<Any> r = Array<Any>::create(0); for (auto& e : m->entries) r.push(e.second); return r; }
inline Array<Array<Any>> mapEntries(Map* m) { Array<Array<Any>> r = Array<Array<Any>>::create(0); for (auto& e : m->entries) r.push(Array<Any>{e.first, e.second}); return r; }
inline Array<Any> setValues(Set* s) { Array<Any> r = Array<Any>::create(0); for (auto& e : s->items) r.push(e); return r; }

// ---------------------------------------------------------------- array functions
template <class R, class E, class F> inline Array<R> arrayMap(const Array<E>& a, F f) {
  Array<R> r = Array<R>::create(a.length());
  for (int32_t i = 0; i < a.length(); ++i) {
    if constexpr (std::is_invocable_v<F, E, int32_t>) r.at(i) = f(a.get(i), i); else r.at(i) = f(a.get(i));
  }
  return r;
}
template <class E, class F> inline void arrayForEach(const Array<E>& a, F f) {
  for (int32_t i = 0; i < a.length(); ++i) { if constexpr (std::is_invocable_v<F, E, int32_t>) f(a.get(i), i); else f(a.get(i)); }
}
template <class E, class F> inline Array<E> arrayFilter(const Array<E>& a, F f) {
  Array<E> r = Array<E>::create(0);
  for (int32_t i = 0; i < a.length(); ++i) { bool keep; if constexpr (std::is_invocable_v<F, E, int32_t>) keep = f(a.get(i), i); else keep = f(a.get(i)); if (keep) r.push(a.get(i)); }
  return r;
}
template <class E, class F> inline bool arraySome(const Array<E>& a, F f) {
  for (int32_t i = 0; i < a.length(); ++i) { bool t; if constexpr (std::is_invocable_v<F, E, int32_t>) t = f(a.get(i), i); else t = f(a.get(i)); if (t) return true; }
  return false;
}
template <class E, class F> inline bool arrayEvery(const Array<E>& a, F f) {
  for (int32_t i = 0; i < a.length(); ++i) { bool t; if constexpr (std::is_invocable_v<F, E, int32_t>) t = f(a.get(i), i); else t = f(a.get(i)); if (!t) return false; }
  return true;
}
template <class E, class F> inline E arrayFind(const Array<E>& a, F f) {
  for (int32_t i = 0; i < a.length(); ++i) { bool t; if constexpr (std::is_invocable_v<F, E, int32_t>) t = f(a.get(i), i); else t = f(a.get(i)); if (t) return a.get(i); }
  return E();
}
template <class E, class F> inline int32_t arrayFindIndex(const Array<E>& a, F f) {
  for (int32_t i = 0; i < a.length(); ++i) { bool t; if constexpr (std::is_invocable_v<F, E, int32_t>) t = f(a.get(i), i); else t = f(a.get(i)); if (t) return i; }
  return -1;
}
template <class R, class E, class F> inline R arrayReduce(const Array<E>& a, F f, R init) {
  R acc = init;
  for (int32_t i = 0; i < a.length(); ++i) { if constexpr (std::is_invocable_v<F, R, E, int32_t>) acc = f(acc, a.get(i), i); else acc = f(acc, a.get(i)); }
  return acc;
}
template <class R, class E, class F> inline R arrayReduce(const Array<E>& a, F f) {
  if (a.length() == 0) throwTypeError(u"Reduce of empty array with no initial value");
  R acc = fromAny<R>(Any(a.get(0)));
  for (int32_t i = 1; i < a.length(); ++i) { if constexpr (std::is_invocable_v<F, R, E, int32_t>) acc = f(acc, a.get(i), i); else acc = f(acc, a.get(i)); }
  return acc;
}
template <class R, class F> inline Array<R> arrayGenerate(int64_t n, F f) {
  Array<R> r = Array<R>::create(n);
  for (int64_t i = 0; i < n; ++i) r.at(i) = f(Any(), (int32_t)i);
  return r;
}
inline Array<int32_t> arrayKeys(int32_t n) { Array<int32_t> r = Array<int32_t>::create(n); for (int32_t i = 0; i < n; ++i) r.at(i) = i; return r; }
// Array.from(array): a plain copy
template <class R, class E> inline Array<R> arrayCopy(const Array<E>& a) {
  if (a.isNull()) throwTypeError(u"Array.from of null");
  Array<R> r = Array<R>::create(a.length());
  for (int32_t i = 0; i < a.length(); ++i) { if constexpr (std::is_same_v<R, E>) r.at(i) = a.get(i); else r.at(i) = fromAny<R>(Any(a.get(i))); }
  return r;
}
template <class R> inline Array<R> arrayFromAny(const Any& v) {
  if (v.tag == Tag::Arr) { Array<R> r = Array<R>::create(v.asArr()->length()); for (int32_t i = 0; i < r.length(); ++i) r.at(i) = fromAny<R>(v.asArr()->getAny(i)); return r; }
  if (v.tag == Tag::Str) { String s = v.asString(); Array<R> r = Array<R>::create(s.length()); for (int32_t i = 0; i < s.length(); ++i) r.at(i) = fromAny<R>(Any(s.charAt(i))); return r; }
  if (v.tag == Tag::Obj) { Any len = v.get(String(u"length")); Array<R> r = Array<R>::create(len.isUndef() ? 0 : (int64_t)len.toNumber()); for (int32_t i = 0; i < r.length(); ++i) r.at(i) = fromAny<R>(v.index(Any(i))); return r; }
  return Array<R>::create(0);
}
// new Uint8Array(array): a typed copy, values wrapped to the element type
template <class R, class E> inline Array<R> typedCopy(const Array<E>& a) {
  if (a.isNull()) return Array<R>::create(0, true);
  Array<R> r = Array<R>::create(a.length(), true);
  for (int32_t i = 0; i < a.length(); ++i) { if constexpr (std::is_same_v<E, Any>) r.at(i) = fromAny<R>(a.get(i)); else if constexpr (std::is_arithmetic_v<E> || std::is_same_v<E, bool>) r.at(i) = num<R>(a.get(i)); else r.at(i) = fromAny<R>(Any(a.get(i))); }
  return r;
}
template <class R> inline Array<R> typedFrom(const Any& v) {
  if (v.isNumber()) return Array<R>::create((int64_t)v.toNumber(), true);
  if (v.isNullish()) return Array<R>::create(0, true);
  Array<R> r = arrayFromAny<R>(v); r.p->typed = true; return r;
}
inline void clearAny(const Any& v) { if (v.tag == Tag::Arr) { ArrayBase* a = v.asArr(); for (int32_t i = 0; i < a->length(); ++i) a->setAny(i, Any(0)); } }

// ---------------------------------------------------------------- strings and numbers
inline String toFixed(double v, int32_t digits) { char b[512]; std::snprintf(b, sizeof b, "%.*f", (int)digits, v); return String(fromUtf8(b)); }
inline int32_t localeCompare(const String& a, const String& b) { return a < b ? -1 : a > b ? 1 : 0; }
inline uint32_t floatToBits(float f) { uint32_t u; std::memcpy(&u, &f, 4); return u; }
inline uint64_t doubleToBits(double d) { uint64_t u; std::memcpy(&u, &d, 8); return u; }
inline float bitsToFloat(uint32_t u) { float f; std::memcpy(&f, &u, 4); return f; }
inline double bitsToDouble(uint64_t u) { double d; std::memcpy(&d, &u, 8); return d; }


// ---------------------------------------------------------------- differential tracing
// js::trace(site, value) prints the value a site of the JavaScript source held
// (to compare a run with the JavaScript reference while debugging the
// translation); the transpiler emits it only when asked to trace.
template <class T> inline std::u16string traceText(const T& v);
inline std::u16string traceAny(const Any& v) {
  switch (v.tag) {
    case Tag::Undef: case Tag::Null: return u"null";
    case Tag::Bool: return v.b ? u"true" : u"false";
    case Tag::Num: return numberText(v.d);
    case Tag::I64: return fromUtf8(std::to_string(v.i));
    case Tag::U64: return fromUtf8(std::to_string(v.u));
    case Tag::Str: return jsonQuote(v.asString()).s();
    case Tag::Big: return fromUtf8(v.asBig().toStdString());
    case Tag::Arr: {
      ArrayBase* a = v.asArr(); std::u16string r = u"[" + fromUtf8(std::to_string(a->length())) + u":";
      for (int32_t i = 0; i < a->length() && i < 16; ++i) { if (i) r += u","; r += traceAny(a->getAny(i)); }
      return r + u"]";
    }
    case Tag::Fn: return u"fn";
    default: return u"{obj}";
  }
}
template <class T> inline std::u16string traceText(const T& v) {
  if constexpr (std::is_same_v<T, Any>) return traceAny(v);
  else if constexpr (std::is_same_v<T, bool> || std::is_same_v<T, boolbox>) return (bool)v ? u"true" : u"false";
  else if constexpr (std::is_floating_point_v<T>) return numberText((double)v);
  else if constexpr (std::is_integral_v<T>) return fromUtf8(std::to_string(v));
  else if constexpr (std::is_same_v<T, String>) { if (v.isNull()) return u"null"; return jsonQuote(v).s(); }
  else if constexpr (std::is_same_v<T, BigInt>) return fromUtf8(v.toStdString());
  else if constexpr (is_array<T>::value) return v.isNull() ? std::u16string(u"null") : traceAny(Any(v));
  else if constexpr (std::is_pointer_v<T>) return v ? u"{obj}" : u"null";
  else if constexpr (std::is_same_v<T, Fun>) return v ? u"fn" : u"null";
  else return u"?";
}
template <class T> inline T trace(int64_t site, T v) {
  static long long budget = 400000;
  if (budget-- > 0) std::fprintf(stderr, "@T %lld|%s\n", (long long)site, toUtf8(traceText(v)).c_str());
  return v;
}

// ---------------------------------------------------------------- AlgorithmFramework
// The classes of AlgorithmFramework.js with the members the JSDoc types give
// them. Each answers the dynamic member protocol (__get/__set/__has/__call)
// the way a JavaScript instance would, for the vector harness and for
// accesses the static types do not resolve.

// enum values (CategoryType.BLOCK, ...): one shared object per name, so identity compares
inline Any enumValue(const char16_t* enumName, const char16_t* member) {
  static std::vector<std::pair<std::u16string, Any>> cache;
  std::u16string key = std::u16string(enumName) + u"." + member;
  for (auto& kv : cache) if (kv.first == key) return kv.second;
  static const std::pair<const char16_t*, const char16_t*> names[] = {
    {u"CategoryType.ASYMMETRIC", u"Asymmetric Ciphers"}, {u"CategoryType.BLOCK", u"Block Ciphers"}, {u"CategoryType.STREAM", u"Stream Ciphers"},
    {u"CategoryType.HASH", u"Hash Functions"}, {u"CategoryType.CHECKSUM", u"Checksums"}, {u"CategoryType.COMPRESSION", u"Compression Algorithms"},
    {u"CategoryType.ENCODING", u"Encoding Schemes"}, {u"CategoryType.CLASSICAL", u"Classical Ciphers"}, {u"CategoryType.MAC", u"Message Authentication"},
    {u"CategoryType.KDF", u"Key Derivation Functions"}, {u"CategoryType.ECC", u"Error Correction"}, {u"CategoryType.MODE", u"Cipher Modes"},
    {u"CategoryType.PADDING", u"Padding Schemes"}, {u"CategoryType.AEAD", u"Authenticated Encryption"}, {u"CategoryType.SPECIAL", u"Special Algorithms"},
    {u"CategoryType.PQC", u"Post-Quantum Cryptography"}, {u"CategoryType.RANDOM", u"Random Number Generators"},
    {u"SecurityStatus.SECURE", u"Secure"}, {u"SecurityStatus.DEPRECATED", u"Deprecated"}, {u"SecurityStatus.BROKEN", u"Broken"},
    {u"SecurityStatus.OBSOLETE", u"Obsolete"}, {u"SecurityStatus.EXPERIMENTAL", u"Experimental"}, {u"SecurityStatus.EDUCATIONAL", u"Educational Only"},
    {u"ComplexityType.BEGINNER", u"Beginner"}, {u"ComplexityType.INTERMEDIATE", u"Intermediate"}, {u"ComplexityType.ADVANCED", u"Advanced"},
    {u"ComplexityType.EXPERT", u"Expert"}, {u"ComplexityType.RESEARCH", u"Research"}};
  std::u16string display = member;
  for (auto& n : names) if (key == n.first) display = n.second;
  DynObject* o = newObject({{u"name", Any(String(display))}});
  o->frozen = true;
  cache.emplace_back(key, Any(o));
  return cache.back().second;
}

struct LinkItem : Object {
  String text, uri;
  static const char16_t* __staticClassName() { return u"LinkItem"; }
  const char16_t* __className() const override { return u"LinkItem"; }
  LinkItem* __ctor(String text = String(), String uri = String()) { this->text = text; this->uri = uri; return this; }
  bool __get(const std::u16string& k, Any& out) override {
    if (k == u"text") { out = text; return true; }
    if (k == u"uri") { out = uri; return true; }
    return Object::__get(k, out);
  }
  bool __set(const std::u16string& k, const Any& v) override {
    if (k == u"text") { text = fromAny<String>(v); return true; }
    if (k == u"uri") { uri = fromAny<String>(v); return true; }
    return Object::__set(k, v);
  }
  bool __has(const std::u16string& k) override { return k == u"text" || k == u"uri" || Object::__has(k); }
  void __keys(std::vector<String>& out) override { out.push_back(String(u"text")); out.push_back(String(u"uri")); Object::__keys(out); }
};

struct TestCase : LinkItem {
  Array<uint8_t> input, expected;
  static const char16_t* __staticClassName() { return u"TestCase"; }
  const char16_t* __className() const override { return u"TestCase"; }
  TestCase() {}
  // A vector written as an object literal, as RegisterAlgorithm converts it
  explicit TestCase(Object* o) {
    std::vector<String> keys; o->__keys(keys);
    Any v;
    if (o->__get(u"input", v)) input = fromAny<Array<uint8_t>>(v);
    if (o->__get(u"expected", v)) expected = fromAny<Array<uint8_t>>(v); else expected = Array<uint8_t>::create(0);
    if (o->__get(u"text", v) && v.truthy()) text = fromAny<String>(v); else text = String(u"Test vector");
    if (o->__get(u"uri", v) && !v.isNullish()) uri = fromAny<String>(v); else uri = String(u"");
    for (auto& k : keys) {
      const auto& s = k.s();
      if (s == u"input" || s == u"expected" || s == u"text" || s == u"uri") continue;
      Any x; o->__get(s, x); *__expandoSlot(s, true) = x;
    }
  }
  TestCase* __ctor(Array<uint8_t> input = Array<uint8_t>(), Array<uint8_t> expected = Array<uint8_t>(), String description = String(u""), String uri = String(u"")) {
    LinkItem::__ctor(description, uri); this->input = input; this->expected = expected; return this;
  }
  bool __get(const std::u16string& k, Any& out) override {
    if (k == u"input") { out = input; return true; }
    if (k == u"expected") { out = expected; return true; }
    return LinkItem::__get(k, out);
  }
  bool __set(const std::u16string& k, const Any& v) override {
    if (k == u"input") { input = fromAny<Array<uint8_t>>(v); return true; }
    if (k == u"expected") { expected = fromAny<Array<uint8_t>>(v); return true; }
    return LinkItem::__set(k, v);
  }
  bool __has(const std::u16string& k) override { return k == u"input" || k == u"expected" || LinkItem::__has(k); }
  void __keys(std::vector<String>& out) override { out.push_back(String(u"text")); out.push_back(String(u"uri")); out.push_back(String(u"input")); out.push_back(String(u"expected")); Object::__keys(out); }
};

struct Vulnerability : LinkItem {
  String description, mitigation;
  static const char16_t* __staticClassName() { return u"Vulnerability"; }
  const char16_t* __className() const override { return u"Vulnerability"; }
  Vulnerability* __ctor(String type = String(), String description = String(u""), String mitigation = String(u""), String uri = String(u"")) {
    LinkItem::__ctor(type, uri); this->description = description; this->mitigation = mitigation; return this;
  }
  bool __get(const std::u16string& k, Any& out) override {
    if (k == u"description") { out = description; return true; }
    if (k == u"mitigation") { out = mitigation; return true; }
    return LinkItem::__get(k, out);
  }
  bool __has(const std::u16string& k) override { return k == u"description" || k == u"mitigation" || LinkItem::__has(k); }
};

struct AuthResult : Object {
  bool Success = false; Array<uint8_t> Output; String FailureReason;
  static const char16_t* __staticClassName() { return u"AuthResult"; }
  const char16_t* __className() const override { return u"AuthResult"; }
  AuthResult* __ctor(bool success = false, Array<uint8_t> output = Array<uint8_t>(), String failureReason = String()) { Success = success; Output = output; FailureReason = failureReason; return this; }
  bool __get(const std::u16string& k, Any& out) override {
    if (k == u"Success") { out = Success; return true; }
    if (k == u"Output") { out = Output; return true; }
    if (k == u"FailureReason") { out = FailureReason; return true; }
    return Object::__get(k, out);
  }
  bool __has(const std::u16string& k) override { return k == u"Success" || k == u"Output" || k == u"FailureReason" || Object::__has(k); }
};

struct KeySize : Object {
  int32_t minSize = 0, maxSize = 0, stepSize = 0;
  static const char16_t* __staticClassName() { return u"KeySize"; }
  const char16_t* __className() const override { return u"KeySize"; }
  KeySize* __ctor(int32_t minSize = 0, int32_t maxSize = 0, int32_t stepSize = 1) { this->minSize = minSize; this->maxSize = maxSize; this->stepSize = stepSize; return this; }
  bool __get(const std::u16string& k, Any& out) override {
    if (k == u"minSize") { out = minSize; return true; }
    if (k == u"maxSize") { out = maxSize; return true; }
    if (k == u"stepSize") { out = stepSize; return true; }
    return Object::__get(k, out);
  }
  bool __set(const std::u16string& k, const Any& v) override {
    if (k == u"minSize") { minSize = fromAny<int32_t>(v); return true; }
    if (k == u"maxSize") { maxSize = fromAny<int32_t>(v); return true; }
    if (k == u"stepSize") { stepSize = fromAny<int32_t>(v); return true; }
    return Object::__set(k, v);
  }
  bool __has(const std::u16string& k) override { return k == u"minSize" || k == u"maxSize" || k == u"stepSize" || Object::__has(k); }
  void __keys(std::vector<String>& out) override { out.push_back(String(u"minSize")); out.push_back(String(u"maxSize")); out.push_back(String(u"stepSize")); Object::__keys(out); }
};

inline uint8_t byteOf(double v) { double r = std::fmod(std::trunc(v), 256.0); return (uint8_t)(r < 0 ? r + 256 : r); }

struct BlockAbsorber : Object {
  int32_t _blockSize = 0; Fun _processBlock; Array<uint8_t> _held; int32_t _pending = 0; uint64_t _length = 0;
  static const char16_t* __staticClassName() { return u"BlockAbsorber"; }
  const char16_t* __className() const override { return u"BlockAbsorber"; }
  BlockAbsorber* __ctor(int32_t blockSize, Fun processBlock) {
    if (!(blockSize > 0)) throwError(u"Error", u"BlockAbsorber: blockSize must be positive");
    if (!processBlock) throwError(u"Error", u"BlockAbsorber: processBlock must be a function");
    _blockSize = blockSize; _processBlock = processBlock; _held = Array<uint8_t>::create(blockSize); _pending = 0; _length = 0;
    return this;
  }
  virtual int32_t __get_BlockSize() { return _blockSize; }
  virtual int32_t __get_Pending() { return _pending; }
  virtual uint64_t __get_Length() { return _length; }
  template <class E> void Absorb(const Array<E>& data) {
    if (data.isNull() || data.length() == 0) return;
    int32_t total = data.length(), offset = 0;
    while (offset < total) {
      if (_pending == _blockSize) { std::vector<Any> a{Any(_held)}; _processBlock(a); _pending = 0; }
      int32_t take = std::min(_blockSize - _pending, total - offset);
      for (int32_t i = 0; i < take; ++i) _held.at(_pending + i) = byteOf((double)data.get(offset + i));
      _pending += take; offset += take; _length += (uint64_t)take;
    }
  }
  Any Finish(Fun finalize) {
    if (!finalize) throwError(u"Error", u"BlockAbsorber: finalize must be a function");
    std::vector<Any> a{Any(_held.slice(0, _pending)), Any(_pending), Any(_length)};
    return finalize(a);
  }
  void Reset() { _held.fill(0); _pending = 0; _length = 0; }
  bool __get(const std::u16string& k, Any& out) override {
    if (k == u"BlockSize") { out = __get_BlockSize(); return true; }
    if (k == u"Pending") { out = __get_Pending(); return true; }
    if (k == u"Length") { out = __get_Length(); return true; }
    return Object::__get(k, out);
  }
  bool __has(const std::u16string& k) override { return k == u"BlockSize" || k == u"Pending" || k == u"Length" || k == u"Absorb" || k == u"Finish" || k == u"Reset" || Object::__has(k); }
};

inline uint8_t mergeBits(uint8_t a, uint8_t b) { return a | b; }
inline Array<Array<uint8_t>> SpongePadBlocks(Array<uint8_t> held, int32_t pending, int32_t rate, int32_t separator) {
  if (!(rate > 0)) throwError(u"Error", u"SpongePadBlocks: rate must be positive");
  if (pending < 0 || pending > rate) throwError(u"Error", u"SpongePadBlocks: pending outside the rate");
  Array<Array<uint8_t>> blocks = Array<Array<uint8_t>>::create(0);
  Array<uint8_t> block = Array<uint8_t>::create(rate);
  for (int32_t i = 0; i < pending; ++i) block.at(i) = held.get(i);
  int32_t used = pending;
  if (used == rate) { blocks.push(block); block = Array<uint8_t>::create(rate); used = 0; }
  block.at(used) = byteOf(separator);
  block.at(rate - 1) = mergeBits(block.get(rate - 1), 0x80);
  blocks.push(block);
  return blocks;
}
inline Array<Array<uint8_t>> MerkleDamgardBlocks(Array<uint8_t> held, int32_t pending, double totalLength, Any options) {
  Any settings = options.isNullish() ? Any(newObject()) : options;
  int32_t blockSize = fromAny<int32_t>(settings.get(String(u"blockSize")));
  if (!(blockSize > 0)) throwError(u"Error", u"MerkleDamgardBlocks: blockSize must be positive");
  if (pending < 0 || pending > blockSize) throwError(u"Error", u"MerkleDamgardBlocks: pending outside the block");
  Any pb = settings.get(String(u"padByte")), lb = settings.get(String(u"lengthBytes"));
  int32_t padByte = pb.isUndef() ? 0x80 : fromAny<int32_t>(pb);
  int32_t lengthBytes = lb.isUndef() ? 8 : fromAny<int32_t>(lb);
  Any le = settings.get(String(u"lengthLittleEndian")), ib = settings.get(String(u"lengthInBits"));
  bool littleEndian = le.tag == Tag::Bool && le.b;
  bool inBits = !(ib.tag == Tag::Bool && !ib.b);
  if (lengthBytes < 0 || lengthBytes >= blockSize) throwError(u"Error", u"MerkleDamgardBlocks: lengthBytes does not fit the block");
  Array<Array<uint8_t>> blocks = Array<Array<uint8_t>>::create(0);
  Array<uint8_t> block = Array<uint8_t>::create(blockSize);
  for (int32_t i = 0; i < pending; ++i) block.at(i) = byteOf((double)held.get(i));
  int32_t used = pending;
  if (used == blockSize) { blocks.push(block); block = Array<uint8_t>::create(blockSize); used = 0; }
  block.at(used) = byteOf(padByte); ++used;
  if (used > blockSize - lengthBytes) { blocks.push(block); block = Array<uint8_t>::create(blockSize); }
  if (lengthBytes > 0) {
    double remaining = std::max(0.0, std::trunc(inBits ? totalLength * 8 : totalLength));
    for (int32_t i = 0; i < lengthBytes; ++i) {
      block.at(blockSize - lengthBytes + (littleEndian ? i : lengthBytes - 1 - i)) = (uint8_t)std::fmod(remaining, 256.0);
      remaining = std::floor(remaining / 256);
    }
  }
  blocks.push(block);
  return blocks;
}

struct IAlgorithmInstance;

struct Algorithm : Object {
  String name, description, inventor, subCategory;
  int32_t year = 0;
  Any category, securityStatus, complexity, country;
  // metadata: JavaScript lets algorithms put any values here (strings for vulnerabilities, ...)
  Array<Any> documentation, references, knownVulnerabilities;
  Array<TestCase*> tests;
  static const char16_t* __staticClassName() { return u"Algorithm"; }
  const char16_t* __className() const override { return u"Algorithm"; }
  Algorithm* __ctor() {
    category = Any(nullptr); securityStatus = Any(nullptr); complexity = Any(nullptr); country = Any(nullptr);
    documentation = Array<Any>::create(0); references = Array<Any>::create(0);
    knownVulnerabilities = Array<Any>::create(0); tests = Array<TestCase*>::create(0);
    return this;
  }
  virtual IAlgorithmInstance* CreateInstance(bool isInverse = false) { (void)isInverse; throwValue(Any(String(u"CreateInstance() not implemented"))); }
  bool __get(const std::u16string& k, Any& out) override {
    if (k == u"name") { out = name; return true; }
    if (k == u"description") { out = description; return true; }
    if (k == u"inventor") { out = inventor; return true; }
    if (k == u"year") { out = year; return true; }
    if (k == u"category") { out = category; return true; }
    if (k == u"subCategory") { out = subCategory; return true; }
    if (k == u"securityStatus") { out = securityStatus; return true; }
    if (k == u"complexity") { out = complexity; return true; }
    if (k == u"country") { out = country; return true; }
    if (k == u"documentation") { out = documentation; return true; }
    if (k == u"references") { out = references; return true; }
    if (k == u"knownVulnerabilities") { out = knownVulnerabilities; return true; }
    if (k == u"tests") { out = tests; return true; }
    return Object::__get(k, out);
  }
  bool __set(const std::u16string& k, const Any& v) override {
    if (k == u"name") { name = fromAny<String>(v); return true; }
    if (k == u"tests") { tests = fromAny<Array<TestCase*>>(v); return true; }
    if (k == u"year") { year = fromAny<int32_t>(v); return true; }
    return Object::__set(k, v);
  }
  bool __has(const std::u16string& k) override {
    static const char16_t* names[] = {u"name", u"description", u"inventor", u"year", u"category", u"subCategory", u"securityStatus", u"complexity", u"country", u"documentation", u"references", u"knownVulnerabilities", u"tests", u"CreateInstance"};
    for (auto n : names) if (k == n) return true;
    return Object::__has(k);
  }
  bool __hasMethod(const std::u16string& k) override { return k == u"CreateInstance" || Object::__hasMethod(k); }
  bool __call(const std::u16string& k, std::vector<Any>& args, Any& out) override;
};

#define JS_FAMILY(Name, Base) \
  struct Name : Base { \
    static const char16_t* __staticClassName() { return u"" #Name; } \
    const char16_t* __className() const override { return u"" #Name; } \
    Name* __ctor() { Base::__ctor(); return this; } \
  };
JS_FAMILY(CryptoAlgorithm, Algorithm)
JS_FAMILY(SymmetricCipherAlgorithm, CryptoAlgorithm)
JS_FAMILY(AsymmetricCipherAlgorithm, CryptoAlgorithm)
JS_FAMILY(StreamCipherAlgorithm, SymmetricCipherAlgorithm)
JS_FAMILY(EncodingAlgorithm, Algorithm)
JS_FAMILY(CompressionAlgorithm, Algorithm)
JS_FAMILY(ErrorCorrectionAlgorithm, Algorithm)
#undef JS_FAMILY

#define JS_FIELD_GET(f) if (k == u"" #f) { out = toAny(f); return true; }
#define JS_FIELD_SET(f) if (k == u"" #f) { f = fromAny<decltype(f)>(v); return true; }
#define JS_FAMILY2(Name, Base, Decl, Init, Fields) \
  struct Name : Base { \
    Decl \
    static const char16_t* __staticClassName() { return u"" #Name; } \
    const char16_t* __className() const override { return u"" #Name; } \
    Name* __ctor() { Base::__ctor(); Init return this; } \
    bool __get(const std::u16string& k, Any& out) override { Fields(JS_FIELD_GET) return Base::__get(k, out); } \
    bool __set(const std::u16string& k, const Any& v) override { Fields(JS_FIELD_SET) return Base::__set(k, v); } \
    bool __has(const std::u16string& k) override { Any out; Fields(JS_FIELD_GET) return Base::__has(k); } \
  };

#define F_BLOCK(X) X(SupportedKeySizes) X(SupportedBlockSizes)
JS_FAMILY2(BlockCipherAlgorithm, SymmetricCipherAlgorithm, Array<Any> SupportedKeySizes; Array<Any> SupportedBlockSizes;,
  SupportedKeySizes = Array<Any>::create(0); SupportedBlockSizes = Array<Any>::create(0);, F_BLOCK)
#define F_HASH(X) X(SupportedOutputSizes)
JS_FAMILY2(HashFunctionAlgorithm, Algorithm, Array<Any> SupportedOutputSizes;, SupportedOutputSizes = Array<Any>::create(0);, F_HASH)
#define F_MAC(X) X(SupportedMacSizes) X(NeedsKey)
JS_FAMILY2(MacAlgorithm, Algorithm, Array<Any> SupportedMacSizes; bool NeedsKey = true;, SupportedMacSizes = Array<Any>::create(0); NeedsKey = true;, F_MAC)
#define F_KDF(X) X(SupportedOutputSizes) X(SaltRequired)
JS_FAMILY2(KdfAlgorithm, Algorithm, Array<Any> SupportedOutputSizes; bool SaltRequired = true;, SupportedOutputSizes = Array<Any>::create(0); SaltRequired = true;, F_KDF)
#define F_PAD(X) X(IsLengthIncluded)
JS_FAMILY2(PaddingAlgorithm, Algorithm, bool IsLengthIncluded = false;, IsLengthIncluded = false;, F_PAD)
#define F_MODE(X) X(RequiresIV) X(SupportedIVSizes)
JS_FAMILY2(CipherModeAlgorithm, Algorithm, bool RequiresIV = true; Array<Any> SupportedIVSizes;, RequiresIV = true; SupportedIVSizes = Array<Any>::create(0);, F_MODE)
#define F_AEAD(X) X(SupportedTagSizes) X(SupportsDetached)
JS_FAMILY2(AeadAlgorithm, CryptoAlgorithm, Array<Any> SupportedTagSizes; bool SupportsDetached = false;, SupportedTagSizes = Array<Any>::create(0); SupportsDetached = false;, F_AEAD)
#define F_RNG(X) X(IsDeterministic) X(IsCryptographicallySecure) X(SupportedSeedSizes)
JS_FAMILY2(RandomGenerationAlgorithm, Algorithm, bool IsDeterministic = false; bool IsCryptographicallySecure = true; Array<Any> SupportedSeedSizes;,
  IsDeterministic = false; IsCryptographicallySecure = true; SupportedSeedSizes = Array<Any>::create(0);, F_RNG)

struct IAlgorithmInstance : Object {
  Algorithm* algorithm = nullptr;
  bool isInverse = false;
  Array<uint8_t> inputBuffer;
  static const char16_t* __staticClassName() { return u"IAlgorithmInstance"; }
  const char16_t* __className() const override { return u"IAlgorithmInstance"; }
  IAlgorithmInstance* __ctor(Algorithm* algorithm = nullptr) { this->algorithm = algorithm; isInverse = false; inputBuffer = Array<uint8_t>::create(0); return this; }
  virtual void Feed(Array<uint8_t> data) {
    if (data.isNull() || data.length() == 0) return;
    if (inputBuffer.isNull()) inputBuffer = Array<uint8_t>::create(0);
    for (int32_t i = 0; i < data.length(); ++i) inputBuffer.push(data.get(i));
  }
  virtual Array<uint8_t> Result() { throwValue(Any(String(u"Result() not implemented"))); }
  virtual void Dispose() { if (!inputBuffer.isNull()) inputBuffer.setLength(0); }
  bool __get(const std::u16string& k, Any& out) override {
    if (k == u"algorithm") { out = algorithm; return true; }
    if (k == u"isInverse") { out = isInverse; return true; }
    if (k == u"inputBuffer") { out = inputBuffer; return true; }
    return Object::__get(k, out);
  }
  bool __set(const std::u16string& k, const Any& v) override {
    if (k == u"algorithm") { algorithm = fromAny<Algorithm*>(v); return true; }
    if (k == u"isInverse") { isInverse = v.truthy(); return true; }
    if (k == u"inputBuffer") { inputBuffer = fromAny<Array<uint8_t>>(v); return true; }
    return Object::__set(k, v);
  }
  bool __has(const std::u16string& k) override { return k == u"algorithm" || k == u"isInverse" || k == u"inputBuffer" || k == u"Feed" || k == u"Result" || k == u"Dispose" || Object::__has(k); }
  bool __hasMethod(const std::u16string& k) override { return k == u"Feed" || k == u"Result" || k == u"Dispose" || Object::__hasMethod(k); }
  bool __call(const std::u16string& k, std::vector<Any>& args, Any& out) override {
    if (k == u"Feed") { Feed(args.size() > 0 ? fromAny<Array<uint8_t>>(args[0]) : Array<uint8_t>()); out = Any(); return true; }
    if (k == u"Result") { out = Result(); return true; }
    if (k == u"Dispose") { Dispose(); out = Any(); return true; }
    return Object::__call(k, args, out);
  }
};

inline bool Algorithm::__call(const std::u16string& k, std::vector<Any>& args, Any& out) {
  if (k == u"CreateInstance") { out = Any(CreateInstance(args.size() > 0 && args[0].truthy())); return true; }
  return Object::__call(k, args, out);
}

struct IBlockCipherInstance : IAlgorithmInstance {
  int32_t BlockSize = 0, KeySize = 0;
  Array<uint8_t> _key;
  static const char16_t* __staticClassName() { return u"IBlockCipherInstance"; }
  const char16_t* __className() const override { return u"IBlockCipherInstance"; }
  IBlockCipherInstance* __ctor(Algorithm* algorithm = nullptr) { IAlgorithmInstance::__ctor(algorithm); BlockSize = 0; KeySize = 0; _key = Array<uint8_t>(); return this; }
  virtual void __set_key(Array<uint8_t> keyBytes) { _key = keyBytes; }
  virtual Array<uint8_t> __get_key() { return _key; }
  virtual Array<uint8_t> EncryptBlock(Array<uint8_t> block) { (void)block; throwValue(Any(String(u"EncryptBlock() not implemented"))); }
  virtual Array<uint8_t> DecryptBlock(Array<uint8_t> block) { (void)block; throwValue(Any(String(u"DecryptBlock() not implemented"))); }
  virtual int32_t RequireBlockMultiple(int32_t blockSize = 0) {
    int32_t size = blockSize ? blockSize : BlockSize;
    if (!(size > 0)) throwError(u"Error", u"BlockSize not set");
    int32_t length = inputBuffer.isNull() ? 0 : inputBuffer.length();
    if (length % size != 0) throwError(u"Error", u"Input length must be multiple of " + str(size).s() + u" bytes");
    return length / size;
  }
  Array<uint8_t> Result() override {
    if (!truthy(__get_key())) throwError(u"Error", u"Key not set");
    if (inputBuffer.isNull() || inputBuffer.length() == 0) throwError(u"Error", u"No data fed");
    int32_t blockSize = BlockSize;
    RequireBlockMultiple(blockSize);
    Array<uint8_t> output = Array<uint8_t>::create(0);
    for (int32_t offset = 0; offset < inputBuffer.length(); offset += blockSize) {
      Array<uint8_t> block = inputBuffer.slice(offset, offset + blockSize);
      Array<uint8_t> processed = isInverse ? DecryptBlock(block) : EncryptBlock(block);
      for (int32_t i = 0; i < processed.length(); ++i) output.push(processed.get(i));
    }
    inputBuffer = Array<uint8_t>::create(0);
    return output;
  }
  bool __get(const std::u16string& k, Any& out) override {
    if (k == u"BlockSize") { out = BlockSize; return true; }
    if (k == u"KeySize") { out = KeySize; return true; }
    if (k == u"_key") { out = _key; return true; }
    if (k == u"key") { out = __get_key(); return true; }
    return IAlgorithmInstance::__get(k, out);
  }
  bool __set(const std::u16string& k, const Any& v) override {
    if (k == u"BlockSize") { BlockSize = fromAny<int32_t>(v); return true; }
    if (k == u"KeySize") { KeySize = fromAny<int32_t>(v); return true; }
    if (k == u"_key") { _key = fromAny<Array<uint8_t>>(v); return true; }
    if (k == u"key") { __set_key(fromAny<Array<uint8_t>>(v)); return true; }
    return IAlgorithmInstance::__set(k, v);
  }
  bool __has(const std::u16string& k) override { return k == u"BlockSize" || k == u"KeySize" || k == u"_key" || k == u"key" || k == u"EncryptBlock" || k == u"DecryptBlock" || k == u"RequireBlockMultiple" || IAlgorithmInstance::__has(k); }
  bool __hasMethod(const std::u16string& k) override { return k == u"EncryptBlock" || k == u"DecryptBlock" || k == u"RequireBlockMultiple" || IAlgorithmInstance::__hasMethod(k); }
  bool __call(const std::u16string& k, std::vector<Any>& args, Any& out) override {
    if (k == u"EncryptBlock") { out = EncryptBlock(args.size() > 0 ? fromAny<Array<uint8_t>>(args[0]) : Array<uint8_t>()); return true; }
    if (k == u"DecryptBlock") { out = DecryptBlock(args.size() > 0 ? fromAny<Array<uint8_t>>(args[0]) : Array<uint8_t>()); return true; }
    if (k == u"RequireBlockMultiple") { out = RequireBlockMultiple(args.size() > 0 ? fromAny<int32_t>(args[0]) : 0); return true; }
    return IAlgorithmInstance::__call(k, args, out);
  }
};

#define JS_INSTANCE(Name, Decl, Init, Fields) \
  struct Name : IAlgorithmInstance { \
    Decl \
    static const char16_t* __staticClassName() { return u"" #Name; } \
    const char16_t* __className() const override { return u"" #Name; } \
    Name* __ctor(Algorithm* algorithm = nullptr) { IAlgorithmInstance::__ctor(algorithm); Init return this; } \
    bool __get(const std::u16string& k, Any& out) override { Fields(JS_FIELD_GET) return IAlgorithmInstance::__get(k, out); } \
    bool __set(const std::u16string& k, const Any& v) override { Fields(JS_FIELD_SET) return IAlgorithmInstance::__set(k, v); } \
    bool __has(const std::u16string& k) override { Any out; Fields(JS_FIELD_GET) return IAlgorithmInstance::__has(k); } \
  };
#define F_NONE(X)
#define F_IHASH(X) X(OutputSize)
JS_INSTANCE(IHashFunctionInstance, int32_t OutputSize = 0;, OutputSize = 0;, F_IHASH)
#define F_IKDF(X) X(OutputSize) X(Iterations)
JS_INSTANCE(IKdfInstance, int32_t OutputSize = 0; int32_t Iterations = 0;, OutputSize = 0; Iterations = 0;, F_IKDF)
#define F_IAEAD(X) X(aad) X(tagSize)
JS_INSTANCE(IAeadInstance, Array<uint8_t> aad; int32_t tagSize = 0;, aad = Array<uint8_t>::create(0); tagSize = 0;, F_IAEAD)

struct IMacInstance : IAlgorithmInstance {
  static const char16_t* __staticClassName() { return u"IMacInstance"; }
  const char16_t* __className() const override { return u"IMacInstance"; }
  IMacInstance* __ctor(Algorithm* algorithm = nullptr) { IAlgorithmInstance::__ctor(algorithm); return this; }
  virtual Array<uint8_t> ComputeMac(Array<uint8_t> data) { (void)data; throwValue(Any(String(u"ComputeMac() not implemented"))); }
  bool __has(const std::u16string& k) override { return k == u"ComputeMac" || IAlgorithmInstance::__has(k); }
};
struct IErrorCorrectionInstance : IAlgorithmInstance {
  static const char16_t* __staticClassName() { return u"IErrorCorrectionInstance"; }
  const char16_t* __className() const override { return u"IErrorCorrectionInstance"; }
  IErrorCorrectionInstance* __ctor(Algorithm* algorithm = nullptr) { IAlgorithmInstance::__ctor(algorithm); return this; }
  virtual bool DetectError(Array<uint8_t> data) { (void)data; throwValue(Any(String(u"DetectError() not implemented"))); }
  bool __has(const std::u16string& k) override { return k == u"DetectError" || IAlgorithmInstance::__has(k); }
};
struct IRandomGeneratorInstance : IAlgorithmInstance {
  static const char16_t* __staticClassName() { return u"IRandomGeneratorInstance"; }
  const char16_t* __className() const override { return u"IRandomGeneratorInstance"; }
  IRandomGeneratorInstance* __ctor(Algorithm* algorithm = nullptr) { IAlgorithmInstance::__ctor(algorithm); return this; }
  virtual Array<uint8_t> NextBytes(int32_t count) { (void)count; throwValue(Any(String(u"NextBytes() not implemented"))); }
  bool __has(const std::u16string& k) override { return k == u"NextBytes" || IAlgorithmInstance::__has(k); }
};

// The registry: AlgorithmFramework.Algorithms, RegisterAlgorithm, Find
inline Array<Algorithm*>& Algorithms() { static Array<Algorithm*> a = Array<Algorithm*>::create(0); return a; }
inline Algorithm* Find(const String& name) {
  Array<Algorithm*>& all = Algorithms();
  for (int32_t i = 0; i < all.length(); ++i) if (all.get(i) && all.get(i)->name == name) return all.get(i);
  return nullptr;
}
inline void RegisterAlgorithm(Algorithm* algorithm) {
  if (!algorithm) throwError(u"Error", u"RegisterAlgorithm: Invalid algorithm object");
  if (algorithm->name.isNull() || algorithm->name.s().empty()) throwError(u"Error", u"RegisterAlgorithm: Algorithm must have a valid name");
  if (Find(algorithm->name)) throwError(u"Error", u"RegisterAlgorithm: Algorithm '" + algorithm->name.s() + u"' already registered");
  Algorithms().push(algorithm);
}
inline void ClearAlgorithms() { Algorithms().setLength(0); }

} // namespace js
#endif // JS_RUNTIME_INCLUDED
`;
  const CPP_REGEX_RUNTIME = String.raw`// Regular expressions (ECMAScript grammar of std::regex, on the UTF-8 form): only
// in programs that use them, as <regex> doubles the compile time.
#ifndef JS_REGEX_INCLUDED
#define JS_REGEX_INCLUDED
#include <regex>
namespace js {
struct RegExp : Object {
  std::string source, flags;
  std::regex re;
  RegExp(const std::string& s, const std::string& f) : source(s), flags(f), re(s, f.find('i') != std::string::npos ? std::regex::ECMAScript | std::regex::icase : std::regex::ECMAScript) {}
  const char16_t* __className() const override { return u"RegExp"; }
  bool test(const String& s) const { std::string t = toUtf8(s.s()); return std::regex_search(t, re); }
  bool __call(const std::u16string& k, std::vector<Any>& args, Any& out) override {
    if (k == u"test") { out = Any(test(args.empty() ? String(u"undefined") : str(args[0]))); return true; }
    return Object::__call(k, args, out);
  }
  bool __hasMethod(const std::u16string& k) override { return k == u"test" || Object::__hasMethod(k); }
};
inline RegExp* newRegExp(const char16_t* pattern, const char16_t* flags) { return new RegExp(toUtf8(pattern), toUtf8(flags)); }
inline String regexReplace(const String& s, const char16_t* pattern, const char16_t* flags, const String& with) {
  std::regex re(toUtf8(pattern), std::u16string(flags).find(u'i') != std::u16string::npos ? std::regex::ECMAScript | std::regex::icase : std::regex::ECMAScript);
  bool global = std::u16string(flags).find(u'g') != std::u16string::npos;
  std::string r = std::regex_replace(toUtf8(s.s()), re, toUtf8(with.s()), global ? std::regex_constants::format_default : std::regex_constants::format_first_only);
  return String(fromUtf8(r));
}
inline Array<String> regexSplit(const String& s, const char16_t* pattern) {
  std::string t = toUtf8(s.s());
  std::regex re(toUtf8(pattern));
  Array<String> r = Array<String>::create(0);
  std::sregex_token_iterator it(t.begin(), t.end(), re, -1), end;
  for (; it != end; ++it) r.push(String(fromUtf8(*it)));
  return r;
}
inline Any regexMatch(const String& s, const String& pattern) {
  std::string t = toUtf8(s.s());
  std::smatch m;
  if (!std::regex_search(t, m, std::regex(toUtf8(pattern.s())))) return Any(nullptr);
  Array<String> r = Array<String>::create(0);
  for (auto& g : m) r.push(String(fromUtf8(g.str())));
  return Any(r);
}
} // namespace js
#endif // JS_REGEX_INCLUDED
`;
  // @@RUNTIME-END

  // A string literal cached on first use (a C++ string is built once per site)
  const LITERAL_MACRO = '#ifndef JS_LIT\n#define JS_LIT(x) ([]() -> const ::js::String& { static const ::js::String s_(x, sizeof(x) / sizeof(char16_t) - 1); return s_; }())\n#endif\n';

  class CppEmitter {
    constructor(options = {}) {
      this.indentUnit = options.indent || '    ';
      this.newline = options.lineEnding || '\n';
    }

    /** The runtime prelude the transpiled code needs */
    static get runtime() { return CPP_RUNTIME; }

    emit(file) {
      const out = [];
      if (file.nodeType !== 'File') {
        this.emitNode(file, 0, out);
        return out.join(this.newline) + this.newline;
      }
      const body = [];
      if (file.namespace) body.push(`namespace ${file.namespace} {`, '');
      for (const section of file.sections) this.emitNode(section, 0, body);
      if (file.namespace) body.push('', `} // namespace ${file.namespace}`);
      const code = body.join(this.newline);
      if (file.includeRuntime) {
        out.push(CPP_RUNTIME, LITERAL_MACRO);
        // <regex> only where a regular expression is used
        if (/js::(newRegExp|regex[A-Z])/.test(code)) out.push(CPP_REGEX_RUNTIME);
      }
      out.push(code);
      return out.join(this.newline) + this.newline;
    }

    pad(depth) { return this.indentUnit.repeat(depth); }

    /** A statement in a position where C++ wants one statement */
    emitBody(node, depth, out) {
      if (node && node.nodeType === 'Block') {
        this.emitNode(node, depth, out);
      } else {
        out.push(this.pad(depth) + '{');
        if (node) this.emitNode(node, depth + 1, out);
        out.push(this.pad(depth) + '}');
      }
    }

    emitNode(node, depth, out) {
      if (!node) return;
      const p = this.pad(depth);
      switch (node.nodeType) {
        case 'Raw':
          for (const line of String(node.text).split('\n')) out.push(line.length ? p + line : '');
          return;
        case 'Comment':
          for (const line of String(node.text).split('\n')) out.push(p + '// ' + line);
          return;
        case 'Class':
          out.push(p + `struct ${node.name}${node.base ? ' : ' + node.base : ''} {`);
          for (const member of node.members) this.emitNode(member, depth + 1, out);
          out.push(p + '};', '');
          return;
        case 'Function':
          out.push(p + node.signature);
          this.emitNode(node.body, depth, out);
          out.push('');
          return;
        case 'Block':
          out.push(p + '{');
          for (const s of node.statements) this.emitNode(s, depth + 1, out);
          out.push(p + '}');
          return;
        case 'ExpressionStatement':
          out.push(p + node.expression + ';');
          return;
        case 'VariableDeclaration':
          out.push(p + `${node.type} ${node.name}${node.init !== null && node.init !== undefined ? ' = ' + node.init : '{}'};`);
          return;
        case 'If': {
          out.push(p + `if (${node.test})`);
          this.emitBody(node.consequent, depth, out);
          if (node.alternate) {
            if (node.alternate.nodeType === 'If') {
              const nested = [];
              this.emitNode(node.alternate, depth, nested);
              nested[0] = p + 'else ' + nested[0].trimStart();
              out.push(...nested);
            } else {
              out.push(p + 'else');
              this.emitBody(node.alternate, depth, out);
            }
          }
          return;
        }
        case 'For': {
          let init = '';
          if (node.init) {
            const tmp = [];
            this.emitNode(node.init, 0, tmp);
            init = tmp.join(' ').replace(/;\s*$/, '');
          }
          out.push(p + `for (${init}; ${node.test || ''}; ${node.update || ''})`);
          this.emitBody(node.body, depth, out);
          return;
        }
        case 'While':
          out.push(p + `while (${node.test})`);
          this.emitBody(node.body, depth, out);
          return;
        case 'DoWhile':
          out.push(p + 'do');
          this.emitBody(node.body, depth, out);
          out.push(p + `while (${node.test});`);
          return;
        case 'Return':
          out.push(p + (node.value !== null && node.value !== undefined ? `return ${node.value};` : 'return;'));
          return;
        case 'Break':
          out.push(p + 'break;');
          return;
        case 'Continue':
          out.push(p + 'continue;');
          return;
        case 'Goto':
          out.push(p + `goto ${node.label};`);
          return;
        case 'Label':
          out.push(p + `${node.name}:;`);
          return;
        case 'Throw':
          out.push(p + `throw ${node.value};`);
          return;
        case 'Try':
          out.push(p + 'try');
          this.emitNode(node.block, depth, out);
          out.push(p + 'catch (...)');
          out.push(p + '{');
          if (node.catchDeclaration) out.push(this.pad(depth + 1) + node.catchDeclaration);
          if (node.handler) for (const s of node.handler.statements) this.emitNode(s, depth + 1, out);
          else out.push(this.pad(depth + 1) + 'throw;');
          out.push(p + '}');
          return;
        case 'Switch':
          out.push(p + `switch (${node.discriminant})`);
          out.push(p + '{');
          for (const c of node.cases) {
            for (const label of c.labels) out.push(this.pad(depth) + (label === 'default' ? 'default:' : `case ${label}:`));
            out.push(this.pad(depth + 1) + '{');
            for (const s of c.body) this.emitNode(s, depth + 2, out);
            out.push(this.pad(depth + 1) + '}');
          }
          out.push(p + '}');
          return;
        default:
          out.push(p + `/* unsupported node ${node.nodeType} */`);
      }
    }
  }

  const exports = { CppEmitter, CPP_RUNTIME, CPP_REGEX_RUNTIME };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exports;
  }
  if (typeof global !== 'undefined') {
    global.CppEmitter = CppEmitter;
  }

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
