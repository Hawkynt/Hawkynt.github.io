# Argon2d

> Password Hashing Competition winner (2015) - data-dependent variant providing maximum resistance to GPU cracking attacks but vulnerable to side-channel attacks. Uses memory access patterns dependent on password content.

## Properties

| Property | Value |
| --- | --- |
| Category | Key Derivation Functions |
| Sub-category | Memory-Hard Password Hashing |
| Security status | 🛡️ Secure |
| Complexity | Advanced |
| Inventor | Alex Biryukov, Daniel Dinu, Dmitry Khovratovich |
| Year | 2015 |
| Origin | 🌐 International |
| Source | [`algorithms/kdf/argon2.js`](../../../algorithms/kdf/argon2.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Output sizes | 4 bytes (32 bits) to 1024 bytes (8192 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `SaltRequired` | Yes |

## Security

**Status:** 🛡️ Secure

No vulnerabilities are recorded for this implementation.

## Documentation

- [RFC 9106 - Argon2 Memory-Hard Function for Password Hashing](https://datatracker.ietf.org/doc/html/rfc9106)
- [Argon2 Specification](https://github.com/P-H-C/phc-winner-argon2/blob/master/argon2-specs.pdf)
- [Password Hashing Competition](https://www.password-hashing.net/)

## References

- [PHC Winner Argon2 Reference Implementation](https://github.com/P-H-C/phc-winner-argon2)
- [Botan Argon2 Implementation](https://botan.randombit.net/)
- [NIST - Password-Based Key Derivation](https://csrc.nist.gov/projects/password-hashing)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Botan Official Test Vector - Argon2d (M=32, T=3, P=4)](https://github.com/randombit/botan/blob/master/src/tests/data/argon2.vec)

| Field | Value |
| --- | --- |
| `password` | `0101010101010101010101010101010101010101010101010101010101010101` |
| `salt` | `02020202020202020202020202020202` |
| `secret` | `0303030303030303` |
| `ad` | `040404040404040404040404` |
| `M` | `32` |
| `T` | `3` |
| `P` | `4` |
| `outputSize` | `32` |
| `input` | `0101010101010101010101010101010101010101010101010101010101010101` |
| `expected` | `512b391b6f1162975371d30919734294f868e3be3984f3c1a13a4db9fabe4acb` |

**Vector 2** — [Botan Official Test Vector - Argon2d (M=64, T=3, P=4)](https://github.com/randombit/botan/blob/master/src/tests/data/argon2.vec)

| Field | Value |
| --- | --- |
| `password` | `0101010101010101010101010101010101010101010101010101010101010101` |
| `salt` | `02020202020202020202020202020202` |
| `secret` | `0303030303030303` |
| `ad` | `040404040404040404040404` |
| `M` | `64` |
| `T` | `3` |
| `P` | `4` |
| `outputSize` | `32` |
| `input` | `0101010101010101010101010101010101010101010101010101010101010101` |
| `expected` | `ab75c7556cd63bbaa818e02dbdfe8c69e80375d64b31d6a7b2bf41da7f7c9951` |

**Vector 3** — [Botan Official Test Vector - Argon2d (M=128, T=3, P=4)](https://github.com/randombit/botan/blob/master/src/tests/data/argon2.vec)

| Field | Value |
| --- | --- |
| `password` | `0101010101010101010101010101010101010101010101010101010101010101` |
| `salt` | `02020202020202020202020202020202` |
| `secret` | `0303030303030303` |
| `ad` | `040404040404040404040404` |
| `M` | `128` |
| `T` | `3` |
| `P` | `4` |
| `outputSize` | `32` |
| `input` | `0101010101010101010101010101010101010101010101010101010101010101` |
| `expected` | `5fc18a6a56b67cadf60287babc490ca0e866f0880a2b51e56a0ab0a640179d13` |

---

[← All algorithms](../README.md)
