# PAEF-ForkSkinny-128-192

> Parallel authenticated encryption with forking based on ForkSkinny-128-256 tweakable block cipher. NIST Lightweight Cryptography Competition candidate optimized for small packet sizes with parallel processing capability.

## Properties

| Property | Value |
| --- | --- |
| Category | Authenticated Encryption |
| Sub-category | Authenticated Encryption |
| Security status | 🧪 Experimental |
| Complexity | Advanced |
| Inventor | Christoph Dobraunig, Maria Eichlseder, Florian Mendel, Martin Schläffer |
| Year | 2019 |
| Origin | Not specified |
| Source | [`algorithms/aead/paef-forkskinny.js`](../../../algorithms/aead/paef-forkskinny.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) |
| Nonce sizes | 6 bytes (48 bits) |

## Security

**Status:** 🧪 Experimental

No vulnerabilities are recorded for this implementation.

## Documentation

- [ForkAE Official Website](https://www.esat.kuleuven.be/cosic/forkae/)
- [ForkAE NIST LWC Round 2 Submission Specification](https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/round-2/spec-doc-rnd2/forkae-spec-round2.pdf)
- [NIST Lightweight Cryptography Project](https://csrc.nist.gov/projects/lightweight-cryptography)
- [Forkcipher: A New Primitive for Authenticated Encryption of Very Short Messages](https://eprint.iacr.org/2019/1004)

## References

- [Reference C Implementation (rweather/lightweight-crypto)](https://github.com/rweather/lightweight-crypto)

## Test vectors

8 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty PT, Empty AD](https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/round-2/spec-doc-rnd2/forkae-spec-round2.pdf)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405` |
| `associatedData` | _(empty)_ |
| `input` | _(empty)_ |
| `expected` | `de2381c2d19a843cff8c3baab8ae9a4c` |

**Vector 2** — [Empty PT, 1-byte AD](https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/round-2/spec-doc-rnd2/forkae-spec-round2.pdf)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405` |
| `associatedData` | `00` |
| `input` | _(empty)_ |
| `expected` | `aabc9caf30a81191e44e26032d1b073f` |

**Vector 3** — [Empty PT, 2-byte AD](https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/round-2/spec-doc-rnd2/forkae-spec-round2.pdf)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405` |
| `associatedData` | `0001` |
| `input` | _(empty)_ |
| `expected` | `56e1c0fb050c740b9d1fc539cf38512f` |

**Vector 4** — [Empty PT, 16-byte AD](https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/round-2/spec-doc-rnd2/forkae-spec-round2.pdf)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405` |
| `associatedData` | `000102030405060708090a0b0c0d0e0f` |
| `input` | _(empty)_ |
| `expected` | `687a101bbbf86f3a98080afcfa7fd965` |

**Vector 5** — [1-byte PT, Empty AD](https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/round-2/spec-doc-rnd2/forkae-spec-round2.pdf)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405` |
| `associatedData` | _(empty)_ |
| `input` | `00` |
| `expected` | `312e5e7dde73a0048dd7de0c66be4033a2` |

**Vector 6** — [1-byte PT, 1-byte AD](https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/round-2/spec-doc-rnd2/forkae-spec-round2.pdf)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405` |
| `associatedData` | `00` |
| `input` | `00` |
| `expected` | `9b92c2d2eedbb1956999f80f4ba5470ca2` |

**Vector 7** — [16-byte PT, Empty AD](https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/round-2/spec-doc-rnd2/forkae-spec-round2.pdf)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405` |
| `associatedData` | _(empty)_ |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `d10cc6cda5214ad435f9b231b0bdd1d182e2d5a15505e038afc39eefbea7d84f` |

**Vector 8** — [16-byte PT, 16-byte AD](https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/round-2/spec-doc-rnd2/forkae-spec-round2.pdf)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405` |
| `associatedData` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `b976d6d61ed925eeadf1b8cd4ac208b482e2d5a15505e038afc39eefbea7d84f` |

---

[← All algorithms](../README.md)
