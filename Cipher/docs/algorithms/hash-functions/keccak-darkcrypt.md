# Keccak (DarkCrypt)

> Keccak sponge hash variant used by the DarkCrypt Total Commander plugin. Built on the standard Keccak-f[1600] permutation (standard rotation offsets and round constants) but truncated to 18 rounds instead of the standard 24, with a fixed 64-byte rate (1088-bit capacity) and a fixed 4-byte padding suffix (0x01, 0x40, 0x40, 0x01) in place of the usual pad10*1 scheme. Produces a 512-bit digest; matches no published Keccak or SHA-3 test vector.

## Properties

| Property | Value |
| --- | --- |
| Category | Hash Functions |
| Sub-category | DarkCrypt Variant |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Guido Bertoni, Joan Daemen, Michaël Peeters, Gilles Van Assche (Keccak); DarkCrypt plugin author (round-count and padding variant) |
| Year | 2012 |
| Origin | 🇧🇪 Belgium |
| Source | [`algorithms/hash/darkcrypt-keccak.js`](../../../algorithms/hash/darkcrypt-keccak.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Output sizes | 64 bytes (512 bits) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [Keccak Team](https://keccak.team/keccak.html)
- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)

## References

- [DarkCrypt Total Commander plugin](https://github.com/Zdimon/DarkCryptTC)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Keccak - empty message](https://github.com/Zdimon/DarkCryptTC)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `8596f8df2e856ec888823da8ccc91413 9f31baee6aa5c37dbe30bddbfd75c63c dc205f15f30faa348e27b5f90495b339 a606e3c84bfcdcd55e88b0e178b56feb` |

**Vector 2** — [DarkCrypt Keccak - "abc"](https://github.com/Zdimon/DarkCryptTC)

| Field | Value |
| --- | --- |
| `input` | `616263` |
| `expected` | `4a2e21878d2785dffb751bb0c635e1f5 780152922ffe7ef5342f7442d877754a 3f866cd5b2d9f2711b02b24f64e437e4 484a8d24b7878d288e9c550729ff954e` |

**Vector 3** — [DarkCrypt Keccak - 64 incrementing bytes](https://github.com/Zdimon/DarkCryptTC)

| Field | Value |
| --- | --- |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `expected` | `ef3d380fac452a2adddfc2efe065378e 82184adbd7cf9cf5ee69a1ad7c49f24b 29013b010490715a98b32956df679d20 27c68a54626bdca21a969c2d74d2c71e` |

---

[← All algorithms](../README.md)
