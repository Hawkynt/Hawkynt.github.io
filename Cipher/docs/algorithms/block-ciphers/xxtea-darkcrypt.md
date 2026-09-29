# XXTEA (DarkCrypt)

> XXTEA / Corrected Block TEA fixed to a 30-word (960-bit) block, as implemented in the DarkCrypt Total Commander plugin. Follows the standard MX()-based structure but with non-standard shifts (9/2, 3/6 vs textbook 5/2, 3/4) and 12 rounds (vs textbook formula's 7 for n=30). 128-bit key.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | David Wheeler, Roger Needham (base XXTEA); DarkCrypt variant by Alexander Myasnikov |
| Year | 2013 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/block/darkcrypt-xxtea.js`](../../../algorithms/block/darkcrypt-xxtea.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) |
| Block sizes | 120 bytes (960 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Non-standard variant | XXTEA fixed to a single block size with unusual shift amounts and round count; unanalyzed and not recommended for real use. | Use AES or another vetted cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)
- [XXTEA / Correction to XTEA](http://www.movable-type.co.uk/scripts/xxtea.pdf)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Xxtea30 — zero key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 0000000000000000` |
| `expected` | `11d1a19de7a3be1c9aae815df67d4f1b ec800c8cbd24b5d4935aad1040e448e9 72b0ebed01a6b8df10c1ce47cf108ba9 199670cb2917d8ab2340d1be675a77f9 6b589b5ee5de5940b52ddb230372240a 9845113adbfe407c1e3cbeb2e087e860 7716cf873ff520647c87f8eea714f4b0 fe85c822b8efbbc3` |

**Vector 2** — [DarkCrypt Xxtea30 — incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f 505152535455565758595a5b5c5d5e5f 606162636465666768696a6b6c6d6e6f 7071727374757677` |
| `expected` | `3057ac052bfd1a5c1e21ac3cb1f2061a 38f9a294a7be9f20bd663d384d033d12 d8d9e1806224031437f978262ef1615a 0114bce2b9f8a690f5370ab60e46e6ca be6376ef7ec3b7606b510624f0bd9011 d33c66c368a0d6e700d1451d673787aa 24d0d31a31c0abc2114f87531cd86da3 75e12a2bc2b112de` |

**Vector 3** — [DarkCrypt Xxtea30 — shifted incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f10` |
| `input` | `101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f 505152535455565758595a5b5c5d5e5f 606162636465666768696a6b6c6d6e6f 707172737475767778797a7b7c7d7e7f 8081828384858687` |
| `expected` | `2b936df03d617f3f0348038a3fe39b7a 4698e9203614461e4eefe40f5a0d8c25 e2ec73cb2b3d7caad61bc8eaaf84cdc3 58028c5a8691f693948467d33a90c2d8 75173b42c1accbce8dde564c59c86d41 b50a1e9faf0b2b52237b8a4c18c68c04 a149a1f70e64457e1b5506e056e31dba 0c0fa7d3fa9450b8` |

---

[← All algorithms](../README.md)
