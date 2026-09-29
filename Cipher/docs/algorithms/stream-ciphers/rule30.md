# Rule30

> Elementary cellular automaton-based pseudorandom number generator using Rule 30 pattern. Exhibits chaotic behavior but NOT cryptographically secure. Educational use only.

## Properties

| Property | Value |
| --- | --- |
| Category | Stream Ciphers |
| Sub-category | Cellular Automaton |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | Stephen Wolfram |
| Year | 1983 |
| Origin | 🇬🇧 United Kingdom |
| Source | [`algorithms/stream/rule30.js`](../../../algorithms/stream/rule30.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 1 byte (8 bits) to 1024 bytes (8192 bits) |
| Nonce sizes | 0 bytes (0 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Predictability | State can be reconstructed from sufficient keystream output, not cryptographically secure | Use only for educational purposes, never for actual cryptography |
| No Cryptographic Design | Cellular automaton not designed for cryptographic use and lacks proper security properties | Educational use only - use proper stream ciphers for security |

## Documentation

- [Rule 30 Wikipedia](https://en.wikipedia.org/wiki/Rule_30)
- [A New Kind of Science](https://www.wolframscience.com/nks/)
- [Wolfram's Original Paper](https://www.stephenwolfram.com/publications/cellular-automata-irreversibility/)

## References

- [Rule 30 Cellular Automaton Encryption PoC (Android)](https://github.com/glureau/android-wolfram-R30-poc)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — Rule30 Deterministic Test - Simple Key

Source: Educational deterministic test case

| Field | Value |
| --- | --- |
| `key` | `0102030405060708` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `acfb3ef79b300e94e86c7fa1f08555f8` |

**Vector 2** — Rule30 Single Byte Test

Source: Educational single byte test case

| Field | Value |
| --- | --- |
| `key` | `ff` |
| `input` | `00` |
| `expected` | `00` |

---

[← All algorithms](../README.md)
