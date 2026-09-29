# NewDES

> New Data Encryption Standard by Robert Scott. Educational implementation of a 64-bit block cipher with 120-bit keys, designed to be easier to implement than DES.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Robert Scott |
| Year | 1985 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/block/newdes.js`](../../../algorithms/block/newdes.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 15 bytes (120 bits) |
| Block sizes | 8 bytes (64 bits) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [NewDES Original Paper](https://www.tandfonline.com/doi/abs/10.1080/0161-118591857944)
- [NewDES Analysis](https://en.wikipedia.org/wiki/NewDES)

## References

- [Mark Riordan's Implementation](https://www.schneier.com/academic/archives/1995/12/applied_cryptography_1.html)
- [Cryptologia Paper](https://www.tandfonline.com/toc/ucry20/9/1)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Riordan reference implementation - all-zero plaintext](https://www.schneier.com/wp-content/uploads/2015/03/NEWDES-2.zip)

| Field | Value |
| --- | --- |
| `key` | `0123456789abcdef0123456789abcd` |
| `input` | `0000000000000000` |
| `expected` | `7f603881d097f619` |

**Vector 2** — [Riordan reference implementation - all-zero key](https://www.schneier.com/wp-content/uploads/2015/03/NEWDES-2.zip)

| Field | Value |
| --- | --- |
| `key` | `000000000000000000000000000000` |
| `input` | `0123456789abcdef` |
| `expected` | `f1e7afca1dee9aed` |

**Vector 3** — [Riordan reference implementation - two blocks](https://www.schneier.com/wp-content/uploads/2015/03/NEWDES-2.zip)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `255cc7953fee5aebe798c886a6eb4ab0` |

---

[← All algorithms](../README.md)
