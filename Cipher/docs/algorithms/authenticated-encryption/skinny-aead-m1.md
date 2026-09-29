# SKINNY-AEAD-M1

> Primary SKINNY-AEAD variant using SKINNY-128-384 with 128-bit key, 128-bit nonce, and 128-bit tag. NIST LWC Round 2 candidate.

## Properties

| Property | Value |
| --- | --- |
| Category | Authenticated Encryption |
| Sub-category | Authenticated Encryption |
| Variant | 1 |
| Security status | 🧪 Experimental |
| Complexity | Advanced |
| Inventor | Beierle, Jean, Kölbl, Leander, Moradi, Peyrin, Sasaki, Sasdrich, Sim |
| Year | 2019 |
| Origin | 🌐 International |
| Source | [`algorithms/aead/skinny-aead.js`](../../../algorithms/aead/skinny-aead.js) |

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

- [SKINNY-AEAD Specification](https://sites.google.com/site/skinnycipher/home)
- [NIST LWC Submission](https://csrc.nist.gov/projects/lightweight-cryptography)
- [Reference Implementation](https://github.com/rweather/lightweight-crypto)

## References

- [SKINNY Paper (CRYPTO 2016)](https://eprint.iacr.org/2016/660)
- [SKINNY Official Website](https://sites.google.com/site/skinnycipher/)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [SKINNY-AEAD-M1 Official Test Vector #1 (empty PT, empty AD)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/SKINNY-AEAD-M1.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | _(empty)_ |
| `input` | _(empty)_ |
| `expected` | `99ce68ef7b52aad0e11c6e2fc722426d` |

**Vector 2** — [SKINNY-AEAD-M1 Official Test Vector #2 (empty PT, 1 byte AD)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/SKINNY-AEAD-M1.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | `00` |
| `input` | _(empty)_ |
| `expected` | `4720e8ea3682d9e9dc5c83563705f8f4` |

**Vector 3** — [SKINNY-AEAD-M1 Official Test Vector #37 (1 byte PT, 3 bytes AD)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/SKINNY-AEAD-M1.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | `000102` |
| `input` | `00` |
| `expected` | `859db826629c124578aba5a459e97a312f` |

---

[← All algorithms](../README.md)
