# Tail-Biting Convolutional Code

> Convolutional codes where ending state equals starting state, eliminating rate loss from tailing bits. Used in 802.11 WiFi, LTE control channels, satellite communications. No zero-padding needed. Circular trellis structure. Viterbi decoding starts from all possible initial states. Achieves full rate without truncation.

## Properties

| Property | Value |
| --- | --- |
| Category | Error Correction |
| Sub-category | Convolutional Code |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Howard Ma, Jack Wolf |
| Year | 1986 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/ecc/tail-biting-convolutional.js`](../../../algorithms/ecc/tail-biting-convolutional.js) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Decoding Complexity | Must try all possible starting states in Viterbi decoding. Complexity is S times standard Viterbi, where S is number of encoder states. For K=3 (4 states), overhead is 4x. | — |
| Short Block Performance | Tail-biting advantage diminishes for long blocks where rate loss from tailing bits becomes negligible. Most beneficial for blocks of 40-500 bits. Longer blocks should use zero-termination. | — |
| Synchronization | Requires proper frame synchronization. Block boundaries must be known precisely or tail-biting constraint will be violated, causing significant performance degradation. | — |

## Documentation

- [Wikipedia - Convolutional Code](https://en.wikipedia.org/wiki/Convolutional_code)
- [IEEE 802.11 Specification](https://standards.ieee.org/standard/802_11-2020.html)
- [3GPP TS 36.212 - LTE Tail-Biting](https://www.3gpp.org/ftp/Specs/archive/36_series/36.212/)
- [Tail-Biting Tutorial](https://www.mathworks.com/help/comm/ug/tail-biting-convolutional-coding.html)

## References

- [Ma-Wolf 1986 - Tail Biting Convolutional Codes](https://ieeexplore.ieee.org/document/1096538)
- [On Tail Biting Convolutional Codes](https://doi.org/10.1109/TCOM.1986.1096538)
- [LTE Physical Layer Overview](https://www.sharetechnote.com/html/PhysicalChannel_LTE.html)
- [802.11n Tail-Biting Implementation](https://www.ieee802.org/11/Reports/tgn_update.htm)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Tail-biting K=3 all zeros (state 00->00)](https://www.3gpp.org/ftp/Specs/archive/36_series/36.212/)

| Field | Value |
| --- | --- |
| `input` | `00000000` |
| `expected` | `0000000000000000` |

**Vector 2** — [Tail-biting K=3 pattern 1100 (state 00->00)](https://standards.ieee.org/standard/802_11-2020.html)

| Field | Value |
| --- | --- |
| `input` | `01010000` |
| `expected` | `0101000100010101` |

**Vector 3** — [Tail-biting K=3 pattern 0110 (state 10->10)](https://www.3gpp.org/ftp/Specs/archive/36_series/36.212/)

| Field | Value |
| --- | --- |
| `input` | `00010100` |
| `expected` | `0101010100010001` |

**Vector 4** — [Tail-biting K=3 pattern 1001 (state 01->01)](https://standards.ieee.org/standard/802_11-2020.html)

| Field | Value |
| --- | --- |
| `input` | `01000001` |
| `expected` | `0001000101010101` |

---

[← All algorithms](../README.md)
