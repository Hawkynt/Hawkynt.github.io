# Ascon-80pq AEAD

> Ascon variant with 160-bit key providing extra security margin against quantum attacks. Maintains same performance as Ascon-128.

## Properties

| Property | Value |
| --- | --- |
| Category | Authenticated Encryption |
| Sub-category | Lightweight Cryptography |
| Variant | ascon80pq |
| Security status | 🛡️ Secure |
| Complexity | Intermediate |
| Inventor | Christoph Dobraunig, Maria Eichlseder, Florian Mendel, Martin Schläffer |
| Year | 2023 |
| Origin | Not specified |
| Source | [`algorithms/aead/ascon.js`](../../../algorithms/aead/ascon.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 20 bytes (160 bits) |
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

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Ascon-80pq: Empty message, empty AAD (Count 1)](https://github.com/ascon/ascon-c/blob/v1.2.8/crypto_aead/ascon80pqv12/LWC_AEAD_KAT_160_128.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f10111213` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | _(empty)_ |
| `input` | _(empty)_ |
| `expected` | `abb688efa0b9d56b33277a2c97d2146b` |

**Vector 2** — [Ascon-80pq: 8-byte plaintext (Count 265)](https://github.com/ascon/ascon-c/blob/v1.2.8/crypto_aead/ascon80pqv12/LWC_AEAD_KAT_160_128.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f10111213` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | _(empty)_ |
| `input` | `0001020304050607` |
| `expected` | `2846418067ce93861a484e22565f161146fb6f47913803f9` |

**Vector 3** — [Ascon-80pq: 16-byte plaintext with 8-byte AAD (Count 537)](https://github.com/ascon/ascon-c/blob/v1.2.8/crypto_aead/ascon80pqv12/LWC_AEAD_KAT_160_128.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f10111213` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | `0001020304050607` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `e16c12dd1db74fa773415872b01cb834dbe18b2d5c6c9e77df52e8cabb7a3283` |

---

[← All algorithms](../README.md)
