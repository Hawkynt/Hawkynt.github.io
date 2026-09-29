# SAFER

> Secure And Fast Encryption Routine by James Massey. Uses exponential/logarithmic S-boxes based on GF(257) and Pseudo-Hadamard Transform for diffusion. Educational implementation supporting K-64 and K-128 variants.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | James Massey |
| Year | 1993 |
| Origin | 🇨🇭 Switzerland |
| Source | [`algorithms/block/safer.js`](../../../algorithms/block/safer.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 8 bytes (64 bits) to 16 bytes (128 bits) in steps of 8 bytes |
| Block sizes | 8 bytes (64 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Weak keys in some variants | Certain key patterns may exhibit reduced security | Use random keys and strengthened variants when available |
| Small block size | 64-bit block size vulnerable to birthday attacks | Avoid encrypting large amounts of data with single key |

## Documentation

- [SAFER Specification](https://link.springer.com/chapter/10.1007/3-540-58108-1_24)
- [Applied Cryptography - SAFER](https://www.schneier.com/academic/archives/1995/12/the_safer_k64_and_sa.html)
- [Wikipedia - SAFER](https://en.wikipedia.org/wiki/SAFER)

## References

- [Original SAFER Paper](https://link.springer.com/chapter/10.1007/3-540-58108-1_24)
- [Crypto++ SAFER Implementation](https://github.com/weidai11/cryptopp/blob/master/safer.cpp)
- [SAFER Analysis](https://www.cosic.esat.kuleuven.be/publications/article-431.pdf)
- [ETH Zurich Reference Implementation](https://web.archive.org/web/20060926072149/http://www.isi.ee.ethz.ch/~moliner/safer.c)

## Test vectors

8 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Crypto++ SAFER K-64 test 1 (zeros)](https://github.com/weidai11/cryptopp/blob/master/TestData/saferval.dat)

| Field | Value |
| --- | --- |
| `key` | `0000000000000000` |
| `input` | `0000000000000000` |
| `expected` | `032808c90ee7ab7f` |

**Vector 2** — [Crypto++ SAFER K-64 test 2 (sequential plaintext)](https://github.com/weidai11/cryptopp/blob/master/TestData/saferval.dat)

| Field | Value |
| --- | --- |
| `key` | `0000000000000000` |
| `input` | `0102030405060708` |
| `expected` | `7d28038633b92eb4` |

**Vector 3** — [Crypto++ SAFER K-64 test 3 (incrementing key/plaintext)](https://github.com/weidai11/cryptopp/blob/master/TestData/saferval.dat)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708` |
| `input` | `1011121314151617` |
| `expected` | `71e5cf7f083a59c5` |

**Vector 4** — [Crypto++ SAFER K-64 test 4 (incrementing key/plaintext)](https://github.com/weidai11/cryptopp/blob/master/TestData/saferval.dat)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708` |
| `input` | `18191a1b1c1d1e1f` |
| `expected` | `356f702cc7fa8161` |

**Vector 5** — [Crypto++ SAFER K-128 test 1 (12 rounds, mirrored key halves)](https://github.com/weidai11/cryptopp/blob/master/TestData/saferval.dat)

| Field | Value |
| --- | --- |
| `key` | `08070605040302010807060504030201` |
| `rounds` | `12` |
| `input` | `5051525354555657` |
| `expected` | `38e64dbf6e0f896e` |

**Vector 6** — [Crypto++ SAFER K-128 test 2 (12 rounds, mirrored key halves)](https://github.com/weidai11/cryptopp/blob/master/TestData/saferval.dat)

| Field | Value |
| --- | --- |
| `key` | `08070605040302010807060504030201` |
| `rounds` | `12` |
| `input` | `58595a5b5c5d5e5f` |
| `expected` | `7d8f014a902480fe` |

**Vector 7** — [Crypto++ SAFER K-128 test 3 (12 rounds, distinct key halves)](https://github.com/weidai11/cryptopp/blob/master/TestData/saferval.dat)

| Field | Value |
| --- | --- |
| `key` | `01020304050607080807060504030201` |
| `rounds` | `12` |
| `input` | `6061626364656667` |
| `expected` | `113511c22e7936df` |

**Vector 8** — [Crypto++ SAFER K-128 test 4 (12 rounds, distinct key halves)](https://github.com/weidai11/cryptopp/blob/master/TestData/saferval.dat)

| Field | Value |
| --- | --- |
| `key` | `01020304050607080807060504030201` |
| `rounds` | `12` |
| `input` | `68696a6b6c6d6e6f` |
| `expected` | `9eeb2d17c0581437` |

---

[← All algorithms](../README.md)
