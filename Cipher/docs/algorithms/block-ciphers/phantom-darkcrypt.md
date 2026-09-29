# Phantom (DarkCrypt)

> Custom block cipher bundled with the DarkCrypt Total Commander plugin. Four-branch structure combining IDEA-style modular multiplication, four keyed byte-substitution tables, and 64-bit rotate mixing over 16 body iterations (32 sub-rounds). 128-bit block, 256-bit key, big-endian words. No public specification is known.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Alexander Myasnikov (DarkCrypt / "Zarya" project) |
| Year | 2009 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/block/darkcrypt-phantom.js`](../../../algorithms/block/darkcrypt-phantom.js) |

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
| Undocumented custom design | No public cryptanalysis exists; the cipher is not derived from any reviewed public design. | Use AES or another vetted cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Phantom — - all-zero key and plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0000000000000000000000000000000000000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `8f1c19b78c1c66df9d154642162d7f8f` |

**Vector 2** — [DarkCrypt Phantom — - incrementing key and plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `c1a60b084f67838784ac4fc05217bb31` |

**Vector 3** — [DarkCrypt Phantom — - shifted incrementing key and plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20` |
| `input` | `101112131415161718191a1b1c1d1e1f` |
| `expected` | `9684468689596000d31f8f5db1669c19` |

---

[← All algorithms](../README.md)
