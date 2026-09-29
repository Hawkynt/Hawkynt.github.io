# Wicker-98 (DarkCrypt)

> Wicker-98 block cipher from the DarkCrypt Total Commander plugin: 35-round unbalanced ARX network on four 32-bit words with a rotating accumulator folded into a cycling target word, plus 4-word key whitening. 128-bit block, 128-bit key.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Unknown (DarkCrypt plugin by Alexander Myasnikov) |
| Year | 1998 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/block/darkcrypt-wicker98.js`](../../../algorithms/block/darkcrypt-wicker98.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) |
| Block sizes | 16 bytes (128 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| All-zero weak key | The network is pure ARX with no round constants, so it fixes the all-zero state, and an all-zero key makes the whitening words zero too. The all-zero block is returned unencrypted under that one key. | Never use an all-zero key. |
| Unanalyzed construction | Non-standard, publicly unanalyzed cipher of unknown provenance; not recommended for real use. | Use AES or another vetted cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)

## Test vectors

6 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Wicker98 — incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `f950ebcd2bc7f510898182915ed3d273` |

**Vector 2** — [DarkCrypt Wicker98 — shifted incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f10` |
| `input` | `101112131415161718191a1b1c1d1e1f` |
| `expected` | `0bd3424f47983c90198664fdce5ac59b` |

**Vector 3** — [DarkCrypt Wicker98 — incrementing key, zero plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `10b3ccc52a3f6de7ca1c90350a018da0` |

**Vector 4** — [DarkCrypt Wicker98 — incrementing key, all-ones plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `ffffffffffffffffffffffffffffffff` |
| `expected` | `231066fde28e4de6436fd65e8bde35a5` |

**Vector 5** — [DarkCrypt Wicker98 — all-zero key, repeated-nibble plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000` |
| `input` | `aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa` |
| `expected` | `d60df079ef6ae58661d929d15d3ad826` |

**Vector 6** — [DarkCrypt Wicker98 — all-ones key, zero plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `ffffffffffffffffffffffffffffffff` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `0f7f9512cfa477b982f80475b6c078c9` |

---

[← All algorithms](../README.md)
