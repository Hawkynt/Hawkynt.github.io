# SAFER++ (DarkCrypt)

> SAFER++ block cipher (James Massey, Gurgen Khachatrian, Melsik Kuregian; NESSIE submission, 2000). 128-bit block, 256-bit key, 10 rounds. As implemented in the DarkCrypt Total Commander plugin.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | James Massey, Gurgen Khachatrian, Melsik Kuregian |
| Year | 2000 |
| Origin | 🇨🇭 Switzerland |
| Source | [`algorithms/block/darkcrypt-saferpp.js`](../../../algorithms/block/darkcrypt-saferpp.js) |

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
| Multiset/boomerang attacks | Reduced-round SAFER++ (up to 5.5 of 7 rounds) has been broken by multiset and boomerang cryptanalysis (Biryukov, De Canniere, Dellkrantz, CRYPTO 2003). | Prefer a vetted modern cipher such as AES. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)
- [SAFER (Wikipedia)](https://en.wikipedia.org/wiki/SAFER)
- [NESSIE Project](https://www.cosic.esat.kuleuven.be/nessie/)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Saferpp — zero key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0000000000000000000000000000000000000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `b3023ab8987797b91932b6b067769b49` |

**Vector 2** — [DarkCrypt Saferpp — incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `f2460a9b53e7f50897f8ab242c29623c` |

**Vector 3** — [DarkCrypt Saferpp — shifted incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20` |
| `input` | `101112131415161718191a1b1c1d1e1f` |
| `expected` | `fa7ef4fb4601d19d75c397c6ba39c336` |

---

[← All algorithms](../README.md)
