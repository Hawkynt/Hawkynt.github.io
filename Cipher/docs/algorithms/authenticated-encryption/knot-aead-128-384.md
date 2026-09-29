# KNOT-AEAD-128-384

> NIST Lightweight Cryptography finalist using 384-bit sponge construction with bit-sliced KNOT permutation. Offers higher throughput than KNOT-128-256 with a 192-bit rate, ideal for constrained environments requiring performance.

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
| `expected` | `df323ce70693fab9266458adf3ed3d3f` |

**Vector 2** — [NIST LWC KAT Vector #2: Empty PT with 1-byte AD](https://csrc.nist.gov/Projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `associatedData` | `00` |
| `input` | _(empty)_ |
| `expected` | `6a1315d028a57be50a1e0106297175f9` |

**Vector 3** — [NIST LWC KAT Vector #5: Empty PT with 4-byte AD](https://csrc.nist.gov/Projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `associatedData` | `00010203` |
| `input` | _(empty)_ |
| `expected` | `a250d62293cc5e144170038925dcc670` |

**Vector 4** — [NIST LWC KAT Vector #9: Empty PT with 8-byte AD](https://csrc.nist.gov/Projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `associatedData` | `0001020304050607` |
| `input` | _(empty)_ |
| `expected` | `7960e636225be5906093c052c4d9d2b9` |

**Vector 5** — [NIST LWC KAT Vector #25: Empty PT with 24-byte AD (rate boundary)](https://csrc.nist.gov/Projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `associatedData` | `000102030405060708090a0b0c0d0e0f1011121314151617` |
| `input` | _(empty)_ |
| `expected` | `b072e203798396f521abea46fe5d05eb` |

**Vector 6** — [NIST LWC KAT Vector #34: 1-byte PT with empty AD](https://csrc.nist.gov/Projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `associatedData` | _(empty)_ |
| `input` | `00` |
| `expected` | `844b6da7e3aa4b388f62f2896dc5ef157a` |

**Vector 7** — [NIST LWC KAT Vector #44: 1-byte PT with 10-byte AD](https://csrc.nist.gov/Projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `associatedData` | `00010203040506070809` |
| `input` | `00` |
| `expected` | `203d9c10a8e20eb23c99f37eb3d55629b2` |

**Vector 8** — [NIST LWC KAT Vector #340: 10-byte PT with 9-byte AD](https://csrc.nist.gov/Projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `associatedData` | `000102030405060708` |
| `input` | `00010203040506070809` |
| `expected` | `0b27c0c725d709ff8c6cfbedefdabe971544fbe89ac67a074561` |

---

[← All algorithms](../README.md)
