# Argon2i

> Password Hashing Competition winner (2015) - data-independent variant resistant to side-channel attacks. Memory access patterns are independent of password content, making it suitable for password hashing in environments with potential side-channel threats.

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

**Vector 1** — [Botan Official Test Vector - Argon2i (M=32, T=3, P=4)](https://github.com/randombit/botan/blob/master/src/tests/data/argon2.vec)

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
| `expected` | `c814d9d1dc7f37aa13f0d77f2494bda1c8de6b016dd388d29952a4c4672b6ce8` |

**Vector 2** — [Botan Official Test Vector - Argon2i (M=64, T=3, P=4)](https://github.com/randombit/botan/blob/master/src/tests/data/argon2.vec)

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
| `expected` | `0f639e5eb9ae1d4d582ccb6033b95551f916a2bdf48ae23d2b8ba4414eb6a182` |

**Vector 3** — [Botan Official Test Vector - Argon2i (M=128, T=3, P=4)](https://github.com/randombit/botan/blob/master/src/tests/data/argon2.vec)

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
| `expected` | `88031ec2094b24a9c4399e7f3fdaa5701dc3bae89917c6ba582e924a547a623d` |

---

[← All algorithms](../README.md)
