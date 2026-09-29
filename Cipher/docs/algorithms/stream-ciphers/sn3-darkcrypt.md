# SN3 (DarkCrypt)

> Table-driven stream cipher with a 192-word key-dependent S-box, conventionally split into three 64-word tables that rotate roles every 64 steps. Each step mixes one word from each table with rotate/xor updates and a data-dependent second index. From the DarkCrypt Total Commander plugin build.

## Properties

| Property | Value |
| --- | --- |
| Category | Stream Ciphers |
| Sub-category | Stream Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Simeon Maltchev |
| Year | 2002 |
| Origin | Not specified |
| Source | [`algorithms/stream/darkcrypt-sn3.js`](../../../algorithms/stream/darkcrypt-sn3.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 768 bytes (6144 bits) |
| Block sizes | 1 byte (8 bits) to 65536 bytes (524288 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Unanalyzed construction | Custom stream cipher with no formal public cryptanalysis beyond the designer's own statistical testing; not recommended for real use. | Use a vetted stream cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)
- [The SN3 Stream Cipher (original posting, sci.crypt.research)](https://groups.google.com/g/sci.crypt.research/c/lPjKoTgO4Jc)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt SN3 - 768-byte key keystream](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f …` (768 bytes; the full value is in the source) |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `expected` | `e535f50705d738004bd02561d095ccc7 9f6561a39435f3324b05369828bc88f8 793b9bc88818357515a03a5f8bd1a364 be26fe53af37c95956085779487fb868 134e4fbcaaa66d45e18cf0ea40b9f561 743b6eafec942283b545a7f8cdfcf711 2d718c4219361fea128316f1b0893421 1c1098eb611081e13ef67dfe3514115d` |

**Vector 2** — [DarkCrypt SN3 - incrementing plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f …` (768 bytes; the full value is in the source) |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `expected` | `e534f70401d23e0743d92f6adc98c2c8 8f7473b08020e525531c2c8334a196e7 591ab9ebac3d13523d891074a7fc8d4b 8e17cc609b02ff6e6e316d4274428657` |

---

[← All algorithms](../README.md)
