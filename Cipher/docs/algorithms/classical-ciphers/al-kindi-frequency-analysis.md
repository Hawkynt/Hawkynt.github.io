# Al-Kindi Frequency Analysis

> Historical frequency analysis method developed by Al-Kindi (Alkindus) in 9th century Baghdad. First systematic approach to cryptanalysis using statistical analysis of letter frequencies to break substitution ciphers.

## Properties

| Property | Value |
| --- | --- |
| Category | Classical Ciphers |
| Sub-category | Frequency Analysis |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | Abu Yusuf Yaqub ibn Ishaq al-Kindi |
| Year | 850 |
| Origin | 🏛️ Ancient |
| Source | [`algorithms/classical/al-kindi-frequency.js`](../../../algorithms/classical/al-kindi-frequency.js) |

## Security

**Status:** 🎓 Educational Only

Educational cryptanalysis tool demonstrating frequency analysis principles. Shows vulnerability of simple substitution ciphers to statistical attacks.

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Only effective against simple substitution ciphers | — | — |
| Requires knowledge of plaintext language frequency patterns | — | — |

## Documentation

- [History of Cryptography](https://en.wikipedia.org/wiki/Al-Kindi)
- [Frequency Analysis](https://en.wikipedia.org/wiki/Frequency_analysis)
- [Medieval Cryptography](https://www.maa.org/press/periodicals/convergence/cryptology-in-the-medieval-islamic-world)

## References

- [Al-Kindi's Manuscript](https://www.lib.cam.ac.uk/collections/departments/taylor-schechter-genizah-research-unit)
- [Islamic Golden Age](https://www.encyclopedia.com/science/encyclopedias-almanacs-transcripts-and-maps/al-kindi-abu-yusuf-yaqub-ibn-ishaq)
- [Cryptanalysis History](https://crypto.stanford.edu/pbc/notes/crypto/classical.html)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — Caesar Cipher Analysis (ciphertext shifted by 3, recovered by frequency analysis)

Source: Historical cryptanalysis examples

| Field | Value |
| --- | --- |
| `language` | english |
| `input` | `574b5256204c562044205648465548572050485656444a48` |
| `expected` | `54484f53204953204120534543524554204d455353414745` |

**Vector 2** — Substitution Analysis

Source: Educational examples

| Field | Value |
| --- | --- |
| `key` | `656e676c697368` |
| `input` | `48454c4c4f20574f524c44` |
| `expected` | `454249494c20544c4f4941` |

---

[← All algorithms](../README.md)
