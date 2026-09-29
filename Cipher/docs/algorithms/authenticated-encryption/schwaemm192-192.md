# Schwaemm192-192

> NIST Lightweight Cryptography finalist using SPARKLE-384 permutation. Balanced variant with 192-bit security level for both key and tag.

## Properties

| Property | Value |
| --- | --- |
| Category | Authenticated Encryption |
| Sub-category | Authenticated Encryption |
| Security status | 🧪 Experimental |
| Complexity | Intermediate |
| Inventor | Christoph Dobraunig, Maria Eichlseder, Florian Mendel, Martin Schläffer |
| Year | 2019 |
| Origin | Not specified |
| Source | [`algorithms/aead/sparkle.js`](../../../algorithms/aead/sparkle.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 24 bytes (192 bits) |
| Tag sizes | 24 bytes (192 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `SupportsDetached` | No |

## Security

**Status:** 🧪 Experimental

No vulnerabilities are recorded for this implementation.

## Documentation

- [NIST LWC Sparkle Specification](https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-spec-doc/sparkle-spec-final.pdf)
- [Sparkle Project Website](https://sparkle-lwc.github.io/)

## References

- [Official Sparkle Reference Implementation](https://github.com/cryptolu/sparkle)
- [rweather/lwc-finalists C Reference (embedded-optimized)](https://github.com/rweather/lwc-finalists)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [NIST LWC KAT Count=1 (empty PT, empty AD)](https://csrc.nist.gov/projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f1011121314151617` |
| `nonce` | `000102030405060708090a0b0c0d0e0f1011121314151617` |
| `associatedData` | _(empty)_ |
| `input` | _(empty)_ |
| `expected` | `94fabef076b80fa4cae902dc5630a2b7b8a72282a560212c` |

**Vector 2** — [NIST LWC KAT Count=2 (empty PT, 1-byte AD)](https://csrc.nist.gov/projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f1011121314151617` |
| `nonce` | `000102030405060708090a0b0c0d0e0f1011121314151617` |
| `associatedData` | `00` |
| `input` | _(empty)_ |
| `expected` | `8939014b970696487ea3642e508a3620b9919155197eb622` |

**Vector 3** — [NIST LWC KAT Count=34 (1-byte PT, empty AD)](https://csrc.nist.gov/projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f1011121314151617` |
| `nonce` | `000102030405060708090a0b0c0d0e0f1011121314151617` |
| `associatedData` | _(empty)_ |
| `input` | `00` |
| `expected` | `5b3ff82215aaa826be2456b0741301105fe9fb87a3308c5826` |

**Vector 4** — [NIST LWC KAT Count=826 (25-byte PT, empty AD)](https://csrc.nist.gov/projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f1011121314151617` |
| `nonce` | `000102030405060708090a0b0c0d0e0f1011121314151617` |
| `associatedData` | _(empty)_ |
| `input` | `000102030405060708090a0b0c0d0e0f101112131415161718` |
| `expected` | `5b64b794b118330eae30497a35df53c1 2c4097f75fade23cefb8f522a8cb42f6 49be16d7cf2e756cead63214597893e1 c1` |

---

[← All algorithms](../README.md)
