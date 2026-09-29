# ChaCha20 (PRNG)

> ChaCha stream cipher variant with 20 rounds designed by Daniel J. Bernstein. Counter-based PRNG providing excellent statistical properties and high performance. Original specification with maximum security margin.

## Properties

| Property | Value |
| --- | --- |
| Category | Random Number Generators |
| Sub-category | Pseudorandom Number Generator |
| Variant | ChaCha20 |
| Security status | 🧪 Experimental |
| Complexity | Advanced |
| Inventor | Daniel J. Bernstein |
| Year | 2008 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/random/chacha.js`](../../../algorithms/random/chacha.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Seed sizes | 32 bytes (256 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `IsDeterministic` | Yes |
| `IsCryptographicallySecure` | Yes |

## Security

**Status:** 🧪 Experimental

No vulnerabilities are recorded for this implementation.

## Documentation

- [ChaCha: A variant of Salsa20 (Bernstein 2008)](https://cr.yp.to/chacha/chacha-20080128.pdf)
- [Wikipedia: Salsa20 (ChaCha section)](https://en.wikipedia.org/wiki/Salsa20#ChaCha_variant)
- [RFC 8439: ChaCha20 and Poly1305 for IETF Protocols](https://www.rfc-editor.org/rfc/rfc8439.html)

## References

- [Go runtime PRNG source code (ChaCha8)](https://github.com/golang/go/blob/master/src/runtime/rand.go)
- [Rust rand_chacha crate](https://docs.rs/rand_chacha/)

## Test vectors

1 vector ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [ChaCha20 zero key and nonce (32-byte key): First 16 bytes](https://www.rfc-editor.org/rfc/rfc8439.html)

| Field | Value |
| --- | --- |
| `seed` | `0000000000000000000000000000000000000000000000000000000000000000` |
| `nonce` | `0000000000000000` |
| `counter` | `0000000000000000` |
| `outputSize` | `16` |
| `input` | `null` |
| `expected` | `76b8e0ada0f13d90405d6ae55386bd28` |

---

[← All algorithms](../README.md)
