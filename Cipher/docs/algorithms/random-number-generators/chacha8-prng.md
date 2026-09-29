# ChaCha8 (PRNG)

> ChaCha stream cipher variant with 8 rounds designed by Daniel J. Bernstein. Counter-based PRNG providing excellent statistical properties and high performance. Used as default PRNG in Go programming language runtime.

## Properties

| Property | Value |
| --- | --- |
| Category | Random Number Generators |
| Sub-category | Pseudorandom Number Generator |
| Variant | ChaCha8 |
| Security status | 🎓 Educational Only |
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
| `IsCryptographicallySecure` | No |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [ChaCha: A variant of Salsa20 (Bernstein 2008)](https://cr.yp.to/chacha/chacha-20080128.pdf)
- [Wikipedia: Salsa20 (ChaCha section)](https://en.wikipedia.org/wiki/Salsa20#ChaCha_variant)
- [RFC 8439: ChaCha20 and Poly1305 for IETF Protocols](https://www.rfc-editor.org/rfc/rfc8439.html)

## References

- [Go runtime PRNG source code (ChaCha8)](https://github.com/golang/go/blob/master/src/runtime/rand.go)
- [Rust rand_chacha crate](https://docs.rs/rand_chacha/)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [ChaCha8 zero key and nonce (32-byte key): First 16 bytes](https://github.com/weidai11/cryptopp/blob/master/TestVectors/chacha.txt)

| Field | Value |
| --- | --- |
| `seed` | `0000000000000000000000000000000000000000000000000000000000000000` |
| `nonce` | `0000000000000000` |
| `counter` | `0000000000000000` |
| `outputSize` | `16` |
| `input` | `null` |
| `expected` | `3e00ef2f895f40d67f5bb8e81f09a5a1` |

**Vector 2** — [ChaCha8 zero key and nonce (32-byte key): First 64 bytes](https://github.com/weidai11/cryptopp/blob/master/TestVectors/chacha.txt)

| Field | Value |
| --- | --- |
| `seed` | `0000000000000000000000000000000000000000000000000000000000000000` |
| `nonce` | `0000000000000000` |
| `counter` | `0000000000000000` |
| `outputSize` | `64` |
| `input` | `null` |
| `expected` | `3e00ef2f895f40d67f5bb8e81f09a5a1 2c840ec3ce9a7f3b181be188ef711a1e 984ce172b9216f419f445367456d5619 314a42a3da86b001387bfdb80e0cfe42` |

---

[← All algorithms](../README.md)
