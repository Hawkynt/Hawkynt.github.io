# PRESENT-128

> PRESENT-128 variant of the lightweight block cipher with extended 128-bit key size. Substitution-Permutation Network with 64-bit blocks, 128-bit keys, and 31 rounds. Educational implementation extending the ISO/IEC 29192-2 specification.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Not specified |
| Inventor | Andrey Bogdanov, Lars R. Knudsen, Gregor Leander, Christof Paar, Axel Poschmann, Matthew J.B. Robshaw, Yannick Seurin, C. Vikkelsoe |
| Year | 2007 |
| Origin | 🇩🇪 Germany |
| Source | [`algorithms/block/present.js`](../../../algorithms/block/present.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) |
| Block sizes | 8 bytes (64 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Linear cryptanalysis | Susceptible to linear cryptanalytic attacks | Use for educational purposes only in constrained environments |
| Small block size | 64-bit block size vulnerable to birthday attacks | Avoid encrypting large amounts of data with single key |

## Documentation

- [PRESENT-128 Extension](https://link.springer.com/chapter/10.1007/978-3-540-74735-2_31)
- [PRESENT Specification](https://link.springer.com/chapter/10.1007/978-3-540-74735-2_31)
- [Wikipedia - PRESENT](https://en.wikipedia.org/wiki/PRESENT)

## References

- [Original PRESENT Paper](https://link.springer.com/chapter/10.1007/978-3-540-74735-2_31)
- [Crypto++ PRESENT Implementation](https://github.com/weidai11/cryptopp/blob/master/present.cpp)
- [PRESENT Analysis](https://eprint.iacr.org/2007/024.pdf)
- [Lightweight Cryptography](https://csrc.nist.gov/projects/lightweight-cryptography)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [PRESENT-128 all zeros test vector - educational](https://crypto.stackexchange.com/questions/70906/where-can-i-find-test-vectors-for-the-present-cipher-with-a-128-bit-key)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000` |
| `input` | `0000000000000000` |
| `expected` | `96db702a2e6900af` |

**Vector 2** — [PRESENT-128 pattern test vector - educational](https://crypto.stackexchange.com/questions/70906/where-can-i-find-test-vectors-for-the-present-cipher-with-a-128-bit-key)

| Field | Value |
| --- | --- |
| `key` | `ffffffffffffffffffffffffffffffff` |
| `input` | `0000000000000000` |
| `expected` | `13238c710272a5d8` |

**Vector 3** — [PRESENT-128 all-ones plaintext, zero key](https://crypto.stackexchange.com/questions/70906/where-can-i-find-test-vectors-for-the-present-cipher-with-a-128-bit-key)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000` |
| `input` | `ffffffffffffffff` |
| `expected` | `3c6019e5e5edd563` |

**Vector 4** — [PRESENT-128 all-ones plaintext and key](https://crypto.stackexchange.com/questions/70906/where-can-i-find-test-vectors-for-the-present-cipher-with-a-128-bit-key)

| Field | Value |
| --- | --- |
| `key` | `ffffffffffffffffffffffffffffffff` |
| `input` | `ffffffffffffffff` |
| `expected` | `628d9fbd4218e5b4` |

---

[← All algorithms](../README.md)
