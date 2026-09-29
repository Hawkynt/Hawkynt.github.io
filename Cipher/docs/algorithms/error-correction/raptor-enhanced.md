# Raptor (Enhanced)

> Enhanced systematic rateless fountain code achieving near-optimal overhead with linear-time encoding and decoding. Two-stage architecture combines LDPC pre-coding with LT codes using RFC 5053 standardized parameters. Supports systematic mode, inactivation decoding, and configurable redundancy levels. Used in 3GPP MBMS, DVB-H mobile broadcasting, and reliable multicast protocols.

## Properties

| Property | Value |
| --- | --- |
| Category | Error Correction |
| Sub-category | Fountain Code |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Amin Shokrollahi |
| Year | 2006 |
| Origin | 🇨🇭 Switzerland |
| Source | [`algorithms/ecc/raptor-enhanced.js`](../../../algorithms/ecc/raptor-enhanced.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Block sizes | 4 bytes (32 bits) to 8192 bytes (65536 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `supportsContinuousEncoding` | Yes |
| `supportsRateless` | Yes |
| `isSystematic` | Yes |
| `supportsInactivationDecoding` | Yes |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [RFC 5053 - Raptor FEC Scheme](https://tools.ietf.org/html/rfc5053)
- [Raptor Codes (IEEE)](https://ieeexplore.ieee.org/document/1490914)
- [3GPP TS 26.346 - MBMS with Raptor](https://www.3gpp.org/dynareport/26346.htm)
- [Raptor Code - Wikipedia](https://en.wikipedia.org/wiki/Raptor_code)

## References

- [freeRaptor RFC 5053 (R10) Implementation](https://github.com/obolo/freeRaptor)
- [RaptorCodes_Cplusplus Encoder/Decoder](https://github.com/ywu40/RaptorCodes_Cplusplus)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [RFC 5053 K=4 systematic encoding with J(K)=10](https://tools.ietf.org/html/rfc5053#section-5.7)

| Field | Value |
| --- | --- |
| `k` | `4` |
| `symbolSize` | `1` |
| `targetOverhead` | `0.25` |
| `input` | `48656c6c` |
| `expected` | `48656c6c00` |

**Vector 2** — [RFC 5053 K=8 systematic encoding with J(K)=11](https://tools.ietf.org/html/rfc5053#section-5.7)

| Field | Value |
| --- | --- |
| `k` | `8` |
| `symbolSize` | `1` |
| `targetOverhead` | `0.125` |
| `input` | `48656c6c6f576f72` |
| `expected` | `48656c6c6f576f7200` |

**Vector 3** — [RFC 5053 K=16 systematic encoding with J(K)=12](https://tools.ietf.org/html/rfc5053#section-5.7)

| Field | Value |
| --- | --- |
| `k` | `16` |
| `symbolSize` | `1` |
| `targetOverhead` | `0.0625` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `000102030405060708090a0b0c0d0e0f00` |

---

[← All algorithms](../README.md)
