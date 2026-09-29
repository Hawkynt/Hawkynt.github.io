# Simpira-128

> Simpira-128 permutation using AES round function. Input/output size: 128 bits (16 bytes). Designed for Intel AES-NI optimization.

## Properties

| Property | Value |
| --- | --- |
| Category | Special Algorithms |
| Sub-category | Cryptographic Permutation |
| Security status | 🧪 Experimental |
| Complexity | Expert |
| Inventor | Shay Gueron, Nicky Mouha |
| Year | 2016 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/permutation/simpira-v2.js`](../../../algorithms/permutation/simpira-v2.js) |

## Security

**Status:** 🧪 Experimental

No vulnerabilities are recorded for this implementation.

## Documentation

- [IACR ePrint 2016/122](https://eprint.iacr.org/2016/122)
- [ASIACRYPT 2016 Paper](https://link.springer.com/chapter/10.1007/978-3-662-53887-6_16)
- [NIST Publication](https://www.nist.gov/publications/simpira-v2-family-efficient-permutations-using-aes-found-function)
- [Reference Implementation](https://mouha.be/wp-content/uploads/simpira_v2.zip)

## References

- [Simpira Implementation (SPHINCS optimized code)](https://github.com/kste/sphincs/blob/master/arm/simpira/simpira.c)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Simpira-128 Zero Vector Test](https://mouha.be/simpira/)

| Field | Value |
| --- | --- |
| `input` | `00000000000000000000000000000000` |
| `expected` | `5e7df1010e4e4de68cfafead5b68c3b9` |

**Vector 2** — [Simpira-128 Sequential Vector Test](https://mouha.be/simpira/)

| Field | Value |
| --- | --- |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `1e0566e2f4992a8018c78a87a1501d95` |

---

[← All algorithms](../README.md)
