# REDOC III (DarkCrypt)

> REDOC III as implemented in the DarkCrypt Total Commander plugin: Michael Wood's REDOC III applied to an 80-bit block (only the first 8 bytes are transformed, the last 2 pass through unchanged) with a fixed 256-bit key. The plugin leaves the upper 16 bits of each 32-bit rand() seed unset, so its output depends on prior memory contents; this implementation clears them, matching the reference source's 16-bit seed and the plugin's output when that memory is zero.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | IBM Research (Michael Wood); DarkCrypt variant by Alexander Myasnikov |
| Year | 1985 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/block/darkcrypt-redoc3.js`](../../../algorithms/block/darkcrypt-redoc3.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 32 bytes (256 bits) |
| Block sizes | 10 bytes (80 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Unprotected bytes | The last 2 of the 10 block bytes pass through unencrypted. | Use AES or another vetted cipher. |
| [Differential cryptanalysis](https://en.wikipedia.org/wiki/REDOC) | Ken Shirriff's differential attack on REDOC III needs about 2^20 chosen plaintexts and 2^30 memory. | Use AES or another vetted cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)
- [REDOC III reference source (Michael Wood)](https://www.schneier.com/wp-content/uploads/2015/03/REDOC3-2.zip)
- [Applied Cryptography, 2nd ed. (REDOC III description)](https://www.schneier.com/books/applied-cryptography/)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Redoc3 — zero key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0000000000000000000000000000000000000000000000000000000000000000` |
| `input` | `00000000000000000000` |
| `expected` | `4f83a9591536d9bd0000` |

**Vector 2** — [DarkCrypt Redoc3 — incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `input` | `00010203040506070809` |
| `expected` | `731624c431837ac50809` |

**Vector 3** — [DarkCrypt Redoc3 — shifted incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20` |
| `input` | `10111213141516171819` |
| `expected` | `40c416275c34483c1819` |

**Vector 4** — [DarkCrypt Redoc3 — all-ones key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff` |
| `input` | `ffffffffffffffffffff` |
| `expected` | `3485b3877f608773ffff` |

---

[← All algorithms](../README.md)
