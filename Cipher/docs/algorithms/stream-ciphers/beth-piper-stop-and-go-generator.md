# Beth-Piper Stop-and-Go Generator

> Clock-controlled LFSR stream cipher using stop-and-go clocking strategy. One LFSR controls the irregular clocking of a second LFSR to introduce nonlinearity. Educational implementation for understanding clock-controlled generators.

## Properties

| Property | Value |
| --- | --- |
| Category | Stream Ciphers |
| Sub-category | Stream Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Not specified |
| Inventor | Thomas Beth, Fred Piper |
| Year | 1984 |
| Origin | DE |
| Source | [`algorithms/stream/beth-piper.js`](../../../algorithms/stream/beth-piper.js) |

## Security

**Status:** 🎓 Educational Only

Clock-controlled generators can be vulnerable to correlation attacks and algebraic attacks. Modern cryptanalysis has shown weaknesses in simple stop-and-go generators.

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Clock-controlled generators can be vulnerable to correlation attacks that exploit dependencies between control and data sequences. | — | Use only for educational purposes, not in production systems. |

## Documentation

- [EUROCRYPT 1984 Paper](https://link.springer.com/chapter/10.1007/3-540-39757-4_17)
- [Stream Ciphers Overview](https://en.wikipedia.org/wiki/Stream_cipher)

## References

- [Clock-Controlled Generators](https://link.springer.com/chapter/10.1007/978-3-030-12850-0_1)

## Test vectors

1 vector ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — Basic functionality test with known key

Source: Educational test vector

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `48656c6c6f20576f726c64` |
| `expected` | `d99a8f65afffd6acbe039b` |

---

[← All algorithms](../README.md)
