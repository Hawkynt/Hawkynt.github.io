# ZUC-128-MAC

> 3GPP integrity algorithm 128-EIA3 for LTE/4G mobile communications. Uses ZUC-128 stream cipher to generate keystream and processes message bits to produce 32-bit authentication tag.

## Properties

| Property | Value |
| --- | --- |
| Category | Message Authentication |
| Sub-category | Stream Cipher MAC |
| Security status | 🛡️ Secure |
| Complexity | Advanced |
| Inventor | DACAS (Data Assurance and Communication Security Research Center) |
| Year | 2011 |
| Origin | 🇨🇳 China |
| Source | [`algorithms/mac/zuc128mac.js`](../../../algorithms/mac/zuc128mac.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) |
| Nonce sizes | 16 bytes (128 bits) |
| MAC sizes | 4 bytes (32 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `NeedsKey` | Yes |
| `NeedsNonce` | Yes |

## Security

**Status:** 🛡️ Secure

No vulnerabilities are recorded for this implementation.

## Documentation

- [3GPP TS 35.221 - ZUC Specification](https://www.3gpp.org/ftp/Specs/archive/35_series/35.221/)
- [ZUC-128 EIA3 Specification](https://www.gsma.com/aboutus/wp-content/uploads/2014/12/eea3eia3zucv16.pdf)
- [3GPP Security Algorithms](https://www.3gpp.org/technologies/keywords-acronyms/100-the-3gpp-security-algorithms)

## References

- [GmSSL ZUC/128-EIA3 Implementation](https://github.com/guanzhi/GmSSL/blob/master/src/zuc.c)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [3GPP ZUC-128-MAC Test 1 - 400 bits of zeros](https://www.gsma.com/aboutus/wp-content/uploads/2014/12/eea3eia3zucv16.pdf)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000` |
| `iv` | `00000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 0000` |
| `expected` | `508dd5ff` |

**Vector 2** — [3GPP ZUC-128-MAC Test 2 - 4000 bits of 0x11](https://www.gsma.com/aboutus/wp-content/uploads/2014/12/eea3eia3zucv16.pdf)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000` |
| `iv` | `00000000000000000000000000000000` |
| `input` | `11111111111111111111111111111111 11111111111111111111111111111111 11111111111111111111111111111111 11111111111111111111111111111111 …` (500 bytes; the full value is in the source) |
| `expected` | `fbed4c12` |

**Vector 3** — [3GPP ZUC-128-MAC Test 3 - 400 bits of zeros, all-ones key/IV](https://www.gsma.com/aboutus/wp-content/uploads/2014/12/eea3eia3zucv16.pdf)

| Field | Value |
| --- | --- |
| `key` | `ffffffffffffffffffffffffffffffff` |
| `iv` | `ffffffffffffffffffffffffffffffff` |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 0000` |
| `expected` | `55e01504` |

**Vector 4** — [3GPP ZUC-128-MAC Test 4 - 4000 bits of 0x11, all-ones key/IV](https://www.gsma.com/aboutus/wp-content/uploads/2014/12/eea3eia3zucv16.pdf)

| Field | Value |
| --- | --- |
| `key` | `ffffffffffffffffffffffffffffffff` |
| `iv` | `ffffffffffffffffffffffffffffffff` |
| `input` | `11111111111111111111111111111111 11111111111111111111111111111111 11111111111111111111111111111111 11111111111111111111111111111111 …` (500 bytes; the full value is in the source) |
| `expected` | `9ce9a0c4` |

---

[← All algorithms](../README.md)
