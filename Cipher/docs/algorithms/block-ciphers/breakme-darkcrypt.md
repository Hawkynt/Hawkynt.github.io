# Breakme (DarkCrypt)

> Non-standard 20-round unbalanced Feistel cipher from the DarkCrypt Total Commander plugin. 64-bit block, 256-bit key. F applies a nested 256-entry byte S-box network; the key schedule expands 8 key words to 24 round-key words via an XOR recurrence followed by a multiplier-driven mixing pass. No public specification exists.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Alexander Myasnikov (DarkCrypt "Zarya" project) |
| Year | 2009 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/block/darkcrypt-breakme.js`](../../../algorithms/block/darkcrypt-breakme.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 32 bytes (256 bits) |
| Block sizes | 8 bytes (64 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Undocumented non-standard design | No public specification or cryptanalysis exists for this cipher. Not recommended for real use. | Use AES or another vetted cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Breakme — zero key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0000000000000000000000000000000000000000000000000000000000000000` |
| `input` | `0000000000000000` |
| `expected` | `7feb8e2d688d5db8` |

**Vector 2** — [DarkCrypt Breakme — incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `input` | `0001020304050607` |
| `expected` | `9a6f6f72a77702ac` |

**Vector 3** — [DarkCrypt Breakme — shifted incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20` |
| `input` | `1011121314151617` |
| `expected` | `82c42b1a61929624` |

---

[← All algorithms](../README.md)
