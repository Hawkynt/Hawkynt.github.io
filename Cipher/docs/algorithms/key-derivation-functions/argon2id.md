# Argon2id

> Password Hashing Competition winner (2015) - hybrid variant combining Argon2d and Argon2i. RECOMMENDED for general password hashing. First half uses data-independent addressing (Argon2i), second half uses data-dependent (Argon2d), providing both side-channel resistance and GPU attack resistance.

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

**Vector 1** — [Botan Official Test Vector - Argon2id (M=32, T=3, P=4)](https://github.com/randombit/botan/blob/master/src/tests/data/argon2.vec)

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
| `expected` | `0d640df58d78766c08c037a34a8b53c9d01ef0452d75b65eb52520e96b01e659` |

**Vector 2** — [Botan Official Test Vector - Argon2id (M=64, T=3, P=4)](https://github.com/randombit/botan/blob/master/src/tests/data/argon2.vec)

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
| `expected` | `4275ee5ad887fe3270e82f01e97db8af3cf63fc7f2102bfea84b305f416a4544` |

**Vector 3** — [Botan Official Test Vector - Argon2id (M=128, T=3, P=4)](https://github.com/randombit/botan/blob/master/src/tests/data/argon2.vec)

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
| `expected` | `8ec72f253bd35d55c3e49c587c77665c9c7fcff26cb3cabe179039b7c4281a48` |

---

[← All algorithms](../README.md)
