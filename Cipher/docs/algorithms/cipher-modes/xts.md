# XTS

> XEX-based Tweaked-codebook mode with ciphertext Stealing is designed for disk encryption. Uses two independent cipher keys (Key1 for encryption, Key2 for tweak generation) and a tweak value (typically sector number) to ensure different ciphertexts for identical plaintext blocks in different sectors. Supports partial block encryption via ciphertext stealing.

## Properties

| Property | Value |
| --- | --- |
| Category | Cipher Modes |
| Sub-category | Disk Encryption Mode |
| Security status | 🛡️ Secure |
| Complexity | Advanced |
| Inventor | Phillip Rogaway |
| Year | 2004 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/modes/xts.js`](../../../algorithms/modes/xts.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| IV sizes | 16 bytes (128 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `RequiresIV` | Yes |

## Security

**Status:** 🛡️ Secure

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Weak Tweak Values | Using predictable or repeated tweak values can leak information. Always use unique tweaks per data unit. | — |
| Key Reuse | Using same key for Key1 and Key2 breaks security. Ensure keys are independent. | — |
| Data Unit Size | Very large data units may have security implications. Recommended maximum is 2^20 blocks per tweak. | — |

## Documentation

- [IEEE 1619-2007](https://standards.ieee.org/standard/1619-2007.html)
- [NIST SP 800-38E](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38e.pdf)
- FIPS 140-2 Annex A — XTS-AES approval for disk encryption

## References

- [Original XTS Paper](https://web.cs.ucdavis.edu/~rogaway/papers/modes.pdf)
- [OpenSSL XTS Implementation](https://github.com/openssl/openssl/blob/master/crypto/modes/xts128.c)
- dm-crypt XTS — Linux kernel XTS implementation

## Test vectors

5 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [IEEE 1619 XTS-AES vector 2 (two full blocks)](https://raw.githubusercontent.com/BrianGladman/modes/master/testvals/xts.1)

| Field | Value |
| --- | --- |
| `cipher` | AES |
| `key` | `1111111111111111111111111111111122222222222222222222222222222222` |
| `iv` | `33333333330000000000000000000000` |
| `input` | `4444444444444444444444444444444444444444444444444444444444444444` |
| `expected` | `c454185e6a16936e39334038acef838bfb186fff7480adc4289382ecd6d394f0` |

**Vector 2** — [IEEE 1619 XTS-AES vector 15 (17 bytes, ciphertext stealing)](https://raw.githubusercontent.com/BrianGladman/modes/master/testvals/xts.1)

| Field | Value |
| --- | --- |
| `cipher` | AES |
| `key` | `fffefdfcfbfaf9f8f7f6f5f4f3f2f1f0bfbebdbcbbbab9b8b7b6b5b4b3b2b1b0` |
| `iv` | `9a785634120000000000000000000000` |
| `input` | `000102030405060708090a0b0c0d0e0f10` |
| `expected` | `6c1625db4671522d3d7599601de7ca09ed` |

**Vector 3** — [IEEE 1619 XTS-AES vector 16 (18 bytes, ciphertext stealing)](https://raw.githubusercontent.com/BrianGladman/modes/master/testvals/xts.1)

| Field | Value |
| --- | --- |
| `cipher` | AES |
| `key` | `fffefdfcfbfaf9f8f7f6f5f4f3f2f1f0bfbebdbcbbbab9b8b7b6b5b4b3b2b1b0` |
| `iv` | `9a785634120000000000000000000000` |
| `input` | `000102030405060708090a0b0c0d0e0f1011` |
| `expected` | `d069444b7a7e0cab09e24447d24deb1fedbf` |

**Vector 4** — [IEEE 1619 XTS-AES vector 17 (19 bytes, ciphertext stealing)](https://raw.githubusercontent.com/BrianGladman/modes/master/testvals/xts.1)

| Field | Value |
| --- | --- |
| `cipher` | AES |
| `key` | `fffefdfcfbfaf9f8f7f6f5f4f3f2f1f0bfbebdbcbbbab9b8b7b6b5b4b3b2b1b0` |
| `iv` | `9a785634120000000000000000000000` |
| `input` | `000102030405060708090a0b0c0d0e0f101112` |
| `expected` | `e5df1351c0544ba1350b3363cd8ef4beedbf9d` |

**Vector 5** — [IEEE 1619 XTS-AES vector 18 (20 bytes, ciphertext stealing)](https://raw.githubusercontent.com/BrianGladman/modes/master/testvals/xts.1)

| Field | Value |
| --- | --- |
| `cipher` | AES |
| `key` | `fffefdfcfbfaf9f8f7f6f5f4f3f2f1f0bfbebdbcbbbab9b8b7b6b5b4b3b2b1b0` |
| `iv` | `9a785634120000000000000000000000` |
| `input` | `000102030405060708090a0b0c0d0e0f10111213` |
| `expected` | `9d84c813f719aa2c7be3f66171c7c5c2edbf9dac` |

---

[← All algorithms](../README.md)
