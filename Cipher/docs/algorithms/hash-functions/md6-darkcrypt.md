# MD6 (DarkCrypt)

> Standard MD6-512 hash function as used by the DarkCrypt Total Commander plugin: the unmodified MIT reference MD6 implementation, hardcoded to digest size d=512 bits, r=168 rounds, mode parameter L=64 (fully hierarchical), and no key.

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
- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)

## References

- [DarkCrypt Total Commander plugin](https://github.com/Zdimon/DarkCryptTC)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt MD6 empty string](https://github.com/Zdimon/DarkCryptTC)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `e3bde7f708d2006335b09d95a0e8648a 87f782e7a1ef17d676d84cc91fe00633 1749fcf14bf2a4c80ae1aeb52ed0799c 8fc9420c59344d4731690e18f7a2cef3` |

**Vector 2** — [DarkCrypt MD6 "abc"](https://github.com/Zdimon/DarkCryptTC)

| Field | Value |
| --- | --- |
| `input` | `616263` |
| `expected` | `1c6233a806832e2c711a5595cdc355b0 4b81a3f547fff89e40391399bb925bc8 45a0cce9ecc3d1b0439450e079df51a2 3d9fdafe99a85e72d1562bbae6a1eb46` |

**Vector 3** — [DarkCrypt MD6 incremental 64-byte message](https://github.com/Zdimon/DarkCryptTC)

| Field | Value |
| --- | --- |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `expected` | `cedddc4d2d764a430bcfa5e03ca641f3 fdb7aabf9782dd0174b4669a164f5ab8 1b223a3dd84a6cbd84d6be2a3a31babe 316ccd400d66cbc180ddfa3c17fd0ed0` |

---

[← All algorithms](../README.md)
