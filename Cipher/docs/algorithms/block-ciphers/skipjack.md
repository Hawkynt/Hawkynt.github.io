# Skipjack

> Declassified NSA block cipher from 1998, originally designed for the Clipper chip. Uses unbalanced Feistel network with 32 rounds, 64-bit blocks, and 80-bit keys. Historical significance only.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | ❌ Broken |
| Complexity | Intermediate |
| Inventor | NSA (National Security Agency) |
| Year | 1987 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/block/skipjack.js`](../../../algorithms/block/skipjack.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 10 bytes (80 bits) |
| Block sizes | 8 bytes (64 bits) |

## Security

**Status:** ❌ Broken

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| [NIST Withdrawal](https://csrc.nist.gov/publications/detail/sp/800-17/archive/1998-02-01) | NIST approval withdrawn in 2015. Not approved for new cryptographic protection | Use modern standardized ciphers like AES |
| [Differential Cryptanalysis](https://www.schneier.com/academic/archives/1998/09/cryptanalysis_of_ski.html) | Vulnerable to differential attacks with reduced complexity | Algorithm is deprecated - do not use for any security applications |
| [Related-key attacks](https://eprint.iacr.org/) | Weak key schedule allows related-key attacks | Historical and educational interest only |

## Documentation

- [Skipjack and KEA Algorithm Specifications](https://csrc.nist.gov/csrc/media/projects/cryptographic-algorithm-validation-program/documents/skipjack/skipjack.pdf)
- [NIST Special Publication 800-17](https://csrc.nist.gov/publications/detail/sp/800-17/archive/1998-02-01)
- [Declassification of SkipJack](https://www.nsa.gov/news-features/declassified-documents/)

## References

- [Original NSA Reference Implementation](https://github.com/coruus/nist-testvectors)
- [Cryptanalysis of SkipJack](https://www.schneier.com/academic/archives/1998/09/cryptanalysis_of_ski.html)
- [SkipJack Cryptanalysis Papers](https://eprint.iacr.org/)

## Test vectors

5 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Skipjack vector 1/zero](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000` |
| `input` | `0000000000000000` |
| `expected` | `aaae8ede6764143d` |

**Vector 2** — [DarkCrypt Skipjack vector 2/incr](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `00010203040506070809` |
| `input` | `0001020304050607` |
| `expected` | `f62e83484fe30190` |

**Vector 3** — [DarkCrypt Skipjack vector 3/incr2](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a` |
| `input` | `1011121314151617` |
| `expected` | `20ab989c85456b03` |

**Vector 4** — [Bouncy Castle SkipjackTest reference vector](https://github.com/bcgit/bc-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/SkipjackTest.java)

| Field | Value |
| --- | --- |
| `key` | `00998877665544332211` |
| `input` | `33221100ddccbbaa` |
| `expected` | `2587cae27a12d300` |

**Vector 5** — [LibTomCrypt skipjack.c reference vector (two identical blocks)](https://github.com/libtom/libtomcrypt/blob/develop/src/ciphers/skipjack.c)

| Field | Value |
| --- | --- |
| `key` | `00998877665544332211` |
| `input` | `33221100ddccbbaa33221100ddccbbaa` |
| `expected` | `2587cae27a12d3002587cae27a12d300` |

---

[← All algorithms](../README.md)
