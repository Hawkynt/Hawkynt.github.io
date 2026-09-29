# Ascon-Hash256

> Lightweight hash function based on Ascon permutation, standardized in NIST SP 800-232. Provides 256-bit security with efficient hardware and software implementations.

## Properties

| Property | Value |
| --- | --- |
| Category | Hash Functions |
| Sub-category | Lightweight Hash |
| Security status | 🛡️ Secure |
| Complexity | Intermediate |
| Inventor | Christoph Dobraunig, Maria Eichlseder, Florian Mendel, Martin Schläffer |
| Year | 2023 |
| Origin | Not specified |
| Source | [`algorithms/hash/ascon-hash.js`](../../../algorithms/hash/ascon-hash.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Output sizes | 32 bytes (256 bits) |

## Security

**Status:** 🛡️ Secure

No vulnerabilities are recorded for this implementation.

## Documentation

- [NIST SP 800-232](https://csrc.nist.gov/pubs/sp/800/232/final)
- [Ascon Specification](https://ascon.iaik.tugraz.at/)
- [NIST LWC Announcement](https://www.nist.gov/news-events/news/2023/02/nist-standardizes-ascon-cryptography-protecting-iot-devices)

## References

- [Official Ascon C reference implementation](https://github.com/ascon/ascon-c)
- [Ascon Python reference implementation](https://github.com/ascon/ascon-python)

## Test vectors

7 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Ascon-Hash256: Empty message (Count=1)](https://github.com/ascon/ascon-c/blob/main/crypto_hash/asconhash256/LWC_HASH_KAT_128_256.txt)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `0b3be5850f2f6b98caf29f8fdea89b64a1fa70aa249b8f839bd53baa304d92b2` |

**Vector 2** — [Ascon-Hash256: Single byte 0x00 (Count=2)](https://github.com/ascon/ascon-c/blob/main/crypto_hash/asconhash256/LWC_HASH_KAT_128_256.txt)

| Field | Value |
| --- | --- |
| `input` | `00` |
| `expected` | `0728621035af3ed2bca03bf6fde900f9456f5330e4b5ee23e7f6a1e70291bc80` |

**Vector 3** — [Ascon-Hash256: Two bytes (Count=3)](https://github.com/ascon/ascon-c/blob/main/crypto_hash/asconhash256/LWC_HASH_KAT_128_256.txt)

| Field | Value |
| --- | --- |
| `input` | `0001` |
| `expected` | `6115e7c9c4081c2797fc8fe1bc57a836afa1c5381e556dd583860ca2dfb48dd2` |

**Vector 4** — [Ascon-Hash256: Four bytes (Count=5)](https://github.com/ascon/ascon-c/blob/main/crypto_hash/asconhash256/LWC_HASH_KAT_128_256.txt)

| Field | Value |
| --- | --- |
| `input` | `00010203` |
| `expected` | `d7e4c7ed9b8a325cd08b9ef259f8877054ecd8304fe1b2d7fd847137df6727ee` |

**Vector 5** — [Ascon-Hash256: Eight bytes, exact rate multiple (Count=9)](https://github.com/ascon/ascon-c/blob/main/crypto_hash/asconhash256/LWC_HASH_KAT_128_256.txt)

| Field | Value |
| --- | --- |
| `input` | `0001020304050607` |
| `expected` | `b88e497ae8e6fb641b87ef622eb8f2fca0ed95383f7ffebe167acf1099ba764f` |

**Vector 6** — [Ascon-Hash256: Sixteen bytes (Count=17)](https://github.com/ascon/ascon-c/blob/main/crypto_hash/asconhash256/LWC_HASH_KAT_128_256.txt)

| Field | Value |
| --- | --- |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `3158c1940a2fbadbd68ab661777859b94a689e4efc375911467addd641835c38` |

**Vector 7** — [Ascon-Hash256: 32 bytes (Count=33)](https://github.com/ascon/ascon-c/blob/main/crypto_hash/asconhash256/LWC_HASH_KAT_128_256.txt)

| Field | Value |
| --- | --- |
| `input` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `expected` | `bd9d3d60a66b53868eab2a5c74539a518a1f60f01eb176c60e43dee81680b33e` |

---

[← All algorithms](../README.md)
