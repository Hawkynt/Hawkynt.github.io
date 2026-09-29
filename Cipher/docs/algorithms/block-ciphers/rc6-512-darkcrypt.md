# RC6-512 (DarkCrypt)

> RC6 variant from the DarkCrypt Total Commander plugin: standard 128-bit block, 20 rounds, extended to a 512-bit (64-byte) key. The key schedule packs each 4-byte key group big-endian (vs. textbook little-endian); the data block itself remains little-endian. As implemented in the DarkCrypt Total Commander plugin.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Ron Rivest, Matt Robshaw, Ray Sidney, Yiqun Lisa Yin; DarkCrypt variant by Alexander Myasnikov |
| Year | 1998 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/block/darkcrypt-rc6-512.js`](../../../algorithms/block/darkcrypt-rc6-512.js) |

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
| Non-standard key extension | 512-bit key size and big-endian key-byte packing are a non-standard, unanalyzed extension of RC6. | Use AES or another vetted cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)
- [RC6 Algorithm Specification](https://people.csail.mit.edu/rivest/Rivest-rc6.pdf)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Rc6-512 — zero key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `89353321da8ac0abf854ded7d845134b` |

**Vector 2** — [DarkCrypt Rc6-512 — incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `896e6b581c0d1a85607052b240b2f707` |

**Vector 3** — [DarkCrypt Rc6-512 — shifted incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f10 1112131415161718191a1b1c1d1e1f20 2122232425262728292a2b2c2d2e2f30 3132333435363738393a3b3c3d3e3f40` |
| `input` | `101112131415161718191a1b1c1d1e1f` |
| `expected` | `9f384a095e48086ebdb02763ad0e66c4` |

---

[← All algorithms](../README.md)
