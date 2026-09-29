# Chaos-512/512 (DarkCrypt)

> Homegrown 512-bit-block ARX cipher from the DarkCrypt Total Commander plugin with no public specification: a 49-round 16-word shift-register/generalized-Feistel network where each round updates one word from its two predecessors and a rotated raw-key constant through a triple ARX/odd-multiply/byte-swap chain.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Alexander Myasnikov ("Zarya" project) — DarkCrypt original design, no public specification |
| Year | 2009 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/block/darkcrypt-chaos.js`](../../../algorithms/block/darkcrypt-chaos.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 64 bytes (512 bits) |
| Block sizes | 64 bytes (512 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Unanalyzed proprietary design | No public specification, cryptanalysis or design rationale exists for Chaos-512/512; the key schedule performs no mixing at all (round constants are the raw key words). Not recommended for any real use. | Use AES or another vetted cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Chaos — zero key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `expected` | `c2bf10da7a632b5eacd60161b6cfa7fe 7ddaed84b8eabc949c041962d13e24c4 8b3354f9e55ce9e3a5b6fd9e9aa4012d 4cc301fd3237e0e683c2513427d80d8e` |

**Vector 2** — [DarkCrypt Chaos — incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `expected` | `4d2487e3a4ccf9818cc1c3329cecba88 bb57694b2922921f8b60226a5a89d508 d67cc5327742513ff43646a4968fd1ef a18fcb30d0d9002726206156d13feee1` |

**Vector 3** — [DarkCrypt Chaos — shifted incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f10 1112131415161718191a1b1c1d1e1f20 2122232425262728292a2b2c2d2e2f30 3132333435363738393a3b3c3d3e3f40` |
| `input` | `101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f` |
| `expected` | `d687a94cb5387286445ca7e9525901c7 542ac2429949d7a3e1b720ee2a1b9b22 c387d6c0230f85069173993a8ef6df1b 5f161fe17f0873a3d0baad24850f2451` |

---

[← All algorithms](../README.md)
