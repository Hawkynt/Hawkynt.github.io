# Multiswap (DarkCrypt)

> Microsoft's MultiSwap block cipher/MAC (from Windows Media DRM / MS Reader .lit DRM), as wrapped into a standalone 64-bit block cipher by the DarkCrypt Total Commander plugin: the 56-byte key supplies 12 odd multiplicative subkeys plus a non-zero initial chaining state.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | ❌ Broken |
| Complexity | Intermediate |
| Inventor | Microsoft (documented/named by 'Beale Screamer'); DarkCrypt wrapper by Alexander Myasnikov |
| Year | 1999 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/block/darkcrypt-multiswap.js`](../../../algorithms/block/darkcrypt-multiswap.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 56 bytes (448 bits) |
| Block sizes | 8 bytes (64 bits) |

## Security

**Status:** ❌ Broken

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Multiplicative differential cryptanalysis | Broken with about 2^14 chosen plaintexts or 2^22.5 known plaintexts (Borisov et al., FSE 2002). | Use AES or another vetted cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)
- [MultiSwap (Wikipedia)](https://en.wikipedia.org/wiki/MultiSwap)
- [Cryptanalysis of MultiSwap (Borisov, Chew, Johnson, Wagner)](https://web.archive.org/web/20011031200331/http://www.cs.berkeley.edu:80/~rtjohnso/multiswap/)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Ms — zero key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 0000000000000000` |
| `input` | `0000000000000000` |
| `expected` | `0200000003000000` |

**Vector 2** — [DarkCrypt Ms — incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 3031323334353637` |
| `input` | `0001020304050607` |
| `expected` | `d0ad5c3a7eb8411c` |

**Vector 3** — [DarkCrypt Ms — shifted incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f10 1112131415161718191a1b1c1d1e1f20 2122232425262728292a2b2c2d2e2f30 3132333435363738` |
| `input` | `1011121314151617` |
| `expected` | `3a20b566b726024c` |

---

[← All algorithms](../README.md)
