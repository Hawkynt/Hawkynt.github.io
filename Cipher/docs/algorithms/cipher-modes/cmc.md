# CMC

> CMC (Cipher-based Message authentication Code) is a tweakable block cipher mode that provides strong pseudorandom permutation properties. It processes messages by using two keys and a universal hash function, providing security even for variable-length inputs without padding.

## Properties

| Property | Value |
| --- | --- |
| Category | Cipher Modes |
| Sub-category | Tweakable Block Cipher Mode |
| Security status | 🧪 Experimental |
| Complexity | Research |
| Inventor | Shai Halevi, Phillip Rogaway |
| Year | 2003 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/modes/cmc.js`](../../../algorithms/modes/cmc.js) |

## Capabilities

| Flag | Value |
| --- | --- |
| `RequiresIV` | No |

## Security

**Status:** 🧪 Experimental

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Research Status | CMC mode is primarily of academic interest and has not seen widespread deployment. Implementation complexity is high compared to standard modes. | — |
| Key Management | Requires careful management of two independent keys and secure universal hash function implementation. | — |

## Documentation

- [CMC Original Paper](https://web.cs.ucdavis.edu/~rogaway/papers/cmc.pdf)
- [Tweakable Block Ciphers](https://web.cs.ucdavis.edu/~rogaway/papers/tweakable.pdf)
- [NIST Analysis](https://csrc.nist.gov/publications/detail/conference-paper/2004/10/01/tweakable-block-ciphers/sp/event-details)

## References

- [Academic Implementation](https://github.com/ciphers/cmc-mode)
- [Research Code](https://web.cs.ucdavis.edu/~rogaway/cmc/)

## Test vectors

1 vector ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [CMC test - single block (AES-128)](https://web.cs.ucdavis.edu/~rogaway/papers/cmc.pdf)

| Field | Value |
| --- | --- |
| `cipher` | AES |
| `key` | `2b7e151628aed2a6abf7158809cf4f3c` |
| `key2` | `603deb1015ca71be2b73aef0857d7781` |
| `tweak` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `6bc1bee22e409f96e93d7e117393172a` |
| `expected` | `43de4eab2b81981eda9088dd9807829a` |

---

[← All algorithms](../README.md)
