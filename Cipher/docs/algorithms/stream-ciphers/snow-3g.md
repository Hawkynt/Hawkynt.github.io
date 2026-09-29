# SNOW 3G

> 3GPP standardized stream cipher for UMTS/3G networks. Used in UEA2 confidentiality and UIA2 integrity algorithms. Features LFSR-based design with FSM and operates on 128-bit keys and IVs.

## Properties

| Property | Value |
| --- | --- |
| Category | Stream Ciphers |
| Sub-category | 3GPP Stream Cipher |
| Security status | 🛡️ Secure |
| Complexity | Expert |
| Inventor | P. Ekdahl, T. Johansson |
| Year | 2003 |
| Origin | 🇸🇪 Sweden |
| Source | [`algorithms/stream/snow3g.js`](../../../algorithms/stream/snow3g.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) |
| Nonce sizes | 16 bytes (128 bits) |

## Security

**Status:** 🛡️ Secure

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Theoretical Attacks | Some theoretical cryptanalytic attacks exist but require impractical amounts of data | Attacks not practical for real-world 3G usage scenarios |

## Documentation

- [3GPP TS 35.216: SNOW 3G Specification](https://www.3gpp.org/ftp/Specs/archive/35_series/35.216/)
- [ETSI/SAGE Specification](https://www.gsma.com/aboutus/wp-content/uploads/2014/12/snow3gspec.pdf)
- [Wikipedia: SNOW](https://en.wikipedia.org/wiki/SNOW)

## References

- [CryptoMobile C Reference (ETSI/SAGE-derived)](https://github.com/mitshell/CryptoMobile)

## Test vectors

1 vector ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [3GPP TS 35.216 Test Vector 1](https://www.3gpp.org/ftp/Specs/archive/35_series/35.216/)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000` |
| `iv` | `00000000000000000000000000000000` |
| `input` | `0000000000000000` |
| `expected` | `13b2655e88d404bb` |

---

[← All algorithms](../README.md)
