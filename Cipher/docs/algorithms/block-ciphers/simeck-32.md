# SIMECK-32

> Lightweight 32-bit block cipher combining design principles from SIMON and SPECK. Uses efficient AND-rotation-XOR round function suitable for hardware implementations in resource-constrained devices.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Lightweight Block Cipher |
| Security status | Not classified |
| Complexity | Intermediate |
| Inventor | Gangqiang Yang, Bo Zhu, Valentin Suder, Mark D. Aagaard, Guang Gong |
| Year | 2015 |
| Origin | 🇨🇦 Canada |
| Source | [`algorithms/block/simeck.js`](../../../algorithms/block/simeck.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 8 bytes (64 bits) |
| Block sizes | 4 bytes (32 bits) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [The Simeck Family of Lightweight Block Ciphers](https://eprint.iacr.org/2015/612.pdf)
- [Crypto++ SIMECK Implementation](https://github.com/weidai11/cryptopp/blob/master/simeck.cpp)

## References

- [Bo Zhu Simeck Reference Implementation (C/Python)](https://github.com/bozhu/Simeck)
- [DFA_Simeck Implementation (C)](https://github.com/dple/DFA_Simeck)

## Test vectors

10 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [SIMECK-32 Official Test Vector](https://github.com/weidai11/cryptopp/blob/master/TestVectors/simeck.txt)

| Field | Value |
| --- | --- |
| `key` | `1918111009080100` |
| `input` | `65656877` |
| `expected` | `770d2c76` |

**Vector 2** — [SIMECK-32 Reference Vector #2](https://github.com/weidai11/cryptopp/blob/master/TestVectors/simeck.txt)

| Field | Value |
| --- | --- |
| `key` | `3d6c4ae1678418be` |
| `input` | `48230029` |
| `expected` | `65359de9` |

**Vector 3** — [SIMECK-32 Reference Vector #3](https://github.com/weidai11/cryptopp/blob/master/TestVectors/simeck.txt)

| Field | Value |
| --- | --- |
| `key` | `6df116495f906952` |
| `input` | `72ae2cd6` |
| `expected` | `0ab073ca` |

**Vector 4** — [SIMECK-32 Reference Vector #4](https://github.com/weidai11/cryptopp/blob/master/TestVectors/simeck.txt)

| Field | Value |
| --- | --- |
| `key` | `2ea60bb301eb26e9` |
| `input` | `41bb5af1` |
| `expected` | `6ed0bc2e` |

**Vector 5** — [SIMECK-32 Reference Vector #5](https://github.com/weidai11/cryptopp/blob/master/TestVectors/simeck.txt)

| Field | Value |
| --- | --- |
| `key` | `00990f3e390c7e87` |
| `input` | `153c12db` |
| `expected` | `76374119` |

**Vector 6** — [SIMECK-32 Reference Vector #6](https://github.com/weidai11/cryptopp/blob/master/TestVectors/simeck.txt)

| Field | Value |
| --- | --- |
| `key` | `4db74d06491c440d` |
| `input` | `305e0124` |
| `expected` | `8252aa91` |

**Vector 7** — [SIMECK-32 Reference Vector #7](https://github.com/weidai11/cryptopp/blob/master/TestVectors/simeck.txt)

| Field | Value |
| --- | --- |
| `key` | `4dc8074d2d1239b3` |
| `input` | `54de1547` |
| `expected` | `e288e7ea` |

**Vector 8** — [SIMECK-32 Reference Vector #8](https://github.com/weidai11/cryptopp/blob/master/TestVectors/simeck.txt)

| Field | Value |
| --- | --- |
| `key` | `5d03701f26a6428b` |
| `input` | `66bb6443` |
| `expected` | `b73099ae` |

**Vector 9** — [SIMECK-32 Reference Vector #9](https://github.com/weidai11/cryptopp/blob/master/TestVectors/simeck.txt)

| Field | Value |
| --- | --- |
| `key` | `1e1f3b2512384509` |
| `input` | `767d7a5a` |
| `expected` | `058a62df` |

**Vector 10** — [SIMECK-32 Reference Vector #10](https://github.com/weidai11/cryptopp/blob/master/TestVectors/simeck.txt)

| Field | Value |
| --- | --- |
| `key` | `7ff57f966bfc63cb` |
| `input` | `1ad46e5d` |
| `expected` | `60c443f2` |

---

[← All algorithms](../README.md)
