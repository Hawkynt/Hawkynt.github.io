# NewDES-120 (DarkCrypt)

> Original 1985 NewDES cipher by Robert Scott as implemented in the DarkCrypt Total Commander plugin: 64-bit block, 120-bit key, 8 loop iterations plus a 4-step tail over a fixed 256-byte rotor S-box, simple 4x-repeated key schedule.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Robert Scott; DarkCrypt port by Alexander Myasnikov |
| Year | 1985 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/block/darkcrypt-newdes.js`](../../../algorithms/block/darkcrypt-newdes.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 15 bytes (120 bits) |
| Block sizes | 8 bytes (64 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Related-key weakness | The original (pre-1996) key schedule simply repeats the 15-byte key, which was later shown to be vulnerable to related-key attacks; superseded by NewDES'96. | Use AES or another vetted cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)
- [NewDES original article (Cryptologia 9(1), 1985)](https://www.tandfonline.com/doi/abs/10.1080/0161-118591857944)
- [Mark Riordan's public-domain reference implementation (1990)](https://www.nic.funet.fi/pub/crypt/cryptography/rpem/rpem/newdes.c)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Newdes — zero key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000000000000000000000000000000` |
| `input` | `0000000000000000` |
| `expected` | `a2176054f58b3458` |

**Vector 2** — [DarkCrypt Newdes — incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e` |
| `input` | `0001020304050607` |
| `expected` | `255cc7953fee5aeb` |

**Vector 3** — [DarkCrypt Newdes — shifted incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f` |
| `input` | `1011121314151617` |
| `expected` | `48fbd180b8f4cd1a` |

---

[← All algorithms](../README.md)
