# DryGASCON256-HASH

> Extended lightweight hash function using DrySPONGE construction with GASCON permutation. Provides 512-bit hash output with enhanced security margin and side-channel resistance.

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
| Output sizes | 64 bytes (512 bits) |

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

**Vector 1** — [DryGASCON256-HASH: Empty message (Count=1)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/DryGASCON256-HASH.txt)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `6896590a319fde1f3b18ebae1df1e5e8 fb0756a878ee9e2165b085ff3aed6805 f8f73d5714c75960a6a8095dae5ef9c0 0d3f055490d4cf45d4a26b37fd7b5441` |

**Vector 2** — [DryGASCON256-HASH: Single byte 0x00 (Count=2)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/DryGASCON256-HASH.txt)

| Field | Value |
| --- | --- |
| `input` | `00` |
| `expected` | `dab16b97c37160586b647b0dca689794 365480324e539cd63f87b119b0c46668 dcde5163a170e06da9361b05f7ce7645 ef68bdc99b3b813b8b1583c5c62d4e4a` |

**Vector 3** — [DryGASCON256-HASH: Two bytes (Count=3)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/DryGASCON256-HASH.txt)

| Field | Value |
| --- | --- |
| `input` | `0001` |
| `expected` | `d1982bc43d8c42dcd94c1c7e96119513 74dc8bf5e6fc407e8a8dc423f4f0f459 09a4aeaa1000b35a8081862e79750880 7e8763f611aef1d3c06ecaedb5229980` |

**Vector 4** — [DryGASCON256-HASH: Four bytes (Count=5)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/DryGASCON256-HASH.txt)

| Field | Value |
| --- | --- |
| `input` | `00010203` |
| `expected` | `3c4c288299fd3986fb213b945addb70f 26edea09fa4291cf42467355da09fdd7 e69a7b306636dac078ee81643a19f512 6ea71dbc4032be2320b8382119238d5b` |

**Vector 5** — [DryGASCON256-HASH: Eight bytes (Count=9)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/DryGASCON256-HASH.txt)

| Field | Value |
| --- | --- |
| `input` | `0001020304050607` |
| `expected` | `ac99fd9156d4c6fc613a85cbbfd283fc 7214792b3e786e34b33d368020f79bf6 ffc2c29fa86eaf1286506f30adb3481b 3830e115ae72f155c3045dd8a27894d1` |

**Vector 6** — [DryGASCON256-HASH: 16 bytes (Count=17)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/DryGASCON256-HASH.txt)

| Field | Value |
| --- | --- |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `e743de651072ae1a078d201373bc383f fae607545308d268ac663b0b680fee8b d0d053ea40a55c5dd2aee281c1cbffa7 9152acc9bd5705f3fb4daf415458ca12` |

---

[← All algorithms](../README.md)
