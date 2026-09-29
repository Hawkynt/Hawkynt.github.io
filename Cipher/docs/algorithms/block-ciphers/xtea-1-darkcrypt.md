# XTEA-1 (DarkCrypt)

> Generalized XTEA/TEA variant from the DarkCrypt Total Commander plugin: additive whitening (v0+=K0,v1+=K1) before 32 rounds, each round combining the classic TEA shift-pair/sum-xor term with an extra data-dependent rotation ROL(K[idx],other-half), then XOR whitening (v0^=K2,v1^=K3). Little-endian. 64-bit block, 128-bit key.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | David Wheeler, Roger Needham (base TEA/XTEA concept); DarkCrypt variant by Alexander Myasnikov |
| Year | 2013 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/block/darkcrypt-xtea1.js`](../../../algorithms/block/darkcrypt-xtea1.js) |

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
| Non-standard, unanalyzed variant | Custom generalized XTEA/TEA construction with data-dependent rotations; not vetted by public cryptanalysis. | Use AES or another vetted cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)
- [XTEA (base algorithm)](https://www.cix.co.uk/~klockstone/xtea.pdf)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Xtea1 — zero key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000` |
| `input` | `0000000000000000` |
| `expected` | `aa2296e56c61f345` |

**Vector 2** — [DarkCrypt Xtea1 — incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `0001020304050607` |
| `expected` | `52a874bd65401332` |

**Vector 3** — [DarkCrypt Xtea1 — shifted incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f10` |
| `input` | `1011121314151617` |
| `expected` | `f85a798953a771e9` |

---

[← All algorithms](../README.md)
