# ESTATE-TWEGIFT-128

> Nonce-misuse resistant authenticated encryption based on tweakable GIFT-128. Uses FCBC authentication and OFB encryption to provide security even when nonces are reused with different plaintexts.

## Properties

| Property | Value |
| --- | --- |
| Category | Authenticated Encryption |
| Sub-category | Authenticated Encryption |
| Security status | 🧪 Experimental |
| Complexity | Intermediate |
| Inventor | Ashwin Jha, Eik List, Mridul Nandi |
| Year | 2020 |
| Origin | 🇮🇳 India |
| Source | [`algorithms/aead/estate-twegift.js`](../../../algorithms/aead/estate-twegift.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) |
| Nonce sizes | 16 bytes (128 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `SupportsDetached` | No |

## Security

**Status:** 🧪 Experimental

No vulnerabilities are recorded for this implementation.

## Documentation

- [NIST LWC Candidate](https://csrc.nist.gov/Projects/lightweight-cryptography)
- [ESTATE Specification](https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/round-2/spec-doc-rnd2/ESTATE-spec-round2.pdf)
- [Reference Implementation](https://github.com/rweather/lightweight-crypto)

## References

- [NIST LWC Round 2 Submission Package (Reference C)](https://csrc.nist.gov/projects/lightweight-cryptography/round-2-candidates)

## Test vectors

7 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [NIST KAT Count 1 - Empty PT and AD](https://csrc.nist.gov/Projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | _(empty)_ |
| `input` | _(empty)_ |
| `expected` | `aab13ec6c00ea011af831a0098a79883` |

**Vector 2** — [NIST KAT Count 2 - Empty PT, 1 byte AD](https://csrc.nist.gov/Projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | `00` |
| `input` | _(empty)_ |
| `expected` | `b2dfe0a387561795dfb34a6fb60b74fd` |

**Vector 3** — [NIST KAT Count 3 - Empty PT, 2 bytes AD](https://csrc.nist.gov/Projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | `0001` |
| `input` | _(empty)_ |
| `expected` | `a3418c9a93a22348816f3c907864b5ad` |

**Vector 4** — [NIST KAT Count 17 - Empty PT, 16 bytes AD](https://csrc.nist.gov/Projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | `000102030405060708090a0b0c0d0e0f` |
| `input` | _(empty)_ |
| `expected` | `098196b91ba5cddfe1b66d2e403737e5` |

**Vector 5** — [NIST KAT Count 34 - 1 byte PT, empty AD](https://csrc.nist.gov/Projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | _(empty)_ |
| `input` | `00` |
| `expected` | `61c85435e5e798be247258bde9e901e281` |

**Vector 6** — [NIST KAT Count 35 - 1 byte PT, 1 byte AD](https://csrc.nist.gov/Projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | `00` |
| `input` | `00` |
| `expected` | `273b88f53f687b4e57e66068dc8f2810a8` |

**Vector 7** — [NIST KAT Count 50 - 1 byte PT, 16 bytes AD](https://csrc.nist.gov/Projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `00` |
| `expected` | `3fb5da8025af0db8abed6100d573b0c70a` |

---

[← All algorithms](../README.md)
