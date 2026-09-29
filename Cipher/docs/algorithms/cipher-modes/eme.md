# EME

> EME (ECB-Mask-ECB) is a wide-block tweakable cipher mode that can handle variable-length inputs while preserving format. It uses a three-round construction: ECB encrypt, mask with universal hash, then ECB encrypt again. Primarily used for format-preserving encryption applications.

## Properties

| Property | Value |
| --- | --- |
| Category | Cipher Modes |
| Sub-category | Wide-Block Tweakable Mode |
| Security status | 🧪 Experimental |
| Complexity | Research |
| Inventor | Shai Halevi, Phillip Rogaway |
| Year | 2003 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/modes/eme.js`](../../../algorithms/modes/eme.js) |

## Capabilities

| Flag | Value |
| --- | --- |
| `RequiresIV` | No |

## Security

**Status:** 🧪 Experimental

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Research Status | EME mode is primarily used in specialized format-preserving encryption applications and has limited real-world deployment. | — |
| Implementation Complexity | Requires careful implementation of universal hash functions and proper masking operations. | — |

## Documentation

- [EME Original Paper](https://web.cs.ucdavis.edu/~rogaway/papers/eme.pdf)
- [Wide-Block Encryption](https://web.cs.ucdavis.edu/~rogaway/papers/wide-block.pdf)
- [Format-Preserving Encryption](https://csrc.nist.gov/publications/detail/sp/800-38g/rev-1/draft)

## References

- [Academic Implementation](https://github.com/ciphers/eme-mode)
- [FPE Libraries](https://github.com/mysto/python-fpe)

## Test vectors

1 vector ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [EME round-trip test - single block](https://web.cs.ucdavis.edu/~rogaway/papers/eme.pdf)

| Field | Value |
| --- | --- |
| `key` | `2b7e151628aed2a6abf7158809cf4f3c` |
| `tweak` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `6bc1bee22e409f96e93d7e117393172a` |
| `expected` | _(empty)_ |

---

[← All algorithms](../README.md)
