# RC5-32/16/64 (DarkCrypt)

> RC5 variant from the DarkCrypt Total Commander plugin: word size w=32 (64-bit real block), 16 rounds, 512-bit (64-byte) key via the standard RC5 key schedule. The external interface is 128 bits; only the first 8 bytes are transformed, the last 8 pass through unchanged. As implemented in the DarkCrypt Total Commander plugin.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Ronald Rivest; DarkCrypt variant by Alexander Myasnikov |
| Year | 1994 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/block/darkcrypt-rc5.js`](../../../algorithms/block/darkcrypt-rc5.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 64 bytes (512 bits) |
| Block sizes | 16 bytes (128 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Non-standard block truncation | Only the first 8 of 16 declared block bytes are actually transformed by the DLL; the remaining 8 bytes are passed through unchanged (unauthenticated, unencrypted). Unanalyzed variant, not recommended for real use. | Use AES or another vetted cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)
- [RC5 Original Paper](https://people.csail.mit.edu/rivest/Rivest-rc5rev.pdf)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Rc5 — zero key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `3de87930a1e4b7040000000000000000` |

**Vector 2** — [DarkCrypt Rc5 — incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `dafb117ea07259b108090a0b0c0d0e0f` |

**Vector 3** — [DarkCrypt Rc5 — shifted incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f10 1112131415161718191a1b1c1d1e1f20 2122232425262728292a2b2c2d2e2f30 3132333435363738393a3b3c3d3e3f40` |
| `input` | `101112131415161718191a1b1c1d1e1f` |
| `expected` | `0cf2a083bc6e73e218191a1b1c1d1e1f` |

---

[← All algorithms](../README.md)
