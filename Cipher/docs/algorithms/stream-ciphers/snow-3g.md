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
- [3GPP TS 35.217: Implementors' Test Data](https://www.3gpp.org/ftp/Specs/archive/35_series/35.217/)
- [ETSI/SAGE Specification](https://www.gsma.com/aboutus/wp-content/uploads/2014/12/snow3gspec.pdf)
- [Wikipedia: SNOW](https://en.wikipedia.org/wiki/SNOW)

## References

- [CryptoMobile C Reference (ETSI/SAGE-derived)](https://github.com/mitshell/CryptoMobile)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [3GPP TS 35.217 SNOW 3G Test Set 1](https://www.3gpp.org/ftp/Specs/archive/35_series/35.217/)

| Field | Value |
| --- | --- |
| `key` | `2bd6459f82c5b300952c49104881ff48` |
| `iv` | `ea024714ad5c4d84df1f9b251c0bf45f` |
| `input` | `0000000000000000` |
| `expected` | `abee97047ac31373` |

**Vector 2** — [3GPP TS 35.217 SNOW 3G Test Set 2](https://www.3gpp.org/ftp/Specs/archive/35_series/35.217/)

| Field | Value |
| --- | --- |
| `key` | `8ce33e2cc3c0b5fc1f3de8a6dc66b1f3` |
| `iv` | `d3c5d592327fb11cde551988ceb2f9b7` |
| `input` | `0000000000000000` |
| `expected` | `eff8a342f751480f` |

**Vector 3** — [3GPP TS 35.217 SNOW 3G Test Set 3](https://www.3gpp.org/ftp/Specs/archive/35_series/35.217/)

| Field | Value |
| --- | --- |
| `key` | `4035c6680af8c6d1a8ff8667b1714013` |
| `iv` | `62a540981ba6f9b74592b0e78690f71b` |
| `input` | `0000000000000000` |
| `expected` | `a8c874a97ae7c4f8` |

**Vector 4** — [3GPP TS 35.217 SNOW 3G Test Set 4](https://www.3gpp.org/ftp/Specs/archive/35_series/35.217/)

| Field | Value |
| --- | --- |
| `key` | `0ded7263109cf92e3352255a140e0f76` |
| `iv` | `6b68079a41a7c4c91befd79f7fdcc233` |
| `input` | `0000000000000000` |
| `expected` | `d712c05ca937c2a6` |

---

[← All algorithms](../README.md)
