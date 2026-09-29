# SEED-WRAP

> RFC 4010 SEED Key Wrap algorithm. Provides authenticated encryption for key material using SEED block cipher with RFC 3394 key wrap structure. Ensures both confidentiality and integrity of wrapped keys.

## Properties

| Property | Value |
| --- | --- |
| Category | Special Algorithms |
| Sub-category | Key Wrapping |
| Security status | 🛡️ Secure |
| Complexity | Intermediate |
| Inventor | Korea Internet Security Agency (KISA) / IETF |
| Year | 2005 |
| Origin | 🇰🇷 South Korea |
| Source | [`algorithms/crypto/seedwrap.js`](../../../algorithms/crypto/seedwrap.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) |

## Security

**Status:** 🛡️ Secure

No vulnerabilities are recorded for this implementation.

## Documentation

- [RFC 4010 - SEED Key Wrap](https://tools.ietf.org/rfc/rfc4010.txt)
- [RFC 3394 - AES Key Wrap Algorithm](https://tools.ietf.org/rfc/rfc3394.txt)
- [RFC 4269 - SEED Encryption Algorithm](https://tools.ietf.org/rfc/rfc4269.txt)

## References

- [Bouncy Castle SEEDWrapEngine](https://github.com/bcgit/bc-java/blob/main/core/src/main/java/org/bouncycastle/crypto/engines/SEEDWrapEngine.java)
- [NIST SP 800-38F - Key Wrap Modes](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-38F.pdf)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [SEED-WRAP 128-bit KEK wrapping 128-bit key](https://tools.ietf.org/rfc/rfc4010.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `00112233445566778899aabbccddeeff` |
| `expected` | `bf71f77138b5afea05232a8dad54024e812dc8dd7d132559` |

**Vector 2** — [SEED-WRAP single 64-bit block (simplified algorithm)](https://tools.ietf.org/rfc/rfc3394.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `0001020304050607` |
| `expected` | `bff44891b9801360b718dbaaa5083596` |

**Vector 3** — [SEED-WRAP wrapping 192-bit key](https://tools.ietf.org/rfc/rfc4010.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `00112233445566778899aabbccddeeff0001020304050607` |
| `expected` | `405bbc1a0f41638d8fac416726d69f4d64742da5a8702b34858a395eda259aef` |

---

[← All algorithms](../README.md)
