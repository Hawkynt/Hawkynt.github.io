# REDOC III (DarkCrypt)

> REDOC III variant from the DarkCrypt Total Commander plugin: an 80-bit block (only the first 8 bytes are transformed, the last 2 pass through unchanged), 256-bit key. Key-dependent 2560-byte pseudorandom table (classic LCG) folded into a 16-byte subkey; two masking passes select table rows that get XORed into the other working bytes.

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
| Non-standard, unanalyzed variant | Only the last 2 of 10 block bytes are unprotected pass-through. Not analyzed for cryptographic strength. | Use AES or another vetted cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)
- [Applied Cryptography, 2nd ed. (REDOC III description)](https://www.schneier.com/books/applied-cryptography/)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Redoc3 — zero key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0000000000000000000000000000000000000000000000000000000000000000` |
| `input` | `00000000000000000000` |
| `expected` | `59384d4a4be0617b0000` |

**Vector 2** — [DarkCrypt Redoc3 — incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `input` | `00010203040506070809` |
| `expected` | `84c182949e2875270809` |

**Vector 3** — [DarkCrypt Redoc3 — shifted incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20` |
| `input` | `10111213141516171819` |
| `expected` | `dba910c8db2fb2ae1819` |

---

[← All algorithms](../README.md)
