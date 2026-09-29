# GIMLI-24-HASH

> Lightweight hash function based on the GIMLI-24 permutation using a sponge construction. Designed for simplicity and efficiency in constrained environments while providing 256-bit security.

## Properties

| Property | Value |
| --- | --- |
| Category | Hash Functions |
| Sub-category | Lightweight Hash |
| Security status | 🧪 Experimental |
| Complexity | Advanced |
| Inventor | Daniel J. Bernstein, Stefan Kölbl, Stefan Lucks, Pedro Maat Costa Massolino, Florian Mendel, Kashif Nawaz, Tobias Schneider, Peter Schwabe, François-Xavier Standaert, Yosuke Todo, Benoît Viguier |
| Year | 2017 |
| Origin | 🌐 International |
| Source | [`algorithms/hash/gimli24-hash.js`](../../../algorithms/hash/gimli24-hash.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Output sizes | 32 bytes (256 bits) |

## Security

**Status:** 🧪 Experimental

No vulnerabilities are recorded for this implementation.

## Documentation

- [GIMLI Official Website](https://gimli.cr.yp.to/)
- [GIMLI Specification](https://gimli.cr.yp.to/gimli-20170627.pdf)
- [NIST Lightweight Cryptography](https://csrc.nist.gov/projects/lightweight-cryptography)
- [Reference Implementation](https://github.com/rweather/lightweight-crypto)

## References

- [rweather lightweight-crypto reference implementation (GIMLI-24-HASH)](https://github.com/rweather/lightweight-crypto)
- [Official GIMLI website with reference C code](https://gimli.cr.yp.to/)

## Test vectors

6 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [GIMLI-24-HASH: Empty message (Count=1)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/GIMLI-24-HASH.txt)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `27ae20e95fbc2bf01e972b0015eea431c20fc8818f25bc6dbe66232230db352f` |

**Vector 2** — [GIMLI-24-HASH: Single byte 0x00 (Count=2)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/GIMLI-24-HASH.txt)

| Field | Value |
| --- | --- |
| `input` | `00` |
| `expected` | `feae3b182d3bf6ff48f63865146abeae85d89c13e5aa688677d0354a9e893fc4` |

**Vector 3** — [GIMLI-24-HASH: Two bytes (Count=3)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/GIMLI-24-HASH.txt)

| Field | Value |
| --- | --- |
| `input` | `0001` |
| `expected` | `5feafd3c603b3bd7b31ee0982c5330e8348cb5b4cc9a10edb860e1226063d047` |

**Vector 4** — [GIMLI-24-HASH: Four bytes (Count=5)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/GIMLI-24-HASH.txt)

| Field | Value |
| --- | --- |
| `input` | `00010203` |
| `expected` | `ac9bc82b68fe1fc51db80c67f6751a09f432d0c7e78239c0697468f54ae3f5aa` |

**Vector 5** — [GIMLI-24-HASH: Eight bytes (Count=9)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/GIMLI-24-HASH.txt)

| Field | Value |
| --- | --- |
| `input` | `0001020304050607` |
| `expected` | `ef1b75e245d5956b71fcd5b90dfe72bc43f95886ad18b11e1c5b0fba44852983` |

**Vector 6** — [GIMLI-24-HASH: Sixteen bytes (Count=17)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/GIMLI-24-HASH.txt)

| Field | Value |
| --- | --- |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `404c130af1b9023a7908200919f690ffbb756d5176e056ffde320016a37c7282` |

---

[← All algorithms](../README.md)
