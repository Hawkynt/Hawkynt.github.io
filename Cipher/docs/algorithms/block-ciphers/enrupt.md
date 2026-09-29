# EnRUPT

> Cryptographic primitive based on XXTEA using unbalanced Feistel network. Submitted to SHA-3 competition but broken by multiple practical attacks including collision, preimage, and chosen plaintext vulnerabilities.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | ❌ Broken |
| Complexity | Intermediate |
| Inventor | Sean O'Neil, Karsten Nohl, Luca Henzen |
| Year | 2008 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/block/enrupt.js`](../../../algorithms/block/enrupt.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 4 bytes (32 bits) to 64 bytes (512 bits) in steps of 4 bytes |
| Block sizes | 8 bytes (64 bits) to 1024 bytes (8192 bits) in steps of 4 bytes |

## Security

**Status:** ❌ Broken

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| [Collision Attack](https://link.springer.com/article/10.1007/s00145-010-9058-x) | Practical collision attack with 2^40 time complexity | DO NOT USE - Algorithm is cryptographically broken |
| [Preimage Attack](https://eprint.iacr.org/2008/467) | Meet-in-the-middle preimage attack with 2^480 complexity against EnRUPT-512 hash | DO NOT USE - Algorithm is cryptographically broken |
| [Chosen Plaintext Attack](https://eprint.iacr.org/2010/517) | Related-key chosen plaintext attack with 2^15 queries against block cipher | DO NOT USE - Algorithm is cryptographically broken |
| [Related-Key Attacks](https://eprint.iacr.org/2010/517) | Fast related-key attacks stemming from weak key schedule properties | DO NOT USE - Severe key schedule vulnerabilities |

## Documentation

- [EnRUPT SHA-3 Submission](https://en.wikipedia.org/wiki/EnRUPT)
- [Cryptanalysis of EnRUPT (IACR ePrint 2008/467)](https://eprint.iacr.org/2008/467)
- [Practical Collisions for EnRUPT](https://link.springer.com/article/10.1007/s00145-010-9058-x)

## References

- [Cryptanalysis of block EnRUPT (IACR ePrint 2010/517)](https://eprint.iacr.org/2010/517)
- [XXTEA (Base Algorithm)](https://www.cix.co.uk/~klockstone/xxtea.htm)
- [SHA-3 Competition Archive](https://ehash.isec.tugraz.at/uploads/9/9b/Enrupt.pdf)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [EnRUPT 8-byte block - all zeros (matches XXTEA for minimal block)](https://en.wikipedia.org/wiki/EnRUPT)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000` |
| `input` | `0000000000000000` |
| `expected` | `ab043705808c5d57` |

**Vector 2** — [EnRUPT 16-byte block - demonstrates different round count](https://en.wikipedia.org/wiki/EnRUPT)

| Field | Value |
| --- | --- |
| `key` | `0102040810204080fffefcf8f0e0c080` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `38b678919f2828418fe77d7d40c4c2ed` |

**Vector 3** — [EnRUPT 8-byte block - mixed key for verification](https://en.wikipedia.org/wiki/EnRUPT)

| Field | Value |
| --- | --- |
| `key` | `0102040810204080fffefcf8f0e0c080` |
| `input` | `0000000000000000` |
| `expected` | `a20a9e9c22f12184` |

---

[← All algorithms](../README.md)
