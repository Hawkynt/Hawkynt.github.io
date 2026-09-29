# Ascon-128 AEAD

> NIST's lightweight cryptography standard for authenticated encryption. Uses 128-bit keys with 8-byte rate for balanced security and performance.

## Properties

| Property | Value |
| --- | --- |
| Category | Authenticated Encryption |
| Sub-category | Lightweight Cryptography |
| Variant | ascon128 |
| Security status | 🛡️ Secure |
| Complexity | Intermediate |
| Inventor | Christoph Dobraunig, Maria Eichlseder, Florian Mendel, Martin Schläffer |
| Year | 2023 |
| Origin | Not specified |
| Source | [`algorithms/aead/ascon.js`](../../../algorithms/aead/ascon.js) |

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

**Status:** 🛡️ Secure

No vulnerabilities are recorded for this implementation.

## Documentation

- [NIST SP 800-232](https://csrc.nist.gov/pubs/sp/800/232/final)
- [Ascon Specification](https://ascon.iaik.tugraz.at/)
- [NIST LWC Winner Announcement](https://www.nist.gov/news-events/news/2023/02/nist-standardizes-ascon-cryptography-protecting-iot-devices)

## References

- [Ascon Reference C Implementation](https://github.com/ascon/ascon-c)
- [pyascon (Python Reference Implementation)](https://github.com/meichlseder/pyascon)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Ascon-128: Empty message, empty AAD (Count 1)](https://github.com/ascon/ascon-c/blob/v1.2.8/crypto_aead/ascon128v12/LWC_AEAD_KAT_128_128.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | _(empty)_ |
| `input` | _(empty)_ |
| `expected` | `e355159f292911f794cb1432a0103a8a` |

**Vector 2** — [Ascon-128: Single byte plaintext (Count 34)](https://github.com/ascon/ascon-c/blob/v1.2.8/crypto_aead/ascon128v12/LWC_AEAD_KAT_128_128.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | _(empty)_ |
| `input` | `00` |
| `expected` | `bc18c3f4e39eca7222490d967c79bffc92` |

**Vector 3** — [Ascon-128: 8-byte plaintext (Count 265)](https://github.com/ascon/ascon-c/blob/v1.2.8/crypto_aead/ascon128v12/LWC_AEAD_KAT_128_128.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | _(empty)_ |
| `input` | `0001020304050607` |
| `expected` | `bc820dbdf7a4631c01a8807a44254b42ac6bb490da1e000a` |

**Vector 4** — [Ascon-128: 16-byte plaintext with 8-byte AAD (Count 537)](https://github.com/ascon/ascon-c/blob/v1.2.8/crypto_aead/ascon128v12/LWC_AEAD_KAT_128_128.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | `0001020304050607` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `69ffee6f5505a4897e2ec80cbdff67ce31614dac97643c45940a8f9e7964613a` |

---

[← All algorithms](../README.md)
