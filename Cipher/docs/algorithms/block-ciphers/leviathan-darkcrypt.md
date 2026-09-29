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

1 vector ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Leviathan — zero block, incrementing key](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `3d2a20bbae89b73ffc9e78598186ef31` |

---

[← All algorithms](../README.md)
