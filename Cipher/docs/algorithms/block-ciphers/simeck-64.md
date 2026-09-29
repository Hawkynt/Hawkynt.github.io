# SIMECK-64

> Lightweight 64-bit block cipher combining design principles from SIMON and SPECK. Uses efficient AND-rotation-XOR round function suitable for hardware implementations in resource-constrained devices.

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
| Key sizes | 16 bytes (128 bits) |
| Block sizes | 8 bytes (64 bits) |

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

**Vector 1** — [SIMECK-64 Official Test Vector](https://github.com/weidai11/cryptopp/blob/master/TestVectors/simeck.txt)

| Field | Value |
| --- | --- |
| `key` | `1b1a1918131211100b0a090803020100` |
| `input` | `656b696c20646e75` |
| `expected` | `45ce69025f7ab7ed` |

**Vector 2** — [SIMECK-64 Reference Vector #2](https://github.com/weidai11/cryptopp/blob/master/TestVectors/simeck.txt)

| Field | Value |
| --- | --- |
| `key` | `0938251f43bb8ba606b747de870c3e99` |
| `input` | `f1bbe9ebe16cd6ae` |
| `expected` | `4d11c6b9da2f7e28` |

**Vector 3** — [SIMECK-64 Reference Vector #3](https://github.com/weidai11/cryptopp/blob/master/TestVectors/simeck.txt)

| Field | Value |
| --- | --- |
| `key` | `323ba122444066d09e7d49dc407836fd` |
| `input` | `1cdbae3296f5453b` |
| `expected` | `1e6a0792f5a717c5` |

**Vector 4** — [SIMECK-64 Reference Vector #4](https://github.com/weidai11/cryptopp/blob/master/TestVectors/simeck.txt)

| Field | Value |
| --- | --- |
| `key` | `61ff698f2ddc8e6653bf67d699d5e980` |
| `input` | `b9729d49e18b1fda` |
| `expected` | `fca0fa8194bda9c7` |

**Vector 5** — [SIMECK-64 Reference Vector #5](https://github.com/weidai11/cryptopp/blob/master/TestVectors/simeck.txt)

| Field | Value |
| --- | --- |
| `key` | `cfd3902d597e35cf9e0cf4d52c53cbc9` |
| `input` | `844f4a779d9c1672` |
| `expected` | `562b1caa75266241` |

**Vector 6** — [SIMECK-64 Reference Vector #6](https://github.com/weidai11/cryptopp/blob/master/TestVectors/simeck.txt)

| Field | Value |
| --- | --- |
| `key` | `f8466a046454ceb13b33821fd4618dbe` |
| `input` | `78818744e6d91d2a` |
| `expected` | `d946fa4941516d8e` |

**Vector 7** — [SIMECK-64 Reference Vector #7](https://github.com/weidai11/cryptopp/blob/master/TestVectors/simeck.txt)

| Field | Value |
| --- | --- |
| `key` | `97278a5928ce0bf52543e53cadae2488` |
| `input` | `d0576876162f6768` |
| `expected` | `ca3e5050126fa61b` |

**Vector 8** — [SIMECK-64 Reference Vector #8](https://github.com/weidai11/cryptopp/blob/master/TestVectors/simeck.txt)

| Field | Value |
| --- | --- |
| `key` | `a786c2b5c19be1c0978c2ff11128c18c` |
| `input` | `08614014c9cd68d4` |
| `expected` | `a307ab5aa10f5c29` |

**Vector 9** — [SIMECK-64 Reference Vector #9](https://github.com/weidai11/cryptopp/blob/master/TestVectors/simeck.txt)

| Field | Value |
| --- | --- |
| `key` | `63b126df89a982790c9bb4479cfed971` |
| `input` | `d96ca166d923d155` |
| `expected` | `5e47b40d9854418a` |

**Vector 10** — [SIMECK-64 Reference Vector #10](https://github.com/weidai11/cryptopp/blob/master/TestVectors/simeck.txt)

| Field | Value |
| --- | --- |
| `key` | `463608dc1b2861c93f41078428a11e20` |
| `input` | `3f895ef162e09612` |
| `expected` | `c5fd5a6c32056800` |

---

[← All algorithms](../README.md)
