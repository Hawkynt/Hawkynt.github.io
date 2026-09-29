# BLAKE2b

> BLAKE2b is a high-speed cryptographic hash function optimized for 64-bit platforms. It's faster than MD5, SHA-1, SHA-2, and SHA-3 while providing excellent security properties.

## Properties

| Property | Value |
| --- | --- |
| Category | Hash Functions |
| Sub-category | BLAKE Family |
| Security status | Not classified |
| Complexity | Advanced |
| Inventor | Jean-Philippe Aumasson, Samuel Neves, Zooko Wilcox-O'Hearn, Christian Winnerlein |
| Year | 2012 |
| Origin | 🇨🇭 Switzerland |
| Source | [`algorithms/hash/blake2.js`](../../../algorithms/hash/blake2.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Output sizes | 64 bytes (512 bits) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [RFC 7693 - BLAKE2 Cryptographic Hash and MAC](https://tools.ietf.org/html/rfc7693)
- [BLAKE2 Official Specification](https://blake2.net/blake2.pdf)
- [BLAKE2 Reference Implementation](https://github.com/BLAKE2/BLAKE2)

## References

- [Wikipedia BLAKE2](https://en.wikipedia.org/wiki/BLAKE_(hash_function)#BLAKE2)
- [libsodium BLAKE2b](https://github.com/jedisct1/libsodium)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [RFC 7693 Test Vector - Empty string](https://tools.ietf.org/html/rfc7693)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `786a02f742015903c6c6fd852552d272 912f4740e15847618a86e217f71f5419 d25e1031afee585313896444934eb04b 903a685b1448b755d56f701afe9be2ce` |

**Vector 2** — [RFC 7693 Test Vector - abc](https://tools.ietf.org/html/rfc7693)

| Field | Value |
| --- | --- |
| `input` | `616263` |
| `expected` | `ba80a53f981c4d0d6a2797b69f12f6e9 4c212f14685ac4b74b12bb6fdbffa2d1 7d87c5392aab792dc252d5de4533cc95 18d38aa8dbf1925ab92386edd4009923` |

**Vector 3** — [RFC 7693 Test Vector - The quick brown fox](https://tools.ietf.org/html/rfc7693)

| Field | Value |
| --- | --- |
| `input` | `54686520717569636b2062726f776e20 666f78206a756d7073206f7665722074 6865206c617a7920646f67` |
| `expected` | `a8add4bdddfd93e4877d2746e62817b1 16364a1fa7bc148d95090bc7333b3673 f82401cf7aa2e4cb1ecd90296e3f14cb 5413f8ed77be73045b13914cdcd6a918` |

---

[← All algorithms](../README.md)
