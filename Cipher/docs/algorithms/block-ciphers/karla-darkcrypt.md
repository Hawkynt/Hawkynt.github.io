# KARLA (DarkCrypt)

> 64-bit block, 160-bit key cipher from the DarkCrypt Total Commander plugin. Unbalanced generalized Feistel over four 16-bit words, 32 rounds using MD4/SHA-1-style choose/parity/majority round functions and a multiply-based key schedule.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Alexander Myasnikov (DarkCrypt "Zarya" project) |
| Year | 2013 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/block/darkcrypt-karla.js`](../../../algorithms/block/darkcrypt-karla.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 20 bytes (160 bits) |
| Block sizes | 8 bytes (64 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Unanalyzed proprietary design | Custom cipher with no public cryptanalysis. | Use AES or another vetted cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Karla — zero key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0000000000000000000000000000000000000000` |
| `input` | `0000000000000000` |
| `expected` | `c7bdb02ebf088d20` |

**Vector 2** — [DarkCrypt Karla — incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f10111213` |
| `input` | `0001020304050607` |
| `expected` | `7b9603d49fe463d3` |

**Vector 3** — [DarkCrypt Karla — shifted incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f1011121314` |
| `input` | `1011121314151617` |
| `expected` | `5ba154dec94695d3` |

---

[← All algorithms](../README.md)
