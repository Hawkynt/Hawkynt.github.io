# MAGENTA

> Deutsche Telekom AES candidate with modified Feistel structure and GF(2^8) operations. Educational implementation of a cipher with known vulnerabilities.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | Not classified |
| Complexity | Advanced |
| Inventor | Michael Jacobson Jr., Klaus Huber |
| Year | 1998 |
| Origin | 🇩🇪 Germany |
| Source | [`algorithms/block/magenta.js`](../../../algorithms/block/magenta.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits); 24 bytes (192 bits); 32 bytes (256 bits) |
| Block sizes | 16 bytes (128 bits) |

## Security

**Status:** not classified — treat as unverified.

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| [Structural Weakness](https://www.schneier.com/academic/archives/1999/05/cryptanalysis_of_mag.html) | MAGENTA has significant structural weaknesses | Educational cipher - not recommended for production use |
| [Low Round Count](https://csrc.nist.gov/archive/aes/round1/conf1/papers/jacobson.pdf) | Only 6-8 rounds insufficient for security | Failed AES candidate due to vulnerabilities |

## Documentation

- [MAGENTA AES Submission](https://csrc.nist.gov/archive/aes/round1/conf1/papers/jacobson.pdf)
- [Schneier Analysis](https://www.schneier.com/academic/archives/1999/05/cryptanalysis_of_mag.html)

## References

- [AES Competition Archive](https://csrc.nist.gov/projects/cryptographic-standards-and-guidelines/archived-crypto-projects/aes-development)
- [MAGENTA Specification](https://csrc.nist.gov/archive/aes/round1/conf1/papers/jacobson.pdf)

## Test vectors

9 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [NIST AES round-1 ecb_int.txt, 128-bit key (non-zero key and plaintext)](https://web.archive.org/web/20070109105056/http://csrc.nist.gov/CryptoToolkit/aes/round1/testvals/magenta-vals.zip)

| Field | Value |
| --- | --- |
| `key` | `fffefdfcfbfaf9f8f7f6f5f4f3f2f1f0` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `0909105491f0ef3d363eae828a504e2b` |

**Vector 2** — [NIST AES round-1 ecb_tbl.txt I=1, 128-bit key](https://web.archive.org/web/20070109105056/http://csrc.nist.gov/CryptoToolkit/aes/round1/testvals/magenta-vals.zip)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `ca7d2b729ff35fbd75e8c72e8049f7d4` |

**Vector 3** — [NIST AES round-1 ecb_vt.txt I=1, 128-bit key](https://web.archive.org/web/20070109105056/http://csrc.nist.gov/CryptoToolkit/aes/round1/testvals/magenta-vals.zip)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000` |
| `input` | `80000000000000000000000000000000` |
| `expected` | `f6b50c496e9a97abe925da2e7c891974` |

**Vector 4** — [NIST AES round-1 ecb_vk.txt I=1, 128-bit key](https://web.archive.org/web/20070109105056/http://csrc.nist.gov/CryptoToolkit/aes/round1/testvals/magenta-vals.zip)

| Field | Value |
| --- | --- |
| `key` | `80000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `d923ff2b95212ca5581693f71137aafa` |

**Vector 5** — [NIST AES round-1 ecb_vk.txt I=2, 128-bit key](https://web.archive.org/web/20070109105056/http://csrc.nist.gov/CryptoToolkit/aes/round1/testvals/magenta-vals.zip)

| Field | Value |
| --- | --- |
| `key` | `40000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `462e3204fcee82beae4fa8cb66696502` |

**Vector 6** — [NIST AES round-1 ecb_tbl.txt I=1, 192-bit key](https://web.archive.org/web/20070109105056/http://csrc.nist.gov/CryptoToolkit/aes/round1/testvals/magenta-vals.zip)

| Field | Value |
| --- | --- |
| `key` | `000000000000000000000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `ca7d2b729ff35fbd75e8c72e8049f7d4` |

**Vector 7** — [NIST AES round-1 ecb_vk.txt I=1, 192-bit key](https://web.archive.org/web/20070109105056/http://csrc.nist.gov/CryptoToolkit/aes/round1/testvals/magenta-vals.zip)

| Field | Value |
| --- | --- |
| `key` | `800000000000000000000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `588ebee01ddf366998f50d3ff58beaec` |

**Vector 8** — [NIST AES round-1 ecb_tbl.txt I=1, 256-bit key](https://web.archive.org/web/20070109105056/http://csrc.nist.gov/CryptoToolkit/aes/round1/testvals/magenta-vals.zip)

| Field | Value |
| --- | --- |
| `key` | `0000000000000000000000000000000000000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `f0f66c085c77ca9433c95e0300c71891` |

**Vector 9** — [NIST AES round-1 ecb_vk.txt I=1, 256-bit key](https://web.archive.org/web/20070109105056/http://csrc.nist.gov/CryptoToolkit/aes/round1/testvals/magenta-vals.zip)

| Field | Value |
| --- | --- |
| `key` | `8000000000000000000000000000000000000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `9a199e39c2df1f1c17cea243f8e5147e` |

---

[← All algorithms](../README.md)
