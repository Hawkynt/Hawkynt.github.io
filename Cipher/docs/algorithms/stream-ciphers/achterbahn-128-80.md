# Achterbahn-128/80

> NLFSR-based stream cipher from eSTREAM project. BROKEN - multiple cryptanalytic attacks exist. DO NOT USE in production. Supports 80-bit and 128-bit keys with 10-13 NLFSRs.

## Properties

| Property | Value |
| --- | --- |
| Category | Stream Ciphers |
| Sub-category | NLFSR Stream Cipher |
| Security status | ❌ Broken |
| Complexity | Expert |
| Inventor | Berndt Gammel, Rainer Göttfert, Oliver Kniffler (Infineon Technologies) |
| Year | 2005 |
| Origin | 🇩🇪 Germany |
| Source | [`algorithms/stream/achterbahn.js`](../../../algorithms/stream/achterbahn.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 10 bytes (80 bits) to 16 bytes (128 bits) |
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

1 vector ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — Achterbahn-128 Functionality Test (BROKEN CIPHER - DO NOT USE)

Source: Research-derived for validation only

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `iv` | `0011223344556677` |
| `input` | `48656c6c6f20576f726c64` |
| `expected` | `9bf6a4199a0c2911440125` |

---

[← All algorithms](../README.md)
