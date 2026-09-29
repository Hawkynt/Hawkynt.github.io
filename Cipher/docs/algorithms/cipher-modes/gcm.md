# GCM

> Galois/Counter Mode provides authenticated encryption by combining CTR mode encryption with GHASH authentication using GF(2^128) arithmetic. Widely used in TLS, IPsec, and other security protocols. Provides both confidentiality and authenticity but catastrophically fails if nonces are reused.

## Properties

| Property | Value |
| --- | --- |
| Category | Cipher Modes |
| Sub-category | Authenticated Encryption |
| Security status | 🛡️ Secure |
| Complexity | Advanced |
| Inventor | David A. McGrew, John Viega |
| Year | 2005 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/modes/gcm.js`](../../../algorithms/modes/gcm.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Tag sizes | 4 bytes (32 bits) to 16 bytes (128 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `SupportsDetached` | Yes |

## Security

**Status:** 🛡️ Secure

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Nonce Reuse Attack | Reusing nonce with same key completely breaks confidentiality and authenticity. Authentication key can be recovered. Always use unique nonces. | — |
| Forbidden Attack | With very long messages (near 2^39 bits), confidentiality degrades. Limit message lengths in practice. | — |
| Authentication Forgery | With nonce reuse, arbitrary messages can be forged after key recovery. | — |

## Documentation

- [NIST SP 800-38D](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38d.pdf)
- [Original GCM Paper](https://citeseerx.ist.psu.edu/viewdoc/summary?doi=10.1.1.58.4924)
- [RFC 5288 - AES GCM for TLS](https://tools.ietf.org/rfc/rfc5288.txt)

## References

- [OpenSSL GCM Implementation](https://github.com/openssl/openssl/blob/master/crypto/modes/gcm128.c)
- ISO/IEC 19772:2009 — GCM international standard
- [Crypto++ GCM Implementation](https://github.com/weidai11/cryptopp/blob/master/gcm.cpp)

## Test vectors

5 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [GCM Test Case 2 - AES-128, one zero block, no AAD](https://csrc.nist.gov/CSRC/media/Projects/Block-Cipher-Techniques/documents/BCM/proposed-modes/gcm/gcm-spec.pdf)

| Field | Value |
| --- | --- |
| `cipher` | AES |
| `key` | `00000000000000000000000000000000` |
| `iv` | `000000000000000000000000` |
| `aad` | _(empty)_ |
| `input` | `00000000000000000000000000000000` |
| `expected` | `0388dace60b6a392f328c2b971b2fe78ab6e47d42cec13bdf53a67b21257bddf` |

**Vector 2** — [GCM Test Case 3 - AES-128, 64-byte plaintext, no AAD](https://csrc.nist.gov/CSRC/media/Projects/Block-Cipher-Techniques/documents/BCM/proposed-modes/gcm/gcm-spec.pdf)

| Field | Value |
| --- | --- |
| `cipher` | AES |
| `key` | `feffe9928665731c6d6a8f9467308308` |
| `iv` | `cafebabefacedbaddecaf888` |
| `aad` | _(empty)_ |
| `input` | `d9313225f88406e5a55909c5aff5269a 86a7a9531534f7da2e4c303d8a318a72 1c3c0c95956809532fcf0e2449a6b525 b16aedf5aa0de657ba637b391aafd255` |
| `expected` | `42831ec2217774244b7221b784d0d49c e3aa212f2c02a4e035c17e2329aca12e 21d514b25466931c7d8f6a5aac84aa05 1ba30b396a0aac973d58e091473f5985 4d5c2af327cd64a62cf35abd2ba6fab4` |

**Vector 3** — [GCM Test Case 4 - AES-128, 60-byte plaintext with AAD](https://csrc.nist.gov/CSRC/media/Projects/Block-Cipher-Techniques/documents/BCM/proposed-modes/gcm/gcm-spec.pdf)

| Field | Value |
| --- | --- |
| `cipher` | AES |
| `key` | `feffe9928665731c6d6a8f9467308308` |
| `iv` | `cafebabefacedbaddecaf888` |
| `aad` | `feedfacedeadbeeffeedfacedeadbeefabaddad2` |
| `input` | `d9313225f88406e5a55909c5aff5269a 86a7a9531534f7da2e4c303d8a318a72 1c3c0c95956809532fcf0e2449a6b525 b16aedf5aa0de657ba637b39` |
| `expected` | `42831ec2217774244b7221b784d0d49c e3aa212f2c02a4e035c17e2329aca12e 21d514b25466931c7d8f6a5aac84aa05 1ba30b396a0aac973d58e0915bc94fbc 3221a5db94fae95ae7121a47` |

**Vector 4** — [GCM Test Case 14 - AES-192, 64-byte plaintext, no AAD](https://csrc.nist.gov/CSRC/media/Projects/Block-Cipher-Techniques/documents/BCM/proposed-modes/gcm/gcm-spec.pdf)

| Field | Value |
| --- | --- |
| `cipher` | AES |
| `key` | `feffe9928665731c6d6a8f9467308308feffe9928665731c` |
| `iv` | `cafebabefacedbaddecaf888` |
| `aad` | _(empty)_ |
| `input` | `d9313225f88406e5a55909c5aff5269a 86a7a9531534f7da2e4c303d8a318a72 1c3c0c95956809532fcf0e2449a6b525 b16aedf5aa0de657ba637b391aafd255` |
| `expected` | `3980ca0b3c00e841eb06fac4872a2757 859e1ceaa6efd984628593b40ca1e19c 7d773d00c144c525ac619d18c84a3f47 18e2448b2fe324d9ccda2710acade256 9924a7c8587336bfb118024db8674a14` |

**Vector 5** — [GCM Test Case 16 - AES-256, 60-byte plaintext with AAD](https://csrc.nist.gov/CSRC/media/Projects/Block-Cipher-Techniques/documents/BCM/proposed-modes/gcm/gcm-spec.pdf)

| Field | Value |
| --- | --- |
| `cipher` | AES |
| `key` | `feffe9928665731c6d6a8f9467308308feffe9928665731c6d6a8f9467308308` |
| `iv` | `cafebabefacedbaddecaf888` |
| `aad` | `feedfacedeadbeeffeedfacedeadbeefabaddad2` |
| `input` | `d9313225f88406e5a55909c5aff5269a 86a7a9531534f7da2e4c303d8a318a72 1c3c0c95956809532fcf0e2449a6b525 b16aedf5aa0de657ba637b39` |
| `expected` | `522dc1f099567d07f47f37a32a84427d 643a8cdcbfe5c0c97598a2bd2555d1aa 8cb08e48590dbb3da7b08b1056828838 c5f61e6393ba7a0abcc9f66276fc6ece 0f4e1768cddf8853bb2d551b` |

---

[← All algorithms](../README.md)
