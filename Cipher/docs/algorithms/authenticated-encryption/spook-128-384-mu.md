# Spook-128-384-mu

> NIST Lightweight Cryptography candidate providing authenticated encryption with side-channel protection. Uses Shadow-384 permutation with Clyde-128 tweakable block cipher. The multi-user variant offers 256-bit key security.

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

**Vector 1** — [NIST LWC round-2 KAT Spook-128-384-mu Count = 1 (PT 0 bytes, AD 0 bytes)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/Spook-128-384-mu.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | _(empty)_ |
| `input` | _(empty)_ |
| `expected` | `f415781fc0dd665660200da92da17d2a` |

**Vector 2** — [NIST LWC round-2 KAT Spook-128-384-mu Count = 2 (PT 0 bytes, AD 1 bytes)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/Spook-128-384-mu.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | `00` |
| `input` | _(empty)_ |
| `expected` | `f7c7b3fc3752534a734908386d3c29df` |

**Vector 3** — [NIST LWC round-2 KAT Spook-128-384-mu Count = 34 (PT 1 bytes, AD 0 bytes)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/Spook-128-384-mu.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | _(empty)_ |
| `input` | `00` |
| `expected` | `26bda1f2538e0859c6b17555d63f61e8c1` |

**Vector 4** — [NIST LWC round-2 KAT Spook-128-384-mu Count = 50 (PT 1 bytes, AD 16 bytes)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/Spook-128-384-mu.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `00` |
| `expected` | `8c1c498da9ec7cfd168ef5950843473d34` |

**Vector 5** — [NIST LWC round-2 KAT Spook-128-384-mu Count = 562 (PT 17 bytes, AD 0 bytes)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/Spook-128-384-mu.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | _(empty)_ |
| `input` | `000102030405060708090a0b0c0d0e0f10` |
| `expected` | `26f5383f4a9db286c0cedd286db1a268 4e21becc46092bc5ff4b25a6526981f5 2e` |

**Vector 6** — [NIST LWC round-2 KAT Spook-128-384-mu Count = 1089 (PT 32 bytes, AD 32 bytes)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/Spook-128-384-mu.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `input` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `expected` | `3b8d8fa82875d7b9c9fb57eefd9a54f3 d1d3cca478c654b0b06ac6773f4ed022 5cf891bc8212f0d2866536fe04bb5068` |

---

[← All algorithms](../README.md)
