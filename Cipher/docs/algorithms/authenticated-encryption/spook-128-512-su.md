# Spook-128-512-su

> NIST Lightweight Cryptography candidate providing authenticated encryption with side-channel protection. Uses Shadow-512 permutation with Clyde-128 tweakable block cipher. The single-user variant offers 128-bit key security.

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

**Vector 1** — [NIST LWC round-2 KAT Spook-128-512-su Count = 1 (PT 0 bytes, AD 0 bytes)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/Spook-128-512-su.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | _(empty)_ |
| `input` | _(empty)_ |
| `expected` | `e3e9a30abc6d23284b31f81783a8e810` |

**Vector 2** — [NIST LWC round-2 KAT Spook-128-512-su Count = 2 (PT 0 bytes, AD 1 bytes)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/Spook-128-512-su.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | `00` |
| `input` | _(empty)_ |
| `expected` | `703ae36267f531a7215e2c09b1351922` |

**Vector 3** — [NIST LWC round-2 KAT Spook-128-512-su Count = 34 (PT 1 bytes, AD 0 bytes)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/Spook-128-512-su.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | _(empty)_ |
| `input` | `00` |
| `expected` | `2848c938fce8cd25c243326e56778432ab` |

**Vector 4** — [NIST LWC round-2 KAT Spook-128-512-su Count = 50 (PT 1 bytes, AD 16 bytes)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/Spook-128-512-su.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `00` |
| `expected` | `f2af92f1a1b050fc59c33a213366095021` |

**Vector 5** — [NIST LWC round-2 KAT Spook-128-512-su Count = 562 (PT 17 bytes, AD 0 bytes)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/Spook-128-512-su.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | _(empty)_ |
| `input` | `000102030405060708090a0b0c0d0e0f10` |
| `expected` | `28bd311fd0cd7f7674d7e62980620497 d8837d06ff9f8059c34c7d452aa51af6 72` |

**Vector 6** — [NIST LWC round-2 KAT Spook-128-512-su Count = 1089 (PT 32 bytes, AD 32 bytes)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/Spook-128-512-su.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `input` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `expected` | `9d1a32ce941dcd220cc33300fd0512ae 8332e1e720898671b8b6eb9d08704031 e1c0be40a40322a13a95d3288f6de8db` |

---

[← All algorithms](../README.md)
