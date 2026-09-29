# DES-X (DarkCrypt)

> DES-X construction from the DarkCrypt Total Commander plugin: a 128-bit key splits into a DES key (parity-fixed before scheduling) and a raw input-whitening key K1, with the output-whitening key K2 derived from both halves via a dedicated LFSR/S-box. 64-bit block, 128-bit key.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Ron Rivest (DES-X construction); DES core: IBM/NSA; DarkCrypt variant by Alexander Myasnikov |
| Year | 2013 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/block/darkcrypt-desx.js`](../../../algorithms/block/darkcrypt-desx.js) |

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
| Non-standard key/whitening derivation | K1/K2 derivation and DES-key parity fixup are DarkCrypt-specific and unanalyzed; not recommended for real use. | Use AES or another vetted cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)
- [DESX (base construction)](https://en.wikipedia.org/wiki/DES-X)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Desx — zero key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000` |
| `input` | `0000000000000000` |
| `expected` | `1d48e0c047ab576c` |

**Vector 2** — [DarkCrypt Desx — incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `0001020304050607` |
| `expected` | `b47b177d71950979` |

**Vector 3** — [DarkCrypt Desx — shifted incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f10` |
| `input` | `1011121314151617` |
| `expected` | `52133e786523302e` |

---

[← All algorithms](../README.md)
