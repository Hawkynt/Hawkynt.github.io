# BLAKE-224

> BLAKE-224 hash function from SHA-3 competition. Produces 224-bit (28-byte) hash values.

## Properties

| Property | Value |
| --- | --- |
| Category | Hash Functions |
| Sub-category | Cryptographic Hash |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Jean-Philippe Aumasson, Luca Henzen, Willi Meier, Raphael C.-W. Phan |
| Year | 2008 |
| Origin | 🇨🇭 Switzerland |
| Source | [`algorithms/hash/blake.js`](../../../algorithms/hash/blake.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [BLAKE Paper](https://www.aumasson.jp/blake/blake.pdf)
- [SHA-3 Competition](https://csrc.nist.gov/projects/hash-functions/sha-3-project)
- [Noble Hashes Implementation](https://github.com/paulmillr/noble-hashes)

## References

- [BLAKE reference implementation (Jean-Philippe Aumasson)](https://github.com/veorq/BLAKE)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty string vector](https://github.com/paulmillr/noble-hashes/blob/main/test/blake.test.ts)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `7dc5313b1c04512a174bd6503b89607aecbee0903d40a8a569c94eed` |

**Vector 2** — [Quick brown fox](https://github.com/paulmillr/noble-hashes/blob/main/test/blake.test.ts)

| Field | Value |
| --- | --- |
| `input` | `54686520717569636b2062726f776e20 666f78206a756d7073206f7665722074 6865206c617a7920646f67` |
| `expected` | `c8e92d7088ef87c1530aee2ad44dc720cc10589cc2ec58f95a15e51b` |

**Vector 3** — [NIST SHA-3 Round 3 KAT, Len = 440 (padding boundary, 55 mod 64)](https://web.archive.org/web/20110605051750id_/http://csrc.nist.gov/groups/ST/hash/sha-3/Round3/documents/Blake_FinalRnd.zip)

| Field | Value |
| --- | --- |
| `input` | `de286ba4206e8b005714f80fb1cdfaeb de91d29f84603e4a3ebc04686f99a46c 9e880b96c574825582e8812a26e5a857 ffc6579f63742f` |
| `expected` | `fa083b9d06432539780b306f8869c12ebc8c893e9308a208b337182d` |

---

[← All algorithms](../README.md)
