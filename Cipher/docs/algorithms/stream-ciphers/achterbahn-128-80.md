# Achterbahn-128/80

> NLFSR-based stream cipher from the eSTREAM project: 13 nonlinear feedback shift registers of lengths 21 to 33 feed a Boolean combining function. Achterbahn-80 takes an 80-bit key and uses 11 registers, Achterbahn-128 a 128-bit key and all 13. BROKEN - multiple cryptanalytic attacks exist. DO NOT USE in production.

## Properties

| Property | Value |
| --- | --- |
| Category | Stream Ciphers |
| Sub-category | NLFSR Stream Cipher |
| Security status | ❌ Broken |
| Complexity | Expert |
| Inventor | Berndt Gammel, Rainer Göttfert, Oliver Kniffler (Infineon Technologies) |
| Year | 2006 |
| Origin | 🇩🇪 Germany |
| Source | [`algorithms/stream/achterbahn.js`](../../../algorithms/stream/achterbahn.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 10 bytes (80 bits); 16 bytes (128 bits) |
| Nonce sizes | 0 bytes (0 bits) to 16 bytes (128 bits) |

## Security

**Status:** ❌ Broken

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Distinguishing Attack | Linear distinguishing attacks can distinguish keystream from random with practical complexity | DO NOT USE - cipher is cryptographically broken |
| Key Recovery Attack | Practical key recovery attacks demonstrated against both 80-bit and 128-bit variants | DO NOT USE - fundamental design flaws exist |
| Correlation Attack | NLFSR correlation attacks reduce effective security below key length | DO NOT USE - not suitable for any production use |

## Documentation

- [eSTREAM Achterbahn Specification](https://www.ecrypt.eu.org/stream/p3ciphers/achterbahn/achterbahn_p3.pdf)
- [Achterbahn Official Site](https://www.matpack.de/achterbahn/specification.html)
- [Wikipedia: Achterbahn](https://en.wikipedia.org/wiki/Achterbahn_(cipher))

## References

- [Achterbahn-128/80 C Reference Implementation (Gammel, Göttfert, Kniffler)](https://github.com/crocs-muni/CryptoStreams/blob/master/streams/stream_ciphers/estream/achterbahn/achterbahn-128-80.cpp)
- [SUPERCOP Benchmarking Suite (includes eSTREAM submission sources)](https://bench.cr.yp.to/supercop.html)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Achterbahn-80 reference keystream: key 01..0a, IV 01..0a](https://github.com/crocs-muni/CryptoStreams/blob/master/streams/stream_ciphers/estream/achterbahn/achterbahn-128-80.cpp)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a` |
| `iv` | `0102030405060708090a` |
| `input` | `0000000000000000000000000000000000000000000000000000000000000000` |
| `expected` | `e59cd632f3f1af7da47e19ff46651f38103a29f2f655edc07f5d6d2dd62a96aa` |

**Vector 2** — [Achterbahn-128 reference keystream: key 01..10, IV 01..10](https://github.com/crocs-muni/CryptoStreams/blob/master/streams/stream_ciphers/estream/achterbahn/achterbahn-128-80.cpp)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f10` |
| `iv` | `0102030405060708090a0b0c0d0e0f10` |
| `input` | `0000000000000000000000000000000000000000000000000000000000000000` |
| `expected` | `df71f042738f6d9ec21d896d0cc12baf54c8ce55a6507a1243b471c2cdf0ec42` |

**Vector 3** — [DarkCrypt Achterbahn-128 — non-zero key and IV, 48-byte message (verified against the DarkCrypt implementation)](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0b30557a9fc4e90e33587da2c7ec1136` |
| `iv` | `073c71a6db10457aafe4194e83b8ed22` |
| `input` | `03203d5a7794b1ceeb0825425f7c99b6 d3f00d2a4764819ebbd8f5122f4c6986 a3c0ddfa1734516e8ba8c5e2ff1c3956` |
| `expected` | `6dd3c8f5a6d34d8fb506c8d60b6b6107 8079cdca88da26e16427f60a9d02e0cf 30524272d3b3f951a7a7076cb4ed211b` |

---

[← All algorithms](../README.md)
