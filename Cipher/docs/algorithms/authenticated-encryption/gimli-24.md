# Gimli-24

> Lightweight authenticated encryption with 384-bit permutation and 24 rounds. NIST LWC competition candidate with compact design optimized for constrained devices.

## Properties

| Property | Value |
| --- | --- |
| Category | Authenticated Encryption |
| Sub-category | Authenticated Encryption |
| Security status | 🧪 Experimental |
| Complexity | Advanced |
| Inventor | Daniel J. Bernstein, Stefan Kolbl, Stefan Lucks, Pedro Maat Costa Massolino, Florian Mendel, Kashif Nawaz, Tobias Schneider, Peter Schwabe, Francois-Xavier Standaert, Yosuke Todo, and Benoit Viguier |
| Year | 2017 |
| Origin | 🌐 International |
| Source | [`algorithms/aead/gimli24.js`](../../../algorithms/aead/gimli24.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 32 bytes (256 bits) |
| Block sizes | 16 bytes (128 bits) |
| Tag sizes | 16 bytes (128 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `SupportsDetached` | No |

## Security

**Status:** 🧪 Experimental

No vulnerabilities are recorded for this implementation.

## Documentation

- [Official Specification](https://csrc.nist.gov/CSRC/media/Projects/Lightweight-Cryptography/documents/round-1/spec-doc/gimli-spec.pdf)
- [Gimli Website](https://gimli.cr.yp.to/)
- [NIST LWC Round 1 Submission](https://csrc.nist.gov/Projects/lightweight-cryptography/round-1-candidates)
- [Reference Implementation](https://github.com/rweather/lightweight-crypto)

## References

- [Gimli Reference Implementations (Gimli team)](https://github.com/jedisct1/gimli)
- [Gimli Hardware Implementation (secworks)](https://github.com/secworks/gimli)
- [Gimli Go Port of the Reference C Code](https://github.com/bmkessler/gimli)

## Test vectors

12 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Count 1 - Empty plaintext and AD](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/GIMLI-24-CIPHER.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | _(empty)_ |
| `input` | _(empty)_ |
| `expected` | `14da9bb7120bf58b985a8e00fdeba15b` |

**Vector 2** — [Count 2 - Empty plaintext, 1-byte AD](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/GIMLI-24-CIPHER.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | `00` |
| `input` | _(empty)_ |
| `expected` | `e8d50453f84b575412327d7c0302d8d3` |

**Vector 3** — [Count 3 - Empty plaintext, 2-byte AD](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/GIMLI-24-CIPHER.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | `0001` |
| `input` | _(empty)_ |
| `expected` | `776f829eb5de73d400ef4dedb2e2772d` |

**Vector 4** — [Count 34 - 1-byte plaintext, empty AD](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/GIMLI-24-CIPHER.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | _(empty)_ |
| `input` | `00` |
| `expected` | `7f80492c317b1cd58a1edc3a0d3e9876fc` |

**Vector 5** — [Count 496 - 15-byte plaintext (below the 16-byte rate), empty AD](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/GIMLI-24-CIPHER.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | _(empty)_ |
| `input` | `000102030405060708090a0b0c0d0e` |
| `expected` | `7f8a2cf4f52aa4d6b2e74105c30a276de1b05cb36f9546d5dedde3f5ea64d1` |

**Vector 6** — [Count 511 - 15-byte plaintext, 15-byte AD](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/GIMLI-24-CIPHER.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | `000102030405060708090a0b0c0d0e` |
| `input` | `000102030405060708090a0b0c0d0e` |
| `expected` | `1a259c7e82bf80485e65d7efce7c35258c36aeff25f990fb6b23ca3caca30d` |

**Vector 7** — [Count 529 - 16-byte plaintext (exactly one rate block), empty AD](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/GIMLI-24-CIPHER.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | _(empty)_ |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `7f8a2cf4f52aa4d6b2e74105c30a2777b9b7502494528b5160f5ee0f65c3a7b4` |

**Vector 8** — [Count 545 - 16-byte plaintext, 16-byte AD](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/GIMLI-24-CIPHER.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `9a93dec680ca514c36e7dd94e6c7417a5af0c6af4582419a3317176f887b67b1` |

**Vector 9** — [Count 562 - 17-byte plaintext (spans two rate blocks), empty AD](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/GIMLI-24-CIPHER.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | _(empty)_ |
| `input` | `000102030405060708090a0b0c0d0e0f10` |
| `expected` | `7f8a2cf4f52aa4d6b2e74105c30a2777 b960057b937a5e002f488dc19db7b011 cf` |

**Vector 10** — [Count 567 - 17-byte plaintext, 5-byte AD](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/GIMLI-24-CIPHER.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | `0001020304` |
| `input` | `000102030405060708090a0b0c0d0e0f10` |
| `expected` | `1f6649ae35bcb8511b3f60020cefeee9 95f239f4eb51f8eb088431116464570b cb` |

**Vector 11** — [Count 1057 - 32-byte plaintext (two full rate blocks), empty AD](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/GIMLI-24-CIPHER.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | _(empty)_ |
| `input` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `expected` | `7f8a2cf4f52aa4d6b2e74105c30a2777 b9d0c8aefdd555de35861bd3011f652f 7256456fa935ac34bbf55ae135f33257` |

**Vector 12** — [Count 1089 - 32-byte plaintext, 32-byte AD](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/GIMLI-24-CIPHER.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `input` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `expected` | `766b3b5e7788272d39edad2bcebaf416 06e62076a0fd1494b99527bf45dc138f 1a9606db255937b68e02fec83e2c54b9` |

---

[← All algorithms](../README.md)
