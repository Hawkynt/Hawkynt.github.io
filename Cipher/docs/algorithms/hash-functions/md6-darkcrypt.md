# MD6 (DarkCrypt)

> MD6-512 as used by the DarkCrypt Total Commander plugin: the MIT reference MD6 as submitted to SHA-3 round 1 (d=512, r=168, L=64, no key), which outputs the first rather than the last 512 bits of the final chaining value, a reference bug fixed in April 2009. Matches the published round 1 known-answer tests.

## Properties

| Property | Value |
| --- | --- |
| Category | Hash Functions |
| Sub-category | DarkCrypt Variant |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Ronald L. Rivest, Benjamin Agre, Daniel V. Bailey, Christopher Crutchfield, Yevgeniy Dodis, Kermin Fleming, Asif Khan, Jayant Krishnamurthy, Yuncheng Lin, Leo Reyzin, Emily Shen, Jim Sutherland, Eran Tromer, Yiqun Lisa Yin |
| Year | 2008 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/hash/darkcrypt-md6.js`](../../../algorithms/hash/darkcrypt-md6.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Output sizes | 64 bytes (512 bits) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [The MD6 Hash Function (NIST SHA-3 submission)](https://groups.csail.mit.edu/cis/md6/)
- [MD6 reference source (md6.h / md6_compress.c / md6_mode.c)](https://groups.csail.mit.edu/cis/md6/docs/md6_report.pdf)
- [NIST SHA-3 round 1 MD6 submission package (known-answer tests)](https://web.archive.org/web/2017/http://csrc.nist.gov/groups/ST/hash/sha-3/Round1/documents/MD6.zip)
- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)

## References

- [DarkCrypt Total Commander plugin](https://github.com/Zdimon/DarkCryptTC)

## Test vectors

5 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [MD6 round 1 ShortMsgKAT_512 - Len = 0](https://web.archive.org/web/2017/http://csrc.nist.gov/groups/ST/hash/sha-3/Round1/documents/MD6.zip)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `e3bde7f708d2006335b09d95a0e8648a 87f782e7a1ef17d676d84cc91fe00633 1749fcf14bf2a4c80ae1aeb52ed0799c 8fc9420c59344d4731690e18f7a2cef3` |

**Vector 2** — [MD6 round 1 ShortMsgKAT_512 - Len = 8](https://web.archive.org/web/2017/http://csrc.nist.gov/groups/ST/hash/sha-3/Round1/documents/MD6.zip)

| Field | Value |
| --- | --- |
| `input` | `cc` |
| `expected` | `0f953eba85b343063d9d9151fda0d12a 527ef8bbf3dbefb8da5e11f0c4d7359e 76058ed60c29fa1f8c33e87fdc5dde12 50e3fcffd247561cef5b70df3d55fb25` |

**Vector 3** — [MD6 round 1 LongMsgKAT_512 - Len = 4568 (two leaves)](https://web.archive.org/web/2017/http://csrc.nist.gov/groups/ST/hash/sha-3/Round1/documents/MD6.zip)

| Field | Value |
| --- | --- |
| `input` | `fe06a4706468b369f7624f62d04f9fac 020f05152f13e350016b2a29efff9a39 3940c138553356b0e2848c01b622b95f fa11ab07585f7dcbbf90e9f8ec5fa2fb …` (571 bytes; the full value is in the source) |
| `expected` | `d7e8e9ce8252ff4dc9ffedc6d8e771c8 e2d456bc959fc71003b4d0af9d392c40 e9c02f2954756b5c6648af50fca073d3 7c63ee99c1f6891fda081db2e9574c45` |

**Vector 4** — [DarkCrypt MD6 "abc"](https://github.com/Zdimon/DarkCryptTC)

| Field | Value |
| --- | --- |
| `input` | `616263` |
| `expected` | `1c6233a806832e2c711a5595cdc355b0 4b81a3f547fff89e40391399bb925bc8 45a0cce9ecc3d1b0439450e079df51a2 3d9fdafe99a85e72d1562bbae6a1eb46` |

**Vector 5** — [DarkCrypt MD6 incremental 64-byte message](https://github.com/Zdimon/DarkCryptTC)

| Field | Value |
| --- | --- |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `expected` | `cedddc4d2d764a430bcfa5e03ca641f3 fdb7aabf9782dd0174b4669a164f5ab8 1b223a3dd84a6cbd84d6be2a3a31babe 316ccd400d66cbc180ddfa3c17fd0ed0` |

---

[← All algorithms](../README.md)
