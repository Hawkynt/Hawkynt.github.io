# SUNDAE-GIFT-128

> Deterministic authenticated encryption using GIFT-128 block cipher with SUNDAE mode. Supports 128-bit nonce for authenticated encryption with associated data in lightweight applications.

## Properties

| Property | Value |
| --- | --- |
| Category | Authenticated Encryption |
| Sub-category | Authenticated Encryption |
| Security status | 🧪 Experimental |
| Complexity | Advanced |
| Inventor | Subhadeep Banik, Zhenzhen Bao, Avik Chakraborti, et al. |
| Year | 2019 |
| Origin | 🌐 International |
| Source | [`algorithms/aead/sundae-gift.js`](../../../algorithms/aead/sundae-gift.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) |
| Nonce sizes | 16 bytes (128 bits) |
| Tag sizes | 16 bytes (128 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `SupportsDetached` | No |

## Security

**Status:** 🧪 Experimental

No vulnerabilities are recorded for this implementation.

## Documentation

- [SUNDAE Specification](https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/round-2/spec-doc-rnd2/sundae-gift-spec-round2.pdf)
- [NIST LWC Round 2 Candidate](https://csrc.nist.gov/Projects/lightweight-cryptography/round-2-candidates)
- [GIFT-128 Specification](https://eprint.iacr.org/2017/622.pdf)

## References

- [SUNDAE-GIFT Submission](https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/round-2/spec-doc-rnd2/sundae-gift-spec-round2.pdf)
- [Reference Implementation](https://github.com/rweather/lightweight-crypto)

## Test vectors

8 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [SUNDAE-GIFT-128 KAT Vector #1 (Empty plaintext, empty AD)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/SUNDAE-GIFT-128.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | _(empty)_ |
| `input` | _(empty)_ |
| `expected` | `f3467a06083b64358eb51659fc8d6d5d` |

**Vector 2** — [SUNDAE-GIFT-128 KAT Vector #2 (Empty plaintext, 1-byte AD)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/SUNDAE-GIFT-128.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | `00` |
| `input` | _(empty)_ |
| `expected` | `c8fd86b45b125a5ebe0b1e8d60dc44c2` |

**Vector 3** — [SUNDAE-GIFT-128 KAT Vector #5 (Empty plaintext, 4-byte AD)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/SUNDAE-GIFT-128.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | `00010203` |
| `input` | _(empty)_ |
| `expected` | `1893183ddd2e9178c0fc28d0a8945812` |

**Vector 4** — [SUNDAE-GIFT-128 KAT Vector #34 (1-byte plaintext, empty AD)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/SUNDAE-GIFT-128.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | _(empty)_ |
| `input` | `00` |
| `expected` | `7a6c405c76704442d565ff3b1434665b0b` |

**Vector 5** — [SUNDAE-GIFT-128 KAT Vector #35 (1-byte plaintext, 1-byte AD)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/SUNDAE-GIFT-128.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | `00` |
| `input` | `00` |
| `expected` | `23bdc419387c27eb8b17ff0eda9843338a` |

**Vector 6** — [SUNDAE-GIFT-128 KAT Vector #69 (2-byte non-zero plaintext, 2-byte AD)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/SUNDAE-GIFT-128.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | `0001` |
| `input` | `0001` |
| `expected` | `8ece7a3ca88465e7c674ab4fd6bb15f3dbe7` |

**Vector 7** — [SUNDAE-GIFT-128 KAT Vector #562 (17-byte plaintext spanning two blocks, empty AD)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/SUNDAE-GIFT-128.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | _(empty)_ |
| `input` | `000102030405060708090a0b0c0d0e0f10` |
| `expected` | `85e5e8b5c25ef2494426dccfa0243439 a2abec21438eb81e9880357b28552605 9f` |

**Vector 8** — [SUNDAE-GIFT-128 KAT Vector #1089 (32-byte plaintext, 32-byte AD)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/SUNDAE-GIFT-128.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `input` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `expected` | `e4c75961ea0a1f4e1509da3aa6268f30 624bbd8083acf3ff0cacd4e5111a542b 6a04b6e51effdf4c554c66e58c879cf8` |

---

[← All algorithms](../README.md)
