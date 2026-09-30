# Whirlpool

> Whirlpool is a cryptographic hash function designed by Vincent Rijmen and Paulo S. L. M. Barreto. It produces a 512-bit hash value and is based on a substantially modified AES.

## Properties

| Property | Value |
| --- | --- |
| Category | Hash Functions |
| Sub-category | AES-Based Hash |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Vincent Rijmen, Paulo S. L. M. Barreto |
| Year | 2000 |
| Origin | Not specified |
| Source | [`algorithms/hash/whirlpool.js`](../../../algorithms/hash/whirlpool.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Output sizes | 64 bytes (512 bits) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [ISO/IEC 10118-3:2004](https://www.iso.org/standard/39876.html)
- [Whirlpool Specification](https://www.cosic.esat.kuleuven.be/nessie/workshop/submissions/whirlpool.zip)

## References

- [Wikipedia: Whirlpool](https://en.wikipedia.org/wiki/Whirlpool_(hash_function))
- [NESSIE Project](https://www.cosic.esat.kuleuven.be/nessie/)

## Test vectors

10 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [ISO/IEC 10118-3 Test Vector - Empty String](https://github.com/randombit/botan/blob/master/src/tests/data/hash/whirlpool.vec)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `19fa61d75522a4669b44e39c1d2e1726 c530232130d407f89afee0964997f7a7 3e83be698b288febcf88e3e03c4f0757 ea8964e59b63d93708b138cc42a66eb3` |

**Vector 2** — [ISO/IEC 10118-3 Test Vector - 'a'](https://github.com/randombit/botan/blob/master/src/tests/data/hash/whirlpool.vec)

| Field | Value |
| --- | --- |
| `input` | `61` |
| `expected` | `8aca2602792aec6f11a67206531fb7d7 f0dff59413145e6973c45001d0087b42 d11bc645413aeff63a42391a39145a59 1a92200d560195e53b478584fdae231a` |

**Vector 3** — [ISO/IEC 10118-3 Test Vector - 'abc'](https://github.com/randombit/botan/blob/master/src/tests/data/hash/whirlpool.vec)

| Field | Value |
| --- | --- |
| `input` | `616263` |
| `expected` | `4e2448a4c6f486bb16b6562c73b4020b f3043e3a731bce721ae1b303d97e6d4c 7181eebdb6c57e277d0e34957114cbd6 c797fc9d95d8b582d225292076d4eef5` |

**Vector 4** — [ISO/IEC 10118-3 Test Vector - 'message digest'](https://github.com/randombit/botan/blob/master/src/tests/data/hash/whirlpool.vec)

| Field | Value |
| --- | --- |
| `input` | `6d65737361676520646967657374` |
| `expected` | `378c84a4126e2dc6e56dcc7458377aac 838d00032230f53ce1f5700c0ffb4d3b 8421557659ef55c106b4b52ac5a4aaa6 92ed920052838f3362e86dbd37a8903e` |

**Vector 5** — [ISO/IEC 10118-3 Test Vector - lowercase alphabet](https://github.com/randombit/botan/blob/master/src/tests/data/hash/whirlpool.vec)

| Field | Value |
| --- | --- |
| `input` | `6162636465666768696a6b6c6d6e6f707172737475767778797a` |
| `expected` | `f1d754662636ffe92c82ebb9212a484a 8d38631ead4238f5442ee13b8054e41b 08bf2a9251c30b6a0b8aae86177ab4a6 f68f673e7207865d5d9819a3dba4eb3b` |

**Vector 6** — [ISO/IEC 10118-3 Test Vector - A-Z, a-z, 0-9](https://github.com/randombit/botan/blob/master/src/tests/data/hash/whirlpool.vec)

| Field | Value |
| --- | --- |
| `input` | `4142434445464748494a4b4c4d4e4f50 5152535455565758595a616263646566 6768696a6b6c6d6e6f70717273747576 7778797a30313233343536373839` |
| `expected` | `dc37e008cf9ee69bf11f00ed9aba2690 1dd7c28cdec066cc6af42e40f82f3a1e 08eba26629129d8fb7cb57211b9281a6 5517cc879d7b962142c65f5a7af01467` |

**Vector 7** — [ISO/IEC 10118-3 Test Vector - 8 times '1234567890'](https://github.com/randombit/botan/blob/master/src/tests/data/hash/whirlpool.vec)

| Field | Value |
| --- | --- |
| `input` | `31323334353637383930313233343536 37383930313233343536373839303132 33343536373839303132333435363738 39303132333435363738393031323334 35363738393031323334353637383930` |
| `expected` | `466ef18babb0154d25b9d38a6414f5c0 8784372bccb204d6549c4afadb601429 4d5bd8df2a6c44e538cd047b2681a51a 2c60481e88c5a20b2c2a80cf3a9a083b` |

**Vector 8** — [ISO/IEC 10118-3 Test Vector - 'abcdbcdecdefdefgefghfghighijhijk' (32 bytes, extra padding block)](https://github.com/randombit/botan/blob/master/src/tests/data/hash/whirlpool.vec)

| Field | Value |
| --- | --- |
| `input` | `6162636462636465636465666465666765666768666768696768696a68696a6b` |
| `expected` | `2a987ea40f917061f5d6f0a0e4644f48 8a7a5a52deee656207c562f988e95c69 16bdc8031bc5be1b7b947639fe050b56 939baaa0adff9ae6745b7b181c3be3fd` |

**Vector 9** — [Wikipedia - 'The quick brown fox jumps over the lazy dog' (43 bytes, extra padding block)](https://en.wikipedia.org/wiki/Whirlpool_(hash_function))

| Field | Value |
| --- | --- |
| `input` | `54686520717569636b2062726f776e20 666f78206a756d7073206f7665722074 6865206c617a7920646f67` |
| `expected` | `b97de512e91e3828b40d2b0fdce9ceb3 c4a71f9bea8d88e75c4fa854df36725f d2b52eb6544edcacd6f8beddfea403cb 55ae31f03ad62a5ef54e42ee82c3fb35` |

**Vector 10** — [DarkCrypt Whirlpool - 64-byte incrementing message (00..3F)](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `expected` | `5c3c6f524c8ae1e7a4f76b84977b1560 e78eb568e2fd8d72699ad79186481bd4 2b53ab39a0b741d9c098a4ecb01f3ecc f3844cf1b73a9355ee5d496a2a1fb5b3` |

---

[← All algorithms](../README.md)
