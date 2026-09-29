# Lucifer

> IBM's pioneering Feistel cipher (1973) that directly led to DES development. Uses 128-bit blocks and keys with 16-round structure.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Feistel Cipher |
| Security status | 📰 Obsolete |
| Complexity | Intermediate |
| Inventor | Horst Feistel, Don Coppersmith |
| Year | 1973 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/block/lucifer.js`](../../../algorithms/block/lucifer.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) |
| Block sizes | 16 bytes (128 bits) |

## Security

**Status:** 📰 Obsolete

No vulnerabilities are recorded for this implementation.

## Documentation

- [Original IBM Research Paper](https://dominoweb.draco.res.ibm.com/reports/RC3326.pdf)
- [Sorkin 1984 Specification](https://www.tandfonline.com/doi/abs/10.1080/0161-118491858746)

## References

- [cryptospecs LUCIFER Reference Source (lucifer.c)](https://github.com/stamparm/cryptospecs/blob/master/symmetrical/sources/lucifer.c)
- [lucifer-go Implementation](https://github.com/robwaddell/lucifer-go)

## Test vectors

6 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Applied Cryptography LUCIFER2 TESTS vector 1](https://www.schneier.com/wp-content/uploads/2015/03/LUCIFER2-2.zip)

| Field | Value |
| --- | --- |
| `key` | `0123456789abcdeffedcba9876543210` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `a201fc18d62c85ef5965a58295bbf609` |

**Vector 2** — [Applied Cryptography LUCIFER2 TESTS vector 2](https://www.schneier.com/wp-content/uploads/2015/03/LUCIFER2-2.zip)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000` |
| `input` | `0123456789abcdeffedcba9876543210` |
| `expected` | `9d14fe4377aa87dd07cc8a14522c21ed` |

**Vector 3** — [Applied Cryptography LUCIFER2 TESTS vector 3](https://www.schneier.com/wp-content/uploads/2015/03/LUCIFER2-2.zip)

| Field | Value |
| --- | --- |
| `key` | `0123456789abcdeffedcba9876543210` |
| `input` | `ffffffffffffffffffffffffffffffff` |
| `expected` | `97f1c104b0f120d194c07024f14815ed` |

**Vector 4** — [Applied Cryptography LUCIFER2 TESTS vector 4](https://www.schneier.com/wp-content/uploads/2015/03/LUCIFER2-2.zip)

| Field | Value |
| --- | --- |
| `key` | `ffffffffffffffffffffffffffffffff` |
| `input` | `0123456789abcdeffedcba9876543210` |
| `expected` | `d442a34dd70e2b4156eb0f2a8aded1a7` |

**Vector 5** — [Applied Cryptography LUCIFER2 TESTS vector 5](https://www.schneier.com/wp-content/uploads/2015/03/LUCIFER2-2.zip)

| Field | Value |
| --- | --- |
| `key` | `0123456789abcdeffedcba9876543210` |
| `input` | `0123456789abcdeffedcba9876543210` |
| `expected` | `cf46622fa98546bb9a5bc00239eb0c92` |

**Vector 6** — [Applied Cryptography LUCIFER2 TESTS vector 6](https://www.schneier.com/wp-content/uploads/2015/03/LUCIFER2-2.zip)

| Field | Value |
| --- | --- |
| `key` | `fedcba98765432100123456789abcdef` |
| `input` | `0123456789abcdeffedcba9876543210` |
| `expected` | `7faf65bfc5458fd2dc9cc2266012ef44` |

---

[← All algorithms](../README.md)
