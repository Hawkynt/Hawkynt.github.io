# MICKEY-128

> Educational implementation of MICKEY-128 enhanced stream cipher based on MICKEY v2 eSTREAM winner. Features 128-bit keys and irregular clocking with dual shift registers.

## Properties

| Property | Value |
| --- | --- |
| Category | Stream Ciphers |
| Sub-category | Stream Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Not specified |
| Inventor | Steve Babbage, Matthew Dodd |
| Year | 2005 |
| Origin | GB |
| Source | [`algorithms/stream/mickey.js`](../../../algorithms/stream/mickey.js) |

## Security

**Status:** 🎓 Educational Only

Based on eSTREAM Portfolio winner MICKEY v2. Enhanced version for 128-bit keys while maintaining hardware efficiency principles.

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| This is an educational implementation not suitable for security applications. | — | Use only for educational purposes to understand enhanced MICKEY variants. |

## Documentation

- [MICKEY eSTREAM Specification](https://www.ecrypt.eu.org/stream/mickey.html)
- [eSTREAM Hardware Portfolio](https://www.ecrypt.eu.org/stream/)

## References

- [Hardware-Oriented Stream Ciphers](https://en.wikipedia.org/wiki/Stream_cipher)

## Test vectors

1 vector ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — Educational test vector for MICKEY-128

Source: Educational implementation

| Field | Value |
| --- | --- |
| `key` | `00010203040506070809101112131415` |
| `input` | `0001020304050607` |
| `expected` | `4dbc308d5236cc4c` |

---

[← All algorithms](../README.md)
