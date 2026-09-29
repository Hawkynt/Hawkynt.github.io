# A5 (DarkCrypt)

> A5-family stop/go three-LFSR stream cipher from the DarkCrypt Total Commander plugin. Loads the 64-bit key directly into the registers (no frame number, no discard rounds) and uses non-standard clock-control/tap positions.

## Properties

| Property | Value |
| --- | --- |
| Category | Stream Ciphers |
| Sub-category | Stream Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | ETSI SAGE (base A5/1 design); DarkCrypt variant by Alexander Myasnikov |
| Year | 2013 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/stream/darkcrypt-a5.js`](../../../algorithms/stream/darkcrypt-a5.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 8 bytes (64 bits) |
| Block sizes | 1 byte (8 bits) to 65536 bytes (524288 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Non-standard variant | Modified A5/1 with a trivial direct key-load and altered tap positions; unanalyzed and not recommended for real use. | Use a vetted stream cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)
- [Wikipedia: A5/1 (base algorithm)](https://en.wikipedia.org/wiki/A5/1)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt A5 — keystream from incrementing key, zero input](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0001020304050607` |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `expected` | `fd65ae4da3a3dcbc8e1c52a8c7fb387a f2644f41e2f17eee773c526206c56dcb 50c51d253501f6959bb1b3572df82b8d 93b40aa3b907ce02e6d9bdcf5975e5b2 8762ee187a9c71e40c5db01eca4136cd 74acbd1779e1301edc07ebf25300a9f4 c327f5806c2065ad0d6a32aa6f2589d3 e040888e0ccb7d683ad91905e99dcadb` |

**Vector 2** — [DarkCrypt A5 — incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0001020304050607` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `expected` | `fd64ac4ea7a6dabb861558a3cbf63675 e2755d52f6e468f96f2548791ad873d4 70e43f061124d0b2b398997c01d505a2 a38538908d32f835dee087f46548db8d` |

---

[← All algorithms](../README.md)
