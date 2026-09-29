# CADAENUS Cipher

> Computer Aided Design of Encryption Algorithm - Non Uniform Substitution. Hybrid cipher using position-dependent substitution with multi-stage transformations for enhanced diffusion compared to classical substitution ciphers.

## Properties

| Property | Value |
| --- | --- |
| Category | Classical Ciphers |
| Sub-category | Classical Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Computer Cryptography Research Team |
| Year | 1985 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/classical/cadaenus.js`](../../../algorithms/classical/cadaenus.js) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| [Position-dependent nature complicates but doesn't prevent key recovery with sufficient known plaintext](https://en.wikipedia.org/wiki/Known-plaintext_attack) | — | Use longer keys and for educational purposes only |
| [Multi-stage transformation provides better diffusion than simple substitution but still vulnerable to advanced cryptanalysis](https://en.wikipedia.org/wiki/Frequency_analysis) | — | Educational use only - not suitable for actual security |

## Documentation

- [Wikipedia Article](https://en.wikipedia.org/wiki/CADAENUS)
- [Educational Materials](https://web.archive.org/web/20080207010024/http://www.cryptography.org/)
- [Classical Cipher Analysis](https://www.dcode.fr/cadaenus-cipher)

## References

- [DCode Implementation](https://www.dcode.fr/cadaenus-cipher)
- [Cryptii Educational Tool](https://cryptii.com/pipes/cadaenus-cipher)
- [NSA Declassified Documents](https://www.nsa.gov/portals/75/documents/news-features/declassified-documents/cryptologic-quarterly/)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Basic Test](https://cryptii.com/pipes/cadaenus-cipher)

| Field | Value |
| --- | --- |
| `key` | `534543524554` |
| `input` | `48454c4c4f` |
| `expected` | `5258474943` |

**Vector 2** — [Alphabet Test](https://www.dcode.fr/cadaenus-cipher)

| Field | Value |
| --- | --- |
| `key` | `4b4559` |
| `input` | `4142434445464748494a4b4c4d4e4f505152535455565758595a` |
| `expected` | `4d505343484443474253564544464e424d504543484e43475053` |

**Vector 3** — [Position Dependency Test](https://en.wikipedia.org/wiki/CADAENUS)

| Field | Value |
| --- | --- |
| `key` | `434950484552` |
| `input` | `4141414141` |
| `expected` | `53584a4d44` |

---

[← All algorithms](../README.md)
