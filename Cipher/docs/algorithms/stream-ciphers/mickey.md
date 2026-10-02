# MICKEY

> Hardware-oriented stream cipher using two 100-bit registers with irregular clocking. Part of the eSTREAM hardware portfolio. Educational implementation demonstrating clock-controlled register principles.

## Properties

| Property | Value |
| --- | --- |
| Category | Stream Ciphers |
| Sub-category | Stream Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Not specified |
| Inventor | Steve Babbage, Matthew Dodd |
| Year | 2005 |
| Origin | 🇬🇧 United Kingdom |
| Source | [`algorithms/stream/mickey.js`](../../../algorithms/stream/mickey.js) |

## Security

**Status:** 🎓 Educational Only

Hardware-oriented design with irregular clocking. This educational implementation uses simplified registers for demonstration purposes.

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Implementation Specific | This is a simplified educational implementation not suitable for security applications. | Use only for educational purposes to understand clock-controlled generators. |

## Documentation

- [MICKEY eSTREAM Specification](https://www.ecrypt.eu.org/stream/mickey.html)
- [eSTREAM Hardware Portfolio](https://www.ecrypt.eu.org/stream/)

## References

- [Hardware-Oriented Stream Ciphers](https://en.wikipedia.org/wiki/Stream_cipher)

## Test vectors

1 vector ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — Educational test vector with simplified initialization

Source: Educational implementation

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `48656c6c6f` |
| `expected` | `5ce1c2430d` |

---

[← All algorithms](../README.md)
