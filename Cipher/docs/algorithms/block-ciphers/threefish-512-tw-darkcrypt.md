# Threefish-512-TW (DarkCrypt)

> Threefish-512 as implemented in the DarkCrypt Total Commander plugin build "TW1.2": standard 72-round/permutation/rotation/tweak structure, but with a non-standard key-schedule parity constant (0x5555555555555555). 512-bit block, 512-bit key + 128-bit tweak.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Bruce Schneier, Niels Ferguson, Stefan Lucks, Doug Whiting, Mihir Bellare, Tadayoshi Kohno, Jon Callas, Jesse Walker (base Threefish); DarkCrypt variant by Alexander Myasnikov |
| Year | 2008 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/block/darkcrypt-threefish512tw.js`](../../../algorithms/block/darkcrypt-threefish512tw.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 80 bytes (640 bits) |
| Block sizes | 64 bytes (512 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Non-standard variant | Modified Threefish-512 with an unanalyzed key-schedule constant; unanalyzed and not recommended for real use. | Use AES or another vetted cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)
- [The Skein Hash Function Family / Threefish specification](https://www.schneier.com/academic/paperfiles/skein1.3.pdf)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Threefish-512-tweak — zero key/tweak/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `expected` | `54c48fea2dac72222c0380d1a1a9f768 4d47bd90fc491724dc599e1824b6b30a e22db97e841482db209c0e6974c2111a d6c691984919c11f987fc2d132379fb4` |

**Vector 2** — [DarkCrypt Threefish-512-tweak — incrementing key/tweak/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `expected` | `54eba34f9c4492af834cc2cb46ac1611 7e9100f6c3f9ec2240f22750038a0ff1 144bf2448bebcd6bc6919270a2a18322 091f60b4345a1c8a5538d57058a22def` |

**Vector 3** — [DarkCrypt Threefish-512-tweak — shifted incrementing key/tweak/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f10 1112131415161718191a1b1c1d1e1f20 2122232425262728292a2b2c2d2e2f30 3132333435363738393a3b3c3d3e3f40 4142434445464748494a4b4c4d4e4f50` |
| `input` | `101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f` |
| `expected` | `95d7e6e756799a33da241d309d8f23ea 7b8436ac36380e90bfc8a3eac0ebcabe 302a0472ded6d94a97484fc7e02b21dc 95ad2fab5e85fd26547ebd2ff1a9ca47` |

---

[← All algorithms](../README.md)
