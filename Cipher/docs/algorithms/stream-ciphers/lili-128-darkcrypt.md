# LILI-128 (DarkCrypt)

> Clock-controlled LFSR keystream generator matching the public LILI-128 design (Simpson/Dawson/Golic/Millan, SAC 2000): a 39-bit LFSRc irregularly clocks an 89-bit LFSRd (1-4 times per bit) whose taps drive a 1024-entry nonlinear Boolean function.

## Properties

| Property | Value |
| --- | --- |
| Category | Stream Ciphers |
| Sub-category | Stream Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Simpson, Dawson, Golic, Millan (base LILI-128 design); DarkCrypt port by Alexander Myasnikov |
| Year | 2000 |
| Origin | 🇦🇺 Australia |
| Source | [`algorithms/stream/darkcrypt-lili.js`](../../../algorithms/stream/darkcrypt-lili.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) |
| Block sizes | 1 byte (8 bits) to 65536 bytes (524288 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Known cryptanalytic attacks | LILI-128 is subject to published distinguishing and algebraic attacks; not recommended for real use. | Use a vetted stream cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)
- [LILI Keystream Generator (SAC 2000 paper)](https://www.researchgate.net/publication/2528091_LILI_Keystream_Generator)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Lili — keystream from incrementing key, zero input](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `expected` | `612cca9a6cd85262a7232e4e636bb125 91244ada79631ed367c0c09422bbe454 9bb92dea46bb75096c01d8a2ff3c2444 ed5389894c6e738ca710ce03aeb52473 063f554bfb63ce58d6b0a7c651276e8d c2210c73ef0737035d863658ec874953 5c87c9338412bf8b16f2228cd54317c2 a0be7f888b995cc88ec7fae592ffd044` |

**Vector 2** — [DarkCrypt Lili — incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `expected` | `612dc89968dd5465af2a24456f66bf2a 813558c96d7608c47fd9da8f3ea6fa4b bb980fc9629e532e4428f289d3110a6b dd62bbba785b45bb9f29f43892881a4c` |

---

[← All algorithms](../README.md)
