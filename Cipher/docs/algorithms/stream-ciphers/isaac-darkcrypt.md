# ISAAC (DarkCrypt)

> Bob Jenkins's ISAAC PRNG wrapped as a stream cipher by the DarkCrypt Total Commander plugin. Seeds from a full 1024-byte state buffer, discards 256 extra rounds during setup, and XORs raw little-endian keystream bytes.

## Properties

| Property | Value |
| --- | --- |
| Category | Stream Ciphers |
| Sub-category | Stream Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Bob Jenkins (base ISAAC design); DarkCrypt wrapper by Alexander Myasnikov |
| Year | 2013 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/stream/darkcrypt-isaac.js`](../../../algorithms/stream/darkcrypt-isaac.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 1024 bytes (8192 bits) |
| Block sizes | 1 byte (8 bits) to 65536 bytes (524288 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Non-standard wrapper | Uses the unmodified ISAAC core but a bespoke setup/crypt protocol; unanalyzed and not recommended for real use. | Use a vetted stream cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)
- [ISAAC Homepage - Bob Jenkins](https://www.burtleburtle.net/bob/rand/isaacafa.html)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Isaac — 1024-byte incrementing seed, zero input](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f …` (1024 bytes; the full value is in the source) |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `expected` | `c86ae56681b5ff86a91004199a995a5c 8d699a0f454b79a250401a4b6e0acee3 8e2c8beea25b40270f18903e25622020 caffb586a47b679e47b7961c2173db60 f6672ae9fbeebe295aacc2812b27cec5 6d046bcbf4c5868ee2bcb0db5e56f237 81efcdd0e2f5d6eebcef2baae8756a09 005646a53684c5c8ff42cd0ed0a31342` |

**Vector 2** — [DarkCrypt Isaac — 1024-byte incrementing seed, incrementing plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f …` (1024 bytes; the full value is in the source) |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `expected` | `c86be76585b0f981a1190e1296945453 9d78881c515e6fb5485900507217d0fc ae0da9cd867e66002731ba15094f0e0f face87b5904e51a97f8eac271d4ee55f` |

---

[← All algorithms](../README.md)
