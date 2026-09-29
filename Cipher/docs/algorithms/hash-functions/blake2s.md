# BLAKE2s

> BLAKE2s is a high-speed cryptographic hash function optimized for 8-32 bit platforms. It's the 32-bit version of BLAKE2 and is used in protocols like WireGuard.

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
| Output sizes | 32 bytes (256 bits) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [RFC 7693 - BLAKE2 Cryptographic Hash and MAC](https://tools.ietf.org/html/rfc7693)
- [BLAKE2 Official Specification](https://blake2.net/blake2.pdf)
- [BLAKE2 Reference Implementation](https://github.com/BLAKE2/BLAKE2)

## References

- [Wikipedia BLAKE2](https://en.wikipedia.org/wiki/BLAKE_(hash_function)#BLAKE2)
- [WireGuard Protocol](https://www.wireguard.com/papers/wireguard.pdf)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [RFC 7693 BLAKE2s - Empty string](https://datatracker.ietf.org/doc/html/rfc7693)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `69217a3079908094e11121d042354a7c1f55b6482ca1a51e1b250dfd1ed0eef9` |

**Vector 2** — [RFC 7693 BLAKE2s - 'abc'](https://datatracker.ietf.org/doc/html/rfc7693)

| Field | Value |
| --- | --- |
| `input` | `616263` |
| `expected` | `508c5e8c327c14e2e1a72ba34eeb452f37458b209ed63a294d999b4c86675982` |

**Vector 3** — [Linux crypto test vector - Empty string unkeyed](https://kdave.github.io/linux-crypto-blake2s/)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `69217a3079908094e11121d042354a7c1f55b6482ca1a51e1b250dfd1ed0eef9` |

---

[← All algorithms](../README.md)
