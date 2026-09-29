# Wabasso (DarkCrypt)

> 160-bit block, 512-bit key cipher from the DarkCrypt Total Commander plugin. A 160-round five-word ARX wheel: each round mixes three of the five live words through a round-dependent boolean function (Parity, an SHA-1-style Ch select, or an MD5-"I"-style (~x|y)^z function), adds the fourth word and a round subkey (plus a round constant for the keyed bands), rotates by a round-specific amount, and adds the fifth word before the wheel advances. ADD whitening before the rounds, XOR whitening after. Same RC6/Blowfish-style key-schedule construction as the DarkCrypt "Shebamik" cipher, scaled to a larger substitution table and three chained RC4-style key schedules.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Alexander Myasnikov (DarkCrypt / "Zarya" project) |
| Year | 2009 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/block/darkcrypt-wabasso.js`](../../../algorithms/block/darkcrypt-wabasso.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 64 bytes (512 bits) |
| Block sizes | 20 bytes (160 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Obscure unanalyzed variant | Non-standard proprietary ARX block cipher construction with no public cryptanalysis. | Use AES or another vetted cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Wabasso - zero key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `input` | `0000000000000000000000000000000000000000` |
| `expected` | `9137e4f8a6196040b0027aa5aef4fc520c534269` |

**Vector 2** — [DarkCrypt Wabasso - incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `input` | `000102030405060708090a0b0c0d0e0f10111213` |
| `expected` | `0289481693e754fad83e621b1a000ee832367c6d` |

**Vector 3** — [DarkCrypt Wabasso - shifted incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f10 1112131415161718191a1b1c1d1e1f20 2122232425262728292a2b2c2d2e2f30 3132333435363738393a3b3c3d3e3f40` |
| `input` | `101112131415161718191a1b1c1d1e1f20212223` |
| `expected` | `497441166641eb31f94290f15a7ef37ac129bb2a` |

---

[← All algorithms](../README.md)
