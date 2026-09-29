# EDE

> EDE (Encrypt-Decrypt-Encrypt) mode applies Encrypt-Decrypt-Encrypt operations using the underlying block cipher. Supports both 2-key mode (K1-K2-K1) and 3-key mode (K1-K2-K3). This is the standard triple operation mode used in 3DES and provides compatibility with single encryption when K1=K2=K3.

## Properties

| Property | Value |
| --- | --- |
| Category | Cipher Modes |
| Sub-category | Block Cipher Mode |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | IBM (Walter Tuchman) |
| Year | 1978 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/modes/ede.js`](../../../algorithms/modes/ede.js) |

## Capabilities

| Flag | Value |
| --- | --- |
| `RequiresIV` | No |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Meet-in-the-middle | Effective security reduced to 2n bits for 2-key variant | — |
| Sweet32 | Birthday attacks on 64-bit block ciphers after 2^32 blocks | — |
| Key reuse | 2-key variant (K1-K2-K1) has lower effective security than 3-key | — |

## Documentation

- [NIST SP 800-67](https://csrc.nist.gov/publications/detail/sp/800-67/rev-2/final)
- [Triple DES](https://en.wikipedia.org/wiki/Triple_DES)
- Applied Cryptography — Bruce Schneier - Multiple Encryption

## References

- [FIPS 46-3](https://csrc.nist.gov/publications/detail/fips/46/3/archive/1999-10-25)
- Cryptography Engineering — Ferguson, Schneier, Kohno - EDE construction
- ANSI X9.52 — Triple DES Encryption Algorithm

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [NIST TDES_ECB - three-key TDEA (EDE3), two blocks](https://csrc.nist.gov/projects/cryptographic-standards-and-guidelines/example-values)

| Field | Value |
| --- | --- |
| `cipher` | DES |
| `key` | `0123456789abcdef23456789abcdef01456789abcdef0123` |
| `input` | `6bc1bee22e409f96e93d7e117393172aae2d8a571e03ac9c9eb76fac45af8e51` |
| `expected` | `714772f339841d34267fcc4bd2949cc3ee11c22a576a303876183f99c0b6de87` |

**Vector 2** — [NIST TDES_ECB - two-key TDEA (EDE2, K3 = K1), two blocks](https://csrc.nist.gov/projects/cryptographic-standards-and-guidelines/example-values)

| Field | Value |
| --- | --- |
| `cipher` | DES |
| `key` | `0123456789abcdef23456789abcdef010123456789abcdef` |
| `input` | `6bc1bee22e409f96e93d7e117393172aae2d8a571e03ac9c9eb76fac45af8e51` |
| `expected` | `06ede3d82884090aff322c19f0518486730576972a666e58b6c88cf107340d3d` |

---

[← All algorithms](../README.md)
