# Camellia

> Camellia block cipher by NTT/Mitsubishi with 128-bit blocks and 18/24 rounds. Features symmetric Feistel network with FL/FLINV functions for high security.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🛡️ Secure |
| Complexity | Advanced |
| Inventor | Kazumaro Aoki, Tetsuya Ichikawa, Masayuki Kanda, Mitsuru Matsui, Shiho Moriai, Junko Nakajima, Toshio Tokita |
| Year | 2000 |
| Origin | 🇯🇵 Japan |
| Source | [`algorithms/block/camellia.js`](../../../algorithms/block/camellia.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits); 24 bytes (192 bits); 32 bytes (256 bits) |
| Block sizes | 16 bytes (128 bits) |

## Security

**Status:** 🛡️ Secure

No vulnerabilities are recorded for this implementation.

## Documentation

- [RFC 3713 - Camellia Cipher Specification](https://tools.ietf.org/rfc/rfc3713.txt)
- [NIST Camellia Information](https://csrc.nist.gov/projects/cryptographic-standards-and-guidelines/archived-crypto-projects/camellia)
- [Original Paper](https://info.isl.ntt.co.jp/crypt/camellia/dl/01espec.pdf)

## References

- [ISO/IEC 18033-3:2010 Standard](https://www.iso.org/standard/54531.html)
- [Bouncy Castle Implementation](https://github.com/bcgit/bc-java/blob/master/core/src/main/java/org/bouncycastle/crypto/engines/CamelliaEngine.java)
- [CRYPTREC Evaluation](https://www.cryptrec.go.jp/en/)

## Test vectors

6 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Camellia vector 1/zero](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0000000000000000000000000000000000000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `396154111adefc500cf6e5c99038bc17` |

**Vector 2** — [DarkCrypt Camellia vector 2/incr](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `5f77dc44e5e6701e8755c1fa176e2434` |

**Vector 3** — [DarkCrypt Camellia vector 3/incr2](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20` |
| `input` | `101112131415161718191a1b1c1d1e1f` |
| `expected` | `959eae4726473536932172ad26025b2a` |

**Vector 4** — [RFC 3713 Camellia-128 Test Vector](https://tools.ietf.org/rfc/rfc3713.txt)

| Field | Value |
| --- | --- |
| `key` | `0123456789abcdeffedcba9876543210` |
| `input` | `0123456789abcdeffedcba9876543210` |
| `expected` | `67673138549669730857065648eabe43` |

**Vector 5** — [RFC 3713 Camellia-192 Test Vector](https://tools.ietf.org/rfc/rfc3713.txt)

| Field | Value |
| --- | --- |
| `key` | `0123456789abcdeffedcba98765432100011223344556677` |
| `input` | `0123456789abcdeffedcba9876543210` |
| `expected` | `b4993401b3e996f84ee5cee7d79b09b9` |

**Vector 6** — [RFC 3713 Camellia-256 Test Vector](https://tools.ietf.org/rfc/rfc3713.txt)

| Field | Value |
| --- | --- |
| `key` | `0123456789abcdeffedcba987654321000112233445566778899aabbccddeeff` |
| `input` | `0123456789abcdeffedcba9876543210` |
| `expected` | `9acc237dff16d76c20ef7c919e3a7509` |

---

[← All algorithms](../README.md)
