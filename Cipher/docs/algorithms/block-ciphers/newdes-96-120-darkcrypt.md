# NewDES'96-120 (DarkCrypt)

> 1996-revised NewDES cipher by Robert Scott (fixed key schedule) as implemented in the DarkCrypt Total Commander plugin: 64-bit block, 120-bit key, same rotor S-box as NewDES but with an extra key-derived XOR term mixed in at three points of the key cycle to remove the related-key weakness.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Robert Scott; DarkCrypt port by Alexander Myasnikov |
| Year | 1996 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/block/darkcrypt-newdes96.js`](../../../algorithms/block/darkcrypt-newdes96.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 15 bytes (120 bits) |
| Block sizes | 8 bytes (64 bits) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)
- [NewDES original article (Cryptologia 9(1), 1985)](https://www.tandfonline.com/doi/abs/10.1080/0161-118591857944)
- [newdes.c, revised 3-2-96 (better key expansion), released to the public domain by Robert Scott](https://github.com/stamparm/cryptospecs/blob/master/symmetrical/sources/newdes.c)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Newdes96 — zero key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000000000000000000000000000000` |
| `input` | `0000000000000000` |
| `expected` | `a2176054f58b3458` |

**Vector 2** — [DarkCrypt Newdes96 — incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e` |
| `input` | `0001020304050607` |
| `expected` | `9f20bedbc9eb0801` |

**Vector 3** — [DarkCrypt Newdes96 — shifted incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f` |
| `input` | `1011121314151617` |
| `expected` | `58c0b08406d12b14` |

---

[← All algorithms](../README.md)
