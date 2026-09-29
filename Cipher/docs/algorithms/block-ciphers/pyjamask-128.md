# Pyjamask-128

> Lightweight block cipher designed for efficient masked implementations. Features a 128-bit block size with 128-bit keys using 14 rounds. Part of NIST Lightweight Cryptography competition (Round 2).

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🧪 Experimental |
| Complexity | Intermediate |
| Inventor | Dahmun Goudarzi, Jérémy Jean, Stefan Kölbl, Thomas Peyrin, Matthieu Rivain, Yu Sasaki, Siang Meng Sim |
| Year | 2019 |
| Origin | 🇫🇷 France |
| Source | [`algorithms/block/pyjamask128.js`](../../../algorithms/block/pyjamask128.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) |
| Block sizes | 16 bytes (128 bits) |

## Security

**Status:** 🧪 Experimental

No vulnerabilities are recorded for this implementation.

## Documentation

- [Official Pyjamask Website](https://pyjamask-cipher.github.io/)
- [NIST LWC Submission](https://csrc.nist.gov/Projects/lightweight-cryptography/round-2-candidates)
- [Pyjamask Specification (PDF)](https://pyjamask-cipher.github.io/spec.pdf)

## References

- [Southern Storm Software Reference Implementation](https://github.com/rweather/lightweight-crypto)
- [NIST LWC Round 2 Candidates](https://csrc.nist.gov/Projects/lightweight-cryptography/round-2-candidates)
- [Cryptanalysis Resources](https://pyjamask-cipher.github.io/)

## Test vectors

1 vector ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Pyjamask-128 block cipher test vector - Pyjamask specification](https://github.com/rweather/lightweight-crypto/blob/master/test/unit/test-pyjamask.c)

| Field | Value |
| --- | --- |
| `key` | `00112233445566778899aabbccddeeff` |
| `input` | `50796a616d61736b2d3132383a293a29` |
| `expected` | `48f139a109bdd9c0726e8261f8d68e7d` |

---

[← All algorithms](../README.md)
