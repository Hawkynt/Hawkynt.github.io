# ECB

> Electronic Codebook mode encrypts each block independently using the underlying block cipher. This is the simplest mode but reveals patterns in plaintext data, making it unsuitable for most cryptographic applications. Educational implementation for learning cipher modes.

## Properties

| Property | Value |
| --- | --- |
| Category | Cipher Modes |
| Sub-category | Block Cipher Mode |
| Security status | ❌ Broken |
| Complexity | Beginner |
| Inventor | US National Bureau of Standards |
| Year | 1977 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/modes/ecb.js`](../../../algorithms/modes/ecb.js) |

## Capabilities

| Flag | Value |
| --- | --- |
| `RequiresIV` | No |

## Security

**Status:** ❌ Broken

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Pattern Leakage | Identical plaintext blocks produce identical ciphertext blocks, revealing patterns | — |
| Block Replay | Individual blocks can be extracted and replayed in different positions | — |
| Known Plaintext | If attacker knows one block plaintext/ciphertext pair, identical blocks elsewhere are compromised | — |

## Documentation

- [NIST SP 800-38A](https://csrc.nist.gov/publications/detail/sp/800-38a/final)
- [FIPS 81 (Historical)](https://csrc.nist.gov/csrc/media/publications/fips/81/archive/1980-12-02/documents/fips81.pdf)

## References

- Cryptography Engineering — Chapter on block cipher modes
- Applied Cryptography — Bruce Schneier - Chapter 9

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [AES-128 ECB test vector](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38a.pdf)

| Field | Value |
| --- | --- |
| `key` | `2b7e151628aed2a6abf7158809cf4f3c` |
| `cipher` | AES |
| `input` | `6bc1bee22e409f96e93d7e117393172a` |
| `expected` | `3ad77bb40d7a3660a89ecaf32466ef97` |

**Vector 2** — [AES-128 ECB second block](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38a.pdf)

| Field | Value |
| --- | --- |
| `key` | `2b7e151628aed2a6abf7158809cf4f3c` |
| `cipher` | AES |
| `input` | `ae2d8a571e03ac9c9eb76fac45af8e51` |
| `expected` | `f5d3d58503b9699de785895a96fdbaaf` |

---

[← All algorithms](../README.md)
