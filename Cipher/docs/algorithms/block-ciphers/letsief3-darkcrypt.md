# Letsief3 (DarkCrypt)

> Letsief3 block cipher from the DarkCrypt Total Commander plugin. 6-round Feistel-like network over two 32-bit big-endian halves; the round function multiplies each half (modular multiply over 16-bit limbs) by two key-dependent 256-entry S-boxes and XORs a round subkey. 64-bit block, 512-bit key.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Alexander Myasnikov (DarkCrypt / Zarya project) |
| Year | 2013 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/block/darkcrypt-letsief3.js`](../../../algorithms/block/darkcrypt-letsief3.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 64 bytes (512 bits) |
| Block sizes | 8 bytes (64 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Uniform keys are fixed points of the key schedule | A key of 64 equal bytes 0x00, 0x33, 0x66, 0x99, 0xCC or 0xFF produces sixteen identical subkeys and two-valued S-boxes, leaving the all-zero block unencrypted. The all-zero key is worse still: roughly one block in seven is returned unchanged. | Never use a key of repeated bytes; prefer a vetted cipher such as AES. |
| Non-standard / unanalyzed variant | Proprietary DarkCrypt cipher with no public cryptanalysis; the small round count and reliance on key-dependent multiplicative S-boxes are unvetted. Not recommended for real use. | Use AES or another vetted cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)

## Test vectors

6 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Letsief — incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `input` | `0001020304050607` |
| `expected` | `985e38bc074b9e16` |

**Vector 2** — [DarkCrypt Letsief — shifted incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f10 1112131415161718191a1b1c1d1e1f20 2122232425262728292a2b2c2d2e2f30 3132333435363738393a3b3c3d3e3f40` |
| `input` | `1011121314151617` |
| `expected` | `2140ee72033560a9` |

**Vector 3** — [DarkCrypt Letsief — incrementing key, zero plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `input` | `0000000000000000` |
| `expected` | `f08a59fb6cac4051` |

**Vector 4** — [DarkCrypt Letsief — incrementing key, all-ones plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `input` | `ffffffffffffffff` |
| `expected` | `de08d6dacc84f8df` |

**Vector 5** — [DarkCrypt Letsief — all-zero key leaves a repeated-nibble block unencrypted](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `input` | `aaaaaaaaaaaaaaaa` |
| `expected` | `aaaaaaaaaaaaaaaa` |

**Vector 6** — [DarkCrypt Letsief — all-zero key, incrementing plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `input` | `0001020304050607` |
| `expected` | `8e5a7ff704050607` |

---

[← All algorithms](../README.md)
