# BLAKE-512

> BLAKE-512 hash function from SHA-3 competition. Produces 512-bit (64-byte) hash values.

## Properties

| Property | Value |
| --- | --- |
| Category | Hash Functions |
| Sub-category | Cryptographic Hash |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
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

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty string vector](https://github.com/paulmillr/noble-hashes/blob/main/test/blake.test.ts)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `a8cfbbd73726062df0c6864dda65defe 58ef0cc52a5625090fa17601e1eecd1b 628e94f396ae402a00acc9eab77b4d4c 2e852aaaa25a636d80af3fc7913ef5b8` |

**Vector 2** — [NIST SHA-3 Round 3 KAT, Len = 888 (padding boundary, 111 mod 128)](https://web.archive.org/web/20110605051750id_/http://csrc.nist.gov/groups/ST/hash/sha-3/Round3/documents/Blake_FinalRnd.zip)

| Field | Value |
| --- | --- |
| `input` | `f690a132ab46b28edfa6479283d6444e 371c6459108afd9c35dbd235e0b6b6ff 4c4ea58e7554bd002460433b2164ca51 e868f7947d7d7a0d792e4abf0be5f450 853cc40d85485b2b8857ea31b5ea6e4c cfa2f3a7ef3380066d7d8979fdac618a ad3d7e886dea4f005ae4ad05e5065f` |
| `expected` | `0043e39f7d08a1eb38a80712d6e6ce24 4fb1834bbf19a3e60a7bf9067de49a18 cb6bcefeb3885c099eaadc8e9c8f04da d0c2a0599c61194ded218354f255badd` |

---

[← All algorithms](../README.md)
