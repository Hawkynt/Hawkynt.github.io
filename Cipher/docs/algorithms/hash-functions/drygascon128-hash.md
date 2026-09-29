# DryGASCON128-HASH

> Lightweight hash function using DrySPONGE construction with GASCON permutation. NIST Lightweight Cryptography finalist providing 256-bit hash output with protection against side-channel attacks.

## Properties

| Property | Value |
| --- | --- |
| Category | Hash Functions |
| Sub-category | Lightweight Hash |
| Security status | 🧪 Experimental |
| Complexity | Advanced |
| Inventor | Sébastien Riou, Michaël Raulet, Stéphane Castelain |
| Year | 2020 |
| Origin | Not specified |
| Source | [`algorithms/hash/drygascon-hash.js`](../../../algorithms/hash/drygascon-hash.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Output sizes | 32 bytes (256 bits) |

## Security

**Status:** 🧪 Experimental

No vulnerabilities are recorded for this implementation.

## Documentation

- [DryGASCON GitHub Repository](https://github.com/sebastien-riou/DryGASCON)
- [NIST LWC Project Page](https://csrc.nist.gov/projects/lightweight-cryptography)
- [DryGASCON Specification](https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-spec-doc/drygascon-spec-final.pdf)

## References

- [Official DryGASCON reference implementation (Sébastien Riou)](https://github.com/sebastien-riou/DryGASCON)

## Test vectors

6 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DryGASCON128-HASH: Empty message (Count=1)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/DryGASCON128-HASH.txt)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `1edc77386e20a37c721d6e77adabb9c4830f199f5ed25284a13c1d84b9fc257a` |

**Vector 2** — [DryGASCON128-HASH: Single byte 0x00 (Count=2)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/DryGASCON128-HASH.txt)

| Field | Value |
| --- | --- |
| `input` | `00` |
| `expected` | `1bec89506e75d725bf93bccfdd6ec81df05ca281cf5201e3ee0865a7063763ee` |

**Vector 3** — [DryGASCON128-HASH: Two bytes (Count=3)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/DryGASCON128-HASH.txt)

| Field | Value |
| --- | --- |
| `input` | `0001` |
| `expected` | `0fe4ed67ea1ff705e94e6d8af07197728c1fc2d7d5accecb8d08cf39ae4d208d` |

**Vector 4** — [DryGASCON128-HASH: Four bytes (Count=5)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/DryGASCON128-HASH.txt)

| Field | Value |
| --- | --- |
| `input` | `00010203` |
| `expected` | `591a2858b4e3b0b99bc116e18b44b55d711f2a8e83fae677ced46db03e031b73` |

**Vector 5** — [DryGASCON128-HASH: Eight bytes (Count=9)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/DryGASCON128-HASH.txt)

| Field | Value |
| --- | --- |
| `input` | `0001020304050607` |
| `expected` | `cde2dee0235345cbfa51ec2ce57435718ec0133ec2756e035fa404c1ce511e24` |

**Vector 6** — [DryGASCON128-HASH: 16 bytes (Count=17)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/DryGASCON128-HASH.txt)

| Field | Value |
| --- | --- |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `572821d80d943e153cbb8c4556c3ad8cf20d77edad7998e8cd46f590d8d13eeb` |

---

[← All algorithms](../README.md)
