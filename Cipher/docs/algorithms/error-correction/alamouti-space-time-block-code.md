# Alamouti Space-Time Block Code

> First space-time block code for 2 transmit antennas. Achieves full transmit diversity with simple linear decoding. Used in 3G, 4G LTE, WiFi 802.11n. Orthogonal design: [s1 s2; -s2* s1*]. Rate 1, no bandwidth expansion. Maximum likelihood decoding with simple combining.

## Properties

| Property | Value |
| --- | --- |
| Category | Error Correction |
| Sub-category | Space-Time Code |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Siavash Alamouti |
| Year | 1998 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/ecc/alamouti-code.js`](../../../algorithms/ecc/alamouti-code.js) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Requires 2 Transmit Antennas | Alamouti code is specifically designed for 2 transmit antennas. Extensions to more antennas require different STBC designs. | — |
| Channel Estimation Accuracy | Performance depends critically on accurate channel state information at the receiver. Channel estimation errors degrade diversity gain. | — |
| Frequency-Selective Fading | Original design assumes flat fading. OFDM is typically used to convert frequency-selective channels to multiple flat-fading subcarriers. | — |

## Documentation

- [Alamouti's Original Paper](https://ieeexplore.ieee.org/document/730453)
- [Wikipedia - Alamouti Code](https://en.wikipedia.org/wiki/Alamouti_space%E2%80%93time_code)
- [MIMO-OFDM Wireless Textbook](https://www.cambridge.org/core/books/mimoofdm-wireless-communications-with-matlab/)
- [IEEE 802.11n Standard](https://standards.ieee.org/standard/802_11n-2009.html)
- [3GPP LTE Specifications](https://www.3gpp.org/technologies/keywords-acronyms/98-lte)

## References

- [A Simple Transmit Diversity Technique for Wireless Communications](https://ieeexplore.ieee.org/document/730453)
- [Space-Time Block Codes from Orthogonal Designs](https://ieeexplore.ieee.org/document/730453)
- [IEEE Trans. on Communications, Vol. 46, No. 10, Oct 1998](https://ieeexplore.ieee.org/document/730453)

## Test vectors

8 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Alamouti encoding: [1, 0] -> [1, 0; 0, 1]](https://en.wikipedia.org/wiki/Alamouti_space%E2%80%93time_code)

| Field | Value |
| --- | --- |
| `input` | `0100` |
| `expected` | `01000001` |

**Vector 2** — [Alamouti encoding: [0, 1] -> [0, 1; -1, 0]](https://en.wikipedia.org/wiki/Alamouti_space%E2%80%93time_code)

| Field | Value |
| --- | --- |
| `input` | `0001` |
| `expected` | `[0,1,-1,0]` |

**Vector 3** — [Alamouti encoding: [1, 1] -> [1, 1; -1, 1]](https://en.wikipedia.org/wiki/Alamouti_space%E2%80%93time_code)

| Field | Value |
| --- | --- |
| `input` | `0101` |
| `expected` | `[1,1,-1,1]` |

**Vector 4** — [Alamouti encoding: [-1, 1] -> [-1, 1; -1, -1]](https://ieeexplore.ieee.org/document/730453)

| Field | Value |
| --- | --- |
| `input` | `[-1,1]` |
| `expected` | `[-1,1,-1,-1]` |

**Vector 5** — [Alamouti encoding: [2, -2] -> [2, -2; 2, 2]](https://ieeexplore.ieee.org/document/730453)

| Field | Value |
| --- | --- |
| `input` | `[2,-2]` |
| `expected` | `[2,-2,2,2]` |

**Vector 6** — [Alamouti encoding: [0, 0] -> [0, 0; 0, 0]](https://en.wikipedia.org/wiki/Alamouti_space%E2%80%93time_code)

| Field | Value |
| --- | --- |
| `input` | `0000` |
| `expected` | `00000000` |

**Vector 7** — [IEEE 802.11n pattern: [3, 4]](https://standards.ieee.org/standard/802_11n-2009.html)

| Field | Value |
| --- | --- |
| `input` | `0304` |
| `expected` | `[3,4,-4,3]` |

**Vector 8** — [3GPP LTE pattern: [-2, 3]](https://www.3gpp.org/technologies/keywords-acronyms/98-lte)

| Field | Value |
| --- | --- |
| `input` | `[-2,3]` |
| `expected` | `[-2,3,-3,-2]` |

---

[← All algorithms](../README.md)
