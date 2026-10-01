# FNAm2-512 (DarkCrypt)

> FNAm2 (Feistel Net Algorithm mark 2) as shipped with the DarkCrypt Total Commander plugin. A 128-bit-block / 512-bit-key ARX-with-multiply construction: 64 sequential steps mix the four little-endian words using subkeys built by 32-bit multiplication from the key, the step number and the block's position in the message.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Alexey Kobzin (DarkCrypt implementation by Alexander Myasnikov) |
| Year | 2009 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/block/darkcrypt-fnam2.js`](../../../algorithms/block/darkcrypt-fnam2.js) |

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
| Non-standard cipher | Amateur ARX-with-multiply design without published cryptanalysis; not recommended for real use. | Use AES or another vetted cipher. |

## Documentation

- [FNAm2 reference C source (fnam2.c, cartman-cipher mirror)](https://cartman-cipher.narod.ru/mirror/fnam2.zip)
- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)

## Test vectors

6 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Fnam2 — zero key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `e7dbfb251bf0fcfb302602cc2cfe03f2` |

**Vector 2** — [DarkCrypt Fnam2 — incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `838b7b06c845801344698e2fd3b89fc0` |

**Vector 3** — [DarkCrypt Fnam2 — shifted incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f10 1112131415161718191a1b1c1d1e1f20 2122232425262728292a2b2c2d2e2f30 3132333435363738393a3b3c3d3e3f40` |
| `input` | `101112131415161718191a1b1c1d1e1f` |
| `expected` | `7baf2995776dab041609d53a6b4b59c7` |

**Vector 4** — [DarkCrypt Fnam2 — four zero blocks (per-block subkeys)](https://cartman-cipher.narod.ru/mirror/fnam2.zip)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `expected` | `e7dbfb251bf0fcfb302602cc2cfe03f2 399dfb35a02cc6fa236003b82c1d1121 f9defb1b1c9ee8aa2bc9020a31a91179 6719fd279e078a1acf7102ee2924a03e` |

**Vector 5** — [DarkCrypt Fnam2 — three incrementing blocks, encryption](https://cartman-cipher.narod.ru/mirror/fnam2.zip)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f` |
| `expected` | `838b7b06c845801344698e2fd3b89fc0 b6aa47fdc0a586afab4fd529ed4071de f30c3a0c501ae7ccbf86f316fd42d5ca` |

**Vector 6** — [DarkCrypt Fnam2 — three incrementing blocks, from the plugin's decryption](https://cartman-cipher.narod.ru/mirror/fnam2.zip)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `input` | `5deae5e351e0f3a4ab28d570de4af746 905e59febfb0c7f66b7ac4e1ef8f288d a4e89bc3bef249d6e6e580768f26e7d7` |
| `expected` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f` |

---

[← All algorithms](../README.md)
