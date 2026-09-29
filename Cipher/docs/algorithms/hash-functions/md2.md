# MD2

> MD2 is a 128-bit cryptographic hash function and predecessor to MD4 and MD5. It is extremely slow and cryptographically broken with known collision and preimage attacks.

## Properties

| Property | Value |
| --- | --- |
| Category | Hash Functions |
| Sub-category | MD Family |
| Security status | Not classified |
| Complexity | Not specified |
| Inventor | Ronald Rivest |
| Year | 1989 |
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

- [RFC 1319 - MD2 Message-Digest Algorithm](https://tools.ietf.org/html/rfc1319)
- [Wikipedia MD2](https://en.wikipedia.org/wiki/MD2_(cryptography))

## References

- [MD2 Cryptanalysis Papers](https://link.springer.com/chapter/10.1007/978-3-540-45146-4_3)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [RFC 1319 Test Vector - Empty string](https://tools.ietf.org/html/rfc1319)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `8350e5a3e24c153df2275c9f80692773` |

**Vector 2** — [RFC 1319 Test Vector - 'a'](https://tools.ietf.org/html/rfc1319)

| Field | Value |
| --- | --- |
| `input` | `61` |
| `expected` | `32ec01ec4a6dac72c0ab96fb34c0b5d1` |

**Vector 3** — [RFC 1319 Test Vector - 'abc'](https://tools.ietf.org/html/rfc1319)

| Field | Value |
| --- | --- |
| `input` | `616263` |
| `expected` | `da853b0d3f88d99b30283a69e6ded6bb` |

---

[← All algorithms](../README.md)
