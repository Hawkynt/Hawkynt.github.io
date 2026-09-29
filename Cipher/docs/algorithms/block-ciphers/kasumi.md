# KASUMI

> 3GPP block cipher for 3G mobile telecommunications security. Based on MISTY1 with 64-bit blocks and 128-bit keys. Uses 8-round Feistel structure with FO and FL functions. Employed in A5/3, f8, and f9 algorithms.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | 3GPP (3rd Generation Partnership Project) |
| Year | 1999 |
| Origin | 🌐 International |
| Source | [`algorithms/block/kasumi.js`](../../../algorithms/block/kasumi.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) |
| Block sizes | 8 bytes (64 bits) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [3GPP TS 35.202 - KASUMI Specification](https://www.3gpp.org/ftp/Specs/archive/35_series/35.202/)
- [Wikipedia: KASUMI](https://en.wikipedia.org/wiki/KASUMI)
- [LibTomCrypt Implementation](https://github.com/libtom/libtomcrypt/blob/develop/src/ciphers/kasumi.c)

## References

- [ETSI TS 135 202 - KASUMI Specification (C reference code in annex)](https://www.etsi.org/deliver/etsi_ts/135200_135299/135202/07.00.00_60/ts_135202v070000p.pdf)
- [ETSI TS 135 201 - f8/f9 Specification (C reference code in annex)](https://www.etsi.org/deliver/etsi_ts/135200_135299/135201/09.00.00_60/ts_135201v090000p.pdf)

## Test vectors

11 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt KASUMI-128 vector 1/zero](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000` |
| `input` | `0000000000000000` |
| `expected` | `f54cfbf75f3b5699` |

**Vector 2** — [DarkCrypt KASUMI-128 vector 2/incr](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `0001020304050607` |
| `expected` | `bb6b2e0c88ad7c37` |

**Vector 3** — [DarkCrypt KASUMI-128 vector 3/incr2](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f10` |
| `input` | `1011121314151617` |
| `expected` | `455a65f01cfe4adc` |

**Vector 4** — [LibTomCrypt Vector #1: Single bit key (bit 0)](https://github.com/libtom/libtomcrypt/blob/develop/src/ciphers/kasumi.c)

| Field | Value |
| --- | --- |
| `key` | `80000000000000000000000000000000` |
| `input` | `0000000000000000` |
| `expected` | `4b58a771afc7e5e8` |

**Vector 5** — [LibTomCrypt Vector #2: Single bit key (bit 8)](https://github.com/libtom/libtomcrypt/blob/develop/src/ciphers/kasumi.c)

| Field | Value |
| --- | --- |
| `key` | `00800000000000000000000000000000` |
| `input` | `0000000000000000` |
| `expected` | `7eef113c95bb5a77` |

**Vector 6** — [LibTomCrypt Vector #3: Single bit key (bit 16)](https://github.com/libtom/libtomcrypt/blob/develop/src/ciphers/kasumi.c)

| Field | Value |
| --- | --- |
| `key` | `00008000000000000000000000000000` |
| `input` | `0000000000000000` |
| `expected` | `5f140686d7ad5a39` |

**Vector 7** — [LibTomCrypt Vector #4: Single bit key (bit 120)](https://github.com/libtom/libtomcrypt/blob/develop/src/ciphers/kasumi.c)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000001` |
| `input` | `0000000000000000` |
| `expected` | `2e1491cf70aa465d` |

**Vector 8** — [LibTomCrypt Vector #5: Single bit key (bit 112)](https://github.com/libtom/libtomcrypt/blob/develop/src/ciphers/kasumi.c)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000100` |
| `input` | `0000000000000000` |
| `expected` | `b54586f4ab9ae546` |

**Vector 9** — [Botan kasumi.vec vector 1](https://github.com/randombit/botan/blob/2.19.3/src/tests/data/block/kasumi.vec)

| Field | Value |
| --- | --- |
| `key` | `2bd6459f82c5b300952c49104881ff48` |
| `input` | `ea024714ad5c4d84` |
| `expected` | `df1f9b251c0bf45f` |

**Vector 10** — [Botan kasumi.vec vector 2](https://github.com/randombit/botan/blob/2.19.3/src/tests/data/block/kasumi.vec)

| Field | Value |
| --- | --- |
| `key` | `8ce33e2cc3c0b5fc1f3de8a6dc66b1f3` |
| `input` | `d3c5d592327fb11c` |
| `expected` | `de551988ceb2f9b7` |

**Vector 11** — [Botan kasumi.vec vector 3](https://github.com/randombit/botan/blob/2.19.3/src/tests/data/block/kasumi.vec)

| Field | Value |
| --- | --- |
| `key` | `4035c6680af8c6d1a8ff8667b1714013` |
| `input` | `62a540981ba6f9b7` |
| `expected` | `4592b0e78690f71b` |

---

[← All algorithms](../README.md)
