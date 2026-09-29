# TOTP

> Time-Based One-Time Password algorithm as defined in RFC 6238. Generates time-dependent OTPs using HMAC for two-factor authentication, synchronized by time between client and server with 30-second default window.

## Properties

| Property | Value |
| --- | --- |
| Category | Special Algorithms |
| Sub-category | One-Time Password |
| Security status | 🛡️ Secure |
| Complexity | Beginner |
| Inventor | David M'Raihi, Johan Rydell, Mingliang Pei, Salah Machani |
| Year | 2011 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/special/totp.js`](../../../algorithms/special/totp.js) |

## Security

**Status:** 🛡️ Secure

No vulnerabilities are recorded for this implementation.

## Documentation

- [RFC 6238 - TOTP: Time-Based One-Time Password Algorithm](https://tools.ietf.org/rfc/rfc6238.txt)
- [OATH TOTP Specification](https://openauthentication.org/specifications-technical-resources/)

## References

- [Botan TOTP Test Vectors](https://github.com/randombit/botan/blob/master/src/tests/data/otp/totp.vec)
- [Google Authenticator Compatibility](https://github.com/google/google-authenticator)

## Test vectors

5 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [RFC 6238 TOTP Test Vector - SHA1 @ 59s (8 digits)](https://tools.ietf.org/rfc/rfc6238.txt)

| Field | Value |
| --- | --- |
| `key` | `3132333435363738393031323334353637383930` |
| `timestamp` | `59` |
| `timestep` | `30` |
| `digits` | `8` |
| `hashAlgorithm` | SHA-1 |
| `input` | _(empty)_ |
| `expected` | `3934323837303832` |

**Vector 2** — [RFC 6238 TOTP Test Vector - SHA1 @ 1111111109s (8 digits)](https://tools.ietf.org/rfc/rfc6238.txt)

| Field | Value |
| --- | --- |
| `key` | `3132333435363738393031323334353637383930` |
| `timestamp` | `1111111109` |
| `timestep` | `30` |
| `digits` | `8` |
| `hashAlgorithm` | SHA-1 |
| `input` | _(empty)_ |
| `expected` | `3037303831383034` |

**Vector 3** — [RFC 6238 TOTP Test Vector - SHA1 @ 1234567890s (8 digits)](https://tools.ietf.org/rfc/rfc6238.txt)

| Field | Value |
| --- | --- |
| `key` | `3132333435363738393031323334353637383930` |
| `timestamp` | `1234567890` |
| `timestep` | `30` |
| `digits` | `8` |
| `hashAlgorithm` | SHA-1 |
| `input` | _(empty)_ |
| `expected` | `3839303035393234` |

**Vector 4** — [RFC 6238 TOTP Test Vector - SHA256 @ 59s (8 digits)](https://tools.ietf.org/rfc/rfc6238.txt)

| Field | Value |
| --- | --- |
| `key` | `3132333435363738393031323334353637383930313233343536373839303132` |
| `timestamp` | `59` |
| `timestep` | `30` |
| `digits` | `8` |
| `hashAlgorithm` | SHA-256 |
| `input` | _(empty)_ |
| `expected` | `3436313139323436` |

**Vector 5** — [RFC 6238 TOTP Test Vector - SHA512 @ 59s (8 digits)](https://tools.ietf.org/rfc/rfc6238.txt)

| Field | Value |
| --- | --- |
| `key` | `31323334353637383930313233343536 37383930313233343536373839303132 33343536373839303132333435363738 39303132333435363738393031323334` |
| `timestamp` | `59` |
| `timestep` | `30` |
| `digits` | `8` |
| `hashAlgorithm` | SHA-512 |
| `input` | _(empty)_ |
| `expected` | `3930363933393336` |

---

[← All algorithms](../README.md)
