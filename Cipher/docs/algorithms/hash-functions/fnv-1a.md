# FNV-1a

> FNV-1a is a fast non-cryptographic hash function with good distribution properties. It uses simple multiply and XOR operations for high performance.

## Properties

| Property | Value |
| --- | --- |
| Category | Hash Functions |
| Sub-category | Fast Hash |
| Security status | 🎓 Educational Only |
| Complexity | Not specified |
| Inventor | Glenn Fowler, Landon Curt Noll, Phong Vo |
| Year | 1991 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/hash/fnv.js`](../../../algorithms/hash/fnv.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Output sizes | 4 bytes (32 bits) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [FNV Hash Official Website](http://www.isthe.com/chongo/tech/comp/fnv/index.html)
- [FNV Hash Specification](http://www.isthe.com/chongo/tech/comp/fnv/)
- [Wikipedia FNV Hash](https://en.wikipedia.org/wiki/Fowler%E2%80%93Noll%E2%80%93Vo_hash_function)

## References

- [FNV Reference Implementation](http://www.isthe.com/chongo/src/fnv/)
- [Hash Function Performance Tests](https://github.com/aappleby/smhasher)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [FNV-1a Test Vector - Empty string](http://www.isthe.com/chongo/tech/comp/fnv/)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `811c9dc5` |

**Vector 2** — [FNV-1a Test Vector - 'a'](http://www.isthe.com/chongo/tech/comp/fnv/)

| Field | Value |
| --- | --- |
| `input` | `61` |
| `expected` | `e40c292c` |

**Vector 3** — [FNV-1a Test Vector - 'foobar'](http://www.isthe.com/chongo/tech/comp/fnv/)

| Field | Value |
| --- | --- |
| `input` | `666f6f626172` |
| `expected` | `bf9cf968` |

---

[← All algorithms](../README.md)
