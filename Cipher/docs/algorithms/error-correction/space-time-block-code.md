# Space-Time Block Code

> Orthogonal designs for multi-antenna wireless transmission achieving full diversity. Alamouti 2x1 code generalizes to N transmit antennas. Used in 3G/4G/WiFi (IEEE 802.11n/ac). Achieves maximum diversity gain without channel state information at transmitter. Linear decoding complexity with maximum likelihood performance.

## Properties

| Property | Value |
| --- | --- |
| Category | Error Correction |
| Sub-category | MIMO Code |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Vahid Tarokh, Hamid Jafarkhani, A. Robert Calderbank |
| Year | 1998 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/ecc/space-time-block-code.js`](../../../algorithms/ecc/space-time-block-code.js) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Rate-Diversity Tradeoff | Full-rate STBCs only exist for 2 transmit antennas (Alamouti). Higher antenna counts require rate &lt; 1, reducing throughput for diversity gain. | — |
| Complex Symbol Handling | Orthogonal designs using complex conjugation require complex-valued symbols. Real-valued approximations reduce performance. Educational implementation uses real symbols. | — |
| Channel Estimation Dependency | Performance critically depends on accurate channel state information at receiver. Channel estimation errors degrade diversity benefits and can cause incorrect decoding. | — |
| Frequency-Selective Channels | Assumes flat fading per transmission block. Frequency-selective channels require OFDM or other techniques to create parallel flat-fading channels. | — |

## Documentation

- [Tarokh et al. Original Paper (1999)](https://ieeexplore.ieee.org/document/771146)
- [Space-Time Block Codes from Orthogonal Designs](https://engineering.uci.edu/files/Jafarkhani-Space-Time-Block-Codes-July-1999.pdf)
- [Wikipedia - Space-Time Block Code](https://en.wikipedia.org/wiki/Space%E2%80%93time_block_code)
- [IEEE 802.11n-2009 Standard](https://standards.ieee.org/standard/802_11n-2009.html)
- [3GPP TS 36.211 - LTE Physical Channels](https://www.3gpp.org/DynaReport/36211.htm)

## References

- [IEEE Trans. on Information Theory, Vol. 45, No. 5, July 1999](https://ieeexplore.ieee.org/document/771146)
- [Alamouti: A Simple Transmit Diversity Technique](https://ieeexplore.ieee.org/document/730453)
- [Orthogonal Space-Time Block Codes](https://www.cambridge.org/core/books/space-time-block-coding-for-wireless-communications/)
- [MIMO-OFDM Wireless Communications with MATLAB](https://www.cambridge.org/core/books/mimoofdm-wireless-communications-with-matlab/)

## Test vectors

8 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [2x2 Alamouti STBC: [1, 2] -> Orthogonal matrix](https://ieeexplore.ieee.org/document/730453)

| Field | Value |
| --- | --- |
| `config` | `{"numTxAntennas":2}` |
| `input` | `0102` |
| `expected` | `[1,2,-2,1]` |

**Vector 2** — [2x2 Alamouti STBC: [3, -1] -> Orthogonal matrix](https://ieeexplore.ieee.org/document/730453)

| Field | Value |
| --- | --- |
| `config` | `{"numTxAntennas":2}` |
| `input` | `[3,-1]` |
| `expected` | `[3,-1,1,3]` |

**Vector 3** — [2x2 Alamouti STBC: [0, 0] -> Zero matrix](https://en.wikipedia.org/wiki/Space%E2%80%93time_block_code)

| Field | Value |
| --- | --- |
| `config` | `{"numTxAntennas":2}` |
| `input` | `0000` |
| `expected` | `00000000` |

**Vector 4** — [IEEE 802.11n STBC pattern: [5, 7]](https://standards.ieee.org/standard/802_11n-2009.html)

| Field | Value |
| --- | --- |
| `config` | `{"numTxAntennas":2}` |
| `input` | `0507` |
| `expected` | `[5,7,-7,5]` |

**Vector 5** — [3GPP LTE STTD pattern: [-3, 4]](https://www.3gpp.org/DynaReport/36211.htm)

| Field | Value |
| --- | --- |
| `config` | `{"numTxAntennas":2}` |
| `input` | `[-3,4]` |
| `expected` | `[-3,4,-4,-3]` |

**Vector 6** — [Large symbols: [127, -128]](https://ieeexplore.ieee.org/document/771146)

| Field | Value |
| --- | --- |
| `config` | `{"numTxAntennas":2}` |
| `input` | `[127,-128]` |
| `expected` | `[127,-128,128,127]` |

**Vector 7** — [Multiple symbol blocks: [1, 2, 3, 4]](https://ieeexplore.ieee.org/document/771146)

| Field | Value |
| --- | --- |
| `config` | `{"numTxAntennas":2}` |
| `input` | `01020304` |
| `expected` | `[1,2,-2,1,3,4,-4,3]` |

**Vector 8** — [Orthogonality test: [1, 1]](https://engineering.uci.edu/files/Jafarkhani-Space-Time-Block-Codes-July-1999.pdf)

| Field | Value |
| --- | --- |
| `config` | `{"numTxAntennas":2}` |
| `input` | `0101` |
| `expected` | `[1,1,-1,1]` |

---

[← All algorithms](../README.md)
