# XChaCha20 Extended-Nonce Stream Cipher

> Extended-nonce variant of ChaCha20 providing 192-bit nonces instead of 96-bit. Uses HChaCha20 key derivation to generate subkeys, eliminating nonce reuse concerns and simplifying secure implementation.

## Properties

| Property | Value |
| --- | --- |
| Category | Stream Ciphers |
| Sub-category | Stream Cipher |
| Security status | 🧪 Experimental |
| Complexity | Not specified |
| Inventor | Daniel J. Bernstein (ChaCha20), Frank Denis (XChaCha20) |
| Year | 2018 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/stream/xchacha20.js`](../../../algorithms/stream/xchacha20.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 32 bytes (256 bits) |

## Security

**Status:** 🧪 Experimental

Extended ChaCha20 with 192-bit nonces. Educational implementation demonstrating nonce extension techniques.

No vulnerabilities are recorded for this implementation.

## Documentation

- [draft-irtf-cfrg-xchacha](https://tools.ietf.org/html/draft-irtf-cfrg-xchacha)
- [ChaCha20 RFC 7539](https://tools.ietf.org/html/rfc7539)

## References

- [libsodium XChaCha20 Reference Implementation](https://github.com/jedisct1/libsodium)

## Test vectors

1 vector ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — XChaCha20 Basic Test

Source: Educational test vector

| Field | Value |
| --- | --- |
| `key` | `0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef` |
| `nonce` | `000102030405060708090a0b0c0d0e0f1011121314151617` |
| `input` | `48656c6c6f20576f726c64` |
| `expected` | `931b70ad80d05cf433f99f` |

---

[← All algorithms](../README.md)
