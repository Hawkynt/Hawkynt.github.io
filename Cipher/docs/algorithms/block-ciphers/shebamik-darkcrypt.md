# Shebamik (DarkCrypt)

> 160-bit block, 512-bit key cipher from the DarkCrypt Total Commander plugin. The SHA-1 compression function (five-word ARX state, ROTL5/ROTL30, Ch/Parity/Maj/Parity boolean functions, standard SHA-1 round constants) run as an 80-round keyed block cipher: an 80-word round-subkey schedule replaces SHA-1's message schedule and the round update accumulates additively so the transform is invertible. ADD whitening before the rounds, XOR whitening after. RC6/Blowfish-style key schedule driven by a fixed substitution table feeding two chained RC4-style key schedules.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Alexander Myasnikov (DarkCrypt / "Zarya" project) |
| Year | 2009 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/block/darkcrypt-shebamik.js`](../../../algorithms/block/darkcrypt-shebamik.js) |

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
| Obscure unanalyzed variant | Non-standard SHA-1-derived block cipher construction with no public cryptanalysis. | Use AES or another vetted cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Shebamik - zero key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `input` | `0000000000000000000000000000000000000000` |
| `expected` | `8131febb310fdfec6f15093f3303554a853d10f9` |

**Vector 2** — [DarkCrypt Shebamik - incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `input` | `000102030405060708090a0b0c0d0e0f10111213` |
| `expected` | `a799446a556109c89206395da9d5fef887bd61c6` |

**Vector 3** — [DarkCrypt Shebamik - shifted incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f10 1112131415161718191a1b1c1d1e1f20 2122232425262728292a2b2c2d2e2f30 3132333435363738393a3b3c3d3e3f40` |
| `input` | `101112131415161718191a1b1c1d1e1f20212223` |
| `expected` | `27ba0df9df9ec6df8b0486f517e9f480843d88e7` |

---

[← All algorithms](../README.md)
