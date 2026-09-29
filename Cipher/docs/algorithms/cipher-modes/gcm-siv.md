# GCM-SIV

> GCM-SIV is a nonce-misuse resistant authenticated encryption algorithm that provides both privacy and authenticity even when nonces are repeated. It combines POLYVAL hash with AES-CTR encryption in a SIV-like construction, offering strong security guarantees and better performance than traditional SIV modes.

## Properties

| Property | Value |
| --- | --- |
| Category | Cipher Modes |
| Sub-category | Nonce-Misuse Resistant AEAD |
| Security status | 🛡️ Secure |
| Complexity | Expert |
| Inventor | Shay Gueron, Yehuda Lindell |
| Year | 2017 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/modes/gcm-siv.js`](../../../algorithms/modes/gcm-siv.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Tag sizes | 16 bytes (128 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `SupportsDetached` | Yes |

## Security

**Status:** 🛡️ Secure

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Nonce Reuse Safe | GCM-SIV is specifically designed to be safe against nonce reuse, providing graceful degradation. | — |
| Key Commitment | Does not provide key commitment - different keys may decrypt to different plaintexts. | — |
| Performance Trade-off | Slightly slower than GCM due to two-pass construction. | — |

## Documentation

- [RFC 8452 - AES-GCM-SIV](https://tools.ietf.org/rfc/rfc8452.txt)
- [GCM-SIV Paper](https://eprint.iacr.org/2017/168.pdf)
- [NIST Consideration](https://csrc.nist.gov/projects/lightweight-cryptography)

## References

- POLYVAL Specification — Section 3 of RFC 8452
- [Nonce-Misuse Resistance](https://tools.ietf.org/rfc/rfc5297.txt)

## Test vectors

8 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [RFC 8452 C.1 AEAD_AES_128_GCM_SIV - 8-byte plaintext, no AAD](https://www.rfc-editor.org/rfc/rfc8452.txt)

| Field | Value |
| --- | --- |
| `cipher` | AES |
| `key` | `01000000000000000000000000000000` |
| `nonce` | `030000000000000000000000` |
| `aad` | _(empty)_ |
| `tagSize` | `16` |
| `input` | `0100000000000000` |
| `expected` | `b5d839330ac7b786578782fff6013b815b287c22493a364c` |

**Vector 2** — [RFC 8452 C.1 AEAD_AES_128_GCM_SIV - one block, no AAD](https://www.rfc-editor.org/rfc/rfc8452.txt)

| Field | Value |
| --- | --- |
| `cipher` | AES |
| `key` | `01000000000000000000000000000000` |
| `nonce` | `030000000000000000000000` |
| `aad` | _(empty)_ |
| `tagSize` | `16` |
| `input` | `01000000000000000000000000000000` |
| `expected` | `743f7c8077ab25f8624e2e948579cf77303aaf90f6fe21199c6068577437a0c4` |

**Vector 3** — [RFC 8452 C.1 AEAD_AES_128_GCM_SIV - one block with 1-byte AAD](https://www.rfc-editor.org/rfc/rfc8452.txt)

| Field | Value |
| --- | --- |
| `cipher` | AES |
| `key` | `01000000000000000000000000000000` |
| `nonce` | `030000000000000000000000` |
| `aad` | `01` |
| `tagSize` | `16` |
| `input` | `02000000000000000000000000000000` |
| `expected` | `e2b0c5da79a901c1745f700525cb335b8f8936ec039e4e4bb97ebd8c4457441f` |

**Vector 4** — [RFC 8452 C.1 AEAD_AES_128_GCM_SIV - ragged plaintext and AAD](https://www.rfc-editor.org/rfc/rfc8452.txt)

| Field | Value |
| --- | --- |
| `cipher` | AES |
| `key` | `01000000000000000000000000000000` |
| `nonce` | `030000000000000000000000` |
| `aad` | `010000000000000000000000000000000200` |
| `tagSize` | `16` |
| `input` | `0300000000000000000000000000000004000000` |
| `expected` | `6bb0fecf5ded9b77f902c7d5da236a43 91dd029724afc9805e976f451e6d87f6 fe106514` |

**Vector 5** — [RFC 8452 C.1 AEAD_AES_128_GCM_SIV - random key, 21-byte plaintext](https://www.rfc-editor.org/rfc/rfc8452.txt)

| Field | Value |
| --- | --- |
| `cipher` | AES |
| `key` | `f901cfe8a69615a93fdf7a98cad48179` |
| `nonce` | `6245709fb18853f68d833640` |
| `aad` | `7576f7028ec6eb5ea7e298342a94d4b2 02b370ef9768ec6561c4fe6b7e7296fa 859c21` |
| `tagSize` | `16` |
| `input` | `e42a3c02c25b64869e146d7b233987bddfc240871d` |
| `expected` | `391cc328d484a4f46406181bcd62efd9 b3ee197d052d15506c84a9edd65e13e9 d24a2a6e70` |

**Vector 6** — [RFC 8452 C.2 AEAD_AES_256_GCM_SIV - one block, no AAD](https://www.rfc-editor.org/rfc/rfc8452.txt)

| Field | Value |
| --- | --- |
| `cipher` | AES |
| `key` | `0100000000000000000000000000000000000000000000000000000000000000` |
| `nonce` | `030000000000000000000000` |
| `aad` | _(empty)_ |
| `tagSize` | `16` |
| `input` | `01000000000000000000000000000000` |
| `expected` | `85a01b63025ba19b7fd3ddfc033b3e76c9eac6fa700942702e90862383c6c366` |

**Vector 7** — [RFC 8452 C.2 AEAD_AES_256_GCM_SIV - random key, 21-byte plaintext](https://www.rfc-editor.org/rfc/rfc8452.txt)

| Field | Value |
| --- | --- |
| `cipher` | AES |
| `key` | `3c535de192eaed3822a2fbbe2ca9dfc88255e14a661b8aa82cc54236093bbc23` |
| `nonce` | `688089e55540db1872504e1c` |
| `aad` | `734320ccc9d9bbbb19cb81b2af4ecbc3 e72834321f7aa0f70b7282b4f33df23f 167541` |
| `tagSize` | `16` |
| `input` | `ced532ce4159b035277d4dfbb7db62968b13cd4eec` |
| `expected` | `626660c26ea6612fb17ad91e8e767639 edd6c9faee9d6c7029675b89eaf4ba1d ed1a286594` |

**Vector 8** — [RFC 8452 C.2 AEAD_AES_256_GCM_SIV - 32-bit counter wrap](https://www.rfc-editor.org/rfc/rfc8452.txt)

| Field | Value |
| --- | --- |
| `cipher` | AES |
| `key` | `0000000000000000000000000000000000000000000000000000000000000000` |
| `nonce` | `000000000000000000000000` |
| `aad` | _(empty)_ |
| `tagSize` | `16` |
| `input` | `000000000000000000000000000000004db923dc793ee6497c76dcc03a98e108` |
| `expected` | `f3f80f2cf0cb2dd9c5984fcda908456c c537703b5ba70324a6793a7bf218d3ea ffffffff000000000000000000000000` |

---

[← All algorithms](../README.md)
