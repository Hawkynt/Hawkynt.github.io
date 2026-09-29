# Online Code

> Online Codes are near-optimal rateless erasure codes with linear-time encoding and decoding complexity. They improve upon LT codes by providing better overhead properties (approaching optimal ε overhead). The online property allows real-time encoding where encoded symbols can be generated continuously as source data arrives, making them ideal for streaming applications and peer-to-peer file distribution.

## Properties

| Property | Value |
| --- | --- |
| Category | Error Correction |
| Sub-category | Rateless Code |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Petar Maymounkov, David Mazières |
| Year | 2003 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/ecc/online-code.js`](../../../algorithms/ecc/online-code.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Block sizes | 1 byte (8 bits) to 65536 bytes (524288 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `supportsContinuousEncoding` | Yes |
| `supportsRateless` | Yes |
| `supportsOnlineEncoding` | Yes |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Overhead Requirement | Requires ε overhead beyond k symbols for successful decoding. Insufficient symbols result in decoding failure. | Ensure receiver collects k(1+ε) symbols before attempting decode. Monitor reception quality. |
| Random Number Dependency | Security and correctness depend on quality of degree distribution selection and random seed generation. | Use cryptographically secure random seeds in production. Verify degree distribution matches theoretical requirements. |
| Decoding Failure Probability | Small non-zero probability of decoding failure even with sufficient symbols. Probability controlled by q parameter. | Set q ≥ 3 for failure probability &lt; 0.01. Implement retry mechanism with different seeds on failure. |

## Documentation

- [Online Codes (Wikipedia)](https://en.wikipedia.org/wiki/Fountain_code#Online_codes)
- [Rateless Codes with Optimum Overhead](https://dl.acm.org/doi/10.1145/947864.947874)
- [Network Coding Survey](https://ieeexplore.ieee.org/document/5439036)

## References

- [oclib Online Codes Implementation](https://github.com/vesselinux/oclib)
- [Google gofountain Online Code Implementation](https://github.com/google/gofountain/blob/master/online.go)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — Online Code encoding with k=8, ε=0.25, q=3

Source: Theoretical test vector based on Online Codes paper parameters

| Field | Value |
| --- | --- |
| `k` | `8` |
| `epsilon` | `0.25` |
| `q` | `3` |
| `seed` | `42` |
| `input` | `48656c6c6f212121` |
| `expected` | `48656c6c6f2121212465` |

**Vector 2** — Online Code encoding with k=8, ε=0.25, q=3

Source: Theoretical test vector for sequential input pattern

| Field | Value |
| --- | --- |
| `k` | `8` |
| `epsilon` | `0.25` |
| `q` | `3` |
| `seed` | `12345` |
| `input` | `0102030405060708` |
| `expected` | `01020304050607080c05` |

**Vector 3** — Online Code encoding with k=8, ε=0.25, q=3

Source: Theoretical test vector for varied byte pattern

| Field | Value |
| --- | --- |
| `k` | `8` |
| `epsilon` | `0.25` |
| `q` | `3` |
| `seed` | `98765` |
| `input` | `aabbccddeeff0011` |
| `expected` | `aabbccddeeff00115500` |

**Vector 4** — Online Code encoding with k=8, ε=0.25, q=3

Source: Theoretical test vector for alternating byte pattern

| Field | Value |
| --- | --- |
| `k` | `8` |
| `epsilon` | `0.25` |
| `q` | `3` |
| `seed` | `54321` |
| `input` | `ffffffff00000000` |
| `expected` | `ffffffff00000000ff00` |

---

[← All algorithms](../README.md)
