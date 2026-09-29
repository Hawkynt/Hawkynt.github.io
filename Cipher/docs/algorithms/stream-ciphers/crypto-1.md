# Crypto-1

> Proprietary stream cipher used in NXP MIFARE Classic cards, reverse-engineered by cryptographic community. Uses 48-bit LFSR with nonlinear filter function. Cryptographically broken with multiple practical attacks published.

## Properties

| Property | Value |
| --- | --- |
| Category | Stream Ciphers |
| Sub-category | Stream Cipher |
| Security status | ❌ Broken |
| Complexity | Intermediate |
| Inventor | NXP Semiconductors (proprietary design) |
| Year | 1994 |
| Origin | 🇳🇱 Netherlands |
| Source | [`algorithms/stream/crypto1.js`](../../../algorithms/stream/crypto1.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 6 bytes (48 bits) |
| Nonce sizes | 0 bytes (0 bits) |

## Security

**Status:** ❌ Broken

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Key Recovery Attack | Multiple practical key recovery attacks allow extracting 48-bit keys in seconds | Do not use - algorithm is fundamentally broken |
| Weak PRNG | Predictable keystream generation allows statistical attacks | Algorithm cannot be fixed - replace with secure alternative |
| Correlation Attacks | Linear correlations in LFSR output enable cryptanalytic attacks | Fundamental design flaw - use modern stream ciphers instead |

## Documentation

- [Crypto-1 Cryptanalysis](https://eprint.iacr.org/2008/166.pdf)
- [MIFARE Classic Security Analysis](https://www.cs.virginia.edu/~evans/pubs/ccs08/)
- [Dismantling MIFARE Classic](https://www.cs.ru.nl/~flaviog/publications/mifare.pdf)

## References

- [crapto1 Reference Library (Proxmark3)](https://github.com/RfidResearchGroup/proxmark3/tree/master/common/crapto1)
- [mfcuk crypto1 Implementation](https://github.com/nfc-tools/mfcuk/blob/master/src/crapto1.c)

## Test vectors

1 vector ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Crypto-1 Test Vector (Educational)](https://github.com/nfc-tools/mfcuk)

| Field | Value |
| --- | --- |
| `key` | `000102030405` |
| `input` | `00000000` |
| `expected` | `4e8485a0` |

---

[← All algorithms](../README.md)
