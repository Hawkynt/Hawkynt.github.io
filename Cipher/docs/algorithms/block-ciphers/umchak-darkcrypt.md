# Umchak (DarkCrypt)

> TEA-family block cipher from the DarkCrypt Total Commander plugin: 64-bit block, 512-bit key, 64-word round-key schedule built by an RC5-constant-driven S-box mixing pass followed by a modified RC4-style permutation.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | DarkCrypt variant by Alexander Myasnikov |
| Year | 2013 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/block/darkcrypt-umchak.js`](../../../algorithms/block/darkcrypt-umchak.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 64 bytes (512 bits) |
| Block sizes | 8 bytes (64 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Unanalyzed non-standard cipher | Undocumented DarkCrypt-specific design with no public cryptanalysis. | Use AES or another vetted cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Umchak — zero key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `input` | `0000000000000000` |
| `expected` | `f6d28498b21e3b96` |

**Vector 2** — [DarkCrypt Umchak — incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `input` | `0001020304050607` |
| `expected` | `a9c7de5d888323cb` |

**Vector 3** — [DarkCrypt Umchak — shifted incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f10 1112131415161718191a1b1c1d1e1f20 2122232425262728292a2b2c2d2e2f30 3132333435363738393a3b3c3d3e3f40` |
| `input` | `1011121314151617` |
| `expected` | `567f7aa3640a8177` |

---

[← All algorithms](../README.md)
