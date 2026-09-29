# Maskenoza (DarkCrypt)

> 5-word (160-bit block) ARX cipher from the DarkCrypt Total Commander plugin: 80-round construction over 5 state words with a 4-group rotating boolean function (xor / (NOT.OR).XOR / xor / AND-XOR), an RC5-style + embedded-S-box key schedule, and a secondary RC4-KSA-like table permutation stage. 160-bit block, 512-bit key.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Expert |
| Inventor | Alexander Myasnikov (DarkCrypt / "Zarya" project) |
| Year | 2013 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/block/darkcrypt-maskenoza.js`](../../../algorithms/block/darkcrypt-maskenoza.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 64 bytes (512 bits) |
| Block sizes | 20 bytes (160 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Non-standard, unanalyzed design | Custom 5-word ARX construction with no public cryptanalysis; unusual RC4-KSA-derived round-key table; not recommended for real use. | Use AES or another vetted cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Maskenoza — zero key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `input` | `0000000000000000000000000000000000000000` |
| `expected` | `a4ec17eaaad1acbb6f78e90a812490682bfc2a43` |

**Vector 2** — [DarkCrypt Maskenoza — incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `input` | `000102030405060708090a0b0c0d0e0f10111213` |
| `expected` | `855d5abf4bfc45412d597d1d35770dba93b8dccf` |

**Vector 3** — [DarkCrypt Maskenoza — shifted incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f10 1112131415161718191a1b1c1d1e1f20 2122232425262728292a2b2c2d2e2f30 3132333435363738393a3b3c3d3e3f40` |
| `input` | `101112131415161718191a1b1c1d1e1f20212223` |
| `expected` | `f32bf65dd367edee52b8e08ba69ce4ce54f5a94a` |

---

[← All algorithms](../README.md)
