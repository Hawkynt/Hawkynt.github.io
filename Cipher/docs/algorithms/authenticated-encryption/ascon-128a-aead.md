# Ascon-128a AEAD

> Faster variant of Ascon-128 with 16-byte rate. Provides same security level as Ascon-128 with improved throughput for larger messages.

## Properties

| Property | Value |
| --- | --- |
| Category | Authenticated Encryption |
| Sub-category | Lightweight Cryptography |
| Variant | ascon128a |
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

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Ascon-128a: Empty message, empty AAD (Count 1)](https://github.com/ascon/ascon-c/blob/v1.2.8/crypto_aead/ascon128av12/LWC_AEAD_KAT_128_128.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | _(empty)_ |
| `input` | _(empty)_ |
| `expected` | `7a834e6f09210957067b10fd831f0078` |

**Vector 2** — [Ascon-128a: 16-byte plaintext (Count 529)](https://github.com/ascon/ascon-c/blob/v1.2.8/crypto_aead/ascon128av12/LWC_AEAD_KAT_128_128.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | _(empty)_ |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `6e490cfed5b3546767350cd83c4acfbdb10f611b7d79278bd8067fc1bcdf39be` |

**Vector 3** — [Ascon-128a: 16-byte plaintext with 8-byte AAD (Count 537)](https://github.com/ascon/ascon-c/blob/v1.2.8/crypto_aead/ascon128av12/LWC_AEAD_KAT_128_128.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | `0001020304050607` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `34d3b7edb89b1d5067c4ec9eb8052962522e547863ac130d032a06927d4261db` |

---

[← All algorithms](../README.md)
