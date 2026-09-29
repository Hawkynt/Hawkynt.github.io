# ASCON-XOF

> Lightweight extendable output function (XOF) based on Ascon permutation, standardized by NIST. Supports variable-length output with efficient hardware and software implementations for constrained environments.

## Properties

| Property | Value |
| --- | --- |
| Category | Hash Functions |
| Sub-category | Lightweight XOF |
| Security status | 🧪 Experimental |
| Complexity | Advanced |
| Inventor | Christoph Dobraunig, Maria Eichlseder, Florian Mendel, Martin Schläffer |
| Year | 2014 |
| Origin | 🌐 International |
| Source | [`algorithms/hash/ascon-hash.js`](../../../algorithms/hash/ascon-hash.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Output sizes | 1 byte (8 bits) to 1024 bytes (8192 bits) |

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

8 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [ASCON-XOF: Empty message (Count=1)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/ASCON-XOF.txt)

| Field | Value |
| --- | --- |
| `outputSize` | `32` |
| `input` | _(empty)_ |
| `expected` | `5d4cbde6350ea4c174bd65b5b332f8408f99740b81aa02735eaefbcf0ba0339e` |

**Vector 2** — [ASCON-XOF: Single byte 0x00 (Count=2)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/ASCON-XOF.txt)

| Field | Value |
| --- | --- |
| `outputSize` | `32` |
| `input` | `00` |
| `expected` | `b2edbb27ac8397a55bc83d137c151de9ede048338fe907f0d3629e717846fedc` |

**Vector 3** — [ASCON-XOF: Two bytes (Count=3)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/ASCON-XOF.txt)

| Field | Value |
| --- | --- |
| `outputSize` | `32` |
| `input` | `0001` |
| `expected` | `d196461c299db714d78c267924b5786ee26fc43b3e640daa5397e38e39d39dc6` |

**Vector 4** — [ASCON-XOF: Three bytes (Count=4)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/ASCON-XOF.txt)

| Field | Value |
| --- | --- |
| `outputSize` | `32` |
| `input` | `000102` |
| `expected` | `1d18b9dd8ff9a1bf59751b88d32766c5e054910f497bff4092afc47f5885523b` |

**Vector 5** — [ASCON-XOF: Four bytes (Count=5)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/ASCON-XOF.txt)

| Field | Value |
| --- | --- |
| `outputSize` | `32` |
| `input` | `00010203` |
| `expected` | `66fb74174782afed898478aa729058d5c30af19af2f5d4e1ce65cd320594ef66` |

**Vector 6** — [ASCON-XOF: Eight bytes (Count=9)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/ASCON-XOF.txt)

| Field | Value |
| --- | --- |
| `outputSize` | `32` |
| `input` | `0001020304050607` |
| `expected` | `18427d2d29df1e0202649f032f2080363fec5de72ecae11b4f98ccc75843e7cc` |

**Vector 7** — [ASCON-XOF: Sixteen bytes (Count=17)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/ASCON-XOF.txt)

| Field | Value |
| --- | --- |
| `outputSize` | `32` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `c861a89cfb1335f278c96cf7ffc9753c290cbe1a4e186d2923b496bb4ea5e519` |

**Vector 8** — [ASCON-XOF: 32 bytes (Count=33)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/ASCON-XOF.txt)

| Field | Value |
| --- | --- |
| `outputSize` | `32` |
| `input` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `expected` | `0b8e325b9bbf1bb43e77aa1eed93bee62b4ea1e4b0c5a696b2f5c5b09c968918` |

---

[← All algorithms](../README.md)
