# SEAL-3.0-BE

> Software-optimized stream cipher designed by Rogaway and Coppersmith using SHA-1-based table generation. Generates 1024 bytes of keystream per iteration. Big-endian variant. Broken - theoretical attacks exist.

## Properties

| Property | Value |
| --- | --- |
| Category | Stream Ciphers |
| Sub-category | Stream Cipher |
| Security status | ❌ Broken |
| Complexity | Advanced |
| Inventor | Phil Rogaway, Don Coppersmith |
| Year | 1994 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/stream/seal.js`](../../../algorithms/stream/seal.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 20 bytes (160 bits) |
| IV sizes | 4 bytes (32 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `isBigEndian` | Yes |

## Security

**Status:** ❌ Broken

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| SEAL has known theoretical weaknesses and is considered broken for modern cryptographic applications. | — | Use modern stream ciphers like ChaCha20 or XSalsa20 for new systems. |

## Documentation

- [SEAL Specification (FSE'94)](https://web.cs.ucdavis.edu/~rogaway/papers/seal.pdf)
- [Crypto++ SEAL Implementation](https://github.com/weidai11/cryptopp/blob/master/seal.cpp)

## References

- [Crypto++ seal.cpp (reference SEAL 3.0 implementation)](https://github.com/weidai11/cryptopp/blob/master/seal.cpp)
- [Crypto++ seal.h (SEAL 3.0 class definitions)](https://github.com/weidai11/cryptopp/blob/master/seal.h)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Crypto++ SEAL-3.0-BE Test Vector](https://github.com/weidai11/cryptopp/blob/master/TestVectors/seal.txt)

| Field | Value |
| --- | --- |
| `key` | `67452301efcdab8998badcfe10325476c3d2e1f0` |
| `iv` | `013577af` |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 …` (1024 bytes; the full value is in the source) |
| `expected` | `37a005959b84c49ca4be1e050673530f 5fb097fdf6a13fbd6c2cdecd81fdee7c 2abdc3e764209aff00a12283ef675085 c1634b53289059e6a7ab5ed9480c01eb …` (1024 bytes; the full value is in the source) |

**Vector 2** — [DarkCrypt Seal3lib KERNEL vector (SEAL 3.0, key=00..13, iv=00000000)](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f10111213` |
| `iv` | `00000000` |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `expected` | `ea180e1c72b8bc5d0bb53bc0e6f2eba6 e19436e7cbcaca18fe01dbcc4407fe61 5748a47ad2f6aec393a0efa009bd4ce1 a45a669a584ab53bb54069740c7dc485 654817d3974ed3f5ee3cd373916d0f3b d1dd0544166cbc5fc30a4a0078aead7b e56fd8bc11e81e8498c6354ee2fbe434 31a1223527e11a3ef739954d9732edfc` |

---

[← All algorithms](../README.md)
