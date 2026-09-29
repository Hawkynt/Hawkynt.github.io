# SAFER-SK128 (DarkCrypt)

> SAFER SK-128 block cipher (James Massey, strengthened key schedule by Lars Knudsen). 64-bit block, 128-bit key. This DarkCrypt build uses 8 rounds (the SK-64 recommendation) rather than the SK-128-standard 10.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | James Massey (SAFER); strengthened key schedule by Lars Knudsen |
| Year | 1995 |
| Origin | 🇨🇭 Switzerland |
| Source | [`algorithms/block/darkcrypt-safer-sk128.js`](../../../algorithms/block/darkcrypt-safer-sk128.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) |
| Block sizes | 8 bytes (64 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Small block size | 64-bit block size is vulnerable to birthday-bound attacks on large volumes of data. | Avoid encrypting large amounts of data with a single key. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)
- [SAFER (Wikipedia)](https://en.wikipedia.org/wiki/SAFER)
- [Announcement of a Strengthened Key Schedule for the Cipher SAFER (J.L. Massey)](https://www.researchgate.net/publication/2334323)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Safer128 — zero key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000` |
| `input` | `0000000000000000` |
| `expected` | `62c4803deb82506d` |

**Vector 2** — [DarkCrypt Safer128 — incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `0001020304050607` |
| `expected` | `f9820c2fd85d91b6` |

**Vector 3** — [DarkCrypt Safer128 — shifted incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f10` |
| `input` | `1011121314151617` |
| `expected` | `4334e11aac2fdd2c` |

---

[← All algorithms](../README.md)
