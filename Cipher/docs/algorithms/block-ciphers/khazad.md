# Khazad

> NESSIE-era 64-bit block cipher using involutional substitution-permutation structure. Educational reference implementation.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Paulo S.L.M. Barreto, Vincent Rijmen |
| Year | 2000 |
| Origin | 🇧🇷 Brazil |
| Source | [`algorithms/block/khazad.js`](../../../algorithms/block/khazad.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) |
| Block sizes | 8 bytes (64 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| [Reduced-round cryptanalysis](https://www.cosic.esat.kuleuven.be/nessie/) | Known attacks on reduced rounds highlight limited security margin. | Use only for educational purposes. |

## Documentation

- [NESSIE Submission](https://www.cosic.esat.kuleuven.be/nessie/workshop/submissions/khazad.zip)
- [Khazad Specification](https://www.cosic.esat.kuleuven.be/nessie/reports/phase1/khaWP1-008.pdf)

## References

- [Original Java Reference](https://www.cosic.esat.kuleuven.be/nessie/workshop/submissions/khazad.zip)
- [LibTomCrypt Reference](https://github.com/libtom/libtomcrypt/blob/develop/src/ciphers/khazad.c)

## Test vectors

9 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt KHAZAD vector 1/zero](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000` |
| `input` | `0000000000000000` |
| `expected` | `2325d00f3e76a22d` |

**Vector 2** — [DarkCrypt KHAZAD vector 2/incr](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `0001020304050607` |
| `expected` | `9c4c292a989175fc` |

**Vector 3** — [DarkCrypt KHAZAD vector 3/incr2](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f10` |
| `input` | `1011121314151617` |
| `expected` | `cb57cca64cd59aff` |

**Vector 4** — [LibTomCrypt Test 0](https://github.com/libtom/libtomcrypt/blob/develop/src/ciphers/khazad.c)

| Field | Value |
| --- | --- |
| `key` | `80000000000000000000000000000000` |
| `input` | `0000000000000000` |
| `expected` | `49a4ce32ac190e3f` |

**Vector 5** — [LibTomCrypt Test 1](https://github.com/libtom/libtomcrypt/blob/develop/src/ciphers/khazad.c)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000001` |
| `input` | `0000000000000000` |
| `expected` | `645d773e40abdd53` |

**Vector 6** — [LibTomCrypt Test 2](https://github.com/libtom/libtomcrypt/blob/develop/src/ciphers/khazad.c)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000` |
| `input` | `8000000000000000` |
| `expected` | `9e399864f78eca02` |

**Vector 7** — [LibTomCrypt Test 3](https://github.com/libtom/libtomcrypt/blob/develop/src/ciphers/khazad.c)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000` |
| `input` | `0000000000000001` |
| `expected` | `a9df3d2c64d3ea28` |

**Vector 8** — [NESSIE Khazad-Tweaked verified vectors - repeating 0x08](https://www.cosic.esat.kuleuven.be/nessie/testvectors/bc/khazad/Khazad-Tweaked-128-64.verified.test-vectors)

| Field | Value |
| --- | --- |
| `key` | `08080808080808080808080808080808` |
| `input` | `0808080808080808` |
| `expected` | `a0e07b8baa41e898` |

**Vector 9** — [NESSIE Khazad-Tweaked verified vectors - set 8](https://www.cosic.esat.kuleuven.be/nessie/testvectors/bc/khazad/Khazad-Tweaked-128-64.verified.test-vectors)

| Field | Value |
| --- | --- |
| `key` | `2bd6459f82c5b300952c49104881ff48` |
| `input` | `39b746a9117f5e6c` |
| `expected` | `ea024714ad5c4d84` |

---

[← All algorithms](../README.md)
