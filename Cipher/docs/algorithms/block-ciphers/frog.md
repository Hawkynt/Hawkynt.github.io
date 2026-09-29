# FROG

> AES candidate from TecApro built on a key-as-program design: the user key derives a large internal key of per-round substitution and permutation tables, and the round function is a short fixed byte sequence driven entirely by those tables. 128-bit block, 128/192/256-bit keys, 8 rounds.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | Not classified |
| Complexity | Advanced |
| Inventor | Dianelos Georgoudis, Damian Leroux, Billy Simon Chaves |
| Year | 1998 |
| Origin | Not specified |
| Source | [`algorithms/block/frog.js`](../../../algorithms/block/frog.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) to 32 bytes (256 bits) in steps of 8 bytes |
| Block sizes | 16 bytes (128 bits) |

## Security

**Status:** not classified — treat as unverified.

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Weak key classes and chosen-plaintext attacks | Wagner, Ferguson and Schneier found large weak-key classes and both chosen-plaintext and chosen-ciphertext attacks; FROG was not selected as an AES finalist. | Use AES or another vetted cipher. |

## Documentation

- [The FROG Encryption Algorithm (TecApro AES submission)](https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Algorithm-Validation-Program/documents/aes-development/frog.pdf)
- [FROG AES Submission (NESSIE mirror)](https://www.cosic.esat.kuleuven.be/nessie/workshop/submissions/frog.pdf)
- [FROG (Wikipedia)](https://en.wikipedia.org/wiki/FROG)

## References

- [A Million Random Digits with 100,000 Normal Deviates (RAND, 1955)](https://www.rand.org/pubs/monograph_reports/MR1418.html)
- [Cryptanalysis of FROG (Wagner, Ferguson, Schneier)](https://www.schneier.com/academic/archives/1999/01/cryptanalysis_of_fro.html)

## Test vectors

10 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [AES KAT ecb_vk.txt I=1 — 128-bit key, highest key bit set](https://web.archive.org/web/20070109105622if_/http://csrc.nist.gov/CryptoToolkit/aes/round1/testvals/frog-vals.zip)

| Field | Value |
| --- | --- |
| `key` | `80000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `6ccbd28a71cc30e2a79de52d532a1a1e` |

**Vector 2** — [AES KAT ecb_vk.txt I=128 — 128-bit key, lowest key bit set](https://web.archive.org/web/20070109105622if_/http://csrc.nist.gov/CryptoToolkit/aes/round1/testvals/frog-vals.zip)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000001` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `c478730c7e57d8d1852a7cebedf3434f` |

**Vector 3** — [AES KAT ecb_vt.txt I=1 — 128-bit key, highest plaintext bit set](https://web.archive.org/web/20070109105622if_/http://csrc.nist.gov/CryptoToolkit/aes/round1/testvals/frog-vals.zip)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000` |
| `input` | `80000000000000000000000000000000` |
| `expected` | `43af8869bde62dd0fc003153b30a7082` |

**Vector 4** — [AES KAT ecb_vt.txt I=128 — 128-bit key, lowest plaintext bit set](https://web.archive.org/web/20070109105622if_/http://csrc.nist.gov/CryptoToolkit/aes/round1/testvals/frog-vals.zip)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000` |
| `input` | `00000000000000000000000000000001` |
| `expected` | `c75425e955ce24cdb02c7840f02261b4` |

**Vector 5** — [AES KAT ecb_vk.txt I=1 — 192-bit key](https://web.archive.org/web/20070109105622if_/http://csrc.nist.gov/CryptoToolkit/aes/round1/testvals/frog-vals.zip)

| Field | Value |
| --- | --- |
| `key` | `800000000000000000000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `0e77f45397c67000e2232bd098c77ed9` |

**Vector 6** — [AES KAT ecb_vk.txt I=192 — 192-bit key, lowest key bit set](https://web.archive.org/web/20070109105622if_/http://csrc.nist.gov/CryptoToolkit/aes/round1/testvals/frog-vals.zip)

| Field | Value |
| --- | --- |
| `key` | `000000000000000000000000000000000000000000000001` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `1c36d07eb28abdf95a54e99200b6e62a` |

**Vector 7** — [AES KAT ecb_vt.txt I=1 — 192-bit key, highest plaintext bit set](https://web.archive.org/web/20070109105622if_/http://csrc.nist.gov/CryptoToolkit/aes/round1/testvals/frog-vals.zip)

| Field | Value |
| --- | --- |
| `key` | `000000000000000000000000000000000000000000000000` |
| `input` | `80000000000000000000000000000000` |
| `expected` | `cecad44deb19b143fb6399c8a798253f` |

**Vector 8** — [AES KAT ecb_vk.txt I=1 — 256-bit key](https://web.archive.org/web/20070109105622if_/http://csrc.nist.gov/CryptoToolkit/aes/round1/testvals/frog-vals.zip)

| Field | Value |
| --- | --- |
| `key` | `8000000000000000000000000000000000000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `b3b4c6422b18c6b989bc341e92a400e1` |

**Vector 9** — [AES KAT ecb_vk.txt I=256 — 256-bit key, lowest key bit set](https://web.archive.org/web/20070109105622if_/http://csrc.nist.gov/CryptoToolkit/aes/round1/testvals/frog-vals.zip)

| Field | Value |
| --- | --- |
| `key` | `0000000000000000000000000000000000000000000000000000000000000001` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `c0386da084bcd68241e4f6709c7bdc2e` |

**Vector 10** — [AES KAT ecb_vt.txt I=1 — 256-bit key, highest plaintext bit set](https://web.archive.org/web/20070109105622if_/http://csrc.nist.gov/CryptoToolkit/aes/round1/testvals/frog-vals.zip)

| Field | Value |
| --- | --- |
| `key` | `0000000000000000000000000000000000000000000000000000000000000000` |
| `input` | `80000000000000000000000000000000` |
| `expected` | `8b26d3a473868cba4f2221bc88de1da5` |

---

[← All algorithms](../README.md)
