# Simpira-512

> Simpira-512 permutation using AES round function. Input/output size: 512 bits (64 bytes). Designed for Intel AES-NI optimization.

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

**Vector 1** — [Simpira-512 Zero Vector Test](https://mouha.be/simpira/)

| Field | Value |
| --- | --- |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `expected` | `1be1c14bac28e36c7c1a106c192ea9f0 b7d9aea1aba2de4572442617b626fc35 c187de7e94c382b6c5d8022779eeb916 7813f10731537de57b5032dda35617ee` |

**Vector 2** — [Simpira-512 Sequential Vector Test](https://mouha.be/simpira/)

| Field | Value |
| --- | --- |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `expected` | `48c98b7e030e3ab38dfcf941a6321d95 86c47f17bc5acb7d59914a444727aaf8 c278e0afc19aa5633939457f5da73e2b f4cb4c8973b48751ba8e15722d025dca` |

---

[← All algorithms](../README.md)
