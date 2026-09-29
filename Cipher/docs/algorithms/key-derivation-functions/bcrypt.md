# Bcrypt

> Industry-standard password hashing function based on Blowfish cipher with expensive key schedule. Designed by Niels Provos and David Mazières. Provides configurable work factor for future-proof security against brute-force attacks.

## Properties

| Property | Value |
| --- | --- |
| Category | Key Derivation Functions |
| Sub-category | Password Hash |
| Security status | 🛡️ Secure |
| Complexity | Intermediate |
| Inventor | Niels Provos, David Mazières |
| Year | 1999 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/kdf/bcrypt.js`](../../../algorithms/kdf/bcrypt.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Output sizes | 23 bytes (184 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `SaltRequired` | Yes |

## Security

**Status:** 🛡️ Secure

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| 72-Character Truncation | Bcrypt truncates passwords at 72 characters. For longer passwords, pre-hash with SHA-256 and use hex encoding. | — |
| Work Factor Evolution | Cost factor should increase over time as hardware improves. Current minimum recommended: 10-12 (2023). | — |

## Documentation

- [Original Paper - A Future-Adaptable Password Scheme](https://www.usenix.org/legacy/events/usenix99/provos/provos.pdf)
- [OpenBSD bcrypt Implementation](https://cvsweb.openbsd.org/cgi-bin/cvsweb/src/lib/libc/crypt/bcrypt.c)
- [Wikipedia - bcrypt](https://en.wikipedia.org/wiki/Bcrypt)
- [Botan Bcrypt Documentation](https://botan.randombit.net/handbook/api_ref/passhash.html#bcrypt)

## References

- [Bcrypt Security Analysis](https://www.usenix.org/conference/woot14/workshop-program/presentation/forler)
- [Password Hashing Competition](https://www.password-hashing.net/)
- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)

## Test vectors

15 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Botan Test Vector #1: 'abc' with cost 5](https://github.com/randombit/botan/blob/master/src/tests/data/passhash/bcrypt.vec)

| Field | Value |
| --- | --- |
| `cost` | `5` |
| `salt` | `16147436e008f0056afe16461e258ddd` |
| `input` | `616263` |
| `expected` | `f09adacb994a66245e9c13794afe65194c18a23cefa2b5` |

**Vector 2** — [Botan Test Vector #2: Empty password with cost 5](https://github.com/randombit/botan/blob/master/src/tests/data/passhash/bcrypt.vec)

| Field | Value |
| --- | --- |
| `cost` | `5` |
| `salt` | `10410410410410410410410410410410` |
| `input` | _(empty)_ |
| `expected` | `f702365c4d4ae1d53d97cd28b0b93f11f79fce44d560fd` |

**Vector 3** — [Botan Test Vector #3: Hex U*2 with cost 5](https://github.com/randombit/botan/blob/master/src/tests/data/passhash/bcrypt.vec)

| Field | Value |
| --- | --- |
| `cost` | `5` |
| `salt` | `10410410410410410410410410410410` |
| `input` | `552a55` |
| `expected` | `1bb69143f9a8d304c8d23d99ab049a77a68e2ccc744206` |

**Vector 4** — [Botan Test Vector #4: Hex U*U* with cost 5](https://github.com/randombit/botan/blob/master/src/tests/data/passhash/bcrypt.vec)

| Field | Value |
| --- | --- |
| `cost` | `5` |
| `salt` | `10410410410410410410410410410410` |
| `input` | `552a552a` |
| `expected` | `5c84350bdfbaa96ac16f615ae79f35cfdacd682d369f23` |

**Vector 5** — [Botan Test Vector #5: Long ASCII string (72+ chars truncated)](https://github.com/randombit/botan/blob/master/src/tests/data/passhash/bcrypt.vec)

| Field | Value |
| --- | --- |
| `cost` | `5` |
| `salt` | `71d79f8218a39259a7a29aabb2dbafc3` |
| `input` | `30313233343536373839616263646566 6768696a6b6c6d6e6f70717273747576 7778797a4142434445464748494a4b4c 4d4e4f505152535455565758595a3031 32333435363738396368617273206166 746572203732206172652069676e6f72 6564` |
| `expected` | `eeee31f80919920425881002d140d555b28a5c72e00f09` |

**Vector 6** — [Botan Test Vector #6: OpenBSD 'A' single char](https://github.com/randombit/botan/blob/master/src/tests/data/passhash/bcrypt.vec)

| Field | Value |
| --- | --- |
| `cost` | `4` |
| `salt` | `00000000000000000000000000000000` |
| `input` | `41` |
| `expected` | `df49e1237b7559ecc1afa1b861865d3378cf0e5c275c18` |

**Vector 7** — [Botan Test Vector #7: OpenBSD 'AB'](https://github.com/randombit/botan/blob/master/src/tests/data/passhash/bcrypt.vec)

| Field | Value |
| --- | --- |
| `cost` | `4` |
| `salt` | `00000000000000000000000000000000` |
| `input` | `4142` |
| `expected` | `80da2e9dfb3c32087a9cfd61b89e48369ed91adfc17e6d` |

**Vector 8** — [Botan Test Vector #8: OpenBSD 'ABC'](https://github.com/randombit/botan/blob/master/src/tests/data/passhash/bcrypt.vec)

| Field | Value |
| --- | --- |
| `cost` | `4` |
| `salt` | `00000000000000000000000000000000` |
| `input` | `414243` |
| `expected` | `520ab39653ca2460bd0f6ddabf81ece1a3d4324bef460a` |

**Vector 9** — [Botan Test Vector #9: OpenBSD 'ABCD'](https://github.com/randombit/botan/blob/master/src/tests/data/passhash/bcrypt.vec)

| Field | Value |
| --- | --- |
| `cost` | `4` |
| `salt` | `00000000000000000000000000000000` |
| `input` | `41424344` |
| `expected` | `ed6602ad33de5fe8853fc9a8f0c7ce13d38b4e91cd2cd9` |

**Vector 10** — [Botan Test Vector #10: OpenBSD 'ABCDE'](https://github.com/randombit/botan/blob/master/src/tests/data/passhash/bcrypt.vec)

| Field | Value |
| --- | --- |
| `cost` | `4` |
| `salt` | `00000000000000000000000000000000` |
| `input` | `4142434445` |
| `expected` | `72c54a412df2d3cceae0532423896f5c9c0d84310012f8` |

**Vector 11** — [Botan Test Vector #11: OpenBSD 'ABCDEF'](https://github.com/randombit/botan/blob/master/src/tests/data/passhash/bcrypt.vec)

| Field | Value |
| --- | --- |
| `cost` | `4` |
| `salt` | `00000000000000000000000000000000` |
| `input` | `414243444546` |
| `expected` | `e6059ef065df289351509ba118f7fde74dec2568a0195f` |

**Vector 12** — [Botan Test Vector #12: OpenBSD 'ABCDEFG'](https://github.com/randombit/botan/blob/master/src/tests/data/passhash/bcrypt.vec)

| Field | Value |
| --- | --- |
| `cost` | `4` |
| `salt` | `00000000000000000000000000000000` |
| `input` | `41424344454647` |
| `expected` | `1f05fceff3707cf28ddb42e1b2d7402c3d9c777804644d` |

**Vector 13** — [Botan Test Vector #13: OpenBSD 'ABCDEFGH'](https://github.com/randombit/botan/blob/master/src/tests/data/passhash/bcrypt.vec)

| Field | Value |
| --- | --- |
| `cost` | `4` |
| `salt` | `00000000000000000000000000000000` |
| `input` | `4142434445464748` |
| `expected` | `dd8155e77701443c1a93a8e8728e22c68882efabff2564` |

**Vector 14** — [Botan Test Vector #14: OpenBSD 'ABCDEFGHI'](https://github.com/randombit/botan/blob/master/src/tests/data/passhash/bcrypt.vec)

| Field | Value |
| --- | --- |
| `cost` | `4` |
| `salt` | `00000000000000000000000000000000` |
| `input` | `414243444546474849` |
| `expected` | `7093a1d05df6deb41cdff0b17a5fb21e6f73f8bd110509` |

**Vector 15** — [Botan Test Vector #15: OpenBSD 'ABCDEFGHIJ'](https://github.com/randombit/botan/blob/master/src/tests/data/passhash/bcrypt.vec)

| Field | Value |
| --- | --- |
| `cost` | `4` |
| `salt` | `00000000000000000000000000000000` |
| `input` | `4142434445464748494a` |
| `expected` | `392aaa30d1be011e7c21d60559db66e0f57945a6ee6502` |

---

[← All algorithms](../README.md)
