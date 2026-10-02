# AES-GCM-SIV

> Simplified educational implementation of nonce-misuse resistant AEAD. Demonstrates synthetic IV generation and stream encryption principles for learning purposes.

## Properties

| Property | Value |
| --- | --- |
| Category | Stream Ciphers |
| Sub-category | AEAD Stream Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Not specified |
| Inventor | Shay Gueron, Yehuda Lindell |
| Year | 2017 |
| Origin | 🌐 International |
| Source | [`algorithms/stream/aes-gcm-siv.js`](../../../algorithms/stream/aes-gcm-siv.js) |

## Security

**Status:** 🎓 Educational Only

Simplified educational implementation for learning AEAD concepts. Not suitable for production use.

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Educational Only | This is a simplified educational implementation not suitable for security applications. | Use only for educational purposes to understand AEAD concepts. |

## Documentation

- [RFC 8452 - AES-GCM-SIV](https://tools.ietf.org/rfc/rfc8452.html)
- [Educational AEAD Overview](https://en.wikipedia.org/wiki/Authenticated_encryption)

## References

- [Stream Cipher Principles](https://en.wikipedia.org/wiki/Stream_cipher)

## Test vectors

1 vector ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — Educational test vector

Source: Educational implementation

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f10` |
| `input` | `48656c6c6f` |
| `expected` | `6c85af6353` |

---

[← All algorithms](../README.md)
