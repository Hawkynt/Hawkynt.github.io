# SM4

> Chinese national standard block cipher (GB/T 32907-2016, also known as SMS4). Features 128-bit blocks and keys with 32-round substitution-permutation network for high security.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | Not classified |
| Complexity | Intermediate |
| Inventor | Lu Shuiwang, et al. |
| Year | 2006 |
| Origin | 🇨🇳 China |
| Source | [`algorithms/block/sm4.js`](../../../algorithms/block/sm4.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) |
| Block sizes | 16 bytes (128 bits) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [GB/T 32907-2016 - SM4 Block Cipher Algorithm](https://tools.ietf.org/rfc/rfc8018.txt)
- [IETF RFC 8018 - SMS4 Encryption Algorithm](https://tools.ietf.org/rfc/rfc8018.txt)
- [Wikipedia - SM4 cipher](https://en.wikipedia.org/wiki/SM4_(cipher))

## References

- [Original SM4 Specification](http://www.oscca.gov.cn/sca/xxgk/2016-08/17/content_1002386.shtml)
- [OpenSSL SM4 Implementation](https://github.com/openssl/openssl/tree/master/crypto/sm4)
- [GmSSL Implementation](https://github.com/guanzhi/GmSSL)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — SM4 Official Test Vector - GB/T 32907-2016

Source: GB/T 32907-2016

| Field | Value |
| --- | --- |
| `key` | `0123456789abcdeffedcba9876543210` |
| `input` | `0123456789abcdeffedcba9876543210` |
| `expected` | `681edf34d206965e86b3e94f536e4246` |

**Vector 2** — SM4 Zero Key Test

Source: Round-trip test

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000` |
| `input` | `0123456789abcdeffedcba9876543210` |
| `expected` | `29c8bccac865d43db25596e2b59be9af` |

**Vector 3** — SM4 Pattern Test

Source: Round-trip test

| Field | Value |
| --- | --- |
| `key` | `55555555555555555555555555555555` |
| `input` | `aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa` |
| `expected` | `039846fc490d67c56ed9c036842de4bb` |

---

[← All algorithms](../README.md)
