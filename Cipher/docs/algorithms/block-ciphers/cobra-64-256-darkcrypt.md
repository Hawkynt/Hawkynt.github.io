# Cobra-64-256 (DarkCrypt)

> Blowfish-derived block cipher from the DarkCrypt Total Commander plugin: 16-round Feistel network over a 64-bit block with an extra 1-bit rotation per round, keyed via a 256-bit key through Blowfish's self-encryption schedule applied to a pi-seeded constant table shifted by two words relative to textbook Blowfish.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Bruce Schneier (Blowfish base design); DarkCrypt variant by Alexander Myasnikov |
| Year | 2009 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/block/darkcrypt-cobra.js`](../../../algorithms/block/darkcrypt-cobra.js) |

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
| Non-standard variant | Modified Blowfish with a shifted constant table and an added per-round bit rotation; unanalyzed and not recommended for real use. | Use AES or another vetted cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)
- [Blowfish (base algorithm)](https://www.schneier.com/academic/archives/1994/09/description_of_a_new.html)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Cobra — zero key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0000000000000000000000000000000000000000000000000000000000000000` |
| `input` | `0000000000000000` |
| `expected` | `30021edebc2495f0` |

**Vector 2** — [DarkCrypt Cobra — incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `input` | `0001020304050607` |
| `expected` | `db6b87b5b52f4591` |

**Vector 3** — [DarkCrypt Cobra — shifted incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20` |
| `input` | `1011121314151617` |
| `expected` | `108d81be52ba6d48` |

---

[← All algorithms](../README.md)
