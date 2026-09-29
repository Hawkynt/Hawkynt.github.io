# Fcrypt-EDE (DarkCrypt)

> 3-key Encrypt-Decrypt-Encrypt composition of "Fcrypt", a DES-inspired 64-bit block cipher from the DarkCrypt Total Commander plugin. The 192-bit key splits into three independent 64-bit Fcrypt subkeys Kc/Ka/Kb; crypt(block) = Encrypt(Decrypt(Encrypt(block,Kc),Ka),Kb). The inner cipher is a 16-round alternating Feistel network using four 256-entry 32-bit lookup tables per round and a DES-style (parity-bit-dropping) key schedule.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Unknown (DarkCrypt plugin author: Alexander Myasnikov) |
| Year | 2006 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/block/darkcrypt-fcrypt.js`](../../../algorithms/block/darkcrypt-fcrypt.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 24 bytes (192 bits) |
| Block sizes | 8 bytes (64 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Non-standard, unanalyzed cipher | No public specification exists for this cipher; the base cipher and its EDE composition have not been subjected to public cryptanalysis. | Use AES or another vetted cipher. |
| Meet-in-the-middle | Triple-EDE constructions built from a 64-bit-block cipher offer materially less than 3x the effective key strength against meet-in-the-middle attacks. | Prefer a modern wide-block cipher such as AES-256. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)
- [EDE (Encrypt-Decrypt-Encrypt) composition](https://en.wikipedia.org/wiki/Triple_DES)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Fcrypt — zero key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000000000000000000000000000000000000000000000000` |
| `input` | `0000000000000000` |
| `expected` | `0e0900c73ef7ed41` |

**Vector 2** — [DarkCrypt Fcrypt — incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f1011121314151617` |
| `input` | `0001020304050607` |
| `expected` | `669264ffa9c6239a` |

**Vector 3** — [DarkCrypt Fcrypt — shifted incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f101112131415161718` |
| `input` | `1011121314151617` |
| `expected` | `8bdb7d0bfb37291c` |

---

[← All algorithms](../README.md)
