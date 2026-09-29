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

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [ISO/IEC Test Vector - Empty String](https://www.iso.org/standard/39876.html)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `19fa61d75522a4669b44e39c1d2e1726 c530232130d407f89afee0964997f7a7 3e83be698b288febcf88e3e03c4f0757 ea8964e59b63d93708b138cc42a66eb3` |

**Vector 2** — [ISO/IEC Test Vector - 'a'](https://www.iso.org/standard/39876.html)

| Field | Value |
| --- | --- |
| `input` | `61` |
| `expected` | `8aca2602792aec6f11a67206531fb7d7 f0dff59413145e6973c45001d0087b42 d11bc645413aeff63a42391a39145a59 1a92200d560195e53b478584fdae231a` |

**Vector 3** — [ISO/IEC Test Vector - 'abc'](https://www.iso.org/standard/39876.html)

| Field | Value |
| --- | --- |
| `input` | `616263` |
| `expected` | `4e2448a4c6f486bb16b6562c73b4020b f3043e3a731bce721ae1b303d97e6d4c 7181eebdb6c57e277d0e34957114cbd6 c797fc9d95d8b582d225292076d4eef5` |

**Vector 4** — [DarkCrypt Whirlpool - 64-byte incrementing message (00..3F)](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `expected` | `5c3c6f524c8ae1e7a4f76b84977b1560 e78eb568e2fd8d72699ad79186481bd4 2b53ab39a0b741d9c098a4ecb01f3ecc f3844cf1b73a9355ee5d496a2a1fb5b3` |

---

[← All algorithms](../README.md)
