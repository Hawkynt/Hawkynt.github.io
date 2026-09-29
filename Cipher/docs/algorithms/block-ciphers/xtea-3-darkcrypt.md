# XTEA-3 (DarkCrypt)

> Generalized 4-word Feistel construction from the DarkCrypt Total Commander plugin, built from TEA-style shift/sum/rotate primitives. 128-bit block, 256-bit key (raw, unexpanded). Not textbook XTEA (different block/key size and round function).

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | David Wheeler, Roger Needham (base TEA/XTEA concept); DarkCrypt variant by Alexander Myasnikov |
| Year | 2013 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/block/darkcrypt-xtea3.js`](../../../algorithms/block/darkcrypt-xtea3.js) |

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
| Non-standard, unanalyzed variant | Custom generalized 4-branch Feistel construction with data-dependent rotations; not vetted by public cryptanalysis. | Use AES or another vetted cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)
- [XTEA (base algorithm concept)](https://www.cix.co.uk/~klockstone/xtea.pdf)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Xtea3 — zero key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0000000000000000000000000000000000000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `eb40e99d74414d1618e0074f65db7521` |

**Vector 2** — [DarkCrypt Xtea3 — incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `be02fe886c3d0f9af6cb4a7cf774fefa` |

**Vector 3** — [DarkCrypt Xtea3 — shifted incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20` |
| `input` | `101112131415161718191a1b1c1d1e1f` |
| `expected` | `9ae1f0845eedc4840dc73375c8b0dd36` |

---

[← All algorithms](../README.md)
