# EEE

> EEE (Triple Encrypt) mode applies the underlying block cipher three times in encryption mode with three independent keys (K1, K2, K3). This provides enhanced security through cascade encryption. Can be used with any block cipher to increase effective key length.

## Properties

| Property | Value |
| --- | --- |
| Category | Cipher Modes |
| Sub-category | Block Cipher Mode |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Generic cascade cipher construction |
| Year | 1978 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/modes/eee.js`](../../../algorithms/modes/eee.js) |

## Capabilities

| Flag | Value |
| --- | --- |
| `RequiresIV` | No |
| `RequiresTripleKey` | Yes |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Meet-in-the-middle | If attacker can store 2^n encryptions, effective security may be reduced from 3n to 2n bits | — |
| Key scheduling | Poor key scheduling in underlying cipher may reduce effective security | — |
| Related keys | If keys are related, security may be significantly reduced | — |

## Documentation

- [Cascade Ciphers](https://en.wikipedia.org/wiki/Multiple_encryption)
- Applied Cryptography — Bruce Schneier - Multiple Encryption
- [NIST SP 800-67](https://csrc.nist.gov/publications/detail/sp/800-67/rev-2/final)

## References

- Cryptography Engineering — Ferguson, Schneier, Kohno - Cascade constructions
- Handbook of Applied Cryptography — Chapter 7 - Multiple encryption

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [EEE round-trip test - 3-key mode with DES (8-byte block)](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-67Rev2.pdf)

| Field | Value |
| --- | --- |
| `cipher` | DES |
| `key` | `0123456789abcdef23456789abcdef01456789abcdef0123` |
| `input` | `0123456789abcdef` |
| `expected` | _(empty)_ |

**Vector 2** — [EEE round-trip test - 3-key mode with DES (16-byte input)](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-67Rev2.pdf)

| Field | Value |
| --- | --- |
| `cipher` | DES |
| `key` | `0123456789abcdef23456789abcdef01456789abcdef0123` |
| `input` | `54686520717569636b2062726f776e20` |
| `expected` | _(empty)_ |

**Vector 3** — [EEE round-trip test - 3-key mode with DES (alternate keys)](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-67Rev2.pdf)

| Field | Value |
| --- | --- |
| `cipher` | DES |
| `key` | `abcdef0123456789bcdef01234567890cdef012345678901` |
| `input` | `6bc1bee22e409f96e93d7e117393172a` |
| `expected` | _(empty)_ |

---

[← All algorithms](../README.md)
