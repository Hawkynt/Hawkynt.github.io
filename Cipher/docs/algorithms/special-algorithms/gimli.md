# Gimli

> Cross-platform 384-bit cryptographic permutation designed for high security and performance. Can construct hash functions or stream ciphers using sponge construction. Features 24 rounds with simple operations.

## Properties

| Property | Value |
| --- | --- |
| Category | Special Algorithms |
| Sub-category | Cryptographic Permutation |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Daniel J. Bernstein, Stefan Kölbl, Stefan Lucks, Pedro Maat Costa Massolino, Florian Mendel, Kashif Nawaz, Tobias Schneider, Peter Schwabe, François-Xavier Standaert, Yosuke Todo, Benoît Viguier |
| Year | 2017 |
| Origin | 🇳🇱 Netherlands |
| Source | [`algorithms/special/gimli.js`](../../../algorithms/special/gimli.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Input sizes | 48 bytes (384 bits) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [Gimli Official Site](https://gimli.cr.yp.to/)
- [NIST LWC Specification](https://csrc.nist.gov/CSRC/media/Projects/Lightweight-Cryptography/documents/round-2/spec-doc-rnd2/gimli-spec-round2.pdf)
- [Wikipedia Article](https://en.wikipedia.org/wiki/Gimli_(cipher))

## References

- [Original Research Paper](https://eprint.iacr.org/2017/630)
- [Java Implementation](https://github.com/codahale/gimli)
- [Cryptographic Constructions](https://github.com/jedisct1/gimli-constructions)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Gimli permutation test vector from C reference](https://github.com/rweather/lightweight-crypto/blob/master/test/unit/test-gimli24.c)

| Field | Value |
| --- | --- |
| `input` | `00000000ba79379e7af36e3c466da6da 24e7dd781a6115172edb4cb566558453 c8cfbbf15a4af38f22c52a2e264062cc` |
| `expected` | `5ac811ba19d1ba9180e80c38682c4cd2 eaffce3e1c927a27bda0734fd89c5ada f073b684f72fe53449ef2b9ed6b81bf4` |

**Vector 2** — [Gimli all-zeros input test vector](https://gimli.cr.yp.to/)

| Field | Value |
| --- | --- |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `expected` | `c4d867643bf8dc07d4b00b3b4c36211b dc3134088ebefb0e84e8540055d98b64 2eb45d4acb4106cac2d2738609d8302e` |

---

[← All algorithms](../README.md)
