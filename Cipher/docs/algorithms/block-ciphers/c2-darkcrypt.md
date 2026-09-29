# C2 (DarkCrypt)

> Cryptomeria/C2 cipher (4C Entity) as implemented in the DarkCrypt Total Commander plugin: 10-round Feistel network, 56-bit key (of a 64-bit key slot), 64-bit block. Round function combines an S-box lookup with 8-bit and 32-bit rotations. The structure matches the published C2 specification exactly (add-based Feistel, S-box driven key schedule with a 17-bit 56-bit register rotation).

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | 4C Entity, LLC (Cryptomeria/C2 specification); DarkCrypt port by Alexander Myasnikov |
| Year | 2003 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/block/darkcrypt-c2.js`](../../../algorithms/block/darkcrypt-c2.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 8 bytes (64 bits) |
| Block sizes | 8 bytes (64 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Proprietary S-box substituted | DarkCrypt uses its own constant table instead of the 4C Entity's licensed production S-box; the real C2 cipher's security also depends on that secret S-box remaining unpublished. | Use AES or another vetted cipher. |
| Short effective key | Only 56 bits of the 64-bit key slot are used, making brute-force key search feasible. | Use a cipher with at least 128-bit keys. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)
- [Cryptomeria cipher (C2) — Wikipedia](https://en.wikipedia.org/wiki/Cryptomeria_cipher)
- [Cryptanalysis of C2 (CRYPTO 2009)](https://www.iacr.org/archive/crypto2009/56770248/56770248.pdf)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt C2 — zero key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0000000000000000` |
| `input` | `0000000000000000` |
| `expected` | `afa7ed3f67eecbc0` |

**Vector 2** — [DarkCrypt C2 — incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0001020304050607` |
| `input` | `0001020304050607` |
| `expected` | `78b03362d08db481` |

**Vector 3** — [DarkCrypt C2 — shifted incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708` |
| `input` | `1011121314151617` |
| `expected` | `7f6eefe40d2021c9` |

---

[← All algorithms](../README.md)
