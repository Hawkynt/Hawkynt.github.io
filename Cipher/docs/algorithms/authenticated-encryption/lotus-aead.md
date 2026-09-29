# LOTUS-AEAD

> Lightweight OCB-like authenticated encryption using TweGIFT-64 block cipher. NIST Lightweight Cryptography Competition candidate with 128-bit keys and 64-bit tags.

## Properties

| Property | Value |
| --- | --- |
| Category | Authenticated Encryption |
| Sub-category | Lightweight Cryptography |
| Security status | 🧪 Experimental |
| Complexity | Advanced |
| Inventor | Avik Chakraborti, Nilanjan Datta, Ashwin Jha, Cuauhtemoc Mancillas López, Mridul Nandi, Yu Sasaki |
| Year | 2019 |
| Origin | 🌐 International |
| Source | [`algorithms/aead/lotus-aead.js`](../../../algorithms/aead/lotus-aead.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) |
| Tag sizes | 8 bytes (64 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `SupportsDetached` | No |

## Security

**Status:** 🧪 Experimental

No vulnerabilities are recorded for this implementation.

## Documentation

- [NIST LWC Submission](https://csrc.nist.gov/projects/lightweight-cryptography)
- [LOTUS-AEAD Specification](https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-spec-doc/lotus-aead-spec-final.pdf)
- [C Reference Implementation](https://github.com/rweather/lightweight-crypto)

## References

- [LOTUS-AEAD and LOCUS-AEAD NIST LWC Round 1 Submission Package (Reference C Code)](https://csrc.nist.gov/CSRC/media/Projects/Lightweight-Cryptography/documents/round-1/submissions/lotus-locus.zip)
- [LOTUS/LOCUS Official Project Page (ISI Kolkata)](https://www.isical.ac.in/~lightweight/lotus/)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [LOTUS-AEAD self-generated regression vector: empty message, empty AAD](https://csrc.nist.gov/projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | _(empty)_ |
| `input` | _(empty)_ |
| `expected` | `37f3ebb83ff38de8` |

**Vector 2** — [LOTUS-AEAD self-generated regression vector: empty message, 1-byte AAD](https://csrc.nist.gov/projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | `00` |
| `input` | _(empty)_ |
| `expected` | `0020cf359fa6ec6e` |

**Vector 3** — [LOTUS-AEAD self-generated regression vector: empty message, 2-byte AAD](https://csrc.nist.gov/projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | `0001` |
| `input` | _(empty)_ |
| `expected` | `9531e45beefee95f` |

---

[← All algorithms](../README.md)
