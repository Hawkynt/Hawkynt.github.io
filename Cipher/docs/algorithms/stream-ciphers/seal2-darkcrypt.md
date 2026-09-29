# SEAL2 (DarkCrypt)

> Rogaway/Coppersmith SEAL variant from the DarkCrypt Total Commander plugin: SHA-0-shaped table generation (T[512]/S[256]/R[16]) from a 160-bit key, a table-driven round mixing a/b/c/d, and additive-only periodic re-mixing of just two of the four state words. Identical output confirmed from the plugin's related SEAL variant.

## Properties

| Property | Value |
| --- | --- |
| Category | Stream Ciphers |
| Sub-category | Stream Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Phil Rogaway, Don Coppersmith (DarkCrypt variant by Alexander Myasnikov) |
| Year | 1994 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/stream/darkcrypt-seal2.js`](../../../algorithms/stream/darkcrypt-seal2.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 20 bytes (160 bits) |
| Block sizes | 1 byte (8 bits) to 65536 bytes (524288 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Non-standard construction | DarkCrypt's SEAL2 variant deviates from the published SEAL round structure (partial state re-mixing, non-standard table hash); not vetted, not recommended for real use. | Use a vetted stream cipher. |

## Documentation

- [SEAL Specification (FSE'94)](https://web.cs.ucdavis.edu/~rogaway/papers/seal.pdf)
- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Seal2 — keystream from incrementing key, zero input](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f10111213` |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `expected` | `d95030a48b03db75c9b45cf849d659e4 43df9aae2e1695a0ba8ea72be7aa37c4 940291d21e585a8d1aadcf142de6d000 6df1cc6fae1c08778a4b033ef90a80c0 ae89ad2e21c0c56936bb2004d5aff917 3164ecd8b47ea23816875981ec67cd9e 1d75612eab874ef2fcaa9400e4c4c1d8 5a1e63c80592a764cb886ddc4072ec4c` |

**Vector 2** — [DarkCrypt Seal — keystream from incrementing key, zero input (byte-identical to with the same key)](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f10111213` |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `expected` | `d95030a48b03db75c9b45cf849d659e4 43df9aae2e1695a0ba8ea72be7aa37c4 940291d21e585a8d1aadcf142de6d000 6df1cc6fae1c08778a4b033ef90a80c0 ae89ad2e21c0c56936bb2004d5aff917 3164ecd8b47ea23816875981ec67cd9e 1d75612eab874ef2fcaa9400e4c4c1d8 5a1e63c80592a764cb886ddc4072ec4c` |

**Vector 3** — [DarkCrypt Seal2 — incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f10111213` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `expected` | `d95132a78f06dd72c1bd56f345db57eb 53ce88bd3a0383b7a297bd30fbb729db b423b3f13a7d7caa3284e53f01cbfe2f 5dc0fe5c9a293e40b2723905c537beff` |

---

[← All algorithms](../README.md)
