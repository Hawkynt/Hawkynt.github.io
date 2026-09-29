# HPC-256 (DarkCrypt)

> Hasty Pudding Cipher (HPC-Medium sub-cipher) as shipped in the DarkCrypt Total Commander plugin. Uses Rich Schroeppel's original 1998 key-stirring (pre-Wagner-fix); the 96-byte key seeds a 256-bit KX expansion while its last 64 bytes act as an 8-word spice/tweak. 128-bit block, 768-bit key.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Rich Schroeppel (base HPC); DarkCrypt variant by Alexander Myasnikov |
| Year | 2013 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/block/darkcrypt-hpc.js`](../../../algorithms/block/darkcrypt-hpc.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 96 bytes (768 bits) |
| Block sizes | 16 bytes (128 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Non-standard variant | Modified HPC using the original pre-Wagner-fix stirring and a fixed 256-bit key-seed length; unanalyzed and not recommended for real use. | Use AES or another vetted cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)
- [Hasty Pudding Cipher (Rich Schroeppel, AES submission)](https://richard.schroeppel.name:8015/hpc/)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Hpc — zero key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `e8d77b317b6ea04abfcb67a2ef4879cb` |

**Vector 2** — [DarkCrypt Hpc — incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f 505152535455565758595a5b5c5d5e5f` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `3d158e9dc45de315e1cef91efd369acc` |

**Vector 3** — [DarkCrypt Hpc — shifted incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f10 1112131415161718191a1b1c1d1e1f20 2122232425262728292a2b2c2d2e2f30 3132333435363738393a3b3c3d3e3f40 4142434445464748494a4b4c4d4e4f50 5152535455565758595a5b5c5d5e5f60` |
| `input` | `101112131415161718191a1b1c1d1e1f` |
| `expected` | `4d686475ede1aff9e60ef040fd5968f2` |

---

[← All algorithms](../README.md)
