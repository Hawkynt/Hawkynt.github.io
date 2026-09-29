# EAX

> EAX (Encrypt-then-Authenticate-then-Translate) is an authenticated encryption mode that combines CTR mode encryption with OMAC authentication. It provides both confidentiality and authenticity, supporting arbitrary-length nonces and associated authenticated data (AAD).

## Properties

| Property | Value |
| --- | --- |
| Category | Cipher Modes |
| Sub-category | Authenticated Encryption |
| Security status | 🛡️ Secure |
| Complexity | Advanced |
| Inventor | Bellare, Rogaway, Wagner |
| Year | 2003 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/modes/eax.js`](../../../algorithms/modes/eax.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Tag sizes | 1 byte (8 bits) to 16 bytes (128 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `SupportsDetached` | Yes |

## Security

**Status:** 🛡️ Secure

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Nonce Reuse | Reusing nonce with same key breaks confidentiality and authenticity. Always use unique nonces. | — |
| Implementation Attacks | Vulnerable to timing attacks if not implemented with constant-time operations. | — |

## Documentation

- [EAX Original Paper](https://web.cs.ucdavis.edu/~rogaway/papers/eax.html)
- [ANSI C12.22 Standard](https://webstore.ansi.org/standards/ansi/ansic1222008)
- [IEEE 1703 Standard](https://standards.ieee.org/standard/1703-2012.html)

## References

- Handbook of Applied Cryptography — Chapter 9 - Authenticated Encryption
- [OMAC Specification](http://www.nuee.nagoya-u.ac.jp/labs/tiwata/omac/omac.html)

## Test vectors

5 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Crypto++ Test Vector #1 - Empty plaintext](https://github.com/weidai11/cryptopp/blob/master/TestVectors/eax.txt)

| Field | Value |
| --- | --- |
| `cipher` | AES |
| `key` | `233952dee4d5ed5f9b9c6d6ff80ff478` |
| `nonce` | `62ec67f9c3a4a407fcb2a8c49031a8b3` |
| `aad` | `6bfb914fd07eae6b` |
| `tagSize` | `16` |
| `input` | _(empty)_ |
| `expected` | `e037830e8389f27b025a2d6527e79d01` |

**Vector 2** — [Crypto++ Test Vector #2 - 2-byte plaintext](https://github.com/weidai11/cryptopp/blob/master/TestVectors/eax.txt)

| Field | Value |
| --- | --- |
| `cipher` | AES |
| `key` | `91945d3f4dcbee0bf45ef52255f095a4` |
| `nonce` | `becaf043b0a23d843194ba972c66debd` |
| `aad` | `fa3bfd4806eb53fa` |
| `tagSize` | `16` |
| `input` | `f7fb` |
| `expected` | `19dd5c4c9331049d0bdab0277408f67967e5` |

**Vector 3** — [Crypto++ Test Vector #3 - 5-byte plaintext](https://github.com/weidai11/cryptopp/blob/master/TestVectors/eax.txt)

| Field | Value |
| --- | --- |
| `cipher` | AES |
| `key` | `01f74ad64077f2e704c0f60ada3dd523` |
| `nonce` | `70c3db4f0d26368400a10ed05d2bff5e` |
| `aad` | `234a3463c1264ac6` |
| `tagSize` | `16` |
| `input` | `1a47cb4933` |
| `expected` | `d851d5bae03a59f238a23e39199dc9266626c40f80` |

**Vector 4** — [Crypto++ Test Vector #4 - 5-byte plaintext](https://github.com/weidai11/cryptopp/blob/master/TestVectors/eax.txt)

| Field | Value |
| --- | --- |
| `cipher` | AES |
| `key` | `d07cf6cbb7f313bdde66b727afd3c5e8` |
| `nonce` | `8408dfff3c1a2b1292dc199e46b7d617` |
| `aad` | `33cce2eabff5a79d` |
| `tagSize` | `16` |
| `input` | `481c9e39b1` |
| `expected` | `632a9d131ad4c168a4225d8e1ff755939974a7bede` |

**Vector 5** — [Crypto++ Test Vector #5 - 6-byte plaintext](https://github.com/weidai11/cryptopp/blob/master/TestVectors/eax.txt)

| Field | Value |
| --- | --- |
| `cipher` | AES |
| `key` | `35b6d0580005bbc12b0587124557d2c2` |
| `nonce` | `fdb6b06676eedc5c61d74276e1f8e816` |
| `aad` | `aeb96eaebe2970e9` |
| `tagSize` | `16` |
| `input` | `40d0c07da5e4` |
| `expected` | `071dfe16c675cb0677e536f73afe6a14b74ee49844dd` |

---

[← All algorithms](../README.md)
