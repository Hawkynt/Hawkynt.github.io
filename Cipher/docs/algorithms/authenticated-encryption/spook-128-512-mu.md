# Spook-128-512-mu

> NIST Lightweight Cryptography candidate providing authenticated encryption with side-channel protection. Uses Shadow-512 permutation with Clyde-128 tweakable block cipher. The multi-user variant offers 256-bit key security.

## Properties

| Property | Value |
| --- | --- |
| Category | Authenticated Encryption |
| Sub-category | Authenticated Encryption |
| Variant | mu |
| Security status | 🧪 Experimental |
| Complexity | Expert |
| Inventor | Davide Bellizia, Francesco Berti, Olivier Bronchain, Gaetan Cassiers, Sebastien Duval, Chun Guo, Gregor Leander, Gaetan Leurent, Itamar Levi, Charles Momin, Olivier Pereira, Thomas Peters, Francois-Xavier Standaert, Friedrich Wiemer |
| Year | 2019 |
| Origin | 🇧🇪 Belgium |
| Source | [`algorithms/aead/spook.js`](../../../algorithms/aead/spook.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 32 bytes (256 bits) |
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

**Vector 1** — [NIST LWC round-2 KAT Spook-128-512-mu Count = 1 (PT 0 bytes, AD 0 bytes)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/Spook-128-512-mu.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | _(empty)_ |
| `input` | _(empty)_ |
| `expected` | `2ef04011dd3048e837440a3022718522` |

**Vector 2** — [NIST LWC round-2 KAT Spook-128-512-mu Count = 2 (PT 0 bytes, AD 1 bytes)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/Spook-128-512-mu.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | `00` |
| `input` | _(empty)_ |
| `expected` | `080e0ceb34e942238be8c87e91e6f8a5` |

**Vector 3** — [NIST LWC round-2 KAT Spook-128-512-mu Count = 34 (PT 1 bytes, AD 0 bytes)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/Spook-128-512-mu.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | _(empty)_ |
| `input` | `00` |
| `expected` | `59652011cf0bfad1d4544fd4b40d820ce8` |

**Vector 4** — [NIST LWC round-2 KAT Spook-128-512-mu Count = 50 (PT 1 bytes, AD 16 bytes)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/Spook-128-512-mu.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `00` |
| `expected` | `38146d8d332522f5e08b482cad26a0704a` |

**Vector 5** — [NIST LWC round-2 KAT Spook-128-512-mu Count = 562 (PT 17 bytes, AD 0 bytes)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/Spook-128-512-mu.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | _(empty)_ |
| `input` | `000102030405060708090a0b0c0d0e0f10` |
| `expected` | `591f6b9032ef281ae0e7ddd30092b828 d28b2dfb7dbe155ce23f27b05a013d7b fc` |

**Vector 6** — [NIST LWC round-2 KAT Spook-128-512-mu Count = 1089 (PT 32 bytes, AD 32 bytes)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/Spook-128-512-mu.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `input` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `expected` | `3401c24a5dc2699436c15a6a99ef3a76 e4309f86ac7dd43295bbaa038fa6fd8e 9a17a05d14dea6e28198885d40451583` |

---

[← All algorithms](../README.md)
