# PRESENT-80

> PRESENT-80 lightweight block cipher designed for constrained environments. Substitution-Permutation Network with 64-bit blocks, 80-bit keys, and 31 rounds. Educational implementation following ISO/IEC 29192-2 specification.

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
| Key sizes | 10 bytes (80 bits) |
| Block sizes | 8 bytes (64 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Linear cryptanalysis | Susceptible to linear cryptanalytic attacks | Use for educational purposes only in constrained environments |
| Small block size | 64-bit block size vulnerable to birthday attacks | Avoid encrypting large amounts of data with single key |

## Documentation

- [ISO/IEC 29192-2:2019 - PRESENT](https://www.iso.org/standard/56425.html)
- [PRESENT Specification](https://link.springer.com/chapter/10.1007/978-3-540-74735-2_31)
- [Wikipedia - PRESENT](https://en.wikipedia.org/wiki/PRESENT)

## References

- [Original PRESENT Paper](https://link.springer.com/chapter/10.1007/978-3-540-74735-2_31)
- [Crypto++ PRESENT Implementation](https://github.com/weidai11/cryptopp/blob/master/present.cpp)
- [PRESENT Analysis](https://eprint.iacr.org/2007/024.pdf)
- [Lightweight Cryptography](https://csrc.nist.gov/projects/lightweight-cryptography)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [PRESENT-80 all zeros test vector - educational](https://link.springer.com/chapter/10.1007/978-3-540-74735-2_31)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000` |
| `input` | `0000000000000000` |
| `expected` | `5579c1387b228445` |

**Vector 2** — [PRESENT-80 pattern test vector - educational](https://link.springer.com/chapter/10.1007/978-3-540-74735-2_31)

| Field | Value |
| --- | --- |
| `key` | `ffffffffffffffffffff` |
| `input` | `0000000000000000` |
| `expected` | `e72c46c0f5945049` |

**Vector 3** — [PRESENT-80 all-ones plaintext, zero key](https://link.springer.com/chapter/10.1007/978-3-540-74735-2_31)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000` |
| `input` | `ffffffffffffffff` |
| `expected` | `a112ffc72f68417b` |

**Vector 4** — [PRESENT-80 all-ones plaintext and key](https://link.springer.com/chapter/10.1007/978-3-540-74735-2_31)

| Field | Value |
| --- | --- |
| `key` | `ffffffffffffffffffff` |
| `input` | `ffffffffffffffff` |
| `expected` | `3333dcd3213210d2` |

---

[← All algorithms](../README.md)
