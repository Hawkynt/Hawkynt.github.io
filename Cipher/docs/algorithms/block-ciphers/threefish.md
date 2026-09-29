# Threefish

> Tweakable block cipher family designed as part of the Skein hash function. Threefish-512 uses 512-bit blocks and keys with 72 rounds, optimized for 64-bit platforms and resistance to timing attacks.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | Not classified |
| Complexity | Advanced |
| Inventor | Bruce Schneier, Niels Ferguson, Stefan Lucks, Doug Whiting, Mihir Bellare, Tadayoshi Kohno, Jon Callas, Jesse Walker |
| Year | 2008 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/block/threefish.js`](../../../algorithms/block/threefish.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 64 bytes (512 bits) |
| Block sizes | 64 bytes (512 bits) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [The Skein Hash Function Family](https://www.schneier.com/academic/skein/)
- [Threefish Specification](https://www.schneier.com/academic/paperfiles/skein1.3.pdf)
- [NIST SHA-3 Submission](https://csrc.nist.gov/projects/hash-functions/sha-3-project)

## References

- [Threefish Cryptanalysis](https://eprint.iacr.org/2009/204.pdf)
- [Skein/Threefish Security Analysis](https://www.schneier.com/academic/skein/threefish-cryptanalysis.html)
- [NIST SHA-3 Competition Analysis](https://csrc.nist.gov/projects/hash-functions/sha-3-project/round-3-submissions)

## Test vectors

1 vector ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Threefish-512 all zeros test vector](https://github.com/weidai11/cryptopp/blob/master/TestVectors/threefish.txt)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `expected` | `b1a2bbc6ef6025bc40eb3822161f36e3 75d1bb0aee3186fbd19e47c5d479947b 7bc2f8586e35f0cff7e7f03084b0b7b1 f1ab3961a580a3e97eb41ea14a6d7bbe` |

---

[← All algorithms](../README.md)
