# Iraqi (DarkCrypt)

> The obscure "Iraqi" block cipher as shipped in the DarkCrypt Total Commander plugin: a 5-round balanced Feistel on two 128-bit halves of a 256-bit block, with a 160-bit key and key-dependent S-boxes/P-box.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Anonymous (Iraqi block cipher); DarkCrypt packaging by Alexander Myasnikov |
| Year | 1999 |
| Origin | ❓ Unknown |
| Source | [`algorithms/block/darkcrypt-iraqi.js`](../../../algorithms/block/darkcrypt-iraqi.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 20 bytes (160 bits) |
| Block sizes | 32 bytes (256 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Unvetted / hoax-origin cipher | The Iraqi cipher is widely regarded as a hoax of unknown provenance and has received little serious analysis; the DarkCrypt packaging is unmodified from that anonymous source. | Use AES or another vetted cipher. |

## Documentation

- [Iraqi block cipher (Wikipedia)](https://en.wikipedia.org/wiki/Iraqi_block_cipher)
- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Iraq — zero key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0000000000000000000000000000000000000000` |
| `input` | `0000000000000000000000000000000000000000000000000000000000000000` |
| `expected` | `0b58520f6a3c1e637046167357bc68cdbf7ce08f15543ae55996555483430e86` |

**Vector 2** — [DarkCrypt Iraq — incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f10111213` |
| `input` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `expected` | `078953cf710d92ce42a2f3b70f37bf175da25d7caf157d8255464232f3f116f3` |

**Vector 3** — [DarkCrypt Iraq — shifted incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f1011121314` |
| `input` | `101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f` |
| `expected` | `fd8db3a65199496eba32fca274ee0e44e9cffaacd85363369c4b1bc30fe1bc2a` |

---

[← All algorithms](../README.md)
