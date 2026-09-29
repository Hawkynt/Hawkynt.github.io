# Trivium

> Hardware-oriented NLFSR-based stream cipher using three interconnected shift registers. eSTREAM hardware portfolio finalist and ISO/IEC 29192-3 standard with 288-bit state.

## Properties

| Property | Value |
| --- | --- |
| Category | Stream Ciphers |
| Sub-category | NLFSR Stream Cipher |
| Security status | 🛡️ Secure |
| Complexity | Advanced |
| Inventor | Christophe De Cannière, Bart Preneel |
| Year | 2005 |
| Origin | 🇧🇪 Belgium |
| Source | [`algorithms/stream/trivium.js`](../../../algorithms/stream/trivium.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 10 bytes (80 bits) |
| Nonce sizes | 10 bytes (80 bits) |

## Security

**Status:** 🛡️ Secure

No vulnerabilities are recorded for this implementation.

## Documentation

- [ISO/IEC 29192-3:2012 - Trivium Stream Cipher](https://www.iso.org/standard/56426.html)
- [eSTREAM Trivium Specification](https://www.ecrypt.eu.org/stream/trivium.html)
- [Trivium: A Stream Cipher Construction](https://www.esat.kuleuven.be/cosic/publications/article-1137.pdf)

## References

- [Public-Domain Trivium Reference Implementation (matches designer's reference output)](https://github.com/cbouilla/trivium)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [eSTREAM Trivium Set 1, vector#0 - stream[0..63]](https://raw.githubusercontent.com/cantora/avr-crypto-lib/master/testvectors/trivium-80.80.test-vectors)

| Field | Value |
| --- | --- |
| `key` | `80000000000000000000` |
| `iv` | `00000000000000000000` |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `expected` | `38eb86ff730d7a9caf8df13a4420540d bb7b651464c87501552041c249f29a64 d2fbf515610921ebe06c8f92cecf7f80 98ff20cccc6a62b97be8ef7454fc80f9` |

**Vector 2** — [eSTREAM Trivium Set 6, vector#0 - stream[0..63]](https://raw.githubusercontent.com/cantora/avr-crypto-lib/master/testvectors/trivium-80.80.test-vectors)

| Field | Value |
| --- | --- |
| `key` | `0053a6f94c9ff24598eb` |
| `iv` | `0d74db42a91077de45ac` |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `expected` | `f4cd954a717f26a7d6930830c4e7cf08 19f80e03f25f342c64adc66aba7f8a8e 6eaa49f23632ae3cd41a7bd290a0132f 81c6d4043b6e397d7388f3a03b5fe358` |

---

[← All algorithms](../README.md)
