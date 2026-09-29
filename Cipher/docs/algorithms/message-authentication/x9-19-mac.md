# X9.19-MAC

> ANSI X9.19 Message Authentication Code using DES/3DES. Also known as ISO 9807-1 MAC Algorithm 3 Mode 1 or Retail MAC. Uses DES in CBC mode with 3DES-EDE for the final block.

## Properties

| Property | Value |
| --- | --- |
| Category | Message Authentication |
| Sub-category | DES-based MAC |
| Security status | ⚠️ Deprecated |
| Complexity | Intermediate |
| Inventor | ANSI (American National Standards Institute) |
| Year | 1986 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/mac/x919-mac.js`](../../../algorithms/mac/x919-mac.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 8 bytes (64 bits); 16 bytes (128 bits) |
| MAC sizes | 8 bytes (64 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `NeedsKey` | Yes |

## Security

**Status:** ⚠️ Deprecated

No vulnerabilities are recorded for this implementation.

## Documentation

- [ANSI X9.19 Standard](https://webstore.ansi.org/standards/ascx9/ansix9191986r1998)
- [ISO 9807-1:1991](https://www.iso.org/standard/17743.html)
- [Botan X9.19-MAC Implementation](https://botan.randombit.net/handbook/api_ref/mac.html)

## References

- [Retail MAC Wikipedia](https://en.wikipedia.org/wiki/CBC-MAC#Retail_MAC)
- [Botan Source Code](https://github.com/randombit/botan/tree/master/src/lib/mac/x919_mac)
- [NIST SP 800-38B - MAC Modes](https://csrc.nist.gov/publications/detail/sp/800-38b/final)

## Test vectors

6 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Botan X9.19-MAC Test Vector #1](https://github.com/randombit/botan/blob/master/src/tests/data/mac/x919_mac.vec)

| Field | Value |
| --- | --- |
| `key` | `0123456789abcdef` |
| `input` | `31311c3931383237333634351c1c3538 3134333237361c1c3b31323334353637 3839303132333435363d393931323130 3030303f1c30303031323530301c3937 38363533343132343837363932331c` |
| `expected` | `c156f1b8cdbfb451` |

**Vector 2** — [Botan X9.19-MAC Test Vector #2](https://github.com/randombit/botan/blob/master/src/tests/data/mac/x919_mac.vec)

| Field | Value |
| --- | --- |
| `key` | `0123456789abcdef` |
| `input` | `35383134333237361c3b313233343536 373839303132333435363d1c30303031 323530301c3937383635333431323438 37363932331c` |
| `expected` | `ab4884061a159618` |

**Vector 3** — [Botan X9.19-MAC Test Vector #3 (3DES key)](https://github.com/randombit/botan/blob/master/src/tests/data/mac/x919_mac.vec)

| Field | Value |
| --- | --- |
| `key` | `0123456789abcdeffedcba9876543210` |
| `input` | `31311c3931383237333634351c1c3538 3134333237361c1c3b31323334353637 3839303132333435363d393931323130 3030303f1c30303031323530301c3937 38363533343132343837363932331c` |
| `expected` | `c209ccb78ee1b606` |

**Vector 4** — [Botan X9.19-MAC Test Vector #4](https://github.com/randombit/botan/blob/master/src/tests/data/mac/x919_mac.vec)

| Field | Value |
| --- | --- |
| `key` | `4061610d85685db0f4d9f1c8fe15a123` |
| `input` | `33303030303230313935435553543031 20202020552020202020202020202020 20202020202020205430325345415450 4152594742324c54535435534f414131 39393530323237313333393434303030 30202020202020202020202020203330 30303031304139354558413030303030 333144` |
| `expected` | `dbe9eb0fa03838d2` |

**Vector 5** — [Botan X9.19-MAC Test Vector #5 (Long message)](https://github.com/randombit/botan/blob/master/src/tests/data/mac/x919_mac.vec)

| Field | Value |
| --- | --- |
| `key` | `bb296726f91480cdc432ab3067536eab` |
| `input` | `e7ef0ec901ccc8e5e44579a25aae7fb8 2fa475acd95f2de313c5c2b7bca63ba3 95496c9615347cfa7af59cd4a31c8dd3 c0027f9961ad7c75723e2c2ee467d279 b13e10c6738cc0ed815dc125794ef839 5177d2b2244e27978d53c571bb97eb6c d6fb324987f3360850f72dc946250297 9dd449c1227158afc41e217fb50ceb8b 071ed48e110a966102c42a48e92cdf86 0028482299a0d25ebef3dd74ffc9ff06 e7d494f8de2a59e0ee8328d8af075eaf 30a6d1c947a3270596057995ce799bb5 4d2fad2b5a060c48893420383c7fe76c 25b8356c5c5d72f262eb88306423e5b1 5392ddad98e9f521` |
| `expected` | `83c4b075af24ab7c` |

**Vector 6** — [Botan X9.19-MAC Test Vector #6 (Long message)](https://github.com/randombit/botan/blob/master/src/tests/data/mac/x919_mac.vec)

| Field | Value |
| --- | --- |
| `key` | `214b48ab97e144f1005831c8c97b8ef0` |
| `input` | `12916051c77047c9efd1e3a43d0086d9 899aa28818bccc5d8b5a0a848682f898 1359e9dac931a4b902875d3f87e31810 7dbb98967765f302bffd8645807fde93 d8c76ea1f8125afb99b83a209b533119 0ec9af852ea287eea00d33208c11b364 d92106d13360cccc1807edb45a1ecd68 e77ced161e7404be8137de0e49927222 b378f3e7d9c0b3f1c7a0a521be7289a6 ee76bc0deac0cb6bf7aa79403cec62ef 6456d63d168a2fdd2ad4fee947878f35 fd4b42e70b0e5202b8cc43f4b8a5e31c fbba5a114489ee6e5dec57a473e6da70 311c573c2aaa3fe2` |
| `expected` | `31174049f029eb36` |

---

[← All algorithms](../README.md)
