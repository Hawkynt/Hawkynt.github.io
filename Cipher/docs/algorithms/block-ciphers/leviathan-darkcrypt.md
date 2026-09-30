# Leviathan (DarkCrypt)

> Keystream-driven block cipher from the DarkCrypt Total Commander plugin: a four-round doubled RC4-style table schedule feeds a Fibonacci-style position counter with S-box-diffused output words, XORed with the block. Exposed through the plugin's generic stream setup()/crypt() interface but only ever advances one 16-byte block per call.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Leviathan stream cipher by David McGrew and Scott Fluhrer; DarkCrypt variant by Alexander Myasnikov |
| Year | 2013 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/block/darkcrypt-leviathan.js`](../../../algorithms/block/darkcrypt-leviathan.js) |

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
| Non-standard exposure | Exposed as a single-block primitive via a stream-cipher interface that discards the requested length; the underlying keystream generator is unanalyzed as reconstructed here and not recommended for real use. | Use a vetted stream or block cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)
- [Leviathan stream cipher (NESSIE submission)](https://www.cosic.esat.kuleuven.be/nessie/workshop/submissions/leviathan.zip)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Leviathan — zero block, incrementing key](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `3d2a20bbae89b73ffc9e78598186ef31` |

**Vector 2** — [DarkCrypt Leviathan — mixed key, non-zero block (verified against the DarkCrypt implementation)](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0f1e2d3c4b5a69788796a5b4c3d2e1f0` |
| `input` | `00112233445566778899aabbccddeeff` |
| `expected` | `fd76bbdecbf577ca8cc541067323f9e7` |

**Vector 3** — [DarkCrypt Leviathan — all-0xFF key, two incrementing blocks continue the keystream (verified against the DarkCrypt implementation)](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `ffffffffffffffffffffffffffffffff` |
| `input` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `expected` | `b4a2c6b7ffce411e2e2aa6b5015d2ac03cb79098609bda1896aaf3a20cdb7151` |

---

[← All algorithms](../README.md)
