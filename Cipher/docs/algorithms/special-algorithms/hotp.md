# HOTP

> HMAC-Based One-Time Password algorithm as defined in RFC 4226. Generates time-independent OTPs using HMAC-SHA1 for two-factor authentication, synchronized by counter value between client and server.

## Properties

| Property | Value |
| --- | --- |
| Category | Special Algorithms |
| Sub-category | One-Time Password |
| Security status | 🛡️ Secure |
| Complexity | Beginner |
| Inventor | David M'Raihi, Mihir Bellare, Frank Hoornaert, David Naccache, Ohad Ranen |
| Year | 2005 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/special/hotp.js`](../../../algorithms/special/hotp.js) |

## Security

**Status:** 🛡️ Secure

No vulnerabilities are recorded for this implementation.

## Documentation

- [RFC 4226 - HOTP: An HMAC-Based One-Time Password Algorithm](https://tools.ietf.org/rfc/rfc4226.txt)
- [OATH HOTP Specification](https://openauthentication.org/specifications-technical-resources/)

## References

- [Botan HOTP Test Vectors](https://github.com/randombit/botan/blob/master/src/tests/data/otp/hotp.vec)
- [Google Authenticator Compatibility](https://github.com/google/google-authenticator)

## Test vectors

5 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [RFC 4226 HOTP Test Vector - Counter 0 (6 digits)](https://tools.ietf.org/rfc/rfc4226.txt)

| Field | Value |
| --- | --- |
| `key` | `3132333435363738393031323334353637383930` |
| `counter` | `0` |
| `digits` | `6` |
| `input` | _(empty)_ |
| `expected` | `373535323234` |

**Vector 2** — [RFC 4226 HOTP Test Vector - Counter 1 (6 digits)](https://tools.ietf.org/rfc/rfc4226.txt)

| Field | Value |
| --- | --- |
| `key` | `3132333435363738393031323334353637383930` |
| `counter` | `1` |
| `digits` | `6` |
| `input` | _(empty)_ |
| `expected` | `323837303832` |

**Vector 3** — [RFC 4226 HOTP Test Vector - Counter 2 (6 digits)](https://tools.ietf.org/rfc/rfc4226.txt)

| Field | Value |
| --- | --- |
| `key` | `3132333435363738393031323334353637383930` |
| `counter` | `2` |
| `digits` | `6` |
| `input` | _(empty)_ |
| `expected` | `333539313532` |

**Vector 4** — [RFC 4226 HOTP Test Vector - Counter 7 (7 digits)](https://tools.ietf.org/rfc/rfc4226.txt)

| Field | Value |
| --- | --- |
| `key` | `3132333435363738393031323334353637383930` |
| `counter` | `7` |
| `digits` | `7` |
| `input` | _(empty)_ |
| `expected` | `32313632353833` |

**Vector 5** — [RFC 4226 HOTP Test Vector - Counter 8 (8 digits)](https://github.com/randombit/botan/blob/master/src/tests/data/otp/hotp.vec)

| Field | Value |
| --- | --- |
| `key` | `3132333435363738393031323334353637383930` |
| `counter` | `8` |
| `digits` | `8` |
| `input` | _(empty)_ |
| `expected` | `3733333939383731` |

---

[← All algorithms](../README.md)
