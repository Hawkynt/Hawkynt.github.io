# MBC2 (DarkCrypt)

> Bit-oriented block cipher from the DarkCrypt Total Commander plugin: 16 rounds of table-driven bit substitution, cascade and permutation over a 64-bit state, keyed via a 588-byte table expanded from a 128-bit key. Original/obscure design (not a published algorithm).

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Alexander Myasnikov ("Zarya" project, DarkCrypt) |
| Year | 2009 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/block/darkcrypt-mbc2.js`](../../../algorithms/block/darkcrypt-mbc2.js) |

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
| Unanalyzed proprietary design | MBC2 has no public specification, security proofs, or third-party cryptanalysis; its bit-level structure has not been vetted. | Use AES or another vetted cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Mbc — zero key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000` |
| `input` | `0000000000000000` |
| `expected` | `8481f5180a7dee0a` |

**Vector 2** — [DarkCrypt Mbc — incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `0001020304050607` |
| `expected` | `adcb42a8ed9f9c2a` |

**Vector 3** — [DarkCrypt Mbc — shifted incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f10` |
| `input` | `1011121314151617` |
| `expected` | `493ab155c3194059` |

---

[← All algorithms](../README.md)
