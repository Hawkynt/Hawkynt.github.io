# OCB3

> OCB3 (Offset CodeBook Mode version 3) is a highly efficient authenticated encryption mode that provides both confidentiality and authenticity in a single pass. It supports parallel processing and was standardized in RFC 7253. OCB3 improves upon earlier OCB versions with enhanced security and performance.

## Properties

| Property | Value |
| --- | --- |
| Category | Cipher Modes |
| Sub-category | Authenticated Encryption |
| Security status | 🛡️ Secure |
| Complexity | Research |
| Inventor | Phillip Rogaway, Ted Krovetz |
| Year | 2011 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/modes/ocb.js`](../../../algorithms/modes/ocb.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| IV sizes | 1 byte (8 bits) to 15 bytes (120 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `RequiresIV` | Yes |

## Security

**Status:** 🛡️ Secure

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Nonce Reuse | Reusing nonces with the same key completely breaks OCB3 security. Each encryption must use a unique nonce. | — |
| Patent History | OCB was patent-encumbered until 2028. Now free for use but still requires careful implementation. | — |

## Documentation

- [RFC 7253 - OCB3](https://tools.ietf.org/rfc/rfc7253.txt)
- [OCB3 Specification](https://web.cs.ucdavis.edu/~rogaway/ocb/ocb-back.htm)
- [CAESAR Competition](https://competitions.cr.yp.to/round3/ocbv11.pdf)

## References

- [Reference Implementation](https://github.com/rweather/arduinolibs/tree/master/libraries/Crypto)
- [OCB3 in LibTomCrypt](https://github.com/libtom/libtomcrypt/blob/develop/src/encauth/ocb3/ocb3_encrypt.c)
- [Python Implementation](https://github.com/Legrandin/pycryptodome/blob/master/lib/Crypto/Cipher/_mode_ocb.py)

## Test vectors

6 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [RFC 7253 AES-128 OCB TAGLEN128, N=...01, 8-byte plaintext](https://www.rfc-editor.org/rfc/rfc7253.txt)

| Field | Value |
| --- | --- |
| `cipher` | AES |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `bbaa99887766554433221101` |
| `aad` | `0001020304050607` |
| `tagLength` | `16` |
| `input` | `0001020304050607` |
| `expected` | `6820b3657b6f615a5725bda0d3b4eb3a257c9af1f8f03009` |

**Vector 2** — [RFC 7253 AES-128 OCB TAGLEN128, N=...03, empty AAD](https://www.rfc-editor.org/rfc/rfc7253.txt)

| Field | Value |
| --- | --- |
| `cipher` | AES |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `bbaa99887766554433221103` |
| `aad` | _(empty)_ |
| `tagLength` | `16` |
| `input` | `0001020304050607` |
| `expected` | `45dd69f8f5aae72414054cd1f35d82760b2cd00d2f99bfa9` |

**Vector 3** — [RFC 7253 AES-128 OCB TAGLEN128, N=...04, one full block](https://www.rfc-editor.org/rfc/rfc7253.txt)

| Field | Value |
| --- | --- |
| `cipher` | AES |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `bbaa99887766554433221104` |
| `aad` | `000102030405060708090a0b0c0d0e0f` |
| `tagLength` | `16` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `571d535b60b277188be5147170a9a22c3ad7a4ff3835b8c5701c1ccec8fc3358` |

**Vector 4** — [RFC 7253 AES-128 OCB TAGLEN128, N=...07, block plus half block](https://www.rfc-editor.org/rfc/rfc7253.txt)

| Field | Value |
| --- | --- |
| `cipher` | AES |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `bbaa99887766554433221107` |
| `aad` | `000102030405060708090a0b0c0d0e0f1011121314151617` |
| `tagLength` | `16` |
| `input` | `000102030405060708090a0b0c0d0e0f1011121314151617` |
| `expected` | `1ca2207308c87c010756104d8840ce19 52f09673a448a122c92c62241051f573 56d7f3c90bb0e07f` |

**Vector 5** — [RFC 7253 AES-128 OCB TAGLEN128, N=...0D, 40-byte plaintext](https://www.rfc-editor.org/rfc/rfc7253.txt)

| Field | Value |
| --- | --- |
| `cipher` | AES |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `bbaa9988776655443322110d` |
| `aad` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 2021222324252627` |
| `tagLength` | `16` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 2021222324252627` |
| `expected` | `d5ca91748410c1751ff8a2f618255b68 a0a12e093ff454606e59f9c1d0ddc54b 65e8628e568bad7aed07ba06a4a69483 a7035490c5769e60` |

**Vector 6** — [RFC 7253 OCB TAGLEN96 with key 0F0E...0100](https://www.rfc-editor.org/rfc/rfc7253.txt)

| Field | Value |
| --- | --- |
| `cipher` | AES |
| `key` | `0f0e0d0c0b0a09080706050403020100` |
| `nonce` | `bbaa9988776655443322110d` |
| `aad` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 2021222324252627` |
| `tagLength` | `12` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 2021222324252627` |
| `expected` | `1792a4e31e0755fb03e31b22116e6c2d df9efd6e33d536f1a0124b0a55bae884 ed93481529c76b6ad0c515f4d1cdd4fd ac4f02aa` |

---

[← All algorithms](../README.md)
