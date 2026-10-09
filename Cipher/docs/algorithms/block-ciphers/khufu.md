# Khufu

> Ralph Merkle's Khufu: a 64-bit Feistel block cipher with a key of up to 512 bits and 8 to 64 rounds (default 16). Each octet of 8 rounds uses its own key-dependent S-box, built by shuffling the byte columns of a standard S-box drawn from RAND's published random digits with a key stream from Khufu in CBC mode.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | ❌ Broken |
| Complexity | Advanced |
| Inventor | Ralph Merkle |
| Year | 1990 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/block/khufu.js`](../../../algorithms/block/khufu.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 1 byte (8 bits) to 64 bytes (512 bits) |
| Block sizes | 8 bytes (64 bits) |

## Security

**Status:** ❌ Broken

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| [Differential Cryptanalysis](https://link.springer.com/chapter/10.1007/3-540-48658-5_33) | 16-round Khufu is broken by a differential chosen-plaintext attack using about 2^43 chosen plaintexts (Gilbert and Chauvaud, CRYPTO '94). | Use a modern cipher such as AES. |

## Documentation

- [CRYPTO '90 Paper: Fast Software Encryption Functions](https://link.springer.com/chapter/10.1007/3-540-38424-3_34)
- [U.S. Patent 5,003,597 (with the reference program as Appendix A)](https://patents.google.com/patent/US5003597A/en)
- [RAND: A Million Random Digits with 100,000 Normal Deviates](https://www.rand.org/pubs/monograph_reports/MR1418.html)
- [Wikipedia - Khufu and Khafre](https://en.wikipedia.org/wiki/Khufu_and_Khafre)

## References

- [US 5,003,597 full text and drawings (PDF)](https://patentimages.storage.googleapis.com/da/90/c5/6e9f3e99ad270f/US5003597.pdf)
- [Gilbert and Chauvaud: A Chosen Plaintext Attack of the 16-round Khufu Cryptosystem](https://link.springer.com/chapter/10.1007/3-540-48658-5_33)

## Test vectors

8 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [US 5,003,597 Appendix A: key 0x345, "Hello th" (block 1 of the published CBC output)](https://patents.google.com/patent/US5003597A/en)

| Field | Value |
| --- | --- |
| `key` | `3450` |
| `input` | `48656c6c6f207468` |
| `expected` | `daa19c48c60e2947` |

**Vector 2** — [US 5,003,597 Appendix A: key 0x345, block 2 ("ere, wor" XOR block 1)](https://patents.google.com/patent/US5003597A/en)

| Field | Value |
| --- | --- |
| `key` | `3450` |
| `input` | `bfd3f964e6794635` |
| `expected` | `c87fd857beeb1d71` |

**Vector 3** — [US 5,003,597 Appendix A: key 0x345, block 3 ("ld!\n" and 0x80 padding XOR block 2)](https://patents.google.com/patent/US5003597A/en)

| Field | Value |
| --- | --- |
| `key` | `3450` |
| `input` | `a41bf95d3eeb1d71` |
| `expected` | `d76cc01b1de661be` |

**Vector 4** — [Zero 64-bit key, zero block, 16 rounds (reference program of US 5,003,597)](https://patents.google.com/patent/US5003597A/en)

| Field | Value |
| --- | --- |
| `key` | `0000000000000000` |
| `input` | `0000000000000000` |
| `expected` | `4b31a94cc29f4223` |

**Vector 5** — [512-bit key 00..3F, 16 rounds (reference program of US 5,003,597)](https://patents.google.com/patent/US5003597A/en)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `input` | `0123456789abcdef` |
| `expected` | `76af43ad43db9918` |

**Vector 6** — [512-bit key 00..3F, 32 rounds (reference program of US 5,003,597)](https://patents.google.com/patent/US5003597A/en)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `rounds` | `32` |
| `input` | `0123456789abcdef` |
| `expected` | `4ae44e6bb4ce0cae` |

**Vector 7** — [128-bit key, all-ones block, 8 rounds (reference program of US 5,003,597)](https://patents.google.com/patent/US5003597A/en)

| Field | Value |
| --- | --- |
| `key` | `0123456789abcdeffedcba9876543210` |
| `rounds` | `8` |
| `input` | `ffffffffffffffff` |
| `expected` | `09a0009ffe68aa60` |

**Vector 8** — [128-bit key, all-ones block, 64 rounds (reference program of US 5,003,597)](https://patents.google.com/patent/US5003597A/en)

| Field | Value |
| --- | --- |
| `key` | `0123456789abcdeffedcba9876543210` |
| `rounds` | `64` |
| `input` | `ffffffffffffffff` |
| `expected` | `ac21a13ce5ec13f2` |

---

[← All algorithms](../README.md)
