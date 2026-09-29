# Romulus-N1

> NIST Lightweight Cryptography finalist using SKINNY-128-384 tweakable block cipher. Primary recommendation of Romulus family with 128-bit nonce and tag.

## Properties

| Property | Value |
| --- | --- |
| Category | Authenticated Encryption |
| Sub-category | Authenticated Encryption |
| Security status | 🛡️ Secure |
| Complexity | Advanced |
| Inventor | Tetsu Iwata, Mustafa Khairallah, Kazuhiko Minematsu, Thomas Peyrin |
| Year | 2019 |
| Origin | 🇯🇵 Japan |
| Source | [`algorithms/aead/romulus.js`](../../../algorithms/aead/romulus.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Tag sizes | 16 bytes (128 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `SupportsDetached` | No |

## Security

**Status:** 🛡️ Secure

No vulnerabilities are recorded for this implementation.

## Documentation

- [Romulus Official Site](https://romulusae.github.io/romulus/)
- [NIST LWC Finalist](https://csrc.nist.gov/Projects/lightweight-cryptography)
- [Romulus Specification](https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-spec-doc/romulus-spec-final.pdf)

## References

- [Romulus Reference Implementation (romulusae/romulus, GitHub)](https://github.com/romulusae/romulus)
- [NIST LWC Finalist Submissions Archive](https://csrc.nist.gov/Projects/lightweight-cryptography/finalists)

## Test vectors

1 vector ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Romulus-N1 NIST KAT Count=1 (empty message, empty AD)](https://csrc.nist.gov/Projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `associatedData` | _(empty)_ |
| `input` | _(empty)_ |
| `expected` | `5d8db25aacb3dab45fbc2f8d77849f90` |

---

[← All algorithms](../README.md)
