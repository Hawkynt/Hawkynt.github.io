# VMPC

> Variably Modified Permutation Composition stream cipher using RC4-like structure with enhanced mixing function P[P[P[s]]+1]. Designed as improved RC4 alternative with stronger security properties.

## Properties

| Property | Value |
| --- | --- |
| Category | Stream Ciphers |
| Sub-category | Stream Cipher |
| Security status | 🧪 Experimental |
| Complexity | Intermediate |
| Inventor | Bartosz Zoltak |
| Year | 2004 |
| Origin | Not specified |
| Source | [`algorithms/stream/vmpc.js`](../../../algorithms/stream/vmpc.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 1 byte (8 bits) to 256 bytes (2048 bits) |
| Nonce sizes | 1 byte (8 bits) to 768 bytes (6144 bits) |

## Security

**Status:** 🧪 Experimental

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Limited Cryptanalysis | VMPC has received less cryptanalytic attention compared to established stream ciphers | Use only after thorough security review for your specific use case |

## Documentation

- [VMPC Specification](http://www.vmpcfunction.com/vmpc.pdf)
- [eSTREAM Submission](https://www.ecrypt.eu.org/stream/p2ciphers/vmpc/vmpc_p2.pdf)

## References

- [BouncyCastle VMPCEngine.java Implementation](https://github.com/bcgit/bc-java/blob/main/core/src/main/java/org/bouncycastle/crypto/engines/VMPCEngine.java)
- [Author's Own C/Pascal/Assembler Implementations](http://www.vmpcfunction.com/cipher.htm)

## Test vectors

5 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [BouncyCastle Test Vector - First 256 bytes (verified against Java implementation)](https://github.com/bcgit/bc-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/VMPCTest.java)

| Field | Value |
| --- | --- |
| `key` | `9661410ab797d8a9eb767c21172df6c7` |
| `iv` | `4b5c2f003e67f39557a8d26f3da2b155` |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `expected` | `a82479f512e604148db1548cd194702e de20e787fe248a543efe139c071b78ac 7c2af5a8272d0ed09c649ecdfdecec20 454c8a7f675ad8816ba569dab29b7079 d57a2f1279ebd9aefb67a8d6403af44c 2d8c4327d09ad4f35a0c967d7dc31319 c7dab130e7eb69c9b71518011226b4d2 8f4927249f0103721714dca5f7c62040 58e11c87eb014dab75041cc2d096a7f7 719081c3d7292d5a9c6ca4aa59d386ca d51db9efdbe45a8293bd34ee876fc7e9 94653ab726f83b82abdaeba885c7050b 9bf9b74ff64ce0f64094a80fecbf0481 c1e0d2e8cab65dc3b8fdecb7720c860f a143eff4f36fa8f729e791d1a6be657b acac49815467c2ca4a3951c0b8fc66a4` |

**Vector 2** — [BouncyCastle Test Vector - First 32 keystream bytes](https://github.com/bcgit/bc-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/VMPCTest.java)

| Field | Value |
| --- | --- |
| `key` | `9661410ab797d8a9eb767c21172df6c7` |
| `iv` | `4b5c2f003e67f39557a8d26f3da2b155` |
| `input` | `0000000000000000000000000000000000000000000000000000000000000000` |
| `expected` | `a82479f512e604148db1548cd194702ede20e787fe248a543efe139c071b78ac` |

**Vector 3** — [DarkCrypt Vmpc - 128-byte keystream (key=00..3F, IV=00)](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `iv` | `00` |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `expected` | `291626f81795b6895ec89d4fd2dbb119 5ba0a901161bb1ba0b8e3f5ec14187ae 94ab8fe2e9a564b8e9c1345cfede1796 8aba3029130327bdfec2b641134b30c3 10dc2991128094cfeadb960e65c7b9d5 eb1705b5401de5a8fdd966b6d3fd6d3d 212410385fc1b834ac3b3f3268ea7c2a ac731ada2e113afb7800bdc541cbbe92` |

**Vector 4** — [DarkCrypt Vmpc - enc of 00..3F (key=00..3F, IV=00)](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `iv` | `00` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `expected` | `291724fb1390b08e56c19744ded6bf16 4bb1bb12020ea7ad13972545dd5c99b1 b48aadc1cd80429fc1e81e77d2f339b9 ba8b021a2736118ac6fb8c7a2f760efc` |

**Vector 5** — [DarkCrypt Vmpc — non-zero key and IV, 48-byte message (verified against the DarkCrypt implementation)](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0b30557a9fc4e90e33587da2c7ec1136 5b80a5caef14395e83a8cdf2173c6186 abd0f51a3f6489aed3f81d42678cb1d6 fb20456a8fb4d9fe23486d92b7dc0126` |
| `iv` | `073c71a6db10457aafe4194e83b8ed22 578cc1f62b6095caff34699ed3083d72 a7dc11467bb0e51a4f84b9ee23588dc2 f72c6196cb00356a9fd4093e73a8dd12` |
| `input` | `03203d5a7794b1ceeb0825425f7c99b6 d3f00d2a4764819ebbd8f5122f4c6986 a3c0ddfa1734516e8ba8c5e2ff1c3956` |
| `expected` | `c4365bcbc4afff16c2e6ef01dc25a3d0 354d744c52312cba6b4297a736f5197a 3b70e4e504ab039e6d06883f72b47475` |

---

[← All algorithms](../README.md)
