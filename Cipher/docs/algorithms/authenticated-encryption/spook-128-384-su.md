# Spook-128-384-su

> NIST Lightweight Cryptography candidate providing authenticated encryption with side-channel protection. Uses Shadow-384 permutation with Clyde-128 tweakable block cipher. The single-user variant offers 128-bit key security.

## Properties

| Property | Value |
| --- | --- |
| Category | Authenticated Encryption |
| Sub-category | Authenticated Encryption |
| Variant | su |
| Security status | 🧪 Experimental |
| Complexity | Expert |
| Inventor | Davide Bellizia, Francesco Berti, Olivier Bronchain, Gaetan Cassiers, Sebastien Duval, Chun Guo, Gregor Leander, Gaetan Leurent, Itamar Levi, Charles Momin, Olivier Pereira, Thomas Peters, Francois-Xavier Standaert, Friedrich Wiemer |
| Year | 2019 |
| Origin | 🇧🇪 Belgium |
| Source | [`algorithms/aead/spook.js`](../../../algorithms/aead/spook.js) |

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

- [NIST LWC Project Page](https://csrc.nist.gov/Projects/lightweight-cryptography)
- [Spook Official Website](https://www.spook.dev/)
- [NIST LWC Submission](https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/round-2/spec-doc-rnd2/spook-spec-round2.pdf)

## References

- [Spook Official Reference Implementations](https://www.spook.dev/implementations.html)
- [Spook High-End Software Implementations (uclcrypto/spook-he, GitHub)](https://github.com/uclcrypto/spook-he)
- [NIST LWC Known-Answer-Test vectors (rweather/lightweight-crypto, MIT)](https://github.com/rweather/lightweight-crypto/tree/master/test/kat)

## Test vectors

6 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [NIST LWC round-2 KAT Spook-128-384-su Count = 1 (PT 0 bytes, AD 0 bytes)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/Spook-128-384-su.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | _(empty)_ |
| `input` | _(empty)_ |
| `expected` | `fc48e447519b6b75d2bcbf63040f5a18` |

**Vector 2** — [NIST LWC round-2 KAT Spook-128-384-su Count = 2 (PT 0 bytes, AD 1 bytes)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/Spook-128-384-su.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | `00` |
| `input` | _(empty)_ |
| `expected` | `00b0214e9f2a7fbe2ce22ebe42337867` |

**Vector 3** — [NIST LWC round-2 KAT Spook-128-384-su Count = 34 (PT 1 bytes, AD 0 bytes)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/Spook-128-384-su.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | _(empty)_ |
| `input` | `00` |
| `expected` | `c844f77b117566b8c9dbea56d38beaa1b1` |

**Vector 4** — [NIST LWC round-2 KAT Spook-128-384-su Count = 50 (PT 1 bytes, AD 16 bytes)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/Spook-128-384-su.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `00` |
| `expected` | `2e5ef88b13b0113f9b655ea5d4d61217ba` |

**Vector 5** — [NIST LWC round-2 KAT Spook-128-384-su Count = 562 (PT 17 bytes, AD 0 bytes)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/Spook-128-384-su.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | _(empty)_ |
| `input` | `000102030405060708090a0b0c0d0e0f10` |
| `expected` | `c83e1bfc0d2dc1ccaeeb2040c4148b52 164779a962ffee8b06c3e9601e9c24c4 aa` |

**Vector 6** — [NIST LWC round-2 KAT Spook-128-384-su Count = 1089 (PT 32 bytes, AD 32 bytes)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/Spook-128-384-su.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `input` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `expected` | `2e0db88e6d535a8b74665a5adb9f5eee 3135da199d8d519842297ee2a6798668 252b19c5f323ece12a80541eadc1809e` |

---

[← All algorithms](../README.md)
