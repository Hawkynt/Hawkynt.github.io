# Bcrypt-PBKDF

> OpenBSD's password-based key derivation function using eksblowfish (expensive key schedule Blowfish). Uses Bcrypt as a cryptographic primitive with iterative hashing for strong key stretching. Different from standard Bcrypt password hashing - designed specifically for key derivation in OpenSSH and other applications.

## Properties

| Property | Value |
| --- | --- |
| Category | Key Derivation Functions |
| Sub-category | Key Derivation Function |
| Security status | 🛡️ Secure |
| Complexity | Advanced |
| Inventor | Niels Provos, Ted Unangst |
| Year | 2013 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/kdf/bcrypt-pbkdf.js`](../../../algorithms/kdf/bcrypt-pbkdf.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Output sizes | 1 byte (8 bits) to 1024 bytes (8192 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `SaltRequired` | Yes |

## Security

**Status:** 🛡️ Secure

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Computational Cost | While designed to be expensive, modern GPUs can parallelize bcrypt. Use sufficient rounds (32+) for 2025. | — |
| Side-Channel Timing | Implementation should use constant-time comparisons for password verification | — |

## Documentation

- [OpenBSD bcrypt_pbkdf Source](https://github.com/openbsd/src/blob/master/lib/libutil/bcrypt_pbkdf.c)
- [Botan Bcrypt-PBKDF Implementation](https://github.com/randombit/botan/blob/master/src/lib/pbkdf/bcrypt_pbkdf/)
- [OpenSSH Usage of bcrypt_pbkdf](https://github.com/openssh/openssh-portable/blob/master/sshkey.c)

## References

- [Provos-Mazieres Paper (Original Bcrypt)](https://www.usenix.org/legacy/events/usenix99/provos/provos.pdf)
- [Password Hashing Competition](https://password-hashing.net/)
- [Bcrypt vs PBKDF2 Analysis](https://security.stackexchange.com/questions/4781/do-any-security-experts-recommend-bcrypt-for-password-storage)

## Test vectors

7 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Botan Test #1: password/salt, 12 rounds, 32 bytes](https://github.com/randombit/botan/blob/master/src/tests/data/bcrypt_pbkdf.vec)

| Field | Value |
| --- | --- |
| `salt` | `73616c74` |
| `iterations` | `12` |
| `outputSize` | `32` |
| `input` | `70617373776f7264` |
| `expected` | `1ae42c05d487bc02f64921a4ebe4ea93bcacfe135fda99974c06b7b01fae149a` |

**Vector 2** — [Botan Test #2: A/0001020304050607, 10 rounds, 10 bytes](https://github.com/randombit/botan/blob/master/src/tests/data/bcrypt_pbkdf.vec)

| Field | Value |
| --- | --- |
| `salt` | `0001020304050607` |
| `iterations` | `10` |
| `outputSize` | `10` |
| `input` | `41` |
| `expected` | `3c705da7e10c61c2523b` |

**Vector 3** — [Botan Test #3: A/0001020304050607, 10 rounds, 64 bytes](https://github.com/randombit/botan/blob/master/src/tests/data/bcrypt_pbkdf.vec)

| Field | Value |
| --- | --- |
| `salt` | `0001020304050607` |
| `iterations` | `10` |
| `outputSize` | `64` |
| `input` | `41` |
| `expected` | `3cf670095d5fa753e1430c6d6177c299 521b3b614d9e53fa89c7f893f33289f6 77ddd72ee1aa29cbf5574a948de4623c 71996ffd16c8806fdd7acbe02992deac` |

**Vector 4** — [Botan Test #4: password/salt, 3 rounds, 32 bytes](https://github.com/randombit/botan/blob/master/src/tests/data/bcrypt_pbkdf.vec)

| Field | Value |
| --- | --- |
| `salt` | `73616c74` |
| `iterations` | `3` |
| `outputSize` | `32` |
| `input` | `70617373776f7264` |
| `expected` | `ccb508027535a962f591d4a7eea08fe15ee0b68044b1a7b209605fdfbfb41228` |

**Vector 5** — [Botan Test #5: password/salt, 4 rounds, 16 bytes](https://github.com/randombit/botan/blob/master/src/tests/data/bcrypt_pbkdf.vec)

| Field | Value |
| --- | --- |
| `salt` | `73616c74` |
| `iterations` | `4` |
| `outputSize` | `16` |
| `input` | `70617373776f7264` |
| `expected` | `5bbf0cc293587f1c3635555c27796598` |

**Vector 6** — [Botan Test #6: password/salt, 8 rounds, 64 bytes](https://github.com/randombit/botan/blob/master/src/tests/data/bcrypt_pbkdf.vec)

| Field | Value |
| --- | --- |
| `salt` | `73616c74` |
| `iterations` | `8` |
| `outputSize` | `64` |
| `input` | `70617373776f7264` |
| `expected` | `e1367ec5151a33faac4cc1c144cd23fa 15d5548493ecc99b9b5d9c0d3b27bec7 6227ea66088b849b20ab7aa478010246 e74bba51723fefa9f9474d6508845e8d` |

**Vector 7** — [Botan Test #7: password/salt, 10 rounds, 32 bytes](https://github.com/randombit/botan/blob/master/src/tests/data/bcrypt_pbkdf.vec)

| Field | Value |
| --- | --- |
| `salt` | `73616c74` |
| `iterations` | `10` |
| `outputSize` | `32` |
| `input` | `70617373776f7264` |
| `expected` | `abc7dcfb41032d844af67a1d1ef8a5e6a04aa3073d4f2777bfa5fe07a54cff9d` |

---

[← All algorithms](../README.md)
