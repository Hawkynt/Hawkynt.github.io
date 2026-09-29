# NewTEA-128 (DarkCrypt)

> 4-word (128-bit block) generalization of TEA from the DarkCrypt Total Commander plugin. Direct key-to-subkey mapping (no sum-indexed schedule), fixed shifts 6/9, running DELTA-sum accumulator, 16 rounds. 128-bit block, 128-bit key.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | Unknown (NewTEA cipher); DarkCrypt variant by Alexander Myasnikov |
| Year | 2013 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/block/darkcrypt-newtea.js`](../../../algorithms/block/darkcrypt-newtea.js) |

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
| Non-standard / unanalyzed | Undocumented TEA-family generalization; not analyzed in the cryptographic literature and not recommended for real use. | Use AES or another vetted cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)
- [TEA (base family)](https://www.cix.co.uk/~klockstone/xtea.pdf)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Newtea — zero key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `e277e788010ee2f65c61f29d69cf2021` |

**Vector 2** — [DarkCrypt Newtea — incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `0c7ca4be6dd5ad490c99e8b84259f9ad` |

**Vector 3** — [DarkCrypt Newtea — shifted incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f10` |
| `input` | `101112131415161718191a1b1c1d1e1f` |
| `expected` | `a7a2d5e121901c68293c0dc891a015e3` |

---

[← All algorithms](../README.md)
