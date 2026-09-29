# Panama-BE-MAC

> Panama-BE MAC using hermetic hash function construction. Key is prepended to message before hashing. Broken by collision attacks on underlying hash - use for legacy compatibility only.

## Properties

| Property | Value |
| --- | --- |
| Category | Message Authentication |
| Sub-category | Hermetic MAC |
| Security status | ❌ Broken |
| Complexity | Advanced |
| Inventor | Joan Daemen, Craig Clapp |
| Year | 1998 |
| Origin | 🇧🇪 Belgium |
| Source | [`algorithms/hash/panama.js`](../../../algorithms/hash/panama.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| MAC sizes | 32 bytes (256 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `NeedsKey` | Yes |
| `VariableKeyLength` | Yes |

## Security

**Status:** ❌ Broken

No vulnerabilities are recorded for this implementation.

## Documentation

- [Panama Specification (FSE'98)](http://www.weidai.com/scan-mirror/md.html#Panama)
- [Hermetic MAC Construction](https://github.com/weidai11/cryptopp/blob/master/panama.h#L66)

## References

- [Crypto++ Implementation](https://github.com/weidai11/cryptopp/blob/master/panama.h)
- [Crypto++ Test Vectors](https://github.com/weidai11/cryptopp/blob/master/TestVectors/panama.txt)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Panama-BE-MAC: Empty key, empty message (Crypto++ modified)](https://github.com/weidai11/cryptopp/blob/master/TestVectors/panama.txt)

| Field | Value |
| --- | --- |
| `key` | _(empty)_ |
| `input` | _(empty)_ |
| `expected` | `e81aa04523532dd7267e5c5bc3ba0e289837a62ba032350351980e960a84b0af` |

**Vector 2** — [Panama-BE-MAC: Empty key, 'The quick brown fox...' (Crypto++ modified)](https://github.com/weidai11/cryptopp/blob/master/TestVectors/panama.txt)

| Field | Value |
| --- | --- |
| `key` | _(empty)_ |
| `input` | `54686520717569636b2062726f776e20 666f78206a756d7073206f7665722074 6865206c617a7920646f67` |
| `expected` | `8fa7dadce0110f979a0b795e76b2c25628d8bda88747758149c42e3bc13f85bc` |

**Vector 3** — [Panama-BE-MAC: Key 'The ', message 'quick brown fox...' (Crypto++ modified)](https://github.com/weidai11/cryptopp/blob/master/TestVectors/panama.txt)

| Field | Value |
| --- | --- |
| `key` | `54686520` |
| `input` | `717569636b2062726f776e20666f7820 6a756d7073206f76657220746865206c 617a7920646f67` |
| `expected` | `8fa7dadce0110f979a0b795e76b2c25628d8bda88747758149c42e3bc13f85bc` |

---

[← All algorithms](../README.md)
