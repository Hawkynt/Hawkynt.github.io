# CLEFIA

> Sony's CLEFIA block cipher (RFC 6114) with 128-bit blocks and variable key lengths. Generalized Feistel Network design optimized for lightweight implementations.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | Not classified |
| Complexity | Intermediate |
| Inventor | Sony Corporation |
| Year | 2007 |
| Origin | 🇯🇵 Japan |
| Source | [`algorithms/block/clefia.js`](../../../algorithms/block/clefia.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) to 32 bytes (256 bits) in steps of 8 bytes |
| Block sizes | 16 bytes (128 bits) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [RFC 6114: The 128-Bit Blockcipher CLEFIA](https://www.rfc-editor.org/rfc/rfc6114.html)
- [ISO/IEC 29192-2:2012](https://www.iso.org/standard/56552.html)

## References

- [Sony CLEFIA Reference Code (clefia_ref.c)](https://www.sony.net/Products/cryptography/clefia/download/data/clefia_ref.c)
- [go-clefia (port of Sony reference C code)](https://github.com/dgryski/go-clefia)

## Test vectors

6 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt CLEFIA vector 1/zero](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0000000000000000000000000000000000000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `c75294761d52fb97ab7955d877164213` |

**Vector 2** — [DarkCrypt CLEFIA vector 2/incr](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `3a92f62a3f938146d9ca6303f5b3d790` |

**Vector 3** — [DarkCrypt CLEFIA vector 3/incr2](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20` |
| `input` | `101112131415161718191a1b1c1d1e1f` |
| `expected` | `eee2469ffc539734e5f93330cc6d8523` |

**Vector 4** — [RFC 6114 Appendix A - CLEFIA-128 test vector](https://www.rfc-editor.org/rfc/rfc6114.html#appendix-A)

| Field | Value |
| --- | --- |
| `key` | `ffeeddccbbaa99887766554433221100` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `de2bf2fd9b74aacdf1298555459494fd` |

**Vector 5** — [RFC 6114 Appendix A - CLEFIA-192 test vector](https://www.rfc-editor.org/rfc/rfc6114.html#appendix-A)

| Field | Value |
| --- | --- |
| `key` | `ffeeddccbbaa99887766554433221100f0e0d0c0b0a09080` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `e2482f649f028dc480dda184fde181ad` |

**Vector 6** — [RFC 6114 Appendix A - CLEFIA-256 test vector](https://www.rfc-editor.org/rfc/rfc6114.html#appendix-A)

| Field | Value |
| --- | --- |
| `key` | `ffeeddccbbaa99887766554433221100f0e0d0c0b0a090807060504030201000` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `a1397814289de80c10da46d1fa48b38a` |

---

[← All algorithms](../README.md)
