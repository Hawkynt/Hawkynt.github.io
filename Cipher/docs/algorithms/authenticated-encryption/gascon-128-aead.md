# GASCON-128 AEAD

> Bit-interleaved variant of Ascon optimized for 32-bit platforms. Provides authenticated encryption with 128-bit security level using sponge construction with efficient bit-interleaved permutation.

## Properties

| Property | Value |
| --- | --- |
| Category | Authenticated Encryption |
| Sub-category | Lightweight Cryptography |
| Security status | 🧪 Experimental |
| Complexity | Advanced |
| Inventor | Christoph Dobraunig, Maria Eichlseder, Florian Mendel, Martin Schläffer |
| Year | 2019 |
| Origin | 🌐 International |
| Source | [`algorithms/aead/gascon.js`](../../../algorithms/aead/gascon.js) |

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

- [NIST LWC Project](https://csrc.nist.gov/projects/lightweight-cryptography)
- [GASCON Specification](https://ascon.iaik.tugraz.at/)
- [Reference Implementation](https://github.com/rweather/lightweight-crypto)

## References

- [DryGASCON Reference Implementation (defines GASCON permutation)](https://github.com/sebastien-riou/DryGASCON)
- [NIST LWC Round 2 Submission Package](https://csrc.nist.gov/projects/lightweight-cryptography/round-2-candidates)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [GASCON-128: Empty message, empty AAD (Count 1)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/GASCON-128.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | _(empty)_ |
| `input` | _(empty)_ |
| `expected` | `16f28158685b2a85f573c62e16d61f09` |

**Vector 2** — [GASCON-128: Empty message with 8-byte AAD (Count 9)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/GASCON-128.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | `0001020304050607` |
| `input` | _(empty)_ |
| `expected` | `15d0b60d1c4c3155966cbcf508eedcd9` |

**Vector 3** — [GASCON-128: 1-byte plaintext, empty AAD (Count 34)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/GASCON-128.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | _(empty)_ |
| `input` | `00` |
| `expected` | `1269eaf2046be0bd81fef44491d24a035c` |

**Vector 4** — [GASCON-128: 1-byte plaintext with 1-byte AAD (Count 35)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/GASCON-128.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | `00` |
| `input` | `00` |
| `expected` | `32c53850fac4f45ec3303c6618151ea75b` |

---

[← All algorithms](../README.md)
