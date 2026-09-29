# Ixchel (DarkCrypt)

> 128-bit block, 512-bit key cipher from the DarkCrypt Total Commander plugin. Sixteen-round ARX network over four 32-bit words: a branching addition diffusion layer followed by keyed rol16/shl6-xor-shr8 mixing stages and a substitution-table-driven nonlinear layer. RC6-style key schedule driven by a fixed 32x256 substitution table.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Alexander Myasnikov (DarkCrypt / Zarya) |
| Year | 2009 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/block/darkcrypt-ixchel.js`](../../../algorithms/block/darkcrypt-ixchel.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 64 bytes (512 bits) |
| Block sizes | 16 bytes (128 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Obscure unanalyzed cipher | Non-standard proprietary design with no public cryptanalysis. | Use AES or another vetted cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Ixchel - zero key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `1a37059bac0edd65d4cbb1187d9ce7fd` |

**Vector 2** — [DarkCrypt Ixchel - incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `e511c3628a58b5a5371ebe39ba7598a7` |

**Vector 3** — [DarkCrypt Ixchel - shifted incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f10 1112131415161718191a1b1c1d1e1f20 2122232425262728292a2b2c2d2e2f30 3132333435363738393a3b3c3d3e3f40` |
| `input` | `101112131415161718191a1b1c1d1e1f` |
| `expected` | `c8fb1d33d8140b25e43fa6a4ed603962` |

---

[← All algorithms](../README.md)
