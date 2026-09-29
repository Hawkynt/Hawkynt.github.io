# AES-CCM

> AES Counter with CBC-MAC authenticated encryption. NIST-standardized AEAD mode combining AES with CBC-MAC for authentication and counter mode for encryption.

## Properties

| Property | Value |
| --- | --- |
| Category | Authenticated Encryption |
| Sub-category | Authenticated Encryption with Associated Data |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Doug Whiting, Russ Housley, Niels Ferguson |
| Year | 2003 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/aead/aes-ccm.js`](../../../algorithms/aead/aes-ccm.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) to 32 bytes (256 bits) in steps of 8 bytes |
| Nonce sizes | 7 bytes (56 bits) to 13 bytes (104 bits) |
| Tag sizes | 4 bytes (32 bits) to 16 bytes (128 bits) in steps of 2 bytes |

## Capabilities

| Flag | Value |
| --- | --- |
| `SupportsDetached` | No |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [RFC 3610 - Counter with CBC-MAC](https://www.rfc-editor.org/rfc/rfc3610)
- [NIST SP 800-38C - CCM Mode Recommendation](https://nvlpubs.nist.gov/nistpubs/legacy/sp/nistspecialpublication800-38c.pdf)
- [NIST CAVP - CCM Validation System](https://csrc.nist.gov/projects/cryptographic-algorithm-validation-program/cavp-testing-block-cipher-modes)

## References

- [Botan CCM Reference Implementation](https://github.com/randombit/botan/tree/master/src/lib/modes/aead/ccm)
- [mbed TLS CCM Reference Implementation](https://github.com/Mbed-TLS/mbedtls/blob/development/library/ccm.c)
- [Crypto++ CCM Reference Implementation](https://github.com/weidai11/cryptopp/blob/master/ccm.h)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [RFC 3610 Packet Vector #1 (L=2, M=8)](https://www.rfc-editor.org/rfc/rfc3610#section-8)

| Field | Value |
| --- | --- |
| `key` | `c0c1c2c3c4c5c6c7c8c9cacbcccdcecf` |
| `nonce` | `00000003020100a0a1a2a3a4a5` |
| `aad` | `0001020304050607` |
| `tagSize` | `8` |
| `input` | `08090a0b0c0d0e0f101112131415161718191a1b1c1d1e` |
| `expected` | `588c979a61c663d2f066d0c2c0f989806d5f6b61dac38417e8d12cfdf926e0` |

**Vector 2** — [RFC 3610 Packet Vector #2 (L=2, M=8)](https://www.rfc-editor.org/rfc/rfc3610#section-8)

| Field | Value |
| --- | --- |
| `key` | `c0c1c2c3c4c5c6c7c8c9cacbcccdcecf` |
| `nonce` | `00000004030201a0a1a2a3a4a5` |
| `aad` | `0001020304050607` |
| `tagSize` | `8` |
| `input` | `08090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `expected` | `72c91a36e135f8cf291ca894085c87e3cc15c439c9e43a3ba091d56e10400916` |

**Vector 3** — [NIST SP 800-38C Appendix C Example 1 (L=8, M=4)](https://nvlpubs.nist.gov/nistpubs/legacy/sp/nistspecialpublication800-38c.pdf)

| Field | Value |
| --- | --- |
| `key` | `404142434445464748494a4b4c4d4e4f` |
| `nonce` | `10111213141516` |
| `aad` | `0001020304050607` |
| `tagSize` | `4` |
| `input` | `20212223` |
| `expected` | `7162015b4dac255d` |

**Vector 4** — [NIST SP 800-38C Appendix C Example 3 (L=4, M=8)](https://nvlpubs.nist.gov/nistpubs/legacy/sp/nistspecialpublication800-38c.pdf)

| Field | Value |
| --- | --- |
| `key` | `404142434445464748494a4b4c4d4e4f` |
| `nonce` | `101112131415161718191a1b` |
| `aad` | `000102030405060708090a0b0c0d0e0f10111213` |
| `tagSize` | `8` |
| `input` | `202122232425262728292a2b2c2d2e2f3031323334353637` |
| `expected` | `e3b201a9f5b71a7a9b1ceaeccd97e70b6176aad9a4428aa5484392fbc1b09951` |

---

[← All algorithms](../README.md)
