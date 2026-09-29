# Enrupt-512-512 (DarkCrypt)

> EnRUPT-family ARX block cipher from the DarkCrypt Total Commander plugin. 512-bit block and 512-bit key, both as 16 little-endian 32-bit words. 192 sliding-window add/rotate/xor steps with round function 9*ror((2*a)^b^k^i,8); no S-boxes.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Sean O'Neil (EnRUPT family); DarkCrypt variant by Alexander Myasnikov |
| Year | 2013 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/block/darkcrypt-enrupt.js`](../../../algorithms/block/darkcrypt-enrupt.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 64 bytes (512 bits) |
| Block sizes | 64 bytes (512 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Non-standard / unvetted variant | A custom EnRUPT-family construction with unusual step count and window layout; the EnRUPT family itself was not selected in the SHA-3/eSTREAM processes and this variant is unanalyzed. | Use AES or another vetted cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)
- [EnRUPT (base design by Sean O'Neil)](https://www.enrupt.com/)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Enrupt — zero key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `expected` | `0c77adc0d76a5fbe7f05e481327af720 20541cdfe571ef6e8f141385dde00975 27f676c436fc90dc9abbff82cdc05986 ad92b7f1c06b611e0b5258d9fbc8d1fb` |

**Vector 2** — [DarkCrypt Enrupt — incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `expected` | `25395342858a086e553ea6f50c8d9288 7f6c7220fd6c7b8b68865a49482f83d7 c8ec3200d836cd8ab87b0d7cf127d021 5b51af3de44a805e9aab5e05eabb97d8` |

**Vector 3** — [DarkCrypt Enrupt — shifted incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f10 1112131415161718191a1b1c1d1e1f20 2122232425262728292a2b2c2d2e2f30 3132333435363738393a3b3c3d3e3f40` |
| `input` | `101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f` |
| `expected` | `d1e5d9fcb3c9b9e61535c1adb9820829 92397219f2fb387465c019fc61b87e4f 43d3c9fc3390536f881a916a707003bf 33d1361aa2bf5ea0a4c102d00c6dd73b` |

---

[← All algorithms](../README.md)
