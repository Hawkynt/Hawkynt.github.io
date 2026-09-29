# OCB

> OCB (Offset CodeBook) is an authenticated encryption mode that provides both confidentiality and authenticity in a single pass. It uses offset-based processing that allows for parallel computation while maintaining strong security guarantees. OCB is highly efficient but was patent-encumbered until 2028.

## Properties

| Property | Value |
| --- | --- |
| Category | Cipher Modes |
| Sub-category | Authenticated Encryption |
| Security status | 🧪 Experimental |
| Complexity | Research |
| Inventor | Phillip Rogaway |
| Year | 2001 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/modes/ocb.js`](../../../algorithms/modes/ocb.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| IV sizes | 12 bytes (96 bits) to 15 bytes (120 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `RequiresIV` | Yes |

## Security

**Status:** 🧪 Experimental

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Patent Status | OCB was patent-encumbered until 2028, limiting adoption. Now free for use but still not widely deployed. | — |
| Nonce Reuse | Reusing nonces with the same key completely breaks OCB security and reveals plaintext patterns. | — |
| Implementation Complexity | OCB requires careful implementation of offset calculations and GF(2^128) arithmetic. | — |

## Documentation

- [RFC 7253 - OCB Authenticated Encryption](https://tools.ietf.org/rfc/rfc7253.txt)
- [OCB Original Paper](https://web.cs.ucdavis.edu/~rogaway/papers/ocb-full.pdf)
- [OCB3 Specification](https://web.cs.ucdavis.edu/~rogaway/ocb/ocb-back.htm)

## References

- [OCB Reference Implementation](https://github.com/rweather/arduinolibs/tree/master/libraries/Crypto)
- [LibOCB](https://github.com/rweather/arduinolibs/blob/master/libraries/Crypto/OCB.cpp)
- [Python OCB](https://github.com/Legrandin/pycryptodome/blob/master/lib/Crypto/Cipher/_mode_ocb.py)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [OCB round-trip test #1 - 1 byte](https://web.cs.ucdavis.edu/~rogaway/ocb/)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `bbaa99887766554433221100` |
| `aad` | _(empty)_ |
| `tagLength` | `16` |
| `input` | `01` |
| `expected` | _(empty)_ |

**Vector 2** — [OCB round-trip test #2 - 8-byte plaintext](https://web.cs.ucdavis.edu/~rogaway/ocb/)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `bbaa99887766554433221101` |
| `aad` | _(empty)_ |
| `tagLength` | `16` |
| `input` | `0001020304050607` |
| `expected` | _(empty)_ |

**Vector 3** — [OCB round-trip test #3 - With AAD](https://web.cs.ucdavis.edu/~rogaway/ocb/)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `bbaa99887766554433221102` |
| `aad` | `0001020304050607` |
| `tagLength` | `16` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | _(empty)_ |

---

[← All algorithms](../README.md)
