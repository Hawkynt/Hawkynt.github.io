# MacGuffin (DarkCrypt)

> MacGuffin GUFN block cipher (Blaze and Schneier, 1994) as implemented in the DarkCrypt Total Commander plugin: identical S-boxes, bit selection and self-encrypting key schedule to the original reference source, but with the encrypt/decrypt round-key directions swapped. 64-bit block, 128-bit key, 32 rounds.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Expert |
| Inventor | Matt Blaze, Bruce Schneier (base MacGuffin); DarkCrypt variant by Alexander Myasnikov |
| Year | 1994 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/block/darkcrypt-macguffin.js`](../../../algorithms/block/darkcrypt-macguffin.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) |
| Block sizes | 8 bytes (64 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Broken cipher | MacGuffin was cryptanalyzed and broken at the same workshop where it was introduced (Rijmen and Preneel, 1994). | Use AES or another vetted cipher. |
| Non-standard variant | DarkCrypt swaps the encrypt/decrypt round-key directions relative to the original reference implementation; unanalyzed and not recommended for real use. | Use AES or another vetted cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)
- [The MacGuffin Block Cipher Algorithm (Blaze and Schneier, FSE 1994)](https://www.schneier.com/academic/archives/1995/01/the_macguffin_block.html)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Mg — zero key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000` |
| `input` | `0000000000000000` |
| `expected` | `91d3c484e44e69e9` |

**Vector 2** — [DarkCrypt Mg — incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `0001020304050607` |
| `expected` | `667a727b5a48a9d8` |

**Vector 3** — [DarkCrypt Mg — shifted incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f10` |
| `input` | `1011121314151617` |
| `expected` | `68ed39824c45e8f7` |

---

[← All algorithms](../README.md)
