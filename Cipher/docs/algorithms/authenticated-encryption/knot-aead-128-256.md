# KNOT-AEAD-128-256

> NIST Lightweight Cryptography finalist using 256-bit sponge construction with bit-sliced KNOT permutation. Features hardware-efficient S-box design and simple linear diffusion for resource-constrained environments.

## Properties

| Property | Value |
| --- | --- |
| Category | Authenticated Encryption |
| Sub-category | Authenticated Encryption |
| Security status | 🧪 Experimental |
| Complexity | Advanced |
| Inventor | Designers from Nanyang Technological University |
| Year | 2019 |
| Origin | Not specified |
| Source | [`algorithms/aead/knot-aead.js`](../../../algorithms/aead/knot-aead.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) |
| Tag sizes | 16 bytes (128 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `SupportsDetached` | No |

## Security

**Status:** 🧪 Experimental

No vulnerabilities are recorded for this implementation.

## Documentation

- [NIST LWC Project](https://csrc.nist.gov/Projects/lightweight-cryptography)
- [KNOT Specification](https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-spec-doc/knot-spec-final.pdf)
- [Reference Implementation](https://github.com/rweather/lightweight-crypto)

## References

- [KNOT NIST LWC Round 2 Submission Package (Reference C Code)](https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/round-2/submissions-rnd2/knot.zip)
- [NIST LWC Round 2 Candidates](https://csrc.nist.gov/projects/lightweight-cryptography/round-2-candidates)

## Test vectors

8 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [NIST LWC KAT Vector #1: Empty PT/AD](https://csrc.nist.gov/Projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `associatedData` | _(empty)_ |
| `input` | _(empty)_ |
| `expected` | `460779ba8e7ae47c69230e79d8684881` |

**Vector 2** — [NIST LWC KAT Vector #2: Empty PT with 1-byte AD](https://csrc.nist.gov/Projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `associatedData` | `00` |
| `input` | _(empty)_ |
| `expected` | `f140dd9677e88d6594b7eb3b02fa2981` |

**Vector 3** — [NIST LWC KAT Vector #5: Empty PT with 4-byte AD](https://csrc.nist.gov/Projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `associatedData` | `00010203` |
| `input` | _(empty)_ |
| `expected` | `527311869ad8fa60712c1d455a6f377c` |

**Vector 4** — [NIST LWC KAT Vector #9: Empty PT with 8-byte AD (rate boundary)](https://csrc.nist.gov/Projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `associatedData` | `0001020304050607` |
| `input` | _(empty)_ |
| `expected` | `373a4fd111779ea4eaccb63378f22948` |

**Vector 5** — [NIST LWC KAT Vector #17: Empty PT with 16-byte AD](https://csrc.nist.gov/Projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `associatedData` | `000102030405060708090a0b0c0d0e0f` |
| `input` | _(empty)_ |
| `expected` | `19f3524ed58284638acdf3da761dd3d5` |

**Vector 6** — [NIST LWC KAT Vector #34: 1-byte PT with empty AD](https://csrc.nist.gov/Projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `associatedData` | _(empty)_ |
| `input` | `00` |
| `expected` | `e93b487dde39fdffe7fb011c639b307a5d` |

**Vector 7** — [NIST LWC KAT Vector #340: 10-byte PT with 9-byte AD](https://csrc.nist.gov/Projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `associatedData` | `000102030405060708` |
| `input` | `00010203040506070809` |
| `expected` | `34f50c813fb6679e88679b8581958da336ea1087c243541aa8da` |

**Vector 8** — [NIST LWC KAT Vector #347: 10-byte PT with 16-byte AD](https://csrc.nist.gov/Projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `associatedData` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `00010203040506070809` |
| `expected` | `b37a7263e721ace03dac24447f66bed7c87d5c964f19e2f3f5e7` |

---

[← All algorithms](../README.md)
