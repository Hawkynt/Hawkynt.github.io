# IDEA

> International Data Encryption Algorithm by Lai and Massey. Uses Lai-Massey structure with three operations: XOR, addition mod 2^16, and multiplication mod (2^16+1). Patent expired 2011.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Xuejia Lai, James L. Massey |
| Year | 1991 |
| Origin | 🇨🇭 Switzerland |
| Source | [`algorithms/block/idea.js`](../../../algorithms/block/idea.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) |
| Block sizes | 8 bytes (64 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| [Patent History](https://patents.google.com/patent/US5214703A) | Algorithm was patented until 2011, limiting adoption. Patent-free since 2011. | Use AES for new applications requiring standardized algorithms |

## Documentation

- [IDEA Algorithm Specification](https://en.wikipedia.org/wiki/International_Data_Encryption_Algorithm)
- [Original Academic Paper](https://link.springer.com/chapter/10.1007/3-540-46877-3_35)
- [Applied Cryptography - IDEA](https://www.schneier.com/books/applied_cryptography/)

## References

- [OpenSSL IDEA Implementation](https://github.com/openssl/openssl/blob/master/crypto/idea/)
- [Crypto++ IDEA Implementation](https://github.com/weidai11/cryptopp/blob/master/idea.cpp)
- [Bouncy Castle IDEA Implementation](https://github.com/bcgit/bc-java/tree/master/core/src/main/java/org/bouncycastle/crypto/engines)

## Test vectors

6 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [NESSIE IDEA ECB test vector - all zeros](https://raw.githubusercontent.com/pyca/cryptography/main/vectors/cryptography_vectors/ciphers/IDEA/idea-ecb.txt)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000` |
| `input` | `0000000000000000` |
| `expected` | `0001000100000000` |

**Vector 2** — [NESSIE IDEA ECB test vector - high bit plaintext](https://raw.githubusercontent.com/pyca/cryptography/main/vectors/cryptography_vectors/ciphers/IDEA/idea-ecb.txt)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000` |
| `input` | `8000000000000000` |
| `expected` | `8001000180008000` |

**Vector 3** — [Botan idea.vec - classic ISO/IEC 18033-3 sample, counting plaintext](https://github.com/randombit/botan/blob/master/src/tests/data/block/idea.vec)

| Field | Value |
| --- | --- |
| `key` | `00010002000300040005000600070008` |
| `input` | `0000000100020003` |
| `expected` | `11fbed2b01986de5` |

**Vector 4** — [Botan idea.vec - classic sample, sequential plaintext](https://github.com/randombit/botan/blob/master/src/tests/data/block/idea.vec)

| Field | Value |
| --- | --- |
| `key` | `00010002000300040005000600070008` |
| `input` | `0102030405060708` |
| `expected` | `540e5fea18c2f8b1` |

**Vector 5** — [Botan idea.vec - random key/plaintext pair](https://github.com/randombit/botan/blob/master/src/tests/data/block/idea.vec)

| Field | Value |
| --- | --- |
| `key` | `ed1bcc9e9267925f3132ba3a8cf9b764` |
| `input` | `7409000000000000` |
| `expected` | `e18315c171b83765` |

**Vector 6** — [Botan idea.vec - multi-block ECB chain](https://github.com/randombit/botan/blob/master/src/tests/data/block/idea.vec)

| Field | Value |
| --- | --- |
| `key` | `00010002000300040005000600070008` |
| `input` | `000000010002000301020304050607080019324b647d96aff5202d5b9c671b08` |
| `expected` | `11fbed2b01986de5540e5fea18c2f8b19f0a0ab6e10ced78cf18fd7355e2c5c5` |

---

[← All algorithms](../README.md)
