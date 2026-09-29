# MD4

> MD4 is a 128-bit cryptographic hash function and predecessor to MD5. It is cryptographically broken with practical collision attacks and should only be used for educational purposes.

## Properties

| Property | Value |
| --- | --- |
| Category | Hash Functions |
| Sub-category | MD Family |
| Security status | Not classified |
| Complexity | Not specified |
| Inventor | Ronald Rivest |
| Year | 1990 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/hash/md.js`](../../../algorithms/hash/md.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Output sizes | 16 bytes (128 bits) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [RFC 1320 - MD4 Message-Digest Algorithm](https://tools.ietf.org/html/rfc1320)
- [Wikipedia MD4](https://en.wikipedia.org/wiki/MD4)

## References

- [MD4 Collision Attacks](https://link.springer.com/chapter/10.1007/978-3-540-28628-8_1)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [RFC 1320 Test Vector - Empty string](https://tools.ietf.org/html/rfc1320)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `31d6cfe0d16ae931b73c59d7e0c089c0` |

**Vector 2** — [RFC 1320 Test Vector - 'a'](https://tools.ietf.org/html/rfc1320)

| Field | Value |
| --- | --- |
| `input` | `61` |
| `expected` | `bde52cb31de33e46245e05fbdbd6fb24` |

**Vector 3** — [RFC 1320 Test Vector - 'abc'](https://tools.ietf.org/html/rfc1320)

| Field | Value |
| --- | --- |
| `input` | `616263` |
| `expected` | `a448017aaf21d8525fc10ae87aa6729d` |

---

[← All algorithms](../README.md)
