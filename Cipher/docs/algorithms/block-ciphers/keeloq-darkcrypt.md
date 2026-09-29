# KeeLoq (DarkCrypt)

> KeeLoq variant from the DarkCrypt Total Commander plugin: standard 528-round NLFSR core, but block and key words are packed little-endian (vs. big-endian in common reference implementations). 32-bit block, 64-bit key.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | ❌ Broken |
| Complexity | Beginner |
| Inventor | Nanoteq (Willem Smit); DarkCrypt packaging by Alexander Myasnikov |
| Year | 1985 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/block/darkcrypt-keeloq.js`](../../../algorithms/block/darkcrypt-keeloq.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 8 bytes (64 bits) |
| Block sizes | 4 bytes (32 bits) |

## Security

**Status:** ❌ Broken

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Cryptographically broken | Practical key-recovery attacks exist against KeeLoq; not suitable for real use. | Use AES or another vetted cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)
- [Wikipedia - KeeLoq](https://en.wikipedia.org/wiki/KeeLoq)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Published KeeLoq vector, in DarkCrypt little-endian byte order](https://github.com/hadipourh/KeeLoq)

| Field | Value |
| --- | --- |
| `key` | `49d99fb70167ec5c` |
| `input` | `dbe241f7` |
| `expected` | `df4c4fe4` |

**Vector 2** — [DarkCrypt Keeloq — incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0001020304050607` |
| `input` | `00010203` |
| `expected` | `24bc009e` |

**Vector 3** — [DarkCrypt Keeloq — shifted incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708` |
| `input` | `10111213` |
| `expected` | `75c2a9d9` |

---

[← All algorithms](../README.md)
