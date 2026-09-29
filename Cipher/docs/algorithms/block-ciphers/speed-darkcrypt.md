# SPEED (DarkCrypt)

> SPEED cipher as implemented by the DarkCrypt Total Commander plugin: an 8x16-bit-word unbalanced shift-register cipher with 64 rounds split into four 16-round groups, each using its own nonlinear Boolean combining function, plus a 64-word expanded key schedule. 128-bit block, fixed 256-bit key.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Yuliang Zheng; DarkCrypt variant |
| Year | 1997 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/block/darkcrypt-speed.js`](../../../algorithms/block/darkcrypt-speed.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 32 bytes (256 bits) |
| Block sizes | 16 bytes (128 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Non-standard variant | DarkCrypt-specific SPEED parameterization (round-group Boolean functions, key schedule) not matched to any published SPEED reference vectors; unanalyzed and not recommended for real use. | Use AES or another vetted cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)
- [SPEED Cipher Paper (Yuliang Zheng)](https://link.springer.com/chapter/10.1007/3-540-63594-7_68)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Speed — zero key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0000000000000000000000000000000000000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `399531b3ea9d535c2b472ba48adfefd3` |

**Vector 2** — [DarkCrypt Speed — incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `ef7717912202cea01703af3a74323942` |

**Vector 3** — [DarkCrypt Speed — shifted incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20` |
| `input` | `101112131415161718191a1b1c1d1e1f` |
| `expected` | `638b7085b28fd4f6cdeab2f5f10a753f` |

---

[← All algorithms](../README.md)
