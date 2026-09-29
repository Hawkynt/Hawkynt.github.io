# Twofish

> AES finalist cipher by Bruce Schneier with key-dependent S-boxes and MDS matrix. Supports 128, 192, and 256-bit keys with excellent security analysis.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | Not classified |
| Complexity | Advanced |
| Inventor | Bruce Schneier, John Kelsey, Doug Whiting, David Wagner, Chris Hall, Niels Ferguson |
| Year | 1998 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/block/twofish.js`](../../../algorithms/block/twofish.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits); 24 bytes (192 bits); 32 bytes (256 bits) |
| Block sizes | 16 bytes (128 bits) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [Twofish Algorithm Specification](https://www.schneier.com/academic/twofish/)
- [Twofish: A 128-Bit Block Cipher](https://www.schneier.com/academic/paperfiles/paper-twofish-paper.pdf)
- [NIST AES Candidate Submission](https://csrc.nist.gov/projects/cryptographic-standards-and-guidelines/archived-crypto-projects/aes-development)

## References

- [Crypto++ Twofish Implementation](https://github.com/weidai11/cryptopp/blob/master/twofish.cpp)
- [libgcrypt Twofish Implementation](https://github.com/gpg/libgcrypt/blob/master/cipher/twofish.c)
- [Bouncy Castle Twofish Implementation](https://github.com/bcgit/bc-java/tree/master/core/src/main/java/org/bouncycastle/crypto/engines)

## Test vectors

7 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Twofish vector 1/zero](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0000000000000000000000000000000000000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `57ff739d4dc92c1bd7fc01700cc8216f` |

**Vector 2** — [DarkCrypt Twofish vector 2/incr](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `8ef0272c42db838bcf7b07af0ec30f38` |

**Vector 3** — [DarkCrypt Twofish vector 3/incr2](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20` |
| `input` | `101112131415161718191a1b1c1d1e1f` |
| `expected` | `36b0770fe4c470de19f63edf1a73e707` |

**Vector 4** — [Twofish ECB 128-bit Key Test Vector](https://www.schneier.com/code/ecb_ival.txt)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `9f589f5cf6122c32b6bfec2f2ae8c35a` |

**Vector 5** — [Twofish ECB 128-bit Key Test Vector #2](https://www.schneier.com/code/ecb_ival.txt)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000` |
| `input` | `9f589f5cf6122c32b6bfec2f2ae8c35a` |
| `expected` | `d491db16e7b1c39e86cb086b789f5419` |

**Vector 6** — [Twofish ECB 192-bit Key Test Vector](https://www.schneier.com/code/ecb_ival.txt)

| Field | Value |
| --- | --- |
| `key` | `000000000000000000000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `efa71f788965bd4453f860178fc19101` |

**Vector 7** — [Twofish ECB 256-bit Key Test Vector](https://www.schneier.com/code/ecb_ival.txt)

| Field | Value |
| --- | --- |
| `key` | `0000000000000000000000000000000000000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `57ff739d4dc92c1bd7fc01700cc8216f` |

---

[← All algorithms](../README.md)
