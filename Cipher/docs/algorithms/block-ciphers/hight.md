# HIGHT

> HIGh security and light weigHT block cipher designed for low-resource devices. Uses only ADD/XOR operations without multiplication, making it suitable for constrained environments like RFID and sensor networks.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Deukjo Hong, Jaechul Sung, Seokhie Hong, Jongin Lim, Sangjin Lee, and others |
| Year | 2006 |
| Origin | 🇰🇷 South Korea |
| Source | [`algorithms/block/hight.js`](../../../algorithms/block/hight.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) |
| Block sizes | 8 bytes (64 bits) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [HIGHT: A New Block Cipher Suitable for Low-Resource Device](https://www.iacr.org/archive/ches2006/04/04.pdf)
- [Crypto++ HIGHT Implementation](https://github.com/weidai11/cryptopp/blob/master/hight.cpp)

## References

- [openluopworld Lightweight Block Ciphers - HIGHT (C)](https://github.com/openluopworld/block-ciphers)
- [kmarquet/bloc Reference Implementations (C)](https://github.com/kmarquet/bloc)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Crypto++ HIGHT Test Vector #1](https://github.com/weidai11/cryptopp/blob/master/TestVectors/hight.txt)

| Field | Value |
| --- | --- |
| `key` | `88e34f8f081779f1e9f394370ad40589` |
| `input` | `d76d0d18327ec562` |
| `expected` | `e4bc2e312277e4dd` |

**Vector 2** — [Crypto++ HIGHT Test Vector #2](https://github.com/weidai11/cryptopp/blob/master/TestVectors/hight.txt)

| Field | Value |
| --- | --- |
| `key` | `2923be84e16cd6ae529049f1f1bbe9eb` |
| `input` | `b3a6db3c870c3e99` |
| `expected` | `23cad1a3cddf7eab` |

**Vector 3** — [Crypto++ HIGHT Test Vector #3](https://github.com/weidai11/cryptopp/blob/master/TestVectors/hight.txt)

| Field | Value |
| --- | --- |
| `key` | `245e0d1c06b747deb3124dc843bb8ba6` |
| `input` | `1f035a7d0938251f` |
| `expected` | `52bd91bb26f8ed99` |

---

[← All algorithms](../README.md)
