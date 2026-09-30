# TC18 (DarkCrypt)

> Obscure block cipher from the DarkCrypt Total Commander plugin with no known public specification. An unbalanced 16-round Feistel network over two 64-bit halves in a custom GF(2^8) field, using a key-derived 8x8 linear mixing matrix and a fixed S-box.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Alexander Myasnikov (DarkCrypt / Zarya project) |
| Year | 2013 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/block/darkcrypt-tc18.js`](../../../algorithms/block/darkcrypt-tc18.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 8 bytes (64 bits) |
| Block sizes | 16 bytes (128 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Undocumented/unanalyzed design | No public cryptanalysis exists for this cipher; it should not be relied upon for security. | Use AES or another vetted, publicly analyzed cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Tc18 — incrementing key, zero plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0001020304050607` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `65829deea528d2376f6ef89d5d4f7135` |

**Vector 2** — [DarkCrypt Tc18 — incrementing key, incrementing plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0001020304050607` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `479e3a9947168262855b5719a8dbc382` |

**Vector 3** — [DarkCrypt Tc18 — random key/plaintext (verified against the DarkCrypt implementation)](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `62f42d2febe7e052` |
| `input` | `9587f7f286be78ec12bdf3a179584cba` |
| `expected` | `f5422b8a61f8caece1614c13cb133ca2` |

---

[← All algorithms](../README.md)
