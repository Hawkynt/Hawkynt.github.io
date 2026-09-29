# Square

> Predecessor to Rijndael/AES designed by Joan Daemen and Vincent Rijmen in 1997. Uses 128-bit blocks and keys with 8 rounds.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Joan Daemen and Vincent Rijmen |
| Year | 1997 |
| Origin | 🇧🇪 Belgium |
| Source | [`algorithms/block/square.js`](../../../algorithms/block/square.js) |

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
| [Square attack](https://link.springer.com/chapter/10.1007/BFb0052343) | — | Algorithm is for historical/educational purposes only - use AES instead |

## Documentation

- [The block cipher Square](https://link.springer.com/chapter/10.1007/BFb0052343)
- [Fast Software Encryption 1997](https://link.springer.com/conference/fse)

## References

- [Crypto++ Square implementation](https://github.com/weidai11/cryptopp/blob/master/square.cpp)
- [Crypto++ Square tables](https://github.com/weidai11/cryptopp/blob/master/squaretb.cpp)
- [Square cipher test vectors](https://github.com/weidai11/cryptopp/blob/master/TestData/squareva.dat)

## Test vectors

9 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt SQUARE vector 1/zero](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `3c00428f8abbc0b84f057cc19c26f8cf` |

**Vector 2** — [DarkCrypt SQUARE vector 2/incr](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `7c3491d94994e70f0ec2e7a5ccb5a14f` |

**Vector 3** — [DarkCrypt SQUARE vector 3/incr2](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f10` |
| `input` | `101112131415161718191a1b1c1d1e1f` |
| `expected` | `a12e77f0b46ea52b188fcf806e2fcdc6` |

**Vector 4** — [Crypto++ squareva.dat line 2](https://github.com/weidai11/cryptopp/blob/master/TestData/squareva.dat)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `ff596fa668bfc3014200ae01e2bba0a0` |

**Vector 5** — [Crypto++ squareva.dat line 4](https://github.com/weidai11/cryptopp/blob/master/TestData/squareva.dat)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `c76c696289898137077a4a59faeeea4d` |
| `expected` | `88c6ff4b92604c6e66656b02ddaf9f40` |

**Vector 6** — [Crypto++ squareva.dat line 5](https://github.com/weidai11/cryptopp/blob/master/TestData/squareva.dat)

| Field | Value |
| --- | --- |
| `key` | `915f4619be41b2516355a50110a9ce91` |
| `input` | `21a5dbee154b8f6d6ff33b98f448e95a` |
| `expected` | `3388801f66e7fcc0bce522a23a4f0c7f` |

**Vector 7** — [Crypto++ squareva.dat line 6](https://github.com/weidai11/cryptopp/blob/master/TestData/squareva.dat)

| Field | Value |
| --- | --- |
| `key` | `783348e75aeb0f2fd7b169bb8dc16787` |
| `input` | `f7c013ac5b2b8952e5e554abe9ced2d2` |
| `expected` | `a1c0e9215141343dec2b556942c92bde` |

**Vector 8** — [Crypto++ squareva.dat line 7](https://github.com/weidai11/cryptopp/blob/master/TestData/squareva.dat)

| Field | Value |
| --- | --- |
| `key` | `dc49db1375a5584f6485b413b5f12baf` |
| `input` | `2f42b3b70369fc929ae068313f343a7a` |
| `expected` | `3fbe6811b998cdf3e50abde2f3c075e3` |

**Vector 9** — [Crypto++ squareva.dat line 8](https://github.com/weidai11/cryptopp/blob/master/TestData/squareva.dat)

| Field | Value |
| --- | --- |
| `key` | `5269f149d41ba0152497574d7f153125` |
| `input` | `65c178b284d197ccd3f111a282f17f29` |
| `expected` | `d7b7209e0879744c782809b6d2e0b1b0` |

---

[← All algorithms](../README.md)
