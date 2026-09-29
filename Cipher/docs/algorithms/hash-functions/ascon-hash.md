# ASCON-HASH

> Lightweight hash function based on Ascon permutation, finalist in CAESAR competition and standardized by NIST. Provides 256-bit security with efficient hardware and software implementations.

## Properties

| Property | Value |
| --- | --- |
| Category | Hash Functions |
| Sub-category | Lightweight Hash |
| Security status | 🧪 Experimental |
| Complexity | Advanced |
| Inventor | Christoph Dobraunig, Maria Eichlseder, Florian Mendel, Martin Schläffer |
| Year | 2014 |
| Origin | 🌐 International |
| Source | [`algorithms/hash/ascon-hash.js`](../../../algorithms/hash/ascon-hash.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Output sizes | 32 bytes (256 bits) |

## Security

**Status:** 🧪 Experimental

No vulnerabilities are recorded for this implementation.

## Documentation

- [NIST Lightweight Cryptography](https://csrc.nist.gov/projects/lightweight-cryptography)
- [Ascon Official Website](https://ascon.iaik.tugraz.at/)
- [NIST SP 800-232: Ascon Standard](https://csrc.nist.gov/pubs/sp/800/232/final)
- [CAESAR Competition](https://competitions.cr.yp.to/caesar.html)

## References

- [Official Ascon C reference implementation](https://github.com/ascon/ascon-c)
- [Ascon Python reference implementation](https://github.com/ascon/ascon-python)

## Test vectors

6 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [ASCON-HASH: Empty message (Count=1)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/ASCON-HASH.txt)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `7346bc14f036e87ae03d0997913088f5f68411434b3cf8b54fa796a80d251f91` |

**Vector 2** — [ASCON-HASH: Single byte 0x00 (Count=2)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/ASCON-HASH.txt)

| Field | Value |
| --- | --- |
| `input` | `00` |
| `expected` | `8dd446ada58a7740ecf56eb638ef775f7d5c0fd5f0c2bbbdfdec29609d3c43a2` |

**Vector 3** — [ASCON-HASH: Two bytes (Count=3)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/ASCON-HASH.txt)

| Field | Value |
| --- | --- |
| `input` | `0001` |
| `expected` | `f77ca13bf89146d3254f1cfb7eddba8fa1bf162284bb29e7f645545cf9e08424` |

**Vector 4** — [ASCON-HASH: Three bytes (Count=4)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/ASCON-HASH.txt)

| Field | Value |
| --- | --- |
| `input` | `000102` |
| `expected` | `15ccf3b00f73ef96faa08c9b440660bea52d6f6aa53c8e2da3f8200a990a122f` |

**Vector 5** — [ASCON-HASH: Four bytes (Count=5)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/ASCON-HASH.txt)

| Field | Value |
| --- | --- |
| `input` | `00010203` |
| `expected` | `8013eaaa1951580a7bef7d29bac323377e64f279ea73e6881b8aed69855ef764` |

**Vector 6** — [ASCON-HASH: Eight bytes (Count=9)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/ASCON-HASH.txt)

| Field | Value |
| --- | --- |
| `input` | `0001020304050607` |
| `expected` | `f4c6a44b29915d3d57cf928a18ec6226bb8dd6c1136acd24965f7e7780cd69cf` |

---

[← All algorithms](../README.md)
