# Elephant-Delirium

> Elephant AEAD variant using Keccak-p[200] permutation with 18 rounds and 128-bit tag. NIST Lightweight Cryptography finalist with highest security level.

## Properties

| Property | Value |
| --- | --- |
| Category | Authenticated Encryption |
| Sub-category | Authenticated Encryption |
| Security status | Not classified |
| Complexity | Advanced |
| Inventor | Tim Beyne, Yu Long Chen, Christoph Dobraunig, Bart Mennink |
| Year | 2019 |
| Origin | 🇧🇪 Belgium |
| Source | [`algorithms/aead/elephant.js`](../../../algorithms/aead/elephant.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) |
| Tag sizes | 16 bytes (128 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `SupportsDetached` | No |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [Elephant Official Site](https://www.esat.kuleuven.be/cosic/elephant/)
- [NIST LWC Finalist Specification](https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-spec-doc/elephant-spec-final.pdf)

## References

- [Rhys Weatherley Reference C Implementation](https://github.com/rweather/lightweight-crypto)
- [Elephant C++ Implementation (itzmeanjan)](https://github.com/itzmeanjan/elephant)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [NIST LWC KAT Vector #1 (empty PT, empty AD)](https://csrc.nist.gov/Projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b` |
| `associatedData` | _(empty)_ |
| `input` | _(empty)_ |
| `expected` | `48bf257607d09ebe1c0e108b91058877` |

**Vector 2** — [NIST LWC KAT Vector #2 (empty PT, 1-byte AD)](https://csrc.nist.gov/Projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b` |
| `associatedData` | `00` |
| `input` | _(empty)_ |
| `expected` | `6e3705abdc45250ceeb36e4d991b741d` |

---

[← All algorithms](../README.md)
