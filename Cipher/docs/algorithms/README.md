# Algorithm reference

> One page per algorithm, generated from the implementations themselves.

This reference covers **1101 algorithms** across **17 categories**.
Every page is produced by `tools/generate-algorithm-docs.js` from the metadata an
algorithm declares in its own source file, so the properties, parameters, security
status, references and test vectors shown here always match the code.

## Contents

- [Asymmetric Ciphers](#asymmetric-ciphers) (36)
- [Authenticated Encryption](#authenticated-encryption) (67)
- [Block Ciphers](#block-ciphers) (232)
- [Checksums](#checksums) (74)
- [Cipher Modes](#cipher-modes) (27)
- [Classical Ciphers](#classical-ciphers) (26)
- [Compression Algorithms](#compression-algorithms) (127)
- [Encoding Schemes](#encoding-schemes) (20)
- [Error Correction](#error-correction) (80)
- [Hash Functions](#hash-functions) (120)
- [Key Derivation Functions](#key-derivation-functions) (26)
- [Message Authentication](#message-authentication) (29)
- [Padding Schemes](#padding-schemes) (13)
- [Post-Quantum Cryptography](#post-quantum-cryptography) (1)
- [Random Number Generators](#random-number-generators) (94)
- [Special Algorithms](#special-algorithms) (27)
- [Stream Ciphers](#stream-ciphers) (102)

## Asymmetric Ciphers

_Public-key cryptography algorithms_

| Algorithm | Security | Summary |
| --- | --- | --- |
| [BIKE](asymmetric-ciphers/bike.md) | 🎓 Educational Only | Bit Flipping Key Encapsulation, the QC-MDPC code-based KEM submitted to round 4 of the NIST post-quantum process. The secret is a pair of s… |
| [Classic McEliece](asymmetric-ciphers/classic-mceliece.md) | 🎓 Educational Only | Code-based key encapsulation submitted to round 4 of the NIST post-quantum process, and the oldest public key scheme still unbroken. The pr… |
| [CROSS](asymmetric-ciphers/cross.md) | 🧪 Experimental | Codes and Restricted Objects Signature Scheme: a zero-knowledge identification over the restricted syndrome decoding problem, made non-inte… |
| [Diffie-Hellman](asymmetric-ciphers/diffie-hellman.md) | 🎓 Educational Only | Key agreement over a finite field: each party publishes g^x mod p for its own private exponent x and raises the value it receives to that s… |
| [Dilithium](asymmetric-ciphers/dilithium.md) | 🎓 Educational Only | CRYSTALS-Dilithium, the module-lattice signature scheme standardised as ML-DSA in NIST FIPS 204. Signs over Z_q[X]/(X^256+1) with q = 83804… |
| [DSA](asymmetric-ciphers/dsa.md) | 🎓 Educational Only | Digital Signature Algorithm of FIPS 186-4: r = (g^k mod p) mod q and s = k^-1 (z + x*r) mod q over a prime-order subgroup, with the nonce d… |
| [ECDSA](asymmetric-ciphers/ecdsa.md) | 🎓 Educational Only | Elliptic Curve Digital Signature Algorithm over secp256k1, P-256, P-384 and P-521, signing a SHA-1 or SHA-2 digest with the deterministic n… |
| [Ed25519](asymmetric-ciphers/ed25519.md) | 🛡️ Secure | EdDSA signature scheme using Curve25519 in twisted Edwards form. Provides 128-bit security with fast constant-time signing and verification… |
| [ElGamal](asymmetric-ciphers/elgamal.md) | 🎓 Educational Only | ElGamal public key cryptosystem based on the discrete logarithm problem in finite fields. Provides semantic security through randomized enc… |
| [ESIGN](asymmetric-ciphers/esign.md) | 🎓 Educational Only | Okamoto's signature scheme over a modulus n = p²q, in the derandomised ESIGN-D form of the NESSIE submission. A signature is a value whose… |
| [FAEST](asymmetric-ciphers/faest.md) | 🧪 Experimental | FAEST, the VOLE-in-the-head signature of the NIST additional-signatures process: a zero-knowledge proof of knowledge of an AES key k with A… |
| [FALCON](asymmetric-ciphers/falcon.md) | 🎓 Educational Only | Lattice signature scheme over NTRU, a NIST post-quantum round 3 finalist and now a draft standard as FN-DSA. A signature is a short vector… |
| [FrodoKEM](asymmetric-ciphers/frodokem.md) | 🎓 Educational Only | Learning With Errors Key Encapsulation Mechanism. Conservative lattice-based post-quantum cryptography using unstructured lattices and stan… |
| [HAWK](asymmetric-ciphers/hawk.md) | ❌ Broken | Lattice-based hash-and-sign signature over rank-2 module lattices, the round-two submission to the NIST additional signatures process. The… |
| [HQC](asymmetric-ciphers/hqc.md) | 🎓 Educational Only | Hamming Quasi-Cyclic, the code-based key encapsulation mechanism NIST selected in March 2025 as its backup to ML-KEM. The public key is a r… |
| [LUC](asymmetric-ciphers/luc.md) | 🎓 Educational Only | LUC public key cryptosystem based on Lucas sequences over finite fields. Encryption is the Lucas function c = V_e(m, 1) mod n and recovery… |
| [LWE-Signature](asymmetric-ciphers/lwe-signature.md) | 🎓 Educational Only | Lyubashevsky's Fiat-Shamir-with-aborts signature over unstructured LWE. The public key is T = A·S for a plain matrix A over Z_q and a terna… |
| [MAYO-1](asymmetric-ciphers/mayo-1.md) | 🧪 Experimental | MAYO at NIST level 1: an Oil-and-Vinegar signature over GF(16) whose oil space has dimension 8, smaller than the 80 equations, which is wha… |
| [MAYO-2](asymmetric-ciphers/mayo-2.md) | 🧪 Experimental | MAYO at NIST level 1: an Oil-and-Vinegar signature over GF(16) whose oil space has dimension 13, smaller than the 64 equations, which is wh… |
| [MAYO-3](asymmetric-ciphers/mayo-3.md) | 🧪 Experimental | MAYO at NIST level 3: an Oil-and-Vinegar signature over GF(16) whose oil space has dimension 10, smaller than the 108 equations, which is w… |
| [MAYO-5](asymmetric-ciphers/mayo-5.md) | 🧪 Experimental | MAYO at NIST level 5: an Oil-and-Vinegar signature over GF(16) whose oil space has dimension 12, smaller than the 142 equations, which is w… |
| [ML-DSA](asymmetric-ciphers/ml-dsa.md) | 🎓 Educational Only | NIST FIPS 204 Module-Lattice-Based Digital Signature Algorithm, the standardised form of CRYSTALS-Dilithium. Shares its lattice core with t… |
| [NTRU](asymmetric-ciphers/ntru.md) | 🎓 Educational Only | NTRU, the truncated polynomial ring lattice scheme, in the key encapsulation form submitted to round 3 of the NIST post-quantum process. Wo… |
| [PERK](asymmetric-ciphers/perk.md) | 🧪 Experimental | Digital signature scheme submitted to the NIST additional signatures project, proving knowledge of a permutation that solves an instance of… |
| [Rabin](asymmetric-ciphers/rabin.md) | 🎓 Educational Only | Rabin public key cryptosystem based on quadratic residues modulo composite numbers. Security equivalent to integer factorization. Each ciph… |
| [Rabin-Williams](asymmetric-ciphers/rabin-williams.md) | 🎓 Educational Only | Rabin-Williams signature scheme with message recovery, following IEEE P1363 and Bernstein's treatment of the e and f tweaks. Signing extrac… |
| [Rainbow-I](asymmetric-ciphers/rainbow-i.md) | ❌ Broken | Rainbow Ia, the round-three parameter set over GF(16) with 36 vinegar variables and layers of 32 and 32 oil variables. A two-layer unbalanc… |
| [Rainbow-III](asymmetric-ciphers/rainbow-iii.md) | ❌ Broken | Rainbow IIIc, the round-three parameter set over GF(256) with 68 vinegar variables and layers of 32 and 48 oil variables. A two-layer unbal… |
| [Rainbow-V](asymmetric-ciphers/rainbow-v.md) | ❌ Broken | Rainbow Vc, the round-three parameter set over GF(256) with 96 vinegar variables and layers of 36 and 64 oil variables. A two-layer unbalan… |
| [RSA](asymmetric-ciphers/rsa.md) | 🎓 Educational Only | RSA public key cryptosystem based on integer factorization hardness. First practical asymmetric encryption enabling secure communication wi… |
| [Schnorr (BIP-340)](asymmetric-ciphers/schnorr-bip-340.md) | 🛡️ Secure | Schnorr signatures for secp256k1 curve as specified in BIP-340. Used in Bitcoin Taproot (BIP-341) for efficient, provably secure digital si… |
| [SIKE](asymmetric-ciphers/sike.md) | ❌ Broken | Supersingular Isogeny Key Encapsulation, the NIST post-quantum round 3 KEM built on isogenies between supersingular elliptic curves over GF… |
| [SLH-DSA](asymmetric-ciphers/slh-dsa.md) | 🛡️ Secure | NIST FIPS 205 stateless hash-based signature scheme, the standardised form of SPHINCS+. Signs with a hypertree of WOTS+ one-time keys over… |
| [SPHINCS+](asymmetric-ciphers/sphincs-plus.md) | ⚠️ Deprecated | Stateless hash-based signature scheme, the round-3 NIST post-quantum submission that was standardised as FIPS 205 SLH-DSA. Signs with a hyp… |
| [SQIsign](asymmetric-ciphers/sqisign.md) | 🧪 Experimental | Short Quaternion and Isogeny Signature, the NIST additional-signatures round 2 candidate with the smallest combined public key and signatur… |
| [X25519](asymmetric-ciphers/x25519.md) | 🛡️ Secure | Curve25519 Diffie-Hellman key exchange using Montgomery curve arithmetic for ECDH. Provides 128-bit security with high performance and side… |

## Authenticated Encryption

_Authenticated encryption with associated data_

| Algorithm | Security | Summary |
| --- | --- | --- |
| [ACE](authenticated-encryption/ace.md) | 🧪 Experimental | Lightweight authenticated encryption using sLiSCP-light-320 permutation in duplex sponge construction. NIST LWC Round 2 candidate with 128-… |
| [AES-CCM](authenticated-encryption/aes-ccm.md) | 🎓 Educational Only | AES Counter with CBC-MAC authenticated encryption. NIST-standardized AEAD mode combining AES with CBC-MAC for authentication and counter mo… |
| [Ascon-128 AEAD](authenticated-encryption/ascon-128-aead.md) | 🛡️ Secure | NIST's lightweight cryptography standard for authenticated encryption. Uses 128-bit keys with 8-byte rate for balanced security and perform… |
| [Ascon-128a AEAD](authenticated-encryption/ascon-128a-aead.md) | 🛡️ Secure | Faster variant of Ascon-128 with 16-byte rate. Provides same security level as Ascon-128 with improved throughput for larger messages. |
| [Ascon-80pq AEAD](authenticated-encryption/ascon-80pq-aead.md) | 🛡️ Secure | Ascon variant with 160-bit key providing extra security margin against quantum attacks. Maintains same performance as Ascon-128. |
| [ChaCha20-Poly1305](authenticated-encryption/chacha20-poly1305.md) | — | Modern AEAD construction combining ChaCha20 stream cipher with Poly1305 authenticator. Provides confidentiality and authenticity with 256-b… |
| [COMET-128-CHAM](authenticated-encryption/comet-128-cham.md) | 🧪 Experimental | NIST Lightweight Cryptography candidate providing authenticated encryption with 128-bit security. Uses CHAM-128/128 block cipher in CTR-lik… |
| [COMET-64-CHAM](authenticated-encryption/comet-64-cham.md) | 🧪 Experimental | NIST Lightweight Cryptography candidate providing authenticated encryption with 64-bit blocks. Uses CHAM-64/128 block cipher in CTR-like mo… |
| [COMET-64-SPECK](authenticated-encryption/comet-64-speck.md) | 🧪 Experimental | NIST Lightweight Cryptography candidate providing authenticated encryption with 64-bit blocks. Uses SPECK-64/128 ARX cipher in CTR-like mod… |
| [Deoxys-II-128](authenticated-encryption/deoxys-ii-128.md) | — | CAESAR in-depth security portfolio winner with nonce-misuse resistance. Uses 128-bit keys with Deoxys-BC-256 tweakable block cipher based o… |
| [Deoxys-II-256](authenticated-encryption/deoxys-ii-256.md) | — | CAESAR in-depth security portfolio winner with nonce-misuse resistance. Uses 256-bit keys with Deoxys-BC-384 tweakable block cipher based o… |
| [DryGASCON128k16](authenticated-encryption/drygascon128k16.md) | 🧪 Experimental | NIST Lightweight Cryptography finalist using DrySPONGE construction with GASCON permutation. Provides authenticated encryption with 16-byte… |
| [Elephant-Delirium](authenticated-encryption/elephant-delirium.md) | — | Elephant AEAD variant using Keccak-p[200] permutation with 18 rounds and 128-bit tag. NIST Lightweight Cryptography finalist with highest s… |
| [Elephant-Dumbo](authenticated-encryption/elephant-dumbo.md) | — | Elephant AEAD variant using Spongent-π[160] permutation with 80 rounds. NIST Lightweight Cryptography finalist designed for constrained env… |
| [Elephant-Jumbo](authenticated-encryption/elephant-jumbo.md) | — | Elephant AEAD variant using Spongent-π[176] permutation with 90 rounds. NIST Lightweight Cryptography finalist offering higher security mar… |
| [ESTATE-TWEGIFT-128](authenticated-encryption/estate-twegift-128.md) | 🧪 Experimental | Nonce-misuse resistant authenticated encryption based on tweakable GIFT-128. Uses FCBC authentication and OFB encryption to provide securit… |
| [GASCON-128 AEAD](authenticated-encryption/gascon-128-aead.md) | 🧪 Experimental | Bit-interleaved variant of Ascon optimized for 32-bit platforms. Provides authenticated encryption with 128-bit security level using sponge… |
| [GIFT-COFB](authenticated-encryption/gift-cofb.md) | 🛡️ Secure | NIST Lightweight Cryptography finalist combining GIFT-128 block cipher with COFB authenticated encryption mode. Provides efficient authenti… |
| [Gimli-24](authenticated-encryption/gimli-24.md) | 🧪 Experimental | Lightweight authenticated encryption with 384-bit permutation and 24 rounds. NIST LWC competition candidate with compact design optimized f… |
| [Grain-128-AEAD](authenticated-encryption/grain-128-aead.md) | 🛡️ Secure | NIST Lightweight Cryptography finalist combining 128-bit LFSR and NFSR with integrated authentication. Designed for resource-constrained en… |
| [HYENA](authenticated-encryption/hyena.md) | 🧪 Experimental | NIST Lightweight Cryptography candidate combining GIFT-128 nibble-based cipher with efficient AEAD construction. Uses sponge-like mode with… |
| [ISAP-A-128A](authenticated-encryption/isap-a-128a.md) | 🛡️ Secure | Side-channel resistant AEAD using Ascon permutation with 12/6/1 round configuration. Designed to protect against power analysis and timing… |
| [Ketje Jr](authenticated-encryption/ketje-jr.md) | — | Lightweight authenticated encryption for extremely constrained devices. Uses 200-bit Keccak-p permutation with 96-bit key and 16-byte rate. |
| [Ketje Sr](authenticated-encryption/ketje-sr.md) | — | Lightweight authenticated encryption with enhanced security margin. Uses 400-bit Keccak-p permutation with 128-bit key and 32-byte rate. |
| [KNOT-AEAD-128-256](authenticated-encryption/knot-aead-128-256.md) | 🧪 Experimental | NIST Lightweight Cryptography finalist using 256-bit sponge construction with bit-sliced KNOT permutation. Features hardware-efficient S-bo… |
| [KNOT-AEAD-128-384](authenticated-encryption/knot-aead-128-384.md) | 🧪 Experimental | NIST Lightweight Cryptography finalist using 384-bit sponge construction with bit-sliced KNOT permutation. Offers higher throughput than KN… |
| [Lake Keyak](authenticated-encryption/lake-keyak.md) | 🧪 Experimental | CAESAR competition finalist using Keccak-p[1600,12] in the Motorist mode with a single Piston. Primary recommended variant of the Keyak fam… |
| [LOCUS-AEAD](authenticated-encryption/locus-aead.md) | 🧪 Experimental | Lightweight authenticated encryption with 128-bit keys, 128-bit nonces, and 64-bit tags. Uses GIFT-64 tweakable block cipher with COFB-styl… |
| [LOTUS-AEAD](authenticated-encryption/lotus-aead.md) | 🧪 Experimental | Lightweight OCB-like authenticated encryption using TweGIFT-64 block cipher. NIST Lightweight Cryptography Competition candidate with 128-b… |
| [ORANGE-Zest](authenticated-encryption/orange-zest.md) | 🧪 Experimental | NIST Lightweight Cryptography candidate using PHOTON-256 permutation with efficient keystream generation and GF(128) operations for authent… |
| [Oribatida-192-96](authenticated-encryption/oribatida-192-96.md) | 🧪 Experimental | Lightweight AEAD cipher based on SimP-192 permutation (reduced-round Simon-96-96). Features 128-bit keys, 64-bit nonces, and 96-bit tags wi… |
| [Oribatida-256-64](authenticated-encryption/oribatida-256-64.md) | 🧪 Experimental | Lightweight AEAD cipher based on SimP-256 permutation (reduced-round Simon-128-128). Features 128-bit keys, 128-bit nonces, and 128-bit tag… |
| [PAEF-ForkSkinny-128-192](authenticated-encryption/paef-forkskinny-128-192.md) | 🧪 Experimental | Parallel authenticated encryption with forking based on ForkSkinny-128-256 tweakable block cipher. NIST Lightweight Cryptography Competitio… |
| [PAEF-ForkSkinny-128-256](authenticated-encryption/paef-forkskinny-128-256.md) | 🧪 Experimental | Parallel authenticated encryption with 128-bit blocks using ForkSkinny-128-256 tweakable block cipher. NIST Lightweight Cryptography finali… |
| [PhotonBeetle-AEAD[128]](authenticated-encryption/photonbeetle-aead-128.md) | 🛡️ Secure | NIST Lightweight Cryptography finalist with 128-bit rate. Balanced performance using PHOTON-256 permutation with efficient absorption for l… |
| [PhotonBeetle-AEAD[32]](authenticated-encryption/photonbeetle-aead-32.md) | 🛡️ Secure | NIST Lightweight Cryptography finalist with 32-bit rate. Optimized for constrained environments with smaller state updates for enhanced sec… |
| [Pyjamask-96 AEAD](authenticated-encryption/pyjamask-96-aead.md) | 🧪 Experimental | NIST lightweight cryptography candidate using 96-bit block cipher with OCB mode. Features efficient masking against side-channel attacks. |
| [Romulus-N1](authenticated-encryption/romulus-n1.md) | 🛡️ Secure | NIST Lightweight Cryptography finalist using SKINNY-128-384 tweakable block cipher. Primary recommendation of Romulus family with 128-bit n… |
| [Romulus-N2](authenticated-encryption/romulus-n2.md) | 🛡️ Secure | Romulus variant with 96-bit nonce using SKINNY-128-384. Balanced security and performance with shorter nonce. |
| [Romulus-N3](authenticated-encryption/romulus-n3.md) | 🛡️ Secure | Romulus variant with 96-bit nonce using SKINNY-128-256. Lightweight version with reduced tweakey size. |
| [SATURNIN-CTR-Cascade](authenticated-encryption/saturnin-ctr-cascade.md) | 🧪 Experimental | Advanced AEAD cipher based on 256-bit block cipher with CTR-Cascade construction. NIST Lightweight Cryptography Round 2 candidate optimized… |
| [SATURNIN-Short](authenticated-encryption/saturnin-short.md) | 🧪 Experimental | Optimized AEAD cipher for short messages (≤15 bytes plaintext, no associated data). Single-block operation with 256-bit key and nonce, prod… |
| [Schwaemm128-128](authenticated-encryption/schwaemm128-128.md) | 🧪 Experimental | NIST Lightweight Cryptography finalist using SPARKLE-256 permutation. Compact variant with 128-bit security level for both confidentiality… |
| [Schwaemm192-192](authenticated-encryption/schwaemm192-192.md) | 🧪 Experimental | NIST Lightweight Cryptography finalist using SPARKLE-384 permutation. Balanced variant with 192-bit security level for both key and tag. |
| [Schwaemm256-128](authenticated-encryption/schwaemm256-128.md) | 🧪 Experimental | NIST Lightweight Cryptography finalist using SPARKLE-384 permutation. Primary recommended variant with 256-bit nonce and 128-bit security. |
| [Schwaemm256-256](authenticated-encryption/schwaemm256-256.md) | 🧪 Experimental | NIST Lightweight Cryptography finalist using SPARKLE-512 permutation. Maximum security variant with 256-bit security level for key, nonce,… |
| [SKINNY-AEAD-M1](authenticated-encryption/skinny-aead-m1.md) | 🧪 Experimental | Primary SKINNY-AEAD variant using SKINNY-128-384 with 128-bit key, 128-bit nonce, and 128-bit tag. NIST LWC Round 2 candidate. |
| [SKINNY-AEAD-M2](authenticated-encryption/skinny-aead-m2.md) | 🧪 Experimental | SKINNY-AEAD variant using SKINNY-128-384 with 128-bit key, 96-bit nonce, and 128-bit tag. Optimized for shorter nonces. |
| [SKINNY-AEAD-M3](authenticated-encryption/skinny-aead-m3.md) | 🧪 Experimental | SKINNY-AEAD PAEF mode using SKINNY-128-384 with 128-bit key, 128-bit nonce, and 64-bit tag. Shorter authentication tag. |
| [SKINNY-AEAD-M4](authenticated-encryption/skinny-aead-m4.md) | 🧪 Experimental | SKINNY-AEAD variant using SKINNY-128-384 with 128-bit key, 96-bit nonce, and 64-bit tag. Compact nonce and tag. |
| [SKINNY-AEAD-M5](authenticated-encryption/skinny-aead-m5.md) | 🧪 Experimental | SKINNY-AEAD variant using SKINNY-128-256 with 128-bit key, 96-bit nonce, and 128-bit tag. Faster than 384-bit variants. |
| [SKINNY-AEAD-M6](authenticated-encryption/skinny-aead-m6.md) | 🧪 Experimental | SKINNY-AEAD variant using SKINNY-128-256 with 128-bit key, 96-bit nonce, and 64-bit tag. Most compact configuration. |
| [SPIX](authenticated-encryption/spix.md) | 🧪 Experimental | Lightweight AEAD cipher using MonkeyDuplex construction with sLiSCP-light-256 permutation. Features 128-bit key/nonce/tag with 8-byte rate… |
| [SpoC-128](authenticated-encryption/spoc-128.md) | 🧪 Experimental | Lightweight AEAD using sLiSCP-light-256 permutation with 128-bit tag. Sponge-based construction optimized for resource-constrained devices. |
| [SpoC-64](authenticated-encryption/spoc-64.md) | 🧪 Experimental | Lightweight AEAD using sLiSCP-light-192 permutation with 64-bit tag. Primary SpoC variant optimized for minimal hardware implementation. |
| [Spook-128-384-mu](authenticated-encryption/spook-128-384-mu.md) | 🧪 Experimental | NIST Lightweight Cryptography candidate providing authenticated encryption with side-channel protection. Uses Shadow-384 permutation with C… |
| [Spook-128-384-su](authenticated-encryption/spook-128-384-su.md) | 🧪 Experimental | NIST Lightweight Cryptography candidate providing authenticated encryption with side-channel protection. Uses Shadow-384 permutation with C… |
| [Spook-128-512-mu](authenticated-encryption/spook-128-512-mu.md) | 🧪 Experimental | NIST Lightweight Cryptography candidate providing authenticated encryption with side-channel protection. Uses Shadow-512 permutation with C… |
| [Spook-128-512-su](authenticated-encryption/spook-128-512-su.md) | 🧪 Experimental | NIST Lightweight Cryptography candidate providing authenticated encryption with side-channel protection. Uses Shadow-512 permutation with C… |
| [Subterranean AEAD](authenticated-encryption/subterranean-aead.md) | 🧪 Experimental | Minimalist duplex sponge AEAD construction with 257-bit permutation. NIST LWC Round 2 candidate designed for hardware efficiency. |
| [SUNDAE-GIFT-128](authenticated-encryption/sundae-gift-128.md) | 🧪 Experimental | Deterministic authenticated encryption using GIFT-128 block cipher with SUNDAE mode. Supports 128-bit nonce for authenticated encryption wi… |
| [Tiaoxin-346](authenticated-encryption/tiaoxin-346.md) | 🧪 Experimental | High-performance authenticated encryption from CAESAR competition third round using AES round functions. Designed for exceptional software… |
| [TinyJAMBU-128 AEAD](authenticated-encryption/tinyjambu-128-aead.md) | 🧪 Experimental | Lightweight authenticated encryption finalist in NIST LWC. Features 128-bit keyed permutation with 4-word state, 96-bit nonce, and 64-bit a… |
| [TinyJAMBU-192 AEAD](authenticated-encryption/tinyjambu-192-aead.md) | 🧪 Experimental | Lightweight authenticated encryption finalist in NIST LWC. Features 192-bit keyed permutation with 4-word state, 96-bit nonce, and 64-bit a… |
| [TinyJAMBU-256 AEAD](authenticated-encryption/tinyjambu-256-aead.md) | 🧪 Experimental | Lightweight authenticated encryption finalist in NIST LWC. Features 256-bit keyed permutation with 4-word state, 96-bit nonce, and 64-bit a… |
| [WAGE](authenticated-encryption/wage.md) | 🧪 Experimental | WAGE authenticated encryption algorithm with 259-bit permutation, NIST LWC Round 2 finalist. Features WG permutation and parallel S-box ope… |
| [Xoodyak AEAD](authenticated-encryption/xoodyak-aead.md) | 🛡️ Secure | NIST Lightweight Cryptography finalist using the Xoodoo permutation with Cyclist mode construction. Provides authenticated encryption with… |

## Block Ciphers

_Block-based symmetric encryption_

| Algorithm | Security | Summary |
| --- | --- | --- |
| [3DES (Triple DES)](block-ciphers/3des-triple-des.md) | ❌ Broken | Triple Data Encryption Standard applies DES encryption three times in EDE mode. Supports both EDE2 (112-bit effective security) and EDE3 (1… |
| [3NewDE (DarkCrypt)](block-ciphers/3newde-darkcrypt.md) | 🎓 Educational Only | DarkCrypt Total Commander plugin cipher: 16 rounds of the standard DES Feistel round function (real DES S-boxes/E/P) without the DES initia… |
| [Anubis](block-ciphers/anubis.md) | 🎓 Educational Only | 128-bit block cipher designed by Vincent Rijmen and Paulo Barreto for the NESSIE project. Features variable key length from 128-320 bits in… |
| [Anubis-256 (DarkCrypt)](block-ciphers/anubis-256-darkcrypt.md) | 🎓 Educational Only | Original (pre-tweak) Anubis block cipher, 256-bit key (N=8, R=16 rounds). Involutional SPN with byte substitution and MDS diffusion, using… |
| [Anubis-320 (DarkCrypt)](block-ciphers/anubis-320-darkcrypt.md) | 🎓 Educational Only | Original (pre-tweak) Anubis block cipher, 320-bit key (N=10, R=18 rounds). Involutional SPN with byte substitution and MDS diffusion, using… |
| [ARIA](block-ciphers/aria.md) | — | Korean national encryption standard (KS X 1213:2004) with 128-bit block size. Supports 128/192/256-bit keys using Substitution-Permutation… |
| [BaseKing](block-ciphers/baseking.md) | 🧪 Experimental | 192-bit block cipher with 192-bit key size using 11 rounds plus final transformation. |
| [BassOMatic](block-ciphers/bassomatic.md) | ❌ Broken | Phil Zimmermann's original cipher from PGP 1.0 with 256-byte blocks and variable key sizes. Cryptographically broken by Eli Biham in 1991 d… |
| [BBC (DarkCrypt)](block-ciphers/bbc-darkcrypt.md) | 🎓 Educational Only | BBC keystream/permutation cipher from the DarkCrypt Total Commander plugin. Exposed through the block interface with a 256 KiB block, but i… |
| [BJ-256 (DarkCrypt)](block-ciphers/bj-256-darkcrypt.md) | 🎓 Educational Only | Homegrown ARX block cipher from the DarkCrypt Total Commander plugin with no public specification: an 8x32-bit-word (256-bit) block cipher… |
| [Blowfish](block-ciphers/blowfish.md) | 🎓 Educational Only | Bruce Schneier's Blowfish cipher with 64-bit blocks and variable key lengths from 32 to 448 bits. Uses key-dependent S-boxes and 16-round F… |
| [Breakme (DarkCrypt)](block-ciphers/breakme-darkcrypt.md) | 🎓 Educational Only | Non-standard 20-round unbalanced Feistel cipher from the DarkCrypt Total Commander plugin. 64-bit block, 256-bit key. F applies a nested 25… |
| [C2 (DarkCrypt)](block-ciphers/c2-darkcrypt.md) | 🎓 Educational Only | Cryptomeria/C2 cipher (4C Entity) as implemented in the DarkCrypt Total Commander plugin: 10-round Feistel network, 56-bit key (of a 64-bit… |
| [Camellia](block-ciphers/camellia.md) | 🛡️ Secure | Camellia block cipher by NTT/Mitsubishi with 128-bit blocks and 18/24 rounds. Features symmetric Feistel network with FL/FLINV functions fo… |
| [Cartman-2X (DarkCrypt)](block-ciphers/cartman-2x-darkcrypt.md) | 🎓 Educational Only | Block cipher from the DarkCrypt Total Commander plugin. 1024-bit key, 128-bit block. The key seeds 64 key-dependent derangement S-boxes (ge… |
| [Cascade(Serpent,AES-256)](block-ciphers/cascade-serpent-aes-256.md) | — | Sequential chaining of Serpent and Rijndael (AES) block ciphers. Encrypts with Serpent first, then Rijndael (AES). Provides increased secur… |
| [Cascade(Serpent,CAST-128)](block-ciphers/cascade-serpent-cast-128.md) | — | Sequential chaining of Serpent and CAST-128 block ciphers. Encrypts with Serpent first, then CAST-128. Provides increased security margin t… |
| [Cascade(Serpent,Twofish)](block-ciphers/cascade-serpent-twofish.md) | — | Sequential chaining of Serpent and Twofish block ciphers. Encrypts with Serpent first, then Twofish. Provides increased security margin thr… |
| [CAST-128](block-ciphers/cast-128.md) | 🎓 Educational Only | Feistel network block cipher with variable key size and three different F-function types. Uses 16 rounds with four 8x32-bit S-boxes. Standa… |
| [CAST-256](block-ciphers/cast-256.md) | 🎓 Educational Only | AES competition finalist by Adams and Tavares with 128-bit blocks and variable key lengths. Uses CAST-128 S-boxes with extended key schedul… |
| [CAST-256 (DarkCrypt)](block-ciphers/cast-256-darkcrypt.md) | 🎓 Educational Only | RFC 2612 CAST-256 (CAST6) as implemented in the DarkCrypt Total Commander plugin: identical round function, key schedule and S-boxes, but 1… |
| [CHAM](block-ciphers/cham.md) | 🎓 Educational Only | Korean lightweight block cipher designed for resource-constrained devices. CHAM-128/128 uses 128-bit blocks with 128-bit keys and 112 round… |
| [Chaos-512/512 (DarkCrypt)](block-ciphers/chaos-512-512-darkcrypt.md) | 🎓 Educational Only | Homegrown 512-bit-block ARX cipher from the DarkCrypt Total Commander plugin with no public specification: a 49-round 16-word shift-registe… |
| [CIPHERUNICORN-A](block-ciphers/cipherunicorn-a.md) | 🎓 Educational Only | Educational implementation of CIPHERUNICORN-A from NEC, a 16-round Feistel network with complex parallel round functions, recommended by CR… |
| [CIPHERUNICORN-A (DarkCrypt)](block-ciphers/cipherunicorn-a-darkcrypt.md) | 🎓 Educational Only | CIPHERUNICORN-A block cipher (NEC Corporation, 2000, CRYPTREC-evaluated), 256-bit key variant, as implemented in the DarkCrypt Total Comman… |
| [CIPHERUNICORN-E (DarkCrypt)](block-ciphers/cipherunicorn-e-darkcrypt.md) | 🎓 Educational Only | NEC's CIPHERUNICORN-E block cipher as implemented in the DarkCrypt Total Commander plugin: 16-round modified Feistel network, 64-bit block,… |
| [CLEFIA](block-ciphers/clefia.md) | — | Sony's CLEFIA block cipher (RFC 6114) with 128-bit blocks and variable key lengths. Generalized Feistel Network design optimized for lightw… |
| [COBRA-128-576 (DarkCrypt)](block-ciphers/cobra-128-576-darkcrypt.md) | 🎓 Educational Only | DarkCrypt Total Commander plugin block cipher: 36 rounds over a 128-bit block (four 32-bit words), round-robin between three Blowfish-style… |
| [Cobra-64-256 (DarkCrypt)](block-ciphers/cobra-64-256-darkcrypt.md) | 🎓 Educational Only | Blowfish-derived block cipher from the DarkCrypt Total Commander plugin: 16-round Feistel network over a 64-bit block with an extra 1-bit r… |
| [Crypton](block-ciphers/crypton.md) | 🎓 Educational Only | Korean AES candidate with 128-bit blocks and 128/192/256-bit keys. |
| [Crypton v1.0 (DarkCrypt)](block-ciphers/crypton-v1-0-darkcrypt.md) | 🎓 Educational Only | CRYPTON v1.0 as implemented by the DarkCrypt Total Commander plugin's table-optimized "-OPT" build. Uses its own precomputed mix/substituti… |
| [CS-Cipher (DarkCrypt)](block-ciphers/cs-cipher-darkcrypt.md) | 🎓 Educational Only | CS-Cipher as implemented in the DarkCrypt Total Commander plugin: 64-bit block, 128-bit key, 12 elementary rounds. Matches the published St… |
| [Curupira-1 (DarkCrypt)](block-ciphers/curupira-1-darkcrypt.md) | 🎓 Educational Only | Curupira-1 block cipher (Barreto and Simplicio, SBRC 2007) as implemented in the DarkCrypt Total Commander plugin: involutional round funct… |
| [Curupira-2 (DarkCrypt)](block-ciphers/curupira-2-darkcrypt.md) | 🎓 Educational Only | Curupira-2 block cipher (Simplicio, Barreto, Carvalho, Margi, Naslund, 2007) as implemented in the DarkCrypt Total Commander plugin: shares… |
| [DAGINDA (DarkCrypt)](block-ciphers/daginda-darkcrypt.md) | 🎓 Educational Only | SHACAL-2-derived block cipher from the DarkCrypt Total Commander plugin: the SHA-256 compression round (Sigma0/Sigma1, Ch, Maj, all 64 stan… |
| [DEAL](block-ciphers/deal.md) | ❌ Broken | Data Encryption Algorithm with Larger blocks - Feistel cipher using DES as F-function. AES candidate by Outerbridge (1998) based on Knudsen… |
| [DEAL-256 (DarkCrypt)](block-ciphers/deal-256-darkcrypt.md) | 🎓 Educational Only | DEAL block cipher (Knudsen/Outerbridge AES candidate) using DES as its round function: 8 rounds, four 64-bit round-key-schedule DES encrypt… |
| [DES](block-ciphers/des.md) | ❌ Broken | Data Encryption Standard, the first widely adopted symmetric encryption algorithm. 64-bit blocks with 56-bit keys. Broken by brute force at… |
| [DES-X](block-ciphers/des-x.md) | ❌ Broken | DES with key whitening by Ron Rivest (1984). Uses 64-bit pre/post-whitening keys with standard DES to increase resistance to brute-force at… |
| [DES-X (DarkCrypt)](block-ciphers/des-x-darkcrypt.md) | 🎓 Educational Only | DES-X construction from the DarkCrypt Total Commander plugin: a 128-bit key splits into a DES key (parity-fixed before scheduling) and a ra… |
| [DFC](block-ciphers/dfc.md) | 🎓 Educational Only | Data Encryption Standard Forte Cipher - AES candidate by CNRS, France. Features 128-bit blocks, variable key sizes (128/192/256-bit), and 8… |
| [DFC-128/256 (DarkCrypt)](block-ciphers/dfc-128-256-darkcrypt.md) | 🎓 Educational Only | Decorrelated Fast Cipher (DFCv1): 8-round Feistel network with a round function based on 64-bit modular multiply-add mod 2^64+13 followed b… |
| [Diamond2](block-ciphers/diamond2.md) | 🎓 Educational Only | Royalty-free block cipher by Michael Paul Johnson with variable key length and substitution-permutation network structure. Uses 128-bit blo… |
| [Diamond2-2048 (DarkCrypt)](block-ciphers/diamond2-2048-darkcrypt.md) | 🎓 Educational Only | Diamond2 substitution-permutation cipher from the DarkCrypt Total Commander plugin. 128-bit block, 2048-bit key, 12 rounds. In this DarkCry… |
| [DoubleKing](block-ciphers/doubleking.md) | 🧪 Experimental | 384-bit block cipher with 384-bit key using 32-bit words. BaseKing variant designed by Tim van Dijk for ARM architecture efficiency. Uses 1… |
| [E2-256 (DarkCrypt)](block-ciphers/e2-256-darkcrypt.md) | 🎓 Educational Only | Standard NTT E2 block cipher (256-bit key variant), a 12-round Feistel cipher with initial/final modular-multiplication transforms and an s… |
| [EksLOKI-89 (DarkCrypt)](block-ciphers/eksloki-89-darkcrypt.md) | 🎓 Educational Only | Expanded LOKI89 variant from the DarkCrypt Total Commander plugin. Uses a 256-bit key expanded via an RC4-like key schedule into a 256-byte… |
| [EnRUPT](block-ciphers/enrupt.md) | ❌ Broken | Cryptographic primitive based on XXTEA using unbalanced Feistel network. Submitted to SHA-3 competition but broken by multiple practical at… |
| [Enrupt-512-512 (DarkCrypt)](block-ciphers/enrupt-512-512-darkcrypt.md) | 🎓 Educational Only | EnRUPT-family ARX block cipher from the DarkCrypt Total Commander plugin. 512-bit block and 512-bit key, both as 16 little-endian 32-bit wo… |
| [Fcrypt-EDE (DarkCrypt)](block-ciphers/fcrypt-ede-darkcrypt.md) | 🎓 Educational Only | 3-key Encrypt-Decrypt-Encrypt composition of "Fcrypt", a DES-inspired 64-bit block cipher from the DarkCrypt Total Commander plugin. The 19… |
| [FEAL-8](block-ciphers/feal-8.md) | ❌ Broken | Fast Data Encipherment Algorithm by NTT. Educational implementation of a cryptographically broken Feistel cipher with 8 rounds, 64-bit bloc… |
| [FEAL-NX](block-ciphers/feal-nx.md) | ❌ Broken | Fast Data Encipherment Algorithm NX variant by NTT with 128-bit keys. Educational implementation of a cryptographically broken Feistel ciph… |
| [FF1](block-ciphers/ff1.md) | — | Format-Preserving Encryption from NIST SP 800-38G. |
| [FF3](block-ciphers/ff3.md) | ❌ Broken | Format-Preserving Encryption from NIST SP 800-38G (March 2016). DEPRECATED due to security vulnerabilities discovered after publication. Ed… |
| [FNAm2-512 (DarkCrypt)](block-ciphers/fnam2-512-darkcrypt.md) | 🎓 Educational Only | FNAm2-512 block cipher from the DarkCrypt Total Commander plugin. A 128-bit-block / 512-bit-key ARX-with-multiply construction: 64 sequenti… |
| [ForkSkinny-128-256](block-ciphers/forkskinny-128-256.md) | 🧪 Experimental | ForkSkinny is a tweakable block cipher with forking construction, producing two outputs from one input. Designed for authenticated encrypti… |
| [ForkSkinny-128-384](block-ciphers/forkskinny-128-384.md) | 🧪 Experimental | ForkSkinny-128-384 is a tweakable block cipher with 384-bit tweakey and forking construction. Used in ForkAE authenticated encryption suite. |
| [FROG](block-ciphers/frog.md) | — | AES candidate from TecApro built on a key-as-program design: the user key derives a large internal key of per-round substitution and permut… |
| [FROG-256 (DarkCrypt)](block-ciphers/frog-256-darkcrypt.md) | 🎓 Educational Only | FROG AES candidate: fully key-dependent substitution/permutation network, where the user key derives a large "internal key" of per-round S-… |
| [GIFT-128](block-ciphers/gift-128.md) | 🧪 Experimental | Lightweight block cipher designed for efficient hardware and software implementation. Uses 128-bit blocks with 128-bit keys and 40 rounds.… |
| [GOST 28147-89](block-ciphers/gost-28147-89.md) | 🎓 Educational Only | Educational implementation of the Soviet/Russian GOST 28147-89 block cipher (Magma). 64-bit Feistel network with 256-bit keys using the Tes… |
| [GOST R 34.12-2015 (Kuznyechik)](block-ciphers/gost-r-34-12-2015-kuznyechik.md) | — | Modern Russian Federal Standard GOST R 34.12-2015 (Kuznyechik). Substitution-permutation network with 128-bit blocks and 256-bit keys. Educ… |
| [GOST-28147-89 (DarkCrypt)](block-ciphers/gost-28147-89-darkcrypt.md) | 🎓 Educational Only | GOST 28147-89 (Magma) variant from the DarkCrypt Total Commander plugin: textbook 32-round Feistel schedule (K0..K7 x3, then K7..K0), but w… |
| [GOST-28147-89 (EDE) (DarkCrypt)](block-ciphers/gost-28147-89-ede-darkcrypt.md) | 🎓 Educational Only | Triple GOST 28147-89 in Encrypt-Decrypt-Encrypt composition, from the DarkCrypt Total Commander plugin. The 768-bit key splits into three i… |
| [Grand Cru](block-ciphers/grand-cru.md) | 🧪 Experimental | Experimental Rijndael variant with key-dependent S-boxes and operations. 128-bit blocks, 10 rounds, designed for enhanced security through… |
| [GTEA 1.0 (DarkCrypt)](block-ciphers/gtea-1-0-darkcrypt.md) | 🎓 Educational Only | Generalized TEA-family block cipher from the DarkCrypt Total Commander plugin: 4-branch generalized Feistel network with an embedded 128x25… |
| [GTEA 2.1 (DarkCrypt)](block-ciphers/gtea-2-1-darkcrypt.md) | 🎓 Educational Only | Generalized TEA-family block cipher from the DarkCrypt Total Commander plugin: 4-branch generalized Feistel network with an embedded 64x256… |
| [GTEA 2.1KS (DarkCrypt)](block-ciphers/gtea-2-1ks-darkcrypt.md) | 🎓 Educational Only | Generalized TEA-family block cipher from the DarkCrypt Total Commander plugin: identical round function to GTEA 2.1 but with a doubled (two… |
| [Hierocrypt-3](block-ciphers/hierocrypt-3.md) | 🎓 Educational Only | Educational implementation of Hierocrypt-3, a 128-bit block cipher from Toshiba submitted to NESSIE with nested SPN structure and variable… |
| [Hierocrypt-3 (DarkCrypt)](block-ciphers/hierocrypt-3-darkcrypt.md) | 🎓 Educational Only | Hierocrypt-3, Toshiba's NESSIE-submission nested-SPN block cipher, fixed to a 256-bit key (8 rounds, turning point 5) as used by the DarkCr… |
| [Hierocrypt-L1](block-ciphers/hierocrypt-l1.md) | 🎓 Educational Only | Hierocrypt-L1, a 64-bit block cipher from Toshiba submitted to NESSIE and recommended by CRYPTREC. Nested SPN structure with 6.5 rounds and… |
| [Hierocrypt-L1 (DarkCrypt)](block-ciphers/hierocrypt-l1-darkcrypt.md) | 🎓 Educational Only | Hierocrypt-L1, Toshiba's NESSIE-submission nested-SPN block cipher (64-bit block, 128-bit key, 6 rounds, turning point 4), as used by the D… |
| [HIGHT](block-ciphers/hight.md) | 🎓 Educational Only | HIGh security and light weigHT block cipher designed for low-resource devices. Uses only ADD/XOR operations without multiplication, making… |
| [HPC](block-ciphers/hpc.md) | 🎓 Educational Only | Hasty Pudding Cipher with variable bit-level block sizes (0-137 billion bits). AES candidate featuring 5 sub-ciphers optimized for differen… |
| [HPC-256 (DarkCrypt)](block-ciphers/hpc-256-darkcrypt.md) | 🎓 Educational Only | Hasty Pudding Cipher (HPC-Medium sub-cipher) as shipped in the DarkCrypt Total Commander plugin. Uses Rich Schroeppel's original 1998 key-s… |
| [Hurricane](block-ciphers/hurricane.md) | 🎓 Educational Only | Roman Ganin's Hurricane cipher with key-dependent 256x256 substitution matrix. Uses four-pass encryption with bidirectional matrix lookups… |
| [ICE](block-ciphers/ice.md) | 🎓 Educational Only | Information Concealment Engine with configurable rounds (Thin-ICE: 8 rounds, ICE: 16 rounds). 64-bit Feistel block cipher with key-dependen… |
| [ICE-2](block-ciphers/ice-2.md) | 🎓 Educational Only | Information Concealment Engine with level 2 (32 rounds, 128-bit key). 64-bit Feistel block cipher with key-dependent S-boxes designed by Ma… |
| [IDEA](block-ciphers/idea.md) | 🎓 Educational Only | International Data Encryption Algorithm by Lai and Massey. Uses Lai-Massey structure with three operations: XOR, addition mod 2^16, and mul… |
| [IDEA (DarkCrypt)](block-ciphers/idea-darkcrypt.md) | 🎓 Educational Only | Standard International Data Encryption Algorithm (Lai/Massey) as implemented in the DarkCrypt Total Commander plugin: textbook 8.5-round La… |
| [IDEA-NXT (DarkCrypt)](block-ciphers/idea-nxt-darkcrypt.md) | 🎓 Educational Only | FOX128/256/32 (IDEA NXT-128 with a 256-bit key, 32 rounds): an Extended Lai-Massey block cipher by Junod and Vaudenay (EPFL), built from an… |
| [Iraqi (DarkCrypt)](block-ciphers/iraqi-darkcrypt.md) | 🎓 Educational Only | The obscure "Iraqi" block cipher as shipped in the DarkCrypt Total Commander plugin: a 5-round balanced Feistel on two 128-bit halves of a… |
| [Ixchel (DarkCrypt)](block-ciphers/ixchel-darkcrypt.md) | 🎓 Educational Only | 128-bit block, 512-bit key cipher from the DarkCrypt Total Commander plugin. Sixteen-round ARX network over four 32-bit words: a branching… |
| [KAIRAKAN (DarkCrypt)](block-ciphers/kairakan-darkcrypt.md) | 🎓 Educational Only | KAIRAKAN as implemented in the DarkCrypt Total Commander plugin. 128-bit block, 256-bit key. |
| [Kalyna](block-ciphers/kalyna.md) | 🎓 Educational Only | Ukrainian national encryption standard (DSTU 7624:2014) - exact Crypto++ port with bit-perfect test vector validation. |
| [Kameko (DarkCrypt)](block-ciphers/kameko-darkcrypt.md) | 🎓 Educational Only | Non-standard 64-round chained byte-substitution cipher from the DarkCrypt Total Commander plugin. 64-bit block (8 independently-updated acc… |
| [KARLA (DarkCrypt)](block-ciphers/karla-darkcrypt.md) | 🎓 Educational Only | 64-bit block, 160-bit key cipher from the DarkCrypt Total Commander plugin. Unbalanced generalized Feistel over four 16-bit words, 32 round… |
| [KASUMI](block-ciphers/kasumi.md) | 🎓 Educational Only | 3GPP block cipher for 3G mobile telecommunications security. Based on MISTY1 with 64-bit blocks and 128-bit keys. Uses 8-round Feistel stru… |
| [Keeloq](block-ciphers/keeloq.md) | ❌ Broken | 32-bit block cipher with 64-bit key designed for remote keyless entry systems. Uses 528-round NLFSR structure. Owned by Microchip. Cryptogr… |
| [KeeLoq (DarkCrypt)](block-ciphers/keeloq-darkcrypt.md) | ❌ Broken | KeeLoq variant from the DarkCrypt Total Commander plugin: standard 528-round NLFSR core, but block and key words are packed little-endian (… |
| [Khazad](block-ciphers/khazad.md) | 🎓 Educational Only | NESSIE-era 64-bit block cipher using involutional substitution-permutation structure. Educational reference implementation. |
| [Khufu](block-ciphers/khufu.md) | ❌ Broken | Ralph Merkle's Khufu cipher with 64-bit blocks and variable key lengths up to 512 bits. Uses key-dependent S-boxes in an unbalanced Feistel… |
| [Khufu-512 (DarkCrypt)](block-ciphers/khufu-512-darkcrypt.md) | 🎓 Educational Only | Ralph Merkle's Khufu cipher with a 544-bit key as implemented in the DarkCrypt Total Commander plugin: 64-bit Feistel block, 8 octets of 8… |
| [Kinebick (DarkCrypt)](block-ciphers/kinebick-darkcrypt.md) | 🎓 Educational Only | 128-bit block, 512-bit key cipher from the DarkCrypt Total Commander plugin. Unrolled ARX network with three boolean mixers over four 32-bi… |
| [Kuznyechik](block-ciphers/kuznyechik.md) | 🧪 Experimental | Russian Federal block cipher standard GOST R 34.12-2015 with 128-bit blocks and 256-bit keys. Designed to replace GOST 28147-89, featuring… |
| [LameCrypt (DarkCrypt)](block-ciphers/lamecrypt-darkcrypt.md) | 🎓 Educational Only | LameCrypt block cipher from the DarkCrypt Total Commander plugin. 128-bit block as four little-endian 32-bit words, 512-bit key, 32 rounds… |
| [LBlock](block-ciphers/lblock.md) | 🧪 Experimental | Lightweight 64-bit block cipher with 80-bit keys designed for resource-constrained environments. Uses 32-round Feistel network with 10 diff… |
| [LEA](block-ciphers/lea.md) | — | Lightweight Encryption Algorithm, Korean national standard (KS X 3246). ARX-based block cipher with 128-bit blocks, optimized for high-spee… |
| [Letsief3 (DarkCrypt)](block-ciphers/letsief3-darkcrypt.md) | 🎓 Educational Only | Letsief3 block cipher from the DarkCrypt Total Commander plugin. 6-round Feistel-like network over two 32-bit big-endian halves; the round… |
| [Leviathan (DarkCrypt)](block-ciphers/leviathan-darkcrypt.md) | 🎓 Educational Only | Keystream-driven block cipher from the DarkCrypt Total Commander plugin: a four-round doubled RC4-style table schedule feeds a Fibonacci-st… |
| [LION](block-ciphers/lion.md) | — | Variable block-size cipher construction combining hash function and stream cipher in three-round Feistel structure. Security depends on inn… |
| [Lja1 (DarkCrypt)](block-ciphers/lja1-darkcrypt.md) | 🎓 Educational Only | Byte-oriented block cipher from the DarkCrypt Total Commander plugin. The 256-byte key becomes a substitution table; 16 cycles rewrite each… |
| [LOKI'91-512 (DarkCrypt)](block-ciphers/loki-91-512-darkcrypt.md) | 🎓 Educational Only | LOKI'91 variant from the DarkCrypt Total Commander plugin: standard 16-round Feistel network with the textbook LOKI'91 S-P round function,… |
| [LOKI89](block-ciphers/loki89.md) | ❌ Broken | Early Australian block cipher designed by Lawrie Brown and Josef Pieprzyk. 64-bit Feistel cipher predecessor to LOKI97, featuring S-box sub… |
| [LOKI91](block-ciphers/loki91.md) | ❌ Broken | Enhanced version of LOKI89 addressing cryptanalytic weaknesses. 64-bit Feistel cipher with improved S-boxes and key schedule designed for b… |
| [LOKI97](block-ciphers/loki97.md) | 🎓 Educational Only | Australian AES candidate featuring 128-bit blocks with 128/192/256-bit keys. Uses substitution-permutation network with S-boxes based on fi… |
| [LOKI97 (DarkCrypt)](block-ciphers/loki97-darkcrypt.md) | 🎓 Educational Only | LOKI97 as implemented in the DarkCrypt Total Commander plugin. 128-bit block, 256-bit key, 16-round Feistel with GF-based S-boxes (S1 in GF… |
| [Lucifer](block-ciphers/lucifer.md) | 📰 Obsolete | IBM's pioneering Feistel cipher (1973) that directly led to DES development. Uses 128-bit blocks and keys with 16-round structure. |
| [Lucifer (DarkCrypt)](block-ciphers/lucifer-darkcrypt.md) | 🎓 Educational Only | Lucifer variant from the DarkCrypt Total Commander plugin: 128-bit block, 128-bit key, 16-round Feistel network with a data/key-dependent i… |
| [MacGuffin](block-ciphers/macguffin.md) | ❌ Broken | Experimental block cipher using Generalized Unbalanced Feistel Network (GUFN) where each round modifies 16 bits based on 48 bits. Broken by… |
| [MacGuffin (DarkCrypt)](block-ciphers/macguffin-darkcrypt.md) | 🎓 Educational Only | MacGuffin GUFN block cipher (Blaze and Schneier, 1994) as implemented in the DarkCrypt Total Commander plugin: identical S-boxes, bit selec… |
| [MAGENTA](block-ciphers/magenta.md) | — | Deutsche Telekom AES candidate with modified Feistel structure and GF(2^8) operations. Educational implementation of a cipher with known vu… |
| [MAGENTA (DarkCrypt)](block-ciphers/magenta-darkcrypt.md) | — | MAGENTA block cipher as implemented in the DarkCrypt Total Commander plugin: 8-round unbalanced Feistel network with palindromic subkey sch… |
| [Magma](block-ciphers/magma.md) | 🧪 Experimental | Russian Federal block cipher standard GOST R 34.12-2015 with 64-bit blocks and 256-bit keys. Updated version of GOST 28147-89 using a 32-ro… |
| [MANTIS](block-ciphers/mantis.md) | 🧪 Experimental | Low-latency tweakable block cipher designed for memory encryption. 64-bit block size with 128-bit keys and 64-bit tweaks using reflection-b… |
| [MARS](block-ciphers/mars.md) | 🎓 Educational Only | IBM AES finalist (1998) featuring heterogeneous structure with Type-3 Feistel network, combining S-boxes, multiplication, and data-dependen… |
| [MARS-1248 (DarkCrypt)](block-ciphers/mars-1248-darkcrypt.md) | 🎓 Educational Only | MARS variant from the DarkCrypt Total Commander plugin: standard MARS round structure (8 forward mixing + 16 keyed core + 8 backward mixing… |
| [MARS-256 (DarkCrypt)](block-ciphers/mars-256-darkcrypt.md) | 🎓 Educational Only | MARS variant from the DarkCrypt Total Commander plugin: standard MARS round structure (8 forward mixing + 16 keyed core + 8 backward mixing… |
| [MARS-512 (DarkCrypt)](block-ciphers/mars-512-darkcrypt.md) | 🎓 Educational Only | MARS variant from the DarkCrypt Total Commander plugin: standard MARS round structure (8 forward mixing + 16 keyed core + 8 backward mixing… |
| [Maskenoza (DarkCrypt)](block-ciphers/maskenoza-darkcrypt.md) | 🎓 Educational Only | 5-word (160-bit block) ARX cipher from the DarkCrypt Total Commander plugin: 80-round construction over 5 state words with a 4-group rotati… |
| [MBC2 (DarkCrypt)](block-ciphers/mbc2-darkcrypt.md) | 🎓 Educational Only | Bit-oriented block cipher from the DarkCrypt Total Commander plugin: 16 rounds of table-driven bit substitution, cascade and permutation ov… |
| [MD4-512 (DarkCrypt)](block-ciphers/md4-512-darkcrypt.md) | 🎓 Educational Only | MD4-512 as implemented in the DarkCrypt Total Commander plugin: the standard MD4 compression function used as an unkeyed-IV, non-feedback b… |
| [MD5-512 (DarkCrypt)](block-ciphers/md5-512-darkcrypt.md) | 🎓 Educational Only | MD5-512 as implemented in the DarkCrypt Total Commander plugin: the standard MD5 compression function used as an unkeyed-IV, non-feedback b… |
| [MD5-Karn (DarkCrypt)](block-ciphers/md5-karn-darkcrypt.md) | 🎓 Educational Only | MD5-Karn as implemented in the DarkCrypt Total Commander plugin: a 3-round unbalanced Feistel-like network over two 128-bit halves, using f… |
| [Mercy](block-ciphers/mercy.md) | ❌ Broken | Paul Crowley's tweakable block cipher designed for disk sector encryption. Features unusually large 4096-bit (512-byte) blocks with 128-bit… |
| [Mercy-6 (DarkCrypt)](block-ciphers/mercy-6-darkcrypt.md) | ❌ Broken | Wide-block (4096-bit / 512-byte) 6-round Feistel cipher from the DarkCrypt Total Commander plugin, in the spirit of Crowley and Lucks' Merc… |
| [MESSA (DarkCrypt)](block-ciphers/messa-darkcrypt.md) | 🎓 Educational Only | 31-round block cipher from the DarkCrypt Total Commander plugin. Key-dependent 64-word round table built via a three-stage key schedule (fi… |
| [Midori128](block-ciphers/midori128.md) | 🧪 Experimental | Lightweight block cipher optimized for low energy consumption. 128-bit block size with 128-bit keys using 20 rounds. Based on AES-like stru… |
| [Midori64](block-ciphers/midori64.md) | 🧪 Experimental | Lightweight block cipher optimized for low energy consumption. 64-bit block size with 128-bit keys using 16 rounds. Based on AES-like struc… |
| [MISTY1](block-ciphers/misty1.md) | — | Japanese block cipher by Mitsuru Matsui designed for provable security. Uses 64-bit blocks and 128-bit keys with 8-round FL/FO structure. F… |
| [Misty1 (DarkCrypt)](block-ciphers/misty1-darkcrypt.md) | 🎓 Educational Only | MISTY1 block cipher (Matsui, 1996) as implemented in the DarkCrypt Total Commander plugin: standard S7 table, a non-standard S9 table, non-… |
| [MISTY2](block-ciphers/misty2.md) | 🎓 Educational Only | Enhanced theoretical successor to MISTY1 with 12-round structure. Features enhanced FL/FO functions and additional diffusion. Academic desi… |
| [MMB (DarkCrypt)](block-ciphers/mmb-darkcrypt.md) | 🎓 Educational Only | MMB (Modular Multiplication-based Block cipher) as implemented in the DarkCrypt Total Commander plugin: 128-bit block/key, 6 rounds combini… |
| [MMB2 (DarkCrypt)](block-ciphers/mmb2-darkcrypt.md) | 🎓 Educational Only | MMB2 (revision of Daemen's MMB) as implemented in the DarkCrypt Total Commander plugin: 128-bit block/key, 6 rounds of key mixing plus thet… |
| [MPJ2 (DarkCrypt)](block-ciphers/mpj2-darkcrypt.md) | 🎓 Educational Only | Undocumented 128-bit block cipher from the DarkCrypt Total Commander plugin: a 15-round substitution-permutation network whose 240 key-depe… |
| [MULTI2](block-ciphers/multi2.md) | 🎓 Educational Only | MULTI2 block cipher used in DVB (Digital Video Broadcasting) systems. Features 64-bit blocks with 320-bit keys and variable rounds for secu… |
| [Multiswap (DarkCrypt)](block-ciphers/multiswap-darkcrypt.md) | ❌ Broken | Microsoft's MultiSwap block cipher/MAC (from Windows Media DRM / MS Reader .lit DRM), as wrapped into a standalone 64-bit block cipher by t… |
| [NewDES](block-ciphers/newdes.md) | 🎓 Educational Only | New Data Encryption Standard by Robert Scott. Educational implementation of a 64-bit block cipher with 120-bit keys, designed to be easier… |
| [NewDES-120 (DarkCrypt)](block-ciphers/newdes-120-darkcrypt.md) | 🎓 Educational Only | Original 1985 NewDES cipher by Robert Scott as implemented in the DarkCrypt Total Commander plugin: 64-bit block, 120-bit key, 8 loop itera… |
| [NewDES'96-120 (DarkCrypt)](block-ciphers/newdes-96-120-darkcrypt.md) | 🎓 Educational Only | 1996-revised NewDES cipher by Robert Scott (fixed key schedule) as implemented in the DarkCrypt Total Commander plugin: 64-bit block, 120-b… |
| [NewTEA-128 (DarkCrypt)](block-ciphers/newtea-128-darkcrypt.md) | 🎓 Educational Only | 4-word (128-bit block) generalization of TEA from the DarkCrypt Total Commander plugin. Direct key-to-subkey mapping (no sum-indexed schedu… |
| [NOEKEON](block-ciphers/noekeon.md) | 🎓 Educational Only | NESSIE 128-bit block cipher designed by Joan Daemen, Michaël Peeters, Gilles Van Assche and Vincent Rijmen. Direct Key Mode implementation… |
| [Noekeon-indirect (DarkCrypt)](block-ciphers/noekeon-indirect-darkcrypt.md) | 🎓 Educational Only | NOEKEON block cipher run in indirect-key mode: the Working Key is derived by running the full 16-round cipher on the Cipher Key with an all… |
| [NSEA (DarkCrypt)](block-ciphers/nsea-darkcrypt.md) | 🎓 Educational Only | Nonpatented Simple Encryption Algorithm by Peter Gutmann (1992) as implemented in the DarkCrypt Total Commander plugin: 128-bit block, 288-… |
| [NUSH (DarkCrypt)](block-ciphers/nush-darkcrypt.md) | 🎓 Educational Only | NUSH block cipher (128-bit block / 256-bit key variant), a NESSIE submission by LAN Crypto (Lebedev, Volchkov) using only XOR/AND/OR/modula… |
| [Paranoia (DarkCrypt)](block-ciphers/paranoia-darkcrypt.md) | 🎓 Educational Only | Undocumented 256-bit block cipher from the DarkCrypt Total Commander plugin: an 8-word generalized Feistel network over a 512-bit key, whos… |
| [PES (DarkCrypt)](block-ciphers/pes-darkcrypt.md) | 🎓 Educational Only | PES (Proposed Encryption Standard, Lai/Massey 1990), the direct historical predecessor of IDEA, as implemented in the DarkCrypt Total Comma… |
| [Phantom (DarkCrypt)](block-ciphers/phantom-darkcrypt.md) | 🎓 Educational Only | Custom block cipher bundled with the DarkCrypt Total Commander plugin. Four-branch structure combining IDEA-style modular multiplication, f… |
| [Pikachu (DarkCrypt)](block-ciphers/pikachu-darkcrypt.md) | 🎓 Educational Only | 64-bit block, 128-bit key cipher from the DarkCrypt Total Commander plugin. Non-swapping Feistel network, 6 outer rounds (12 keyed F applic… |
| [PRESENT-128](block-ciphers/present-128.md) | 🎓 Educational Only | PRESENT-128 variant of the lightweight block cipher with extended 128-bit key size. Substitution-Permutation Network with 64-bit blocks, 12… |
| [PRESENT-80](block-ciphers/present-80.md) | 🎓 Educational Only | PRESENT-80 lightweight block cipher designed for constrained environments. Substitution-Permutation Network with 64-bit blocks, 80-bit keys… |
| [PRIDE](block-ciphers/pride.md) | 🧪 Experimental | Block cipher optimized for 8-bit microcontrollers with focus on efficient linear layer. 64-bit block size with 128-bit keys using FX constr… |
| [Pyjamask-128](block-ciphers/pyjamask-128.md) | 🧪 Experimental | Lightweight block cipher designed for efficient masked implementations. Features a 128-bit block size with 128-bit keys using 14 rounds. Pa… |
| [Q128 (DarkCrypt)](block-ciphers/q128-darkcrypt.md) | 🎓 Educational Only | Q128, an obscure 128-bit block cipher bundled with the DarkCrypt Total Commander plugin. No public specification is known. 16-round Feistel… |
| [Raiden-16 (DarkCrypt)](block-ciphers/raiden-16-darkcrypt.md) | 🎓 Educational Only | Raiden, the genetic-programming-designed TEA replacement of Polimon, Hernandez-Castro, Estevez-Tapiador and Ribagorda, at the 16 rounds use… |
| [Raiden-32 (DarkCrypt)](block-ciphers/raiden-32-darkcrypt.md) | 🎓 Educational Only | Raiden, the genetic-programming-designed TEA replacement of Polimon, Hernandez-Castro, Estevez-Tapiador and Ribagorda, at 32 rounds. Same r… |
| [Rainbow (DarkCrypt)](block-ciphers/rainbow-darkcrypt.md) | 🎓 Educational Only | Home-grown SP-network block cipher from the DarkCrypt Total Commander plugin (not related to the Rainbow signature scheme or any other publ… |
| [RC2](block-ciphers/rc2.md) | ❌ Broken | RC2 variable-key-size block cipher with 64-bit blocks. Uses mixing and mashing operations over 18 rounds. Developed by Ron Rivest at RSA Da… |
| [RC2 (DarkCrypt)](block-ciphers/rc2-darkcrypt.md) | 🎓 Educational Only | RC2 block cipher from the DarkCrypt Total Commander plugin, keyed with a fixed 1024-bit (128-byte) key copied verbatim into the subkey tabl… |
| [RC5](block-ciphers/rc5.md) | — | Variable symmetric block cipher with data-dependent rotations. Features configurable word size, rounds, and key length. This implementation… |
| [RC5-32/16/64 (DarkCrypt)](block-ciphers/rc5-32-16-64-darkcrypt.md) | 🎓 Educational Only | RC5 variant from the DarkCrypt Total Commander plugin: word size w=32 (64-bit real block), 16 rounds, 512-bit (64-byte) key via the standar… |
| [RC6](block-ciphers/rc6.md) | — | AES finalist designed as evolution of RC5. Features 128-bit blocks, variable key sizes, and data-dependent rotations with quadratic nonline… |
| [RC6-512 (DarkCrypt)](block-ciphers/rc6-512-darkcrypt.md) | 🎓 Educational Only | RC6 variant from the DarkCrypt Total Commander plugin: standard 128-bit block, 20 rounds, extended to a 512-bit (64-byte) key. The key sche… |
| [REDOC II](block-ciphers/redoc-ii.md) | 🎓 Educational Only | IBM's experimental data-dependent cipher from the 1980s with 80-bit blocks and 160-bit keys. Uses data-dependent permutations, substitution… |
| [REDOC II (DarkCrypt)](block-ciphers/redoc-ii-darkcrypt.md) | 🎓 Educational Only | The genuine REDOC II cipher (Michael Wood, 1985) as implemented in the DarkCrypt Total Commander plugin: 80-bit blocks, 160-bit keys, 10 ro… |
| [REDOC III](block-ciphers/redoc-iii.md) | 🎓 Educational Only | Enhanced version of IBM's REDOC II cipher with 128-bit blocks and 256-bit keys. Features improved security and stronger diffusion compared… |
| [REDOC III (DarkCrypt)](block-ciphers/redoc-iii-darkcrypt.md) | 🎓 Educational Only | REDOC III variant from the DarkCrypt Total Commander plugin: an 80-bit block (only the first 8 bytes are transformed, the last 2 pass throu… |
| [RHX (Rijndael Extended)](block-ciphers/rhx-rijndael-extended.md) | 🎓 Educational Only | Professional extended Rijndael/AES with 256/512/1024-bit keys from CEX Cryptographic Library. Enhanced security margins with increased roun… |
| [Rijndael (AES)](block-ciphers/rijndael-aes.md) | 🎓 Educational Only | Educational AES implementation with 128-bit blocks and 128/192/256-bit keys, aligned with NIST FIPS 197. |
| [Rijndael-256 (DarkCrypt)](block-ciphers/rijndael-256-darkcrypt.md) | 🎓 Educational Only | Original Rijndael specification generalized to an 8-column state: 256-bit block, 256-bit key, 14 rounds, ShiftRow offsets {0,1,3,4} (per th… |
| [RTEA (DarkCrypt)](block-ciphers/rtea-darkcrypt.md) | 🎓 Educational Only | TEA-family block cipher from the DarkCrypt Total Commander plugin: round index used directly as the additive constant (no DELTA-derived sum… |
| [SAFER](block-ciphers/safer.md) | 🎓 Educational Only | Secure And Fast Encryption Routine by James Massey. Uses exponential/logarithmic S-boxes based on GF(257) and Pseudo-Hadamard Transform for… |
| [SAFER-SK128 (DarkCrypt)](block-ciphers/safer-sk128-darkcrypt.md) | 🎓 Educational Only | SAFER SK-128 block cipher (James Massey, strengthened key schedule by Lars Knudsen). 64-bit block, 128-bit key. This DarkCrypt build uses 8… |
| [SAFER+](block-ciphers/safer-plus.md) | 🎓 Educational Only | SAFER+ (SAFER Plus) block cipher with enhanced security. Features 128-bit blocks, PHT transform for diffusion, and Armenian shuffle permuta… |
| [SAFER++ (DarkCrypt)](block-ciphers/safer-plus-plus-darkcrypt.md) | 🎓 Educational Only | SAFER++ block cipher (James Massey, Gurgen Khachatrian, Melsik Kuregian; NESSIE submission, 2000). 128-bit block, 256-bit key, 10 rounds. A… |
| [SC2000](block-ciphers/sc2000.md) | 🎓 Educational Only | Fujitsu Laboratories block cipher combining an SPN half-round (subkey XOR plus a bit-sliced 4-bit S-box layer) with pairs of Feistel rounds… |
| [SC2000 (DarkCrypt)](block-ciphers/sc2000-darkcrypt.md) | 🎓 Educational Only | SC2000 variant from the DarkCrypt Total Commander plugin: always runs 6.5 rounds (56 round-key words) regardless of key size, whereas the p… |
| [SC6B (DarkCrypt)](block-ciphers/sc6b-darkcrypt.md) | 🎓 Educational Only | Non-standard 128-bit block cipher from the DarkCrypt Total Commander plugin. 320-bit key expanded by a nonlinear feedback shift register in… |
| [SEED](block-ciphers/seed.md) | — | Korean block cipher standardized in RFC 4269 and TTAS.KO-12.0004. Features 128-bit blocks and keys with 16-round Feistel structure and comp… |
| [SEED (DarkCrypt)](block-ciphers/seed-darkcrypt.md) | 🎓 Educational Only | RFC 4269 SEED as implemented in the DarkCrypt Total Commander plugin: identical Feistel structure, G/F-functions, S-boxes and key schedule,… |
| [Serpent](block-ciphers/serpent.md) | — | AES finalist cipher by Anderson, Biham, and Knudsen with 32 rounds and 8 S-boxes. Uses substitution-permutation network with 128-bit blocks… |
| [Serpent (DarkCrypt)](block-ciphers/serpent-darkcrypt.md) | 🎓 Educational Only | Serpent variant from the DarkCrypt Total Commander plugin: standard 32-round S-box/linear-transform structure, but a non-overlapping flat k… |
| [SHA1-512 (DarkCrypt)](block-ciphers/sha1-512-darkcrypt.md) | 🎓 Educational Only | SHA-1 compression function used as a raw keyed block cipher (SHACAL-style), as implemented in the DarkCrypt Total Commander plugin. 160-bit… |
| [SHACAL-1](block-ciphers/shacal-1.md) | 🎓 Educational Only | 160-bit block cipher based on the SHA-1 hash function compression function. Submitted to NESSIE but not selected due to SHA-1 weaknesses. U… |
| [SHACAL-2](block-ciphers/shacal-2.md) | 🎓 Educational Only | 256-bit block cipher based on the SHA-256 hash function compression function. Selected by NESSIE for standardization. Uses 64 rounds with S… |
| [SHARK](block-ciphers/shark.md) | 🧪 Experimental | SHARK is a 64-bit block cipher using S-box and MDS matrix transformations over GF(2^8). Designed in 1996, it features variable rounds (defa… |
| [SHARK-A (DarkCrypt)](block-ciphers/shark-a-darkcrypt.md) | 🎓 Educational Only | SHARK-A variant from the DarkCrypt Total Commander plugin: a non-standard SHARK derivative with a GF(2^8) plaintext-whitening multiplier, s… |
| [SHARK-E (DarkCrypt)](block-ciphers/shark-e-darkcrypt.md) | 🎓 Educational Only | SHARK-E variant from the DarkCrypt Total Commander plugin: structurally the classic SHARK cipher (5 C-box rounds + S-box-only final round,… |
| [Shebamik (DarkCrypt)](block-ciphers/shebamik-darkcrypt.md) | 🎓 Educational Only | 160-bit block, 512-bit key cipher from the DarkCrypt Total Commander plugin. The SHA-1 compression function (five-word ARX state, ROTL5/ROT… |
| [Shogashi (DarkCrypt)](block-ciphers/shogashi-darkcrypt.md) | 🎓 Educational Only | 128-bit block, 512-bit key cipher from the DarkCrypt Total Commander plugin. A fully custom, exotic construction: multiplicative input/outp… |
| [SHX (Serpent Extended)](block-ciphers/shx-serpent-extended.md) | 🎓 Educational Only | Extended Serpent cipher with 256/512/1024-bit keys from CEX library. Educational implementation with increased rounds (40/48/64) for enhanc… |
| [SIMECK-32](block-ciphers/simeck-32.md) | — | Lightweight 32-bit block cipher combining design principles from SIMON and SPECK. Uses efficient AND-rotation-XOR round function suitable f… |
| [SIMECK-64](block-ciphers/simeck-64.md) | — | Lightweight 64-bit block cipher combining design principles from SIMON and SPECK. Uses efficient AND-rotation-XOR round function suitable f… |
| [Simon](block-ciphers/simon.md) | 🎓 Educational Only | NSA's lightweight block cipher family designed for resource-constrained environments. Simon64/128 variant uses 64-bit blocks with 128-bit k… |
| [Simplicity (DarkCrypt)](block-ciphers/simplicity-darkcrypt.md) | 🎓 Educational Only | Undocumented 128-bit block cipher from the DarkCrypt Total Commander plugin: a 12-group substitution-diffusion network over a 256-bit key,… |
| [Sinople (DarkCrypt)](block-ciphers/sinople-darkcrypt.md) | 🎓 Educational Only | 128-bit block, 128-bit key cipher from the DarkCrypt Total Commander plugin. 4-branch generalized Feistel network, 64 rounds alternating tw… |
| [SKINNY-128](block-ciphers/skinny-128.md) | 🧪 Experimental | A family of lightweight tweakable block ciphers designed for resource-constrained environments. Features efficient hardware and software im… |
| [Skip32](block-ciphers/skip32.md) | 🎓 Educational Only | 32-bit block cipher based on Skipjack's F-table. Uses 24-round Feistel structure with 80-bit key. Designed for obfuscating small integers. |
| [Skipjack](block-ciphers/skipjack.md) | ❌ Broken | Declassified NSA block cipher from 1998, originally designed for the Clipper chip. Uses unbalanced Feistel network with 32 rounds, 64-bit b… |
| [SM4](block-ciphers/sm4.md) | — | Chinese national standard block cipher (GB/T 32907-2016, also known as SMS4). Features 128-bit blocks and keys with 32-round substitution-p… |
| [Snappy (DarkCrypt)](block-ciphers/snappy-darkcrypt.md) | 🎓 Educational Only | Undocumented 64-bit block cipher from the DarkCrypt Total Commander plugin: 16 rounds of an in-place, byte-at-a-time S-box mixing network w… |
| [Sobbikashi (DarkCrypt)](block-ciphers/sobbikashi-darkcrypt.md) | 🎓 Educational Only | 128-bit block, 512-bit key cipher from the DarkCrypt Total Commander plugin. A CAST-256-shaped generalized Feistel network (standard Type1/… |
| [Sonjitege (DarkCrypt)](block-ciphers/sonjitege-darkcrypt.md) | 🎓 Educational Only | 128-bit block, 512-bit key cipher from the DarkCrypt Total Commander plugin. A 32-round 4-word ARX/boolean network with an RC4-style key-sc… |
| [Speck](block-ciphers/speck.md) | 🎓 Educational Only | NSA's lightweight ARX (Addition-Rotation-XOR) cipher designed for software efficiency. Speck64/128 variant uses 64-bit blocks with 128-bit… |
| [SPEED](block-ciphers/speed.md) | — | Unbalanced Feistel network by Yuliang Zheng over a queue of eight words. Each round builds one new word from a nonlinear Boolean combinatio… |
| [SPEED (DarkCrypt)](block-ciphers/speed-darkcrypt.md) | 🎓 Educational Only | SPEED cipher as implemented by the DarkCrypt Total Commander plugin: an 8x16-bit-word unbalanced shift-register cipher with 64 rounds split… |
| [Square](block-ciphers/square.md) | 🎓 Educational Only | Predecessor to Rijndael/AES designed by Joan Daemen and Vincent Rijmen in 1997. Uses 128-bit blocks and keys with 8 rounds. |
| [TC18 (DarkCrypt)](block-ciphers/tc18-darkcrypt.md) | 🎓 Educational Only | Obscure block cipher from the DarkCrypt Total Commander plugin with no known public specification. An unbalanced 16-round Feistel network o… |
| [TEA](block-ciphers/tea.md) | ❌ Broken | Tiny Encryption Algorithm with 64-bit blocks and 128-bit keys using simple XOR, shift, and add operations. Fast but has known cryptanalytic… |
| [Threefish](block-ciphers/threefish.md) | — | Tweakable block cipher family designed as part of the Skein hash function. Threefish-512 uses 512-bit blocks and keys with 72 rounds, optim… |
| [Threefish-1024 (DarkCrypt)](block-ciphers/threefish-1024-darkcrypt.md) | 🎓 Educational Only | Threefish-1024 as implemented in the DarkCrypt Total Commander plugin. 1024-bit block, 1152-bit key. |
| [Threefish-512-TW (DarkCrypt)](block-ciphers/threefish-512-tw-darkcrypt.md) | 🎓 Educational Only | Threefish-512 as implemented in the DarkCrypt Total Commander plugin build "TW1.2": standard 72-round/permutation/rotation/tweak structure,… |
| [THX (Twofish Extended)](block-ciphers/thx-twofish-extended.md) | 🎓 Educational Only | Educational extended Twofish with 256/512/1024-bit keys and proportional rounds (16/20/24). Based on Twofish structure with simplified key… |
| [Tnepres](block-ciphers/tnepres.md) | 🎓 Educational Only | Tnepres is a 128-bit 32-round block cipher based on Serpent. Due to endianness confusion in AES submission test vectors, Tnepres is a byte-… |
| [TWINE](block-ciphers/twine.md) | 🧪 Experimental | Lightweight block cipher designed by NEC for resource-constrained environments. 64-bit block size with 80-bit or 128-bit keys using 36-roun… |
| [Twofish](block-ciphers/twofish.md) | — | AES finalist cipher by Bruce Schneier with key-dependent S-boxes and MDS matrix. Supports 128, 192, and 256-bit keys with excellent securit… |
| [TWOPES (DarkCrypt)](block-ciphers/twopes-darkcrypt.md) | 🎓 Educational Only | Double-IDEA block cipher from the DarkCrypt Total Commander plugin: two consecutive 8-round IDEA passes over a 64-bit block using multiplic… |
| [Umchak (DarkCrypt)](block-ciphers/umchak-darkcrypt.md) | 🎓 Educational Only | TEA-family block cipher from the DarkCrypt Total Commander plugin: 64-bit block, 512-bit key, 64-word round-key schedule built by an RC5-co… |
| [Vemokwana (DarkCrypt)](block-ciphers/vemokwana-darkcrypt.md) | 🎓 Educational Only | Generalized-Feistel block cipher from the DarkCrypt Total Commander plugin: RC5/RC6-style S-box-driven key schedule feeding an RC4-permuted… |
| [VSEN (DarkCrypt)](block-ciphers/vsen-darkcrypt.md) | 🎓 Educational Only | 32-round chained-Feistel block cipher from the DarkCrypt Total Commander plugin. Key-dependent per-round S-boxes (32 rows x 4x256 bytes) bu… |
| [VSEN REV1.0 (DarkCrypt)](block-ciphers/vsen-rev1-0-darkcrypt.md) | 🎓 Educational Only | 32-round chained-Feistel block cipher from the DarkCrypt Total Commander plugin. Key-dependent per-round S-boxes (32 rows x 4x256 bytes) bu… |
| [Wabasso (DarkCrypt)](block-ciphers/wabasso-darkcrypt.md) | 🎓 Educational Only | 160-bit block, 512-bit key cipher from the DarkCrypt Total Commander plugin. A 160-round five-word ARX wheel: each round mixes three of the… |
| [Webino (DarkCrypt)](block-ciphers/webino-darkcrypt.md) | 🎓 Educational Only | Block cipher from the DarkCrypt Total Commander plugin built directly on the MD5 compression function (RFC 1321 F/G/H/I, rotate amounts and… |
| [Wicker-98 (DarkCrypt)](block-ciphers/wicker-98-darkcrypt.md) | 🎓 Educational Only | Wicker-98 block cipher from the DarkCrypt Total Commander plugin: 35-round unbalanced ARX network on four 32-bit words with a rotating accu… |
| [XTEA](block-ciphers/xtea.md) | 🎓 Educational Only | Extended TEA cipher by Wheeler and Needham with improved key schedule and better security than TEA. Uses 64 rounds with 64-bit blocks and 1… |
| [XTEA (DarkCrypt)](block-ciphers/xtea-darkcrypt.md) | 🎓 Educational Only | XTEA variant from the DarkCrypt Total Commander plugin: shift amounts 6/9 (vs textbook 4/5), 38 rounds, little-endian words. 64-bit block,… |
| [XTEA-1 (DarkCrypt)](block-ciphers/xtea-1-darkcrypt.md) | 🎓 Educational Only | Generalized XTEA/TEA variant from the DarkCrypt Total Commander plugin: additive whitening (v0+=K0,v1+=K1) before 32 rounds, each round com… |
| [XTEA-3 (DarkCrypt)](block-ciphers/xtea-3-darkcrypt.md) | 🎓 Educational Only | Generalized 4-word Feistel construction from the DarkCrypt Total Commander plugin, built from TEA-style shift/sum/rotate primitives. 128-bi… |
| [XTEA-TW (DarkCrypt)](block-ciphers/xtea-tw-darkcrypt.md) | 🎓 Educational Only | XTEA variant from the DarkCrypt Total Commander plugin: shift amounts 6/9 (vs textbook 4/5), 38 rounds, little-endian words. Byte-identical… |
| [XXTEA](block-ciphers/xxtea.md) | 🎓 Educational Only | Corrected Block TEA by Needham and Wheeler with variable block sizes and enhanced security over TEA/XTEA. Supports blocks from 8 bytes to 1… |
| [XXTEA (DarkCrypt)](block-ciphers/xxtea-darkcrypt.md) | 🎓 Educational Only | XXTEA / Corrected Block TEA fixed to a 30-word (960-bit) block, as implemented in the DarkCrypt Total Commander plugin. Follows the standar… |
| [XXTEA-TW (DarkCrypt)](block-ciphers/xxtea-tw-darkcrypt.md) | 🎓 Educational Only | Fixed 64-bit-block cipher from the DarkCrypt Total Commander plugin, built from the XXTEA MX() round function with non-standard shifts (9/2… |

## Checksums

_Checksum and integrity verification algorithms_

| Algorithm | Security | Summary |
| --- | --- | --- |
| [ABA-Routing](checksums/aba-routing.md) | 🎓 Educational Only | ABA Routing Number check digit for US bank identification. 9-digit code using weighted modulo-10 algorithm with weights 3,7,1 repeating. Fo… |
| [Adler-16](checksums/adler-16.md) | 🎓 Educational Only | Adler-16 checksum for lightweight error detection in embedded systems Uses two 8-bit running sums with modulo 251 for fast error detection. |
| [Adler-32](checksums/adler-32.md) | 🎓 Educational Only | Adler-32 checksum used in zlib, gzip and other compression formats Uses two 16-bit running sums with modulo 65521 for fast error detection. |
| [Adler-64](checksums/adler-64.md) | 🎓 Educational Only | Adler-64 checksum for high-performance applications and large datasets Uses two 32-bit running sums with modulo 4294967291 for fast error d… |
| [BSD-Checksum](checksums/bsd-checksum.md) | 🎓 Educational Only | BSD Unix checksum algorithm using rotating 16-bit sum. Rotates checksum right by 1 bit before adding each byte. Used by BSD 'sum' command f… |
| [Constant Weight Code](checksums/constant-weight-code.md) | 🎓 Educational Only | Error detection code where all valid codewords have the same Hamming weight (m-of-n codes). Can detect all unidirectional errors by verifyi… |
| [CRC-128-BIGDATA](checksums/crc-128-bigdata.md) | 🎓 Educational Only | Big Data variant designed for distributed storage systems and massive dataset integrity Uses 128-bit polynomial with normal input processin… |
| [CRC-128-HPC](checksums/crc-128-hpc.md) | 🎓 Educational Only | High-Performance Computing variant optimized for scientific computing and parallel processing Uses 128-bit polynomial with normal input pro… |
| [CRC-128-STANDARD](checksums/crc-128-standard.md) | 🎓 Educational Only | Standard 128-bit CRC used in high-performance computing and large data integrity verification Uses 128-bit polynomial with normal input pro… |
| [CRC-16-ANSI](checksums/crc-16-ansi.md) | 🎓 Educational Only | 16-bit CRC used in ANSI standards and some protocols Uses 16-bit polynomial with reflected input processing. |
| [CRC-16-ARC](checksums/crc-16-arc.md) | 🎓 Educational Only | 16-bit CRC used in ARC archiver and reflected algorithms (LSB first processing) Uses 16-bit polynomial with reflected input processing. |
| [CRC-16-CCITT](checksums/crc-16-ccitt.md) | 🎓 Educational Only | 16-bit CRC used in CCITT/ITU-T standards, telecommunications, and X.25 protocol Uses 16-bit polynomial with normal input processing. |
| [CRC-16-IBM](checksums/crc-16-ibm.md) | 🎓 Educational Only | 16-bit CRC used by IBM in SDLC and USB standards Uses 16-bit polynomial with reflected input processing. |
| [CRC-16-XMODEM](checksums/crc-16-xmodem.md) | 🎓 Educational Only | 16-bit CRC used in XMODEM protocol with different initial value Uses 16-bit polynomial with normal input processing. |
| [CRC-24-FLEXRAY](checksums/crc-24-flexray.md) | 🎓 Educational Only | 24-bit CRC used in FlexRay automotive communication protocol Uses 24-bit polynomial with normal input processing. |
| [CRC-24-INTERLAKEN](checksums/crc-24-interlaken.md) | 🎓 Educational Only | 24-bit CRC used in Interlaken protocol for high-speed chip-to-chip communication Uses 24-bit polynomial with normal input processing. |
| [CRC-24-OPENPGP](checksums/crc-24-openpgp.md) | 🎓 Educational Only | 24-bit CRC used in OpenPGP ASCII armor for message integrity checking Uses 24-bit polynomial with normal input processing. |
| [CRC-32-BZIP2](checksums/crc-32-bzip2.md) | 🎓 Educational Only | CRC-32 used in BZIP2 compression format Uses 32-bit polynomial with normal input processing. |
| [CRC-32-IEEE](checksums/crc-32-ieee.md) | 🎓 Educational Only | CRC-32 (IEEE 802.3) standard used in Ethernet, zip files, and many protocols Uses 32-bit polynomial with reflected input processing. |
| [CRC-32-POSIX](checksums/crc-32-posix.md) | 🎓 Educational Only | CRC-32/POSIX (also known as CKSUM) - base algorithm without length appending Uses 32-bit polynomial with normal input processing. |
| [CRC-64-ECMA182](checksums/crc-64-ecma182.md) | 🎓 Educational Only | CRC-64 ECMA-182 standard used in DLT-1 tape cartridges Uses 64-bit polynomial with normal input processing. |
| [CRC-64-WE](checksums/crc-64-we.md) | 🎓 Educational Only | CRC-64/WE variant used in some applications with different initialization Uses 64-bit polynomial with normal input processing. |
| [CRC-64-XZ](checksums/crc-64-xz.md) | 🎓 Educational Only | CRC-64 used in XZ compression format and file integrity verification Uses 64-bit polynomial with reflected input processing. |
| [CRC-8-AUTOSAR](checksums/crc-8-autosar.md) | 🎓 Educational Only | 8-bit CRC used in AUTOSAR Classic Platform for automotive applications Uses 8-bit polynomial with normal input processing. |
| [CRC-8-CDMA2000](checksums/crc-8-cdma2000.md) | 🎓 Educational Only | 8-bit CRC used in CDMA2000 mobile telecommunications standard Uses 8-bit polynomial with normal input processing. |
| [CRC-8-MAXIM](checksums/crc-8-maxim.md) | 🎓 Educational Only | 8-bit CRC used in Maxim/Dallas 1-Wire device registration numbers Uses 8-bit polynomial with reflected input processing. |
| [CRC-8-SMBUS](checksums/crc-8-smbus.md) | 🎓 Educational Only | 8-bit CRC used in System Management Bus (SMBus) specification for I2C communications Uses 8-bit polynomial with normal input processing. |
| [CUSIP](checksums/cusip.md) | 🎓 Educational Only | CUSIP (Committee on Uniform Securities Identification Procedures) check digit calculation. 9-character alphanumeric identifier for North Am… |
| [Damm](checksums/damm.md) | 🎓 Educational Only | Damm algorithm using quasigroup of order 10 for check digit calculation. Detects ALL single-digit errors and ALL adjacent transposition err… |
| [Damm-Check-Digit](checksums/damm-check-digit.md) | 🎓 Educational Only | Damm algorithm using anti-symmetric quasigroups for optimal single-digit error detection Validates identification numbers to detect transcr… |
| [EAN-13](checksums/ean-13.md) | 🎓 Educational Only | EAN-13 (European Article Number) check digit for retail product barcodes. 13-digit identifier (12 data + 1 check) using alternating weights… |
| [EAN-8](checksums/ean-8.md) | 🎓 Educational Only | EAN-8 (European Article Number) check digit for compact product barcodes. 8-digit identifier (7 data + 1 check) using alternating weights 3… |
| [Even-Parity](checksums/even-parity.md) | 🎓 Educational Only | Even parity check ensuring total number of 1 bits is even Fundamental error detection using XOR operations. |
| [Fletcher-16](checksums/fletcher-16.md) | 🎓 Educational Only | Fletcher-16 checksum used in network protocols and data transmission Uses two 8-bit running sums with modulo 255 for enhanced error detecti… |
| [Fletcher-32](checksums/fletcher-32.md) | 🎓 Educational Only | Fletcher-32 checksum providing robust error detection for medium-sized data Uses two 16-bit running sums with modulo 65535 for enhanced err… |
| [Fletcher-64](checksums/fletcher-64.md) | 🎓 Educational Only | Fletcher-64 checksum for large datasets and high-performance applications Uses two 32-bit running sums with modulo 4294967295 for enhanced… |
| [Fletcher-8](checksums/fletcher-8.md) | 🎓 Educational Only | Fletcher-8 checksum for small data integrity checking in embedded systems Uses two 4-bit running sums with modulo 15 for enhanced error det… |
| [GTIN](checksums/gtin.md) | 🎓 Educational Only | GTIN (Global Trade Item Number) check digit calculation per GS1 standards. Unified format for product identification supporting GTIN-8, GTI… |
| [IBAN](checksums/iban.md) | 🎓 Educational Only | IBAN (International Bank Account Number) checksum using modulo-97 algorithm per ISO 13616. Validates international bank accounts with 2-dig… |
| [ICCID](checksums/iccid.md) | 🎓 Educational Only | ICCID (Integrated Circuit Card Identifier) check digit for SIM cards using Luhn algorithm. 18-20 digit identifier per ITU-T E.118 standard.… |
| [IMEI](checksums/imei.md) | 🎓 Educational Only | IMEI (International Mobile Equipment Identity) check digit using Luhn algorithm. 15-digit unique identifier for mobile phones (14 digits +… |
| [Internet-Checksum](checksums/internet-checksum.md) | 🎓 Educational Only | Internet checksum algorithm (RFC 1071) used in IPv4, TCP, UDP protocols. Uses 16-bit one's complement arithmetic for network packet header… |
| [ISBN-10](checksums/isbn-10.md) | 🎓 Educational Only | ISBN-10 checksum using modulo 11 with weighted positions and possible X check digit Standard book identifier validation used worldwide in p… |
| [ISBN-13](checksums/isbn-13.md) | 🎓 Educational Only | ISBN-13 checksum using modulo 10 (EAN-13 based) for modern book identification Standard book identifier validation used worldwide in publis… |
| [ISIN](checksums/isin.md) | 🎓 Educational Only | ISIN (International Securities Identification Number) check digit per ISO 6166. 12-character alphanumeric code (2 country + 9 identifier +… |
| [ISSN](checksums/issn.md) | 🎓 Educational Only | ISSN (International Standard Serial Number) check digit calculation per ISO 3297. 8-digit identifier for periodical publications with modul… |
| [Longitudinal-Parity](checksums/longitudinal-parity.md) | 🎓 Educational Only | Longitudinal parity check using XOR of all bytes for multi-byte error detection Fundamental error detection using XOR operations. |
| [LRC](checksums/lrc.md) | 🎓 Educational Only | Longitudinal Redundancy Check used in serial communications, as specified for Modbus ASCII. Sums all bytes modulo 256 and takes the two's c… |
| [Luhn](checksums/luhn.md) | 🎓 Educational Only | Luhn algorithm (mod 10 algorithm) for validating identification numbers. Invented by Hans Peter Luhn at IBM in 1954. Used in credit cards,… |
| [Luhn-Check-Digit](checksums/luhn-check-digit.md) | 🎓 Educational Only | Luhn algorithm (modulo 10) used for credit card validation and many ID numbers Validates identification numbers to detect transcription err… |
| [Modulo-10](checksums/modulo-10.md) | 🎓 Educational Only | Simple modulo-10 checksum for digit sequences. Sums all digits and returns remainder when divided by 10. Basic error detection for barcodes… |
| [Modulo-11](checksums/modulo-11.md) | 🎓 Educational Only | Modulo-11 weighted checksum used in ISBN-10, ISSN, and various identification systems. Uses position-based weights to detect single-digit e… |
| [Modulo-97](checksums/modulo-97.md) | 🎓 Educational Only | Modulo-97 checksum algorithm used in IBAN (International Bank Account Number) validation per ISO 7064. Detects up to 99% of single-digit er… |
| [NMEA-0183](checksums/nmea-0183.md) | 🎓 Educational Only | NMEA 0183 sentence checksum for GPS and marine navigation systems. XOR of all characters between '$' and '*' delimiters. Standard protocol… |
| [NPI](checksums/npi.md) | 🎓 Educational Only | NPI (National Provider Identifier) check digit for US healthcare providers using Luhn algorithm. 10-digit unique identifier required by HIP… |
| [Odd-Parity](checksums/odd-parity.md) | 🎓 Educational Only | Odd parity check ensuring total number of 1 bits is odd Fundamental error detection using XOR operations. |
| [Ones-Complement](checksums/ones-complement.md) | 🎓 Educational Only | Internet protocol checksum using one's complement arithmetic. Sums 16-bit words with end-around carry, then inverts all bits. Used in IP, T… |
| [PLANET](checksums/planet.md) | 🎓 Educational Only | PLANET (Postal Alpha Numeric Encoding Technique) check digit for US Postal Service Confirm Service. 12 or 14 digits for tracking business r… |
| [POSTNET](checksums/postnet.md) | 🎓 Educational Only | POSTNET (Postal Numeric Encoding Technique) check digit for US Postal Service barcodes. Simple modulo-10 sum algorithm for ZIP codes and de… |
| [SEDOL](checksums/sedol.md) | 🎓 Educational Only | SEDOL (Stock Exchange Daily Official List) check digit calculation. 7-character alphanumeric identifier for securities on London Stock Exch… |
| [Sum-16](checksums/sum-16.md) | 🎓 Educational Only | 16-bit summation checksum. Adds all bytes and keeps only the lowest 16 bits (modulo 65536). Better error detection than Sum-8. |
| [Sum-32](checksums/sum-32.md) | 🎓 Educational Only | 32-bit summation checksum. Adds all bytes and keeps only the lowest 32 bits. Good error detection for larger data blocks. |
| [Sum-8](checksums/sum-8.md) | 🎓 Educational Only | Simple 8-bit summation checksum. Adds all bytes and keeps only the lowest 8 bits (modulo 256). Fast and lightweight, commonly used in embed… |
| [SYSV-Checksum](checksums/sysv-checksum.md) | 🎓 Educational Only | Unix System V checksum algorithm used by the 'sum' command. Simple sum of all bytes with modulo 32-bit arithmetic. Historical Unix utility… |
| [Twos-Complement-16](checksums/twos-complement-16.md) | 🎓 Educational Only | 16-bit two's complement checksum. Sums all bytes modulo 65536, then returns two's complement. Better error detection than 8-bit version for… |
| [Twos-Complement-8](checksums/twos-complement-8.md) | 🎓 Educational Only | 8-bit two's complement checksum. Sums all bytes modulo 256, then returns two's complement (negate). Verification: sum of all data bytes plu… |
| [Unix-Sum-BSD](checksums/unix-sum-bsd.md) | — | BSD checksum with circular right rotation providing order-dependent error detection Classic Unix sum(1) algorithm for basic file integrity… |
| [Unix-Sum-SYSV](checksums/unix-sum-sysv.md) | — | SYSV checksum using simple summation with order-independent calculation Classic Unix sum(1) algorithm for basic file integrity verification. |
| [UPC-A](checksums/upc-a.md) | 🎓 Educational Only | UPC-A (Universal Product Code) check digit for North American retail products. 12-digit identifier (11 data + 1 check) using alternating we… |
| [UPC-EAN](checksums/upc-ean.md) | 🎓 Educational Only | UPC/EAN checksum algorithm for product barcodes. Uses alternating weights (3,1,3,1...) from right to left. Used in UPC-A (12 digits), EAN-1… |
| [Verhoeff](checksums/verhoeff.md) | 🎓 Educational Only | Verhoeff algorithm using dihedral group D5 for superior error detection. Detects ALL single-digit errors and ALL adjacent transposition err… |
| [Verhoeff-Check-Digit](checksums/verhoeff-check-digit.md) | 🎓 Educational Only | Verhoeff algorithm using dihedral group D5 for superior error detection Validates identification numbers to detect transcription errors. |
| [VIN](checksums/vin.md) | 🎓 Educational Only | VIN (Vehicle Identification Number) check digit calculation per ISO 3779 and SAE J853. 17-character alphanumeric code using weighted sum mo… |
| [XOR-8](checksums/xor-8.md) | 🎓 Educational Only | Simple XOR-based checksum used in NMEA GPS sentences and serial communication protocols. XORs all input bytes to produce a single-byte erro… |

## Cipher Modes

_Block cipher modes of operation_

| Algorithm | Security | Summary |
| --- | --- | --- |
| [CBC](cipher-modes/cbc.md) | 🛡️ Secure | Cipher Block Chaining mode XORs each plaintext block with the previous ciphertext block before encryption. The first block is XORed with an… |
| [CCM](cipher-modes/ccm.md) | 🛡️ Secure | Counter with CBC-MAC provides authenticated encryption by combining CTR mode encryption with CBC-MAC authentication. Used in IEEE 802.11i,… |
| [CFB](cipher-modes/cfb.md) | 🛡️ Secure | Cipher Feedback mode converts a block cipher into a stream cipher by encrypting the previous ciphertext block (or IV) and XORing the result… |
| [CMC](cipher-modes/cmc.md) | 🧪 Experimental | CMC (Cipher-based Message authentication Code) is a tweakable block cipher mode that provides strong pseudorandom permutation properties. I… |
| [CTR](cipher-modes/ctr.md) | 🛡️ Secure | Counter mode converts a block cipher into a stream cipher by encrypting successive counter values to generate a keystream. Allows parallel… |
| [CTS](cipher-modes/cts.md) | 🛡️ Secure | Ciphertext Stealing (CTS) mode allows block ciphers to handle arbitrary-length plaintexts without padding by 'stealing' ciphertext bits fro… |
| [EAX](cipher-modes/eax.md) | 🛡️ Secure | EAX (Encrypt-then-Authenticate-then-Translate) is an authenticated encryption mode that combines CTR mode encryption with OMAC authenticati… |
| [ECB](cipher-modes/ecb.md) | ❌ Broken | Electronic Codebook mode encrypts each block independently using the underlying block cipher. This is the simplest mode but reveals pattern… |
| [EDE](cipher-modes/ede.md) | 🎓 Educational Only | EDE (Encrypt-Decrypt-Encrypt) mode applies Encrypt-Decrypt-Encrypt operations using the underlying block cipher. Supports both 2-key mode (… |
| [EEE](cipher-modes/eee.md) | 🎓 Educational Only | EEE (Triple Encrypt) mode applies the underlying block cipher three times in encryption mode with three independent keys (K1, K2, K3). This… |
| [EME](cipher-modes/eme.md) | 🧪 Experimental | EME (ECB-Mask-ECB) is a wide-block tweakable cipher mode that can handle variable-length inputs while preserving format. It uses a three-ro… |
| [F8](cipher-modes/f8.md) | 🛡️ Secure | F8 mode (3GPP confidentiality mode) is a stream cipher mode designed for mobile telecommunications. It uses a block cipher with a salt key… |
| [FFX](cipher-modes/ffx.md) | 🧪 Experimental | FFX (Format-Preserving Encryption) is a Feistel-based construction that preserves the format of input data during encryption. It can handle… |
| [FPE](cipher-modes/fpe.md) | 🧪 Experimental | FPE (Format-Preserving Encryption) is a general framework for encryption schemes that preserve the format and structure of input data. It e… |
| [GCM](cipher-modes/gcm.md) | 🛡️ Secure | Galois/Counter Mode provides authenticated encryption by combining CTR mode encryption with GHASH authentication using GF(2^128) arithmetic… |
| [GCM-SIV](cipher-modes/gcm-siv.md) | 🛡️ Secure | GCM-SIV is a nonce-misuse resistant authenticated encryption algorithm that provides both privacy and authenticity even when nonces are rep… |
| [IGE](cipher-modes/ige.md) | 🧪 Experimental | Infinite Garble Extension (IGE) mode uses bidirectional chaining where each block is XORed with both the previous ciphertext and the previo… |
| [KW](cipher-modes/kw.md) | 🛡️ Secure | KW (Key Wrap) is a specialized mode designed specifically for securely wrapping (encrypting) cryptographic keys. It provides both confident… |
| [KWP](cipher-modes/kwp.md) | 🛡️ Secure | KWP (Key Wrap with Padding) extends the standard Key Wrap algorithm to handle arbitrary-length key material by adding padding. It includes… |
| [LRW](cipher-modes/lrw.md) | ⚠️ Deprecated | LRW (Liskov-Rivest-Wagner) is a tweakable block cipher mode designed for disk encryption. It combines a block cipher with Galois field mult… |
| [OCB](cipher-modes/ocb.md) | 🧪 Experimental | OCB (Offset CodeBook) is an authenticated encryption mode that provides both confidentiality and authenticity in a single pass. It uses off… |
| [OCB3](cipher-modes/ocb3.md) | 🛡️ Secure | OCB3 (Offset CodeBook Mode version 3) is a highly efficient authenticated encryption mode that provides both confidentiality and authentici… |
| [OFB](cipher-modes/ofb.md) | 🛡️ Secure | Output Feedback mode converts a block cipher into a stream cipher by encrypting the previous output block (or IV) to generate a keystream.… |
| [PCBC](cipher-modes/pcbc.md) | ⚠️ Deprecated | Propagating Cipher Block Chaining (PCBC) mode is a variant of CBC where the feedback combines both plaintext and ciphertext from the previo… |
| [SIV](cipher-modes/siv.md) | 🛡️ Secure | Synthetic IV (SIV) mode provides deterministic authenticated encryption by first computing an authentication tag (synthetic IV) using S2V,… |
| [XEX](cipher-modes/xex.md) | 🛡️ Secure | XEX (XOR-Encrypt-XOR) is a tweakable block cipher construction that forms the foundation of the XTS disk encryption mode. It uses a simple… |
| [XTS](cipher-modes/xts.md) | 🛡️ Secure | XEX-based Tweaked-codebook mode with ciphertext Stealing is designed for disk encryption. Uses two independent cipher keys (Key1 for encryp… |

## Classical Ciphers

_Historical and educational ciphers_

| Algorithm | Security | Summary |
| --- | --- | --- |
| [Affine Cipher](classical-ciphers/affine-cipher.md) | 🎓 Educational Only | Classical mathematical cipher using linear transformation f(x) = (ax + b) mod 26. Requires coefficient 'a' to be coprime with 26 for revers… |
| [Al-Kindi Frequency Analysis](classical-ciphers/al-kindi-frequency-analysis.md) | 🎓 Educational Only | Historical frequency analysis method developed by Al-Kindi (Alkindus) in 9th century Baghdad. First systematic approach to cryptanalysis us… |
| [Autokey Cipher](classical-ciphers/autokey-cipher.md) | 🎓 Educational Only | Enhanced Vigenère cipher that extends the key using plaintext itself, eliminating periodic key repetition. Uses initial keyword plus plaint… |
| [Bazeries Cylinder Cipher](classical-ciphers/bazeries-cylinder-cipher.md) | 🎓 Educational Only | Mechanical transposition cipher using cylindrical device with rotating disks. Text written horizontally around cylinder then read verticall… |
| [Beaufort Cipher](classical-ciphers/beaufort-cipher.md) | 🎓 Educational Only | Reciprocal polyalphabetic substitution cipher invented by Sir Francis Beaufort. Uses formula C = (K - P) mod 26 where encryption and decryp… |
| [Bifid Cipher](classical-ciphers/bifid-cipher.md) | 🎓 Educational Only | Fractionating cipher invented by Félix Delastelle in 1901. Combines Polybius square with transposition, replacing each letter with two coor… |
| [CADAENUS Cipher](classical-ciphers/cadaenus-cipher.md) | 🎓 Educational Only | Computer Aided Design of Encryption Algorithm - Non Uniform Substitution. Hybrid cipher using position-dependent substitution with multi-st… |
| [Caesar Cipher](classical-ciphers/caesar-cipher.md) | 🎓 Educational Only | Ancient Roman substitution cipher shifting each letter by fixed number of positions in alphabet. Used by Julius Caesar for military communi… |
| [Columnar Transposition](classical-ciphers/columnar-transposition.md) | 🎓 Educational Only | Classical transposition cipher that arranges plaintext in a grid and reads columns in keyword-alphabetical order. Input domain: uppercase A… |
| [Enigma Machine](classical-ciphers/enigma-machine.md) | 🎓 Educational Only | Simplified 3-rotor Enigma machine simulation for educational purposes. Historical WWII cipher machine with rotating mechanical rotors and e… |
| [Four-Square Cipher](classical-ciphers/four-square-cipher.md) | 🎓 Educational Only | Classical polygraphic cipher using four 5x5 squares for digraph encryption, offering enhanced security over simple substitution ciphers. |
| [Gronsfeld Cipher](classical-ciphers/gronsfeld-cipher.md) | 🎓 Educational Only | Polyalphabetic substitution cipher using numeric key instead of letters. Each digit represents Caesar shift value, making it Vigenère varia… |
| [Hill Cipher](classical-ciphers/hill-cipher.md) | 🎓 Educational Only | Classical polygraphic substitution cipher using linear algebra with matrix multiplication modulo 26. Encrypts blocks of letters using matri… |
| [Jefferson Wheel](classical-ciphers/jefferson-wheel.md) | 🎓 Educational Only | Polyalphabetic substitution cipher using rotating wheels with randomly arranged alphabets. Invented by Thomas Jefferson around 1795 as a me… |
| [Nihilist Cipher](classical-ciphers/nihilist-cipher.md) | 🎓 Educational Only | Russian revolutionary cipher combining Polybius square with additive key encryption for historical cryptography study. |
| [Phillips Cipher](classical-ciphers/phillips-cipher.md) | 🎓 Educational Only | 5x5 grid cipher with coordinate system and block transposition for educational cryptography study. |
| [Pigpen](classical-ciphers/pigpen.md) | 🎓 Educational Only | Geometric substitution cipher using tic-tac-toe and X-shaped grids with dots. Also known as Freemason cipher, used by secret societies for… |
| [Playfair Cipher](classical-ciphers/playfair-cipher.md) | 🎓 Educational Only | Classical digraph substitution cipher using 5x5 key grid. Encrypts pairs of letters according to position rules. Invented by Charles Wheats… |
| [Polybius Square](classical-ciphers/polybius-square.md) | 🎓 Educational Only | Ancient coordinate-based cipher system that converts letters to coordinate pairs using a 5×5 grid. Invented by Greek historian Polybius aro… |
| [Porta Cipher](classical-ciphers/porta-cipher.md) | 🎓 Educational Only | Reciprocal polyalphabetic substitution cipher invented by Giovan Battista Bellaso in 1563. Uses 13-row substitution tableau where same oper… |
| [Rail Fence Cipher](classical-ciphers/rail-fence-cipher.md) | 🎓 Educational Only | Classical transposition cipher writing plaintext diagonally on successive rails of imaginary fence, then reading horizontally. Simple zigza… |
| [Scytale Cipher](classical-ciphers/scytale-cipher.md) | 🎓 Educational Only | Ancient Spartan transposition cipher using a staff for military communications in classical antiquity. A scytale reorders the marks on a st… |
| [Solitaire Cipher](classical-ciphers/solitaire-cipher.md) | 🎓 Educational Only | Bruce Schneier's card-based stream cipher designed for manual use without computer assistance from Neal Stephenson's Cryptonomicon. Input d… |
| [Trifid Cipher](classical-ciphers/trifid-cipher.md) | 🎓 Educational Only | Félix Delastelle's three-dimensional fractionating cipher extending the Bifid concept to three dimensions for enhanced security. |
| [Two-Square Cipher](classical-ciphers/two-square-cipher.md) | 🎓 Educational Only | Classical polygraphic substitution cipher using two 5x5 Polybius squares for digraph encryption with enhanced security. |
| [Vigenère Cipher](classical-ciphers/vigen-re-cipher.md) | 🎓 Educational Only | Classical polyalphabetic substitution cipher using repeating keyword to shift letters. Developed by Blaise de Vigenère in 16th century, con… |

## Compression Algorithms

_Data compression algorithms_

| Algorithm | Security | Summary |
| --- | --- | --- |
| [ACE (WinAce)](compression-algorithms/ace-winace.md) | — | WinAce's ACE 1.0 method: an LZ77 matcher over a 32 KiB dictionary feeding two per-block Huffman trees, a 284-symbol main tree of literals,… |
| [Adaptive Huffman (FGK)](compression-algorithms/adaptive-huffman-fgk.md) | — | Faller-Gallager-Knuth dynamic Huffman coding. The code tree adapts after every symbol and no code-length table is transmitted: the decoder… |
| [aPLib](compression-algorithms/aplib.md) | — | Joergen Ibsen's LZSS-based compression library, known for very small and fast decompressors. A 4-byte little-endian length header precedes… |
| [Arithmetic Coding](compression-algorithms/arithmetic-coding.md) | — | Arithmetic coding represents the entire message as a single fraction in the range [0,1) using probability models. Unlike prefix codes, achi… |
| [ARJ](compression-algorithms/arj.md) | — | ARJ method 1: LZSS matching over a 26624-byte window with match lengths 3 to 256, feeding a 510-symbol literal/length Huffman tree and a 17… |
| [BALZ](compression-algorithms/balz.md) | — | ROLZ (reduced-offset Lempel-Ziv) compressor by Ilya Muravyov: matches are drawn from a 64-entry table selected by the previous byte, so onl… |
| [BCJ ARM](compression-algorithms/bcj-arm.md) | — | Branch/Call/Jump filter for 32-bit ARM (A32) machine code. Detects BL (Branch with Link) instructions, identified by the 0xEB opcode byte,… |
| [BCJ ARM-Thumb](compression-algorithms/bcj-arm-thumb.md) | — | Branch/Call/Jump filter for 16-bit ARM Thumb (T32) machine code. Detects the two-halfword BL (Branch with Link) instruction, identified by… |
| [BCJ ARM64](compression-algorithms/bcj-arm64.md) | — | Branch/Call/Jump filter for AArch64 (ARM64) machine code. Detects BL instructions (top 6 bits equal to 100101) and ADRP instructions (bits… |
| [BCJ IA-64](compression-algorithms/bcj-ia-64.md) | — | Branch/Call/Jump filter for Itanium (IA-64) machine code. Scans 16-byte instruction bundles, uses the 5-bit template field to find slots ho… |
| [BCJ PowerPC](compression-algorithms/bcj-powerpc.md) | — | Branch/Call/Jump filter for big-endian PowerPC machine code. Detects B/BL (Branch, Branch with Link) instructions, identified by opcode 18… |
| [BCJ RISC-V](compression-algorithms/bcj-risc-v.md) | — | Branch/Call/Jump filter for RISC-V machine code. Rewrites JAL (Jump and Link) instructions with rd = ra or rd = t0, and AUIPC-led pc-relati… |
| [BCJ SPARC](compression-algorithms/bcj-sparc.md) | — | Branch/Call/Jump filter for big-endian SPARC machine code. Detects CALL instructions, identified by their top two format bits equal to 01,… |
| [BCJ x86](compression-algorithms/bcj-x86.md) | — | Branch/Call/Jump filter for 32/64-bit x86 machine code. Scans for CALL (0xE8) and JMP (0xE9) opcodes and rewrites their 32-bit little-endia… |
| [BCM (Block Context Mixing)](compression-algorithms/bcm-block-context-mixing.md) | 🎓 Educational Only | Burrows-Wheeler Transform with a compact order-0..2 context-mixing back end, BCM-style. Ported to be byte-for-byte identical to Compression… |
| [BriefLZ](compression-algorithms/brieflz.md) | — | Byte-for-byte port of CompressionWorkbench's clean-room BriefLZ building block: byte-oriented LZ77 with a single tag bit per token (0=liter… |
| [Brotli](compression-algorithms/brotli.md) | 🎓 Educational Only | RFC 7932-compatible Brotli codec. The decoder implements the full RFC 7932 bitstream grammar (meta-block framing, complex/simple prefix cod… |
| [BSC (Block Sorting Compression)](compression-algorithms/bsc-block-sorting-compression.md) | 🎓 Educational Only | Burrows-Wheeler Transform, Move-to-Front recoding, and an LZMA-style adaptive bit-tree entropy stage (two trees selected by whether the pre… |
| [BWT (Burrows-Wheeler Transform)](compression-algorithms/bwt-burrows-wheeler-transform.md) | — | Reversible data transformation that rearranges string characters to improve performance of other compression techniques. Used as preprocess… |
| [BWT-Advanced (Enhanced Burrows-Wheeler Transform)](compression-algorithms/bwt-advanced-enhanced-burrows-wheeler-transform.md) | 🎓 Educational Only | Advanced block-sorting compression using enhanced Burrows-Wheeler Transform with optimal suffix array construction, intelligent post-proces… |
| [Byte-Pair Encoding (BPE)](compression-algorithms/byte-pair-encoding-bpe.md) | — | Iteratively replaces the most frequently occurring byte pairs with unused byte values. Simple greedy approach that can achieve good compres… |
| [BZIP2](compression-algorithms/bzip2.md) | 🎓 Educational Only | Block-sorting compression using Burrows-Wheeler Transform, Move-to-Front coding, Run-Length Encoding, and Huffman coding. Both compression… |
| [CMIX](compression-algorithms/cmix.md) | 🎓 Educational Only | Reduced context-mixing model set (hashed orders 0,1,2,3,4,6 plus a word context and a match model, mixed by one logistic-domain mixer with… |
| [Context Predictor (order-2/1/0)](compression-algorithms/context-predictor-order-2-1-0.md) | 🎓 Educational Only | Most-frequent-symbol predictor over an order-2/1/0 byte context hierarchy with a hit/miss bitmap. Not the Context Tree Weighting (CTW) meth… |
| [Context Tree Weighting (Willems)](compression-algorithms/context-tree-weighting-willems.md) | 🎓 Educational Only | Genuine Context Tree Weighting (Willems/Shtarkov/Tjalkens): a depth-16 binary context tree with a Krichevsky-Trofimov estimator per node, r… |
| [Crush](compression-algorithms/crush.md) | — | Fast LZ77 coder by Ilya Muravyov. Every token carries a single tag bit; matches add an Elias-gamma coded length and a fixed 16-bit offset.… |
| [CSC (Context Sorting Compression)](compression-algorithms/csc-context-sorting-compression.md) | 🎓 Educational Only | LZ77 parsing (hash-chain match finder, 32 KiB window, 3-258 byte matches) whose flag/literal/length/distance channels are entropy-coded wit… |
| [DEFLATE](compression-algorithms/deflate.md) | — | Industry-standard lossless compression combining LZ77 and Huffman coding. Used in ZIP, gzip, PNG, and HTTP compression. Full RFC 1951 imple… |
| [Deflate64](compression-algorithms/deflate64.md) | — | Enhanced DEFLATE (ZIP compression method 9) with a 64KB sliding window, distance codes up to 65536, and a 16-bit extended length code reach… |
| [Delta + RLE](compression-algorithms/delta-plus-rle.md) | — | Difference-based transform (stores differences between consecutive values) followed by run-length encoding of the delta stream, so unlike t… |
| [Delta Filter](compression-algorithms/delta-filter.md) | — | Pure, size-preserving delta transform: each byte is stored as the difference from the byte a fixed distance behind it (distance=1 here), wi… |
| [Density (Chameleon)](compression-algorithms/density-chameleon.md) | — | Predictive 4-byte-chunk dictionary coder: a hash of the previous chunk predicts the next one, and a correct prediction costs zero payload b… |
| [DMC](compression-algorithms/dmc.md) | — | Dynamic Markov Compression. Predicts each bit with an adaptive finite-state Markov model (a binary tree that grows by cloning states shared… |
| [DNA Sequence Compression](compression-algorithms/dna-sequence-compression.md) | 🎓 Educational Only | 2-bit packing for the four canonical DNA nucleotide symbols (A, C, G, T), four symbols per byte, giving 4:1 on pure nucleotide data. Bytes… |
| [DoubleSpace](compression-algorithms/doublespace.md) | — | MS-DOS 6.0/6.2 real-time disk compression codec (DBLSPACE.BIN, SVDC cluster format). Sliding-window LZ77 with a 4KB window, a 2-bit length… |
| [DoubleSpace/DriveSpace LZ77](compression-algorithms/doublespace-drivespace-lz77.md) | — | Microsoft DoubleSpace/DriveSpace LZ77 grammar as a standalone building block: variable-bit length and distance codes over a 4KB sliding win… |
| [DPCM](compression-algorithms/dpcm.md) | — | Differential Pulse-Code Modulation, an order-1 predictive transform that stores each sample as its difference (modulo 256) from the immedia… |
| [DriveSpace](compression-algorithms/drivespace.md) | — | MS-DOS 6.21/6.22 real-time disk compression codec (DRVSPACE.BIN, JM cluster format). Sliding-window LZ77 sharing DoubleSpace's token gramma… |
| [DS-LZ77](compression-algorithms/ds-lz77.md) | — | LZSS variant used by the Game Boy Advance and Nintendo DS BIOS decompression routines (type 0x10 header). Flag bytes select between literal… |
| [Elias Delta Coding](compression-algorithms/elias-delta-coding.md) | 🎓 Educational Only | Peter Elias improved universal integer encoding, more efficient than Gamma for larger numbers using variable-length prefix codes. |
| [Elias Gamma Coding](compression-algorithms/elias-gamma-coding.md) | 🎓 Educational Only | Peter Elias universal integer encoding optimal for geometric distributions where small values are more frequent. |
| [Exp-Golomb](compression-algorithms/exp-golomb.md) | — | Exponential-Golomb coding, the universal variable-length integer code used for syntax elements in the H.264/AVC and H.265/HEVC video standa… |
| [FastLZ](compression-algorithms/fastlz.md) | — | Portable byte-aligned LZ77 compression optimized for speed. Features two compression levels: Level 1 (8KB window, ultra-fast) and Level 2 (… |
| [Fibonacci Coding](compression-algorithms/fibonacci-coding.md) | — | Universal integer encoding using Fibonacci number representation. Each number is represented as a sum of non-consecutive Fibonacci numbers,… |
| [FSE](compression-algorithms/fse.md) | 🎓 Educational Only | Finite State Entropy encoding using tANS (tabled Asymmetric Numeral Systems). Achieves near-optimal compression like arithmetic coding but… |
| [Golomb](compression-algorithms/golomb.md) | — | Golomb coding is a lossless data compression method using prefix codes optimized for geometric distributions. Rice coding (power-of-2 param… |
| [Golomb-BitStream](compression-algorithms/golomb-bitstream.md) | — | Enhanced Golomb coding using OpCodes.BitStream for optimal prefix coding of geometric distributions. Demonstrates advanced bit-level operat… |
| [Huffman](compression-algorithms/huffman.md) | — | Lossless data compression using optimal prefix codes based on symbol frequencies. Developed by David Huffman in 1952 for minimum-redundancy… |
| [IBM 842](compression-algorithms/ibm-842.md) | — | Fixed-block dictionary compression built for IBM POWER hardware accelerators. Encodes data in 8-byte chunks as a template opcode selecting… |
| [Implode](compression-algorithms/implode.md) | — | PKWARE DCL/ZIP method 6 (Imploding): an 8K sliding-dictionary LZ77 matcher (minimum match length 3) whose literal, length, and distance-hig… |
| [Levenshtein Coding](compression-algorithms/levenshtein-coding.md) | — | Universal prefix code for non-negative integers. Recursively encodes the bit-length of the bit-length (an iterated-logarithm chain) termina… |
| [Lizard](compression-algorithms/lizard.md) | — | Efficient compressor with very fast decompression and compression ratios comparable to zip/zlib at fast decompression speed. Successor to L… |
| [LZ4](compression-algorithms/lz4.md) | — | Lossless compression algorithm focused on compression and decompression speed. Uses byte-oriented encoding with tokens for literals and mat… |
| [LZ4 Frame](compression-algorithms/lz4-frame.md) | — | LZ4 frame format with content size, checksums and multi-block support. Wraps LZ4 compressed blocks in the interchange container defined by… |
| [LZ77](compression-algorithms/lz77.md) | — | Dictionary-based compression using sliding window technique. Encodes data as a flat, self-describing stream of literal/match tokens (1 flag… |
| [LZ77-Optimal](compression-algorithms/lz77-optimal.md) | — | LZ77 with cost-based optimal (shortest-path) parsing. Keeps the flat literal/match token stream of plain LZ77 but chooses the parse by a fo… |
| [LZ78 Dictionary Building](compression-algorithms/lz78-dictionary-building.md) | 🎓 Educational Only | Lempel-Ziv 1978 algorithm builds dictionary of phrases during compression, providing universal compression without sliding window. |
| [LZAP](compression-algorithms/lzap.md) | — | Lempel-Ziv All Prefixes, a derivative of LZMW: after coding a match the dictionary gains the previous match concatenated with every prefix… |
| [LZAV](compression-algorithms/lzav.md) | 🎓 Educational Only | Fast general-purpose in-memory LZ77 compression algorithm. Achieves 480-600 MB/s compression and 2800-3800 MB/s decompression with better r… |
| [LZF](compression-algorithms/lzf.md) | — | Original Lempel-Ziv-Free compression by Marc Lehmann. Extremely fast compression algorithm optimized for speed with minimal memory overhead… |
| [LZFSE](compression-algorithms/lzfse.md) | 🎓 Educational Only | Apple's Lempel-Ziv Finite State Entropy compression algorithm. Splits the LZ77 parse into literal/length/distance streams and entropy-codes… |
| [LZFX](compression-algorithms/lzfx.md) | — | Improved LZF variant with better compression ratios while maintaining high speed. Uses hash-based LZ77 matching with 13-bit offset encoding… |
| [LZG](compression-algorithms/lzg.md) | — | Minimal LZ77-based compression with a deliberately tiny decoder. Literals pass through untouched; the escape byte 0xFF introduces either an… |
| [LZH](compression-algorithms/lzh.md) | — | LHA/LHarc -lh5- method: LZSS matching over an 8 KiB window feeding two per-block Huffman trees, a 510-symbol literal/length tree whose code… |
| [LZHAM](compression-algorithms/lzham.md) | 🎓 Educational Only | LZ77 parsing over 32 KB hash chains (matches of 3 to 258 bytes, at most 64 chain probes) with the literal/length and distance alphabets cod… |
| [LZJB](compression-algorithms/lzjb.md) | — | Fast lossless compression algorithm designed for ZFS filesystem. Simple LZ77 variant with fixed 1024-byte sliding window and 3-byte minimum… |
| [LZMA](compression-algorithms/lzma.md) | — | Lempel-Ziv-Markov chain Algorithm. Dictionary compression combining hash-chain match finding with an adaptive binary range coder and contex… |
| [LZMAT](compression-algorithms/lzmat.md) | — | Real-time compression using match tables instead of hash chains. Developed by Vitaly Evseenko, LZMAT balances fast compression/decompressio… |
| [LZMS](compression-algorithms/lzms.md) | — | Microsoft's LZ77 compression format, introduced with Windows 8 for the WIM (Windows Imaging Format) archiver and msdelta, succeeding LZX/Xp… |
| [LZMW](compression-algorithms/lzmw.md) | — | Miller-Wegman variant of LZW: instead of adding the previous match plus one character, the dictionary gains the concatenation of the previo… |
| [LZO](compression-algorithms/lzo.md) | — | Lempel-Ziv-Oberhumer compression algorithm. A fast compression library emphasizing decompression speed over compression ratio. |
| [LZP](compression-algorithms/lzp.md) | — | Dictionary compression with context-based prediction using hash tables. Combines PPM-style context modeling with LZ77-style string matching… |
| [LZRLE](compression-algorithms/lzrle.md) | — | LZO-RLE compression combining LZ77 dictionary-based compression with run-length encoding for zero sequences. Default zram compressor in Lin… |
| [LZRW1](compression-algorithms/lzrw1.md) | — | Extremely fast LZ77-based compression algorithm with hash table dictionary matching. Uses control bytes for 16-item groups to indicate lite… |
| [LZRW3](compression-algorithms/lzrw3.md) | — | Improved LZ77-based compression using hash table index encoding instead of offsets. Better compression than LZRW1 (50% vs 55%) with persist… |
| [LZS](compression-algorithms/lzs.md) | — | Stac Lempel-Ziv-Stac compression as specified for PPP by RFC 1974. A continuous MSB-first bit stream mixes 8-bit literals with back-referen… |
| [LZSS](compression-algorithms/lzss.md) | — | Lempel-Ziv-Storer-Szymanski compression algorithm. An improved variant of LZ77 that omits short matches and uses bit flags to distinguish l… |
| [LZTURBO](compression-algorithms/lzturbo.md) | 🎓 Educational Only | Fast hash-matched LZ77 front end wrapped in a magic/method/length block, modelling LZTURBO's documented outer shape. LZTURBO's real bitstre… |
| [LZVN](compression-algorithms/lzvn.md) | 🎓 Educational Only | Byte-oriented opcode LZ77 in the spirit of Apple's fast LZVN codec, with tiered distance encoding. Follows LZVN's documented single-byte-op… |
| [LZW (Lempel-Ziv-Welch)](compression-algorithms/lzw-lempel-ziv-welch.md) | — | Dictionary-based compression algorithm that builds a table of frequently occurring strings, starting from a dictionary of all single bytes… |
| [LZWL](compression-algorithms/lzwl.md) | — | LZW whose initial dictionary is seeded with the input's most frequent byte digrams (found via an up-front frequency analysis), so common by… |
| [LZX](compression-algorithms/lzx.md) | — | Microsoft's Lempel-Ziv Extended codec used in CAB, CHM and WIM. LZ77 over a 32 KiB window feeding a main tree of literals plus position-slo… |
| [MCM](compression-algorithms/mcm.md) | 🎓 Educational Only | Two-level context-mixing network: local (orders 0-2), medium (orders 3-4) and wide (order 6 + sparse skip-1) model groups, each mixed by th… |
| [Move-to-Front (MTF)](compression-algorithms/move-to-front-mtf.md) | 🎓 Educational Only | Data transformation algorithm that restructures data for better compressibility by moving recently seen symbols to the front of the alphabe… |
| [MS-LZH](compression-algorithms/ms-lzh.md) | — | Microsoft DriveSpace 3 codec: LZ77 over a 4 KiB window feeding a DEFLATE-shaped alphabet of 286 literal/length symbols and 30 distance symb… |
| [Neural Network Compression (Educational)](compression-algorithms/neural-network-compression-educational.md) | 🎓 Educational Only | Online-trained two-layer neural predictor (backprop through a tanh hidden layer) driving a binary arithmetic coder, NNCP-style. The network… |
| [NRV2D](compression-algorithms/nrv2d.md) | — | UCL library "Not Really Vanished" LZ77 variant 2D. Bit-tagged literal/match stream with an exponential-Golomb offset (with single-symbol re… |
| [NRV2E](compression-algorithms/nrv2e.md) | — | UCL library "Not Really Vanished" LZ77 variant 2E. Bit-tagged literal/match stream with an exponential-Golomb offset (with single-symbol re… |
| [Omega Coding](compression-algorithms/omega-coding.md) | 🎓 Educational Only | Universal code for positive integers with self-delimiting property. Efficient encoding scheme for integers with unknown probability distrib… |
| [PackBits RLE](compression-algorithms/packbits-rle.md) | — | Classic run-length encoding algorithm used in TIFF images, PostScript, and early Apple computer systems. Simple but effective for data with… |
| [PAQ (Context Mixing)](compression-algorithms/paq-context-mixing.md) | 🎓 Educational Only | Reduced lpaq-style context-mixing primitive: six hashed bit models over byte orders 0, 1, 2, 3, 4 and 6, blended by a single logistic-domai… |
| [PAQ8hp (High Performance)](compression-algorithms/paq8hp-high-performance.md) | 🎓 Educational Only | Reduced context-mixing model set (hashed orders 0,1,2,3,4,6 plus a match model, combined with PAQ8-style context-selected mixing - 16 weigh… |
| [Pithy](compression-algorithms/pithy.md) | — | Fast LZ77-based compression library by John Engelhart, inspired by Google's Snappy but with incompatible format. Uses hash-based match find… |
| [PPM (Prediction by Partial Matching)](compression-algorithms/ppm-prediction-by-partial-matching.md) | — | Order-3 finite-context model with escape method C and full exclusion, driving a Witten-Neal-Cleary arithmetic coder. Each byte is coded fro… |
| [PPMd (PPM with Dynamic Memory)](compression-algorithms/ppmd-ppm-with-dynamic-memory.md) | 🎓 Educational Only | Context trie with Method D escape estimation (escape frequency = number of distinct symbols observed), periodic rescaling, exclusion of alr… |
| [Quantum](compression-algorithms/quantum.md) | — | LZ77 dictionary matching combined with an adaptive arithmetic coder; the compression method Microsoft licensed from David Stafford's Quantu… |
| [QuickLZ](compression-algorithms/quicklz.md) | — | Fast compression algorithm optimized for speed (150-300 MB/s). Uses hash-based LZ77 with control words and optimized match encoding. Level… |
| [Range Coding](compression-algorithms/range-coding.md) | — | Entropy coding method that assigns codewords to symbols based on their probability distributions. More general and efficient than arithmeti… |
| [rANS (Range Asymmetric Numeral Systems)](compression-algorithms/rans-range-asymmetric-numeral-systems.md) | 🎓 Educational Only | Advanced entropy coding using range-based asymmetric numeral systems for optimal compression efficiency. Provides arithmetic coding quality… |
| [RAR3 (classic)](compression-algorithms/rar3-classic.md) | — | The classic RAR method of RAR 3.x and 4.x: LZ77 matching over a 4 MiB dictionary with four repeat-offset slots, coded through four Huffman… |
| [RAR5](compression-algorithms/rar5.md) | — | Block compression stage of the RAR 5.0 archive format: LZ77 over a 128KB dictionary whose literals, match-length slots, distance slots and… |
| [Reduce](compression-algorithms/reduce.md) | — | PKZIP methods 2-5 (Reducing): a DLE-escaped LZ77 pre-pass (factor-controlled length/distance bit split) followed by a static, frequency-ran… |
| [RePair](compression-algorithms/repair.md) | — | Recursive pairing grammar compression. Repeatedly replaces the most frequent adjacent symbol pair with a new grammar rule until no pair rep… |
| [RLE](compression-algorithms/rle.md) | — | Simple compression algorithm that replaces consecutive identical bytes with a count-value pair. Most effective on data with long runs of re… |
| [ROLZ (Reduced Offset LZ)](compression-algorithms/rolz-reduced-offset-lz.md) | 🎓 Educational Only | Context-aware dictionary compression using reduced offset sets. Combines LZ77 dictionary matching with context modeling to reduce active of… |
| [RZIP](compression-algorithms/rzip.md) | — | Long-range redundancy-elimination compressor that indexes the entire input with a rolling hash so LZ77-style (offset,length) matches can be… |
| [Salvador](compression-algorithms/salvador.md) | — | Emmanuel Marty's high-speed optimal parser for the ZX0 compressed format. Shares ZX0's three-block LZ77 grammar (literal, last-offset match… |
| [Sequitur](compression-algorithms/sequitur.md) | — | Online grammar inference by Nevill-Manning and Witten: as each symbol is appended the algorithm enforces digram uniqueness (no adjacent pai… |
| [Shannon-Fano Coding](compression-algorithms/shannon-fano-coding.md) | 🎓 Educational Only | Variable-length prefix-free coding algorithm that predates Huffman coding. Divides symbols recursively by frequency to create binary codes,… |
| [Shoco](compression-algorithms/shoco.md) | — | Short string compression optimized for English text using a trained character alphabet and successor-rank prediction, packed via Shoco's re… |
| [Shrink](compression-algorithms/shrink.md) | — | PKZIP method 1 (Shrinking): dynamic LZW coding with encoder-controlled variable code width (9-13 bits) and partial dictionary clearing, whi… |
| [Simplified Deflate (Fixed Huffman)](compression-algorithms/simplified-deflate-fixed-huffman.md) | 🎓 Educational Only | Raw RFC 1951 DEFLATE restricted to fixed-Huffman blocks. The encoder emits a single BFINAL=1, BTYPE=01 block over the fixed literal/length… |
| [Snappy](compression-algorithms/snappy.md) | — | Fast LZ77-based compression algorithm developed by Google in 2011. Optimizes for speed over compression ratio with typical compression spee… |
| [SQX](compression-algorithms/sqx.md) | — | The SQX archiver's LZH method: an LZ77 matcher over a 32 KiB dictionary feeding a 310-symbol main tree that folds literals, four repeated-d… |
| [Suffix Tree Compression](compression-algorithms/suffix-tree-compression.md) | 🎓 Educational Only | Advanced lossless compression using suffix tree construction and longest common substring analysis. Exploits repetitive structure through e… |
| [tANS (Table-based Asymmetric Numeral Systems)](compression-algorithms/tans-table-based-asymmetric-numeral-systems.md) | 🎓 Educational Only | Table-driven ANS entropy coder over a 2048-state table. Symbols are spread with Duda's precise initialization (slots ranked by the keys (2k… |
| [Tunstall Coding](compression-algorithms/tunstall-coding.md) | — | Variable-to-fixed length source code. Builds a byte-alphabet dictionary by repeatedly splitting the highest-probability phrase into its 256… |
| [uABS (Binary Asymmetric Numeral Systems)](compression-algorithms/uabs-binary-asymmetric-numeral-systems.md) | 🎓 Educational Only | Binary variant of Asymmetric Numeral Systems. Each bit of the message is coded with the uABS transition pair against a 24-bit state that re… |
| [UCL (NRV2B)](compression-algorithms/ucl-nrv2b.md) | 🎓 Educational Only | Universal Compression Library implementing NRV2B algorithm. LZ77-based compression with a bit-packed 32-bit little-endian stream, offering… |
| [Unary Coding](compression-algorithms/unary-coding.md) | — | Universal integer coding where number n is represented by n-1 ones followed by a zero. Simple but inefficient for large numbers, mainly use… |
| [Xpress](compression-algorithms/xpress.md) | — | Microsoft's LZ77+Huffman compression algorithm ([MS-XCA]), used in WIM images, NTFS, and Hyper-V. Splits data into 64KB chunks, each with i… |
| [XZ/LZMA2](compression-algorithms/xz-lzma2.md) | 🎓 Educational Only | Genuine .xz container (stream header/block/index/footer, CRC32/CRC64) wrapping a real LZMA1 range encoder/decoder pair through real LZMA2 c… |
| [Zling](compression-algorithms/zling.md) | — | LZ77 dictionary matching followed by canonical Huffman entropy coding, after Zhang Li's libzling. A bounded hash-chain parser emits flag-by… |
| [Zopfli](compression-algorithms/zopfli.md) | — | Iterative-optimal DEFLATE encoder from Google (2013). Parses the input by shortest path over the entropy of the previous parse's symbol cou… |
| [ZPAQ (Context Mixing)](compression-algorithms/zpaq-context-mixing.md) | 🎓 Educational Only | The context-mixing compressor at the heart of ZPAQ: four direct context models over hashed orders 1 to 4 predict each bit of the message, t… |
| [Zstandard](compression-algorithms/zstandard.md) | — | Zstandard (Zstd), RFC 8878. Encoder performs genuine LZ77 compression: a hash-chain match finder produces sequences that are FSE-coded (Pre… |
| [ZX0](compression-algorithms/zx0.md) | — | LZ77 compressor for 8-bit targets designed by Einar Saukas. Uses only three block types (literal, last-offset match, new-offset match) dist… |

## Encoding Schemes

_Data encoding and representation_

| Algorithm | Security | Summary |
| --- | --- | --- |
| [Atbash Cipher](encoding-schemes/atbash-cipher.md) | 🎓 Educational Only | Ancient Hebrew substitution cipher that reverses the alphabet. Maps each letter to its opposite position (A↔Z, B↔Y, etc.). Simple monoalpha… |
| [Base16](encoding-schemes/base16.md) | 🎓 Educational Only | Base16 (hexadecimal) encoding using 16-character alphabet to represent binary data. Each byte is represented by two hex digits (0-9, A-F).… |
| [Base32](encoding-schemes/base32.md) | 🎓 Educational Only | Base32 encoding scheme using 32-character alphabet for case-insensitive encoding. More human-readable than Base64 and commonly used in auth… |
| [Base58](encoding-schemes/base58.md) | 🎓 Educational Only | Base58 encoding scheme using 58-character alphabet that excludes visually similar characters (0, O, I, l). Created by Satoshi Nakamoto for… |
| [Base62](encoding-schemes/base62.md) | 🎓 Educational Only | Base62 encoding using 62-character alphabet (A-Z, a-z, 0-9) for URL-safe, compact encoding. Commonly used in URL shortening services like b… |
| [Base64](encoding-schemes/base64.md) | 🎓 Educational Only | Base64 encoding scheme using 64-character alphabet to represent binary data in ASCII string format. Commonly used for email attachments, da… |
| [Base85](encoding-schemes/base85.md) | 🎓 Educational Only | Base85 encoding using the RFC 1924 85-character alphabet (digits, then upper/lowercase letters, then symbols) for efficient binary-to-text… |
| [Base91](encoding-schemes/base91.md) | 🎓 Educational Only | Base91 (basE91) encoding using 91-character alphabet for efficient binary-to-text encoding. Achieves only 23% overhead compared to Base64's… |
| [Baudot Code (ITA2)](encoding-schemes/baudot-code-ita2.md) | 🎓 Educational Only | 5-bit character encoding used in early teleprinters and telegraph systems. Uses two modes (LETTERS and FIGURES) selected by special shift c… |
| [BinHex 4.0 (Macintosh)](encoding-schemes/binhex-4-0-macintosh.md) | 🎓 Educational Only | Binary-to-text encoding system used on classic Mac OS for sending binary files over email. Includes run-length encoding and CRC protection… |
| [BubbleBabble Encoding](encoding-schemes/bubblebabble-encoding.md) | 🎓 Educational Only | Binary-to-text encoding scheme that produces pronounceable words, commonly used for SSH fingerprints. Creates human-readable representation… |
| [Koremutake Encoding](encoding-schemes/koremutake-encoding.md) | 🎓 Educational Only | Memorable phonetic string encoding system that converts large numbers into pronounceable words using consonant-vowel patterns. Designed to… |
| [Manchester Encoding](encoding-schemes/manchester-encoding.md) | 🎓 Educational Only | Line code in which each data bit is represented by at least one transition. Combines clock and data signals and is self-synchronizing. Used… |
| [Morse Code (International)](encoding-schemes/morse-code-international.md) | 🎓 Educational Only | Method of transmitting text information as a series of on-off tones, lights, or clicks using standardized sequences of short and long signa… |
| [PEM (Privacy-Enhanced Mail)](encoding-schemes/pem-privacy-enhanced-mail.md) | 🎓 Educational Only | Text encoding format for cryptographic objects like certificates and keys. Uses Base64 encoding wrapped with header and footer lines for em… |
| [ROT](encoding-schemes/rot.md) | 🎓 Educational Only | ROT (rotate) character substitution cipher that shifts characters by a fixed offset. ROT13 shifts letters by 13 positions, ROT47 shifts pri… |
| [UUencode](encoding-schemes/uuencode.md) | 🎓 Educational Only | UUencoding (Unix-to-Unix encoding) binary-to-text encoding developed by Mary Ann Horton at UC Berkeley in 1980. Encodes 3 bytes into 4 char… |
| [XXencoding](encoding-schemes/xxencoding.md) | 🎓 Educational Only | Binary-to-text encoding similar to UUencoding but uses a different character set designed to avoid problematic characters in some communica… |
| [yEnc (Usenet Binary Encoding)](encoding-schemes/yenc-usenet-binary-encoding.md) | 🎓 Educational Only | Binary-to-text encoding scheme developed by Jürgen Helbing for Usenet newsgroup postings. More efficient than UUEncoding and Base64 for bin… |
| [Z85 (ZeroMQ Base85)](encoding-schemes/z85-zeromq-base85.md) | 🎓 Educational Only | Variant of Base85 encoding developed for ZeroMQ that provides more efficient binary-to-text encoding than Base64. Uses 85 printable ASCII c… |

## Error Correction

_Error correction codes_

| Algorithm | Security | Summary |
| --- | --- | --- |
| [2D Parity Code](error-correction/2d-parity-code.md) | 🎓 Educational Only | Two-dimensional parity check code arranging data in rectangular grid with row and column parity bits. Can correct single-bit errors and det… |
| [Alamouti Space-Time Block Code](error-correction/alamouti-space-time-block-code.md) | 🎓 Educational Only | First space-time block code for 2 transmit antennas. Achieves full transmit diversity with simple linear decoding. Used in 3G, 4G LTE, WiFi… |
| [Algebraic Geometry Code](error-correction/algebraic-geometry-code.md) | 🎓 Educational Only | Evaluation AG codes constructed from algebraic curves over finite fields via the Goppa construction. First codes to exceed the Gilbert-Vars… |
| [Bacon-Shor Code](error-correction/bacon-shor-code.md) | 🧪 Experimental | Subsystem quantum error correction code combining Shor's 9-qubit code concepts with gauge freedom. [[9,1,3]] configuration encodes 1 logica… |
| [Balanced Constant Weight Code](error-correction/balanced-constant-weight-code.md) | 🎓 Educational Only | All codewords have same Hamming weight (constant number of 1s). Parameters A(n,d,w) denote maximum codewords of length n, minimum distance… |
| [BATS](error-correction/bats.md) | 🎓 Educational Only | Batched Sparse (BATS) Codes combine network coding with batching for efficient multicast in lossy networks. Inner code applies random linea… |
| [BCH](error-correction/bch.md) | 🎓 Educational Only | Bose-Chaudhuri-Hocquenghem (BCH) error correction codes using Galois Field arithmetic. Can detect and correct multiple random errors in tra… |
| [BCH Code](error-correction/bch-code.md) | 🎓 Educational Only | Bose-Chaudhuri-Hocquenghem cyclic error-correcting codes constructed using polynomials over Galois fields. Can correct multiple random erro… |
| [Berger Code](error-correction/berger-code.md) | 🎓 Educational Only | Optimal unidirectional error detection code that detects all errors where bits flip in only one direction (all 0→1 or all 1→0). Encodes dat… |
| [Bicycle Code](error-correction/bicycle-code.md) | 🧪 Experimental | Quantum LDPC code using bicycle graph construction with circulant matrices. Stabilizer generator matrix has structure H_X = H_Z = (A\|A^T) w… |
| [Biorthogonal Code](error-correction/biorthogonal-code.md) | 🎓 Educational Only | Extension of first-order Reed-Muller codes including complements of all codewords. Parameters [2^m, m+1, 2^(m-1)] where extra bit selects b… |
| [Cat Code](error-correction/cat-code.md) | 🧪 Experimental | Bosonic quantum error correction using superpositions of coherent states (cat states) in cavity modes. Encodes qubit as \|0⟩ = (\|α⟩+\|-α⟩)/N… |
| [Concatenated Code](error-correction/concatenated-code.md) | 🎓 Educational Only | Powerful error correction combining inner and outer codes. Outer code (e.g., Reed-Solomon) protects against burst errors, inner code (e.g.,… |
| [Convolutional Code (Viterbi)](error-correction/convolutional-code-viterbi.md) | 🎓 Educational Only | Convolutional encoder with Viterbi maximum likelihood decoder. Uses constraint length K=3, rate 1/2 with generator polynomials (7,5) octal.… |
| [Cortex Code](error-correction/cortex-code.md) | 🧪 Experimental | Hierarchical sparse code inspired by neural network connectivity patterns. Uses multi-layer structure with sparse connections between layer… |
| [CSS Quantum Code](error-correction/css-quantum-code.md) | 🎓 Educational Only | Quantum stabilizer code constructed from two classical linear codes C1 and C2 where the dual of C2 is a subset of C1. Corrects quantum erro… |
| [DNA Storage Code](error-correction/dna-storage-code.md) | 🧪 Experimental | Error correction codes for DNA data storage using quaternary alphabet {A,C,G,T}. Implements Reed-Solomon over GF(4) with GC-content balanci… |
| [Dual Hamming Code](error-correction/dual-hamming-code.md) | 🎓 Educational Only | Dual code of Hamming (7,4) yielding Simplex (7,3) code. Generator matrix of dual is parity-check matrix of original. All non-zero codewords… |
| [Even Weight Code](error-correction/even-weight-code.md) | 🎓 Educational Only | Code where all codewords have even Hamming weight (even number of 1s). Equivalent to single parity check code. Parameters (n, n-1, 2) with… |
| [Expander Code](error-correction/expander-code.md) | 🎓 Educational Only | Linear error-correcting codes based on expander graphs with strong connectivity properties. Used in modern LDPC constructions, polar codes,… |
| [Extended Golay Code](error-correction/extended-golay-code.md) | 🎓 Educational Only | Perfect binary (24,12,8) linear code that can correct up to 3 errors or detect up to 4 errors. One of only two non-trivial perfect binary c… |
| [Extended Self-Dual Code](error-correction/extended-self-dual-code.md) | 🎓 Educational Only | Extended Hamming [8,4,4] code that is self-dual (C = C⊥). Type II doubly-even self-dual code where all codewords have weight divisible by 4… |
| [Fire Code](error-correction/fire-code.md) | 🎓 Educational Only | Burst error correction code using cyclic polynomial structure. Can correct single burst errors up to length b. Generator polynomial G(x) =… |
| [Folded Reed-Solomon](error-correction/folded-reed-solomon.md) | 🧪 Experimental | Reed-Solomon codes with folding transformation achieving list-decoding capacity. Bundles consecutive symbols into super-symbols for improve… |
| [Gabidulin Code](error-correction/gabidulin-code.md) | 🎓 Educational Only | Rank-metric codes achieving Singleton bound for rank distance. Maximum Rank Distance (MRD) codes over extension fields. Used in network cod… |
| [GKP Quantum Code](error-correction/gkp-quantum-code.md) | 🧪 Experimental | Classical simulation of Gottesman-Kitaev-Preskill code, a continuous variable quantum error correction code encoding qubits into oscillator… |
| [Golay](error-correction/golay.md) | 🛡️ Secure | Binary Golay code [23,12,7] is a perfect error-correcting code capable of correcting up to 3 bit errors or detecting up to 7 errors. Achiev… |
| [Goppa Code](error-correction/goppa-code.md) | 🎓 Educational Only | Binary Goppa codes defined by polynomials over finite fields. Capable of correcting t errors with redundancy 2t*m bits. Used in McEliece po… |
| [Hadamard Code](error-correction/hadamard-code.md) | 🎓 Educational Only | Walsh-Hadamard error correction code that encodes k bits into 2^k bits. Can correct up to (2^(k-1) - 1) / 2 errors. Used in Mariner 9 space… |
| [Hamming Code](error-correction/hamming-code.md) | 🎓 Educational Only | Parametrized Hamming error correction codes supporting standard (7,4), (15,11), (31,26) variants, extended SECDED variants with overall par… |
| [Hermitian Code](error-correction/hermitian-code.md) | 🎓 Educational Only | Algebraic geometry codes from Hermitian curves over finite fields. Exceed Gilbert-Varshamov bound. Defined over x^q + y^q + 1 = 0 in GF(q²)… |
| [Hsiao Code](error-correction/hsiao-code.md) | 🎓 Educational Only | Optimized SEC-DED code with minimum odd-weight columns for energy efficiency. Uses syndrome parity to distinguish single from double errors… |
| [Interleaver](error-correction/interleaver.md) | 🎓 Educational Only | Block interleaver that rearranges data to distribute burst errors across multiple codewords. Uses matrix transposition to convert burst err… |
| [Justesen Code](error-correction/justesen-code.md) | 🎓 Educational Only | First asymptotically good codes with constant rate, constant relative distance, and constant alphabet size. Constructed by concatenating Re… |
| [Kerdock Code](error-correction/kerdock-code.md) | 🎓 Educational Only | Nonlinear binary code that is Z4-linear. For odd m, parameters [2^(m+1), 2^(2m), 2^m - 2^((m-1)/2)]. The [16, 256, 6] Kerdock code (m=3) ac… |
| [LDPC](error-correction/ldpc.md) | 🎓 Educational Only | Low-Density Parity-Check (LDPC) codes using sparse parity-check matrices for efficient error correction. Modern error correction technique… |
| [Levenshtein Code](error-correction/levenshtein-code.md) | 🎓 Educational Only | Code correcting single deletion errors using balanced binary sequences. All codewords have equal number of 0s and 1s (balanced). Can correc… |
| [Lexicographic Code](error-correction/lexicographic-code.md) | 🎓 Educational Only | Greedy construction method for error correction codes. Builds codebook by adding codewords in lexicographic order that maintain minimum dis… |
| [Locally Recoverable Code](error-correction/locally-recoverable-code.md) | 🎓 Educational Only | Codes with locality property where each symbol can be recovered from small number of other symbols. Parameters [n,k,d,r] where r is localit… |
| [LRC Pyramid Code](error-correction/lrc-pyramid-code.md) | 🎓 Educational Only | Hierarchical locally recoverable code with pyramid structure used in Microsoft Azure Storage. 12+2+2 configuration with local parity groups… |
| [LT](error-correction/lt.md) | 🛡️ Secure | LT (Luby Transform) codes are the first practical implementation of digital fountain codes. They provide rateless error correction where en… |
| [LT Enhanced](error-correction/lt-enhanced.md) | 🎓 Educational Only | Enhanced Luby Transform codes with systematic encoding, pre-coding, and inactivation decoding. First practical rateless fountain code with… |
| [Multi-Edge Type LDPC Code](error-correction/multi-edge-type-ldpc-code.md) | 🧪 Experimental | Generalization of LDPC codes with multiple variable and check node types connected by different edge types. Each edge type has its own degr… |
| [Nordstrom-Robinson Code](error-correction/nordstrom-robinson-code.md) | 🎓 Educational Only | Nonlinear (16, 256, 6) code achieving optimal parameters. Has minimum distance 6, can correct 2 errors and detect 5 errors. Meets the Plotk… |
| [Online Code](error-correction/online-code.md) | 🎓 Educational Only | Online Codes are near-optimal rateless erasure codes with linear-time encoding and decoding complexity. They improve upon LT codes by provi… |
| [Parvaresh-Vardy Code](error-correction/parvaresh-vardy-code.md) | 🎓 Educational Only | Algebraic codes achieving list-decoding capacity with efficient algorithms. Generalization of Reed-Solomon using correlated polynomials. Fi… |
| [Plotkin Code](error-correction/plotkin-code.md) | 🎓 Educational Only | Linear binary codes achieving Plotkin bound (maximum minimum distance) via recursive \|u\|u+v\| construction. Starting from [2,2,1] repetition… |
| [Polar Code](error-correction/polar-code.md) | 🎓 Educational Only | First capacity-achieving codes with explicit construction. Provably achieve Shannon channel capacity for symmetric binary-input discrete me… |
| [Preparata Code](error-correction/preparata-code.md) | 🎓 Educational Only | Nonlinear codes with parameters [2^m, k=2^m-2m-1, d=5] achieving good parameters. The (16,2048,5) code can correct 2 errors. Constructed us… |
| [Product Code](error-correction/product-code.md) | 🎓 Educational Only | Two-dimensional error correction using row and column parity checks. Can detect and correct single-bit errors by identifying the intersecti… |
| [Protograph LDPC Code](error-correction/protograph-ldpc-code.md) | 🎓 Educational Only | LDPC codes constructed from small prototype graphs (protographs) expanded via copy-and-permute operations. AR4JA (Accumulate-Repeat-4-Jagge… |
| [Quadratic Residue Code](error-correction/quadratic-residue-code.md) | 🎓 Educational Only | Cyclic codes constructed from quadratic residues in finite fields. For prime p ≡ ±1 (mod 8), constructs (p, (p+1)/2) code with excellent di… |
| [Quantum LDPC Code](error-correction/quantum-ldpc-code.md) | 🧪 Experimental | Quantum extension of low-density parity-check codes using sparse parity-check matrices for both X and Z stabilizers. Enables scalable quant… |
| [Raptor](error-correction/raptor.md) | 🛡️ Secure | Raptor codes are systematic fountain codes that achieve near-optimal performance by combining a high-rate pre-code (typically LDPC) with LT… |
| [Raptor (Enhanced)](error-correction/raptor-enhanced.md) | 🎓 Educational Only | Enhanced systematic rateless fountain code achieving near-optimal overhead with linear-time encoding and decoding. Two-stage architecture c… |
| [RaptorQ](error-correction/raptorq.md) | 🛡️ Secure | RaptorQ codes are standardized fountain codes defined in RFC 6330. They provide excellent error correction performance with minimal overhea… |
| [Reed-Muller Code](error-correction/reed-muller-code.md) | 🎓 Educational Only | First-order Reed-Muller codes RM(1,m) with parameters [2^m, 1+m, 2^(m-1)]. Closely related to Hadamard codes and biorthogonal codes. Simple… |
| [Reed-Solomon](error-correction/reed-solomon.md) | 🎓 Educational Only | Reed-Solomon error correction codes using polynomial arithmetic over Galois Fields. Can correct burst errors and multiple symbol errors. Us… |
| [Repeat-Accumulate Code](error-correction/repeat-accumulate-code.md) | 🎓 Educational Only | Capacity-approaching code using repeat-interleave-accumulate construction. Serial concatenation of repetition code with differential encode… |
| [Repetition](error-correction/repetition.md) | 🎓 Educational Only | Repetition codes use triple modular redundancy (TMR) or N-modular redundancy to correct errors. Each bit is repeated N times, and majority… |
| [Repetition Code](error-correction/repetition-code.md) | 🎓 Educational Only | Simplest error correction code that repeats each bit n times. Decoding uses majority voting to recover the original bit. Can correct up to… |
| [SECDED](error-correction/secded.md) | 🎓 Educational Only | Extended Hamming code providing Single Error Correction and Double Error Detection. Used in ECC RAM and critical storage systems. Achieves… |
| [Simplex Code](error-correction/simplex-code.md) | 🎓 Educational Only | Dual of Hamming code with parameters [2^m-1, m, 2^(m-1)]. All non-zero codewords have constant Hamming weight 2^(m-1). Maximal-length linea… |
| [Single Parity Check](error-correction/single-parity-check.md) | 🎓 Educational Only | Simplest error correction code adding single parity bit to detect odd number of errors. Parameters (n, n-1, 2) giving code rate (n-1)/n. Ca… |
| [Singleton Bound Code (MDS)](error-correction/singleton-bound-code-mds.md) | 🎓 Educational Only | Maximum Distance Separable code achieving Singleton bound d=n-k+1 using Cauchy matrix construction. Provides optimal erasure correction wit… |
| [Space-Time Block Code](error-correction/space-time-block-code.md) | 🎓 Educational Only | Orthogonal designs for multi-antenna wireless transmission achieving full diversity. Alamouti 2x1 code generalizes to N transmit antennas.… |
| [Spatially Coupled LDPC Code](error-correction/spatially-coupled-ldpc-code.md) | 🧪 Experimental | Convolutional-like LDPC codes achieving capacity on binary erasure channel with bounded complexity through spatial coupling. Chain-like cou… |
| [Spinal Code](error-correction/spinal-code.md) | 🎓 Educational Only | Rateless codes achieving capacity on unknown channels. Hash-based incremental redundancy. State machine generates pseudo-random symbols. Re… |
| [Stabilizer Quantum Code](error-correction/stabilizer-quantum-code.md) | 🎓 Educational Only | Most general framework for quantum error correction using stabilizer formalism. Stabilizer group S consists of commuting Pauli operators th… |
| [Tail-Biting Convolutional Code](error-correction/tail-biting-convolutional-code.md) | 🎓 Educational Only | Convolutional codes where ending state equals starting state, eliminating rate loss from tailing bits. Used in 802.11 WiFi, LTE control cha… |
| [Ternary Golay Code](error-correction/ternary-golay-code.md) | 🎓 Educational Only | Perfect [11,6,5] ternary linear code over GF(3) with 729 codewords. Can correct 2 ternary symbol errors. Minimum distance 5. One of only fi… |
| [Topological Color Code](error-correction/topological-color-code.md) | 🧪 Experimental | 2D topological quantum code on hexagonal lattice with 3-coloring. Supports transversal gates beyond Clifford group enabling fault-tolerant… |
| [Topological Surface Code](error-correction/topological-surface-code.md) | 🧪 Experimental | Classical simulation of topological surface code, a 2D lattice quantum error correction code with stabilizer measurements. Educational impl… |
| [Tornado Code](error-correction/tornado-code.md) | 🎓 Educational Only | First practical fountain codes with linear-time encoding/decoding. Precursor to LT and Raptor codes. Uses irregular bipartite graph structu… |
| [Trellis Coded Modulation](error-correction/trellis-coded-modulation.md) | 🎓 Educational Only | Joint coding and modulation achieving coding gain without bandwidth expansion. Combines convolutional encoding with signal constellation ma… |
| [Triple Modular Redundancy](error-correction/triple-modular-redundancy.md) | 🎓 Educational Only | Simplest fault-tolerant system replicating data three times and using majority voting for error correction. Can correct single-bit errors p… |
| [Turbo Code](error-correction/turbo-code.md) | 🎓 Educational Only | Parallel concatenated convolutional codes with iterative decoding. First practical codes to closely approach Shannon limit. Used in 3G/4G m… |
| [Varshamov-Tenengolts Code](error-correction/varshamov-tenengolts-code.md) | 🎓 Educational Only | Code correcting single insertion, deletion, or asymmetric (0→1) error. Rate-1 code with log(n+1) redundancy bits. Uses weighted checksum: s… |
| [Wozencraft Ensemble](error-correction/wozencraft-ensemble.md) | 🎓 Educational Only | Set of linear codes where most codes satisfy Gilbert-Varshamov bound. Named after John Wozencraft. Used as inner codes in Justesen code con… |
| [Zigzag Code](error-correction/zigzag-code.md) | 🎓 Educational Only | Diagonal interleaving technique for burst error correction. Data written row-wise into matrix, transmitted in zigzag diagonal pattern. Spre… |

## Hash Functions

_Cryptographic hash algorithms_

| Algorithm | Security | Summary |
| --- | --- | --- |
| [ASCON-HASH](hash-functions/ascon-hash.md) | 🧪 Experimental | Lightweight hash function based on Ascon permutation, finalist in CAESAR competition and standardized by NIST. Provides 256-bit security wi… |
| [Ascon-Hash256](hash-functions/ascon-hash256.md) | 🛡️ Secure | Lightweight hash function based on Ascon permutation, standardized in NIST SP 800-232. Provides 256-bit security with efficient hardware an… |
| [ASCON-XOF](hash-functions/ascon-xof.md) | 🧪 Experimental | Lightweight extendable output function (XOF) based on Ascon permutation, standardized by NIST. Supports variable-length output with efficie… |
| [BLAKE-224](hash-functions/blake-224.md) | 🎓 Educational Only | BLAKE-224 hash function from SHA-3 competition. Produces 224-bit (28-byte) hash values. |
| [BLAKE-256](hash-functions/blake-256.md) | 🎓 Educational Only | BLAKE-256 hash function from SHA-3 competition. Produces 256-bit (32-byte) hash values. |
| [BLAKE-384](hash-functions/blake-384.md) | 🎓 Educational Only | BLAKE-384 hash function from SHA-3 competition. Produces 384-bit (48-byte) hash values. |
| [BLAKE-512](hash-functions/blake-512.md) | 🎓 Educational Only | BLAKE-512 hash function from SHA-3 competition. Produces 512-bit (64-byte) hash values. |
| [BLAKE2b](hash-functions/blake2b.md) | — | BLAKE2b is a high-speed cryptographic hash function optimized for 64-bit platforms. It's faster than MD5, SHA-1, SHA-2, and SHA-3 while pro… |
| [BLAKE2s](hash-functions/blake2s.md) | — | BLAKE2s is a high-speed cryptographic hash function optimized for 8-32 bit platforms. It's the 32-bit version of BLAKE2 and is used in prot… |
| [BLAKE2xs](hash-functions/blake2xs.md) | 🧪 Experimental | BLAKE2xs is an eXtendable Output Function (XOF) based on BLAKE2s. It supports variable-length output from 1 byte to 2^32 blocks of 32 bytes. |
| [BLAKE3](hash-functions/blake3.md) | — | Modern cryptographic hash function based on BLAKE2. Splits the message into 1024-byte chunks, hashes each to a chaining value and combines… |
| [BLAKE3-Enhanced](hash-functions/blake3-enhanced.md) | — | Enhanced educational implementation of the BLAKE3 cryptographic hash function. Splits the message into 1024-byte chunks, hashes each to a c… |
| [CHC](hash-functions/chc.md) | 🎓 Educational Only | Cipher Hash Construction builds a cryptographic hash from a block cipher using Matyas-Meyer-Oseas construction. Default implementation uses… |
| [CityHash](hash-functions/cityhash.md) | 🎓 Educational Only | Fast non-cryptographic hash function developed by Google. Optimized for short strings with excellent speed and distribution. |
| [COMB4P(MD4,MD5)](hash-functions/comb4p-md4-md5.md) | — | COMB4P hash combiner using MD4 and MD5. Combines two hash functions with a Feistel-like construction to provide security even if one compon… |
| [COMB4P(SHA-1,RIPEMD-160)](hash-functions/comb4p-sha-1-ripemd-160.md) | — | COMB4P hash combiner using SHA-1 and RIPEMD-160. Combines two hash functions with a Feistel-like construction to provide security even if o… |
| [cSHAKE128](hash-functions/cshake128.md) | 🛡️ Secure | cSHAKE128 is a customizable extendable-output function based on SHAKE128 from NIST SP 800-185. Supports function name and customization str… |
| [cSHAKE256](hash-functions/cshake256.md) | 🛡️ Secure | cSHAKE256 is a customizable extendable-output function based on SHAKE256 from NIST SP 800-185. Supports function name and customization str… |
| [CubeHash-256](hash-functions/cubehash-256.md) | 🎓 Educational Only | CubeHash-16+16/32+16-256 variant producing 256-bit hashes. SHA-3 competition candidate by Daniel J. Bernstein. |
| [CubeHash-512](hash-functions/cubehash-512.md) | 🎓 Educational Only | CubeHash-16+16/32+16-512 hash function designed by Daniel J. Bernstein, submitted to NIST SHA-3 competition. Uses 16 initialization rounds,… |
| [DryGASCON128-HASH](hash-functions/drygascon128-hash.md) | 🧪 Experimental | Lightweight hash function using DrySPONGE construction with GASCON permutation. NIST Lightweight Cryptography finalist providing 256-bit ha… |
| [DryGASCON256-HASH](hash-functions/drygascon256-hash.md) | 🧪 Experimental | Extended lightweight hash function using DrySPONGE construction with GASCON permutation. Provides 512-bit hash output with enhanced securit… |
| [DSTU7564 (Kupyna)](hash-functions/dstu7564-kupyna.md) | 🎓 Educational Only | Ukrainian national standard hash function. Substitution-permutation network operating on 512/1024-bit states with 64-bit words. ISO/IEC 101… |
| [DSTU7564-256 (Kupyna-256)](hash-functions/dstu7564-256-kupyna-256.md) | 🎓 Educational Only | Ukrainian National Standard hash function (DSTU 7564:2014). 256-bit variant using AES-like structure with Even-Mansour construction. Approv… |
| [DSTU7564-512 (Kupyna-512)](hash-functions/dstu7564-512-kupyna-512.md) | 🎓 Educational Only | Ukrainian National Standard hash function (DSTU 7564:2014). 512-bit variant using AES-like structure with Even-Mansour construction. Approv… |
| [ECHO](hash-functions/echo.md) | 🎓 Educational Only | ECHO is an AES-based cryptographic hash function submitted to the NIST SHA-3 competition (Round 2). It processes a 512-bit (small variants)… |
| [Esch256](hash-functions/esch256.md) | 🧪 Experimental | NIST Lightweight Cryptography finalist based on SPARKLE-384 permutation. Optimized for constrained devices with 256-bit security. |
| [Esch384](hash-functions/esch384.md) | 🧪 Experimental | NIST Lightweight Cryptography finalist based on SPARKLE-512 permutation. Optimized for constrained devices with 384-bit security. |
| [FNV-1a](hash-functions/fnv-1a.md) | 🎓 Educational Only | FNV-1a is a fast non-cryptographic hash function with good distribution properties. It uses simple multiply and XOR operations for high per… |
| [Fugue-224](hash-functions/fugue-224.md) | 🎓 Educational Only | Fugue-224 is an AES-inspired cryptographic hash function with 224-bit output, submitted to the NIST SHA-3 competition (2008-2012). It uses… |
| [Fugue-256](hash-functions/fugue-256.md) | 🎓 Educational Only | Fugue-256 is an AES-inspired cryptographic hash function with 256-bit output, submitted to the NIST SHA-3 competition (2008-2012). It uses… |
| [Fugue-384](hash-functions/fugue-384.md) | 🎓 Educational Only | Fugue-384 is an AES-inspired cryptographic hash function with 384-bit output, submitted to the NIST SHA-3 competition (2008-2012). It uses… |
| [Fugue-512](hash-functions/fugue-512.md) | 🎓 Educational Only | Fugue-512 is an AES-inspired cryptographic hash function with 512-bit output, submitted to the NIST SHA-3 competition (2008-2012). It uses… |
| [GIMLI-24-HASH](hash-functions/gimli-24-hash.md) | 🧪 Experimental | Lightweight hash function based on the GIMLI-24 permutation using a sponge construction. Designed for simplicity and efficiency in constrai… |
| [GOST R 34.11-94](hash-functions/gost-r-34-11-94.md) | ⚠️ Deprecated | Soviet/Russian national hash standard producing 256-bit digests. Uses GOST 28147-89 cipher internally with D-A S-box. Superseded by Streebo… |
| [Grøstl](hash-functions/gr-stl.md) | 🎓 Educational Only | Grøstl is a cryptographic hash function designed as a SHA-3 candidate. Features wide-pipe construction with AES-like design and two permuta… |
| [Hamsi-224](hash-functions/hamsi-224.md) | 📰 Obsolete | SHA-3 candidate hash function with 224-bit output. Uses a Serpent-inspired non-linear permutation with a linear-code based message expansio… |
| [Hamsi-256](hash-functions/hamsi-256.md) | 📰 Obsolete | SHA-3 candidate hash function with 256-bit output. Uses a Serpent-inspired non-linear permutation with a linear-code based message expansio… |
| [Hamsi-384](hash-functions/hamsi-384.md) | 📰 Obsolete | SHA-3 candidate hash function with 384-bit output. Uses a Serpent-inspired non-linear permutation with a linear-code based message expansio… |
| [Hamsi-512](hash-functions/hamsi-512.md) | 📰 Obsolete | SHA-3 candidate hash function with 512-bit output. Uses a Serpent-inspired non-linear permutation with a linear-code based message expansio… |
| [Haraka-256](hash-functions/haraka-256.md) | 🧪 Experimental | High-performance hash function optimized for short inputs using AES round function. Designed for post-quantum cryptographic applications wi… |
| [Haraka-512](hash-functions/haraka-512.md) | 🧪 Experimental | High-performance hash function for 512-bit inputs producing 256-bit output using AES round function. Optimized for post-quantum signature s… |
| [HAVAL](hash-functions/haval.md) | — | HAVAL (HAsh of Variable Length) is a cryptographic hash function with variable output length (128, 160, 192, 224, 256 bits) and variable pa… |
| [HighwayHash](hash-functions/highwayhash.md) | 🎓 Educational Only | Google's keyed hash function designed as a faster, stronger successor to SipHash. Absorbs 32-byte packets into a 256-bit state of multiply/… |
| [ISAP Hash](hash-functions/isap-hash.md) | 🛡️ Secure | Ascon-based hash function used in the ISAP authenticated encryption scheme. Uses Ascon-p permutation in sponge mode to produce 256-bit hash… |
| [JH-224](hash-functions/jh-224.md) | — | JH is a SHA-3 finalist designed by Hongjun Wu. A 1024-bit state is regrouped into 256 four-bit elements and driven through 42 rounds of S-b… |
| [JH-256](hash-functions/jh-256.md) | — | JH is a SHA-3 finalist designed by Hongjun Wu. A 1024-bit state is regrouped into 256 four-bit elements and driven through 42 rounds of S-b… |
| [JH-384](hash-functions/jh-384.md) | — | JH is a SHA-3 finalist designed by Hongjun Wu. A 1024-bit state is regrouped into 256 four-bit elements and driven through 42 rounds of S-b… |
| [JH-512](hash-functions/jh-512.md) | — | JH is a SHA-3 finalist designed by Hongjun Wu. A 1024-bit state is regrouped into 256 four-bit elements and driven through 42 rounds of S-b… |
| [KangarooTwelve](hash-functions/kangarootwelve.md) | 🧪 Experimental | Fast hashing based on Keccak-p[1600,12] with tree structure for parallel processing. NIST Lightweight Cryptography submission offering high… |
| [Keccak (DarkCrypt)](hash-functions/keccak-darkcrypt.md) | 🎓 Educational Only | Keccak-512 as used by the DarkCrypt Total Commander plugin: the original SHA-3 round 1 submission (Keccak version 1, 2008), Keccak[r=512, c… |
| [Keccak-224](hash-functions/keccak-224.md) | — | Original Keccak-224 hash function (pre-SHA3). Uses 0x01 padding instead of SHA-3's 0x06. Produces 224-bit digests. |
| [Keccak-256](hash-functions/keccak-256.md) | — | Original Keccak-256 hash function (pre-SHA3). Uses 0x01 padding instead of SHA-3's 0x06. Widely used in blockchain applications like Ethere… |
| [Keccak-384](hash-functions/keccak-384.md) | — | Original Keccak-384 hash function (pre-SHA3). Uses 0x01 padding instead of SHA-3's 0x06. Produces 384-bit digests. |
| [Keccak-512](hash-functions/keccak-512.md) | — | Original Keccak-512 hash function (pre-SHA3). Uses 0x01 padding instead of SHA-3's 0x06. Produces 512-bit digests. |
| [KNOT-HASH-256-256](hash-functions/knot-hash-256-256.md) | 🧪 Experimental | Lightweight hash function based on bit-sliced PRESENT-like permutations, finalist in NIST Lightweight Cryptography competition. Uses KNOT-2… |
| [KNOT-HASH-256-384](hash-functions/knot-hash-256-384.md) | 🧪 Experimental | Lightweight hash function based on bit-sliced PRESENT-like permutations, finalist in NIST Lightweight Cryptography competition. Uses KNOT-3… |
| [KNOT-HASH-384-384](hash-functions/knot-hash-384-384.md) | 🧪 Experimental | Lightweight hash function based on bit-sliced PRESENT-like permutations, finalist in NIST Lightweight Cryptography competition. Uses KNOT-3… |
| [KNOT-HASH-512-512](hash-functions/knot-hash-512-512.md) | 🧪 Experimental | Lightweight hash function based on bit-sliced PRESENT-like permutations, finalist in NIST Lightweight Cryptography competition. Uses KNOT-5… |
| [LSH-224](hash-functions/lsh-224.md) | — | Korean Lightweight Secure Hash producing 224-bit digests. Developed by Korea Internet&Security Agency (KISA) as part of Korean cryptographi… |
| [LSH-256](hash-functions/lsh-256.md) | — | Korean Lightweight Secure Hash producing 256-bit digests. Developed by Korea Internet&Security Agency (KISA) as part of Korean cryptographi… |
| [LSH-384](hash-functions/lsh-384.md) | — | Korean cryptographic hash function standard producing 384-bit digests. Uses 512-bit internal processing with 28-step compression and 64-bit… |
| [LSH-512](hash-functions/lsh-512.md) | — | Korean cryptographic hash function standard producing 512-bit digests. Designed by KISA with 28-step compression function and 64-bit operat… |
| [LSH-512-256](hash-functions/lsh-512-256.md) | — | Korean cryptographic hash function standard producing 256-bit digests. Uses 512-bit internal processing with 28-step compression and 64-bit… |
| [Luffa-224](hash-functions/luffa-224.md) | 📰 Obsolete | SHA-3 candidate hash function producing 224-bit outputs using 3 parallel state chains with a sponge-like construction. Eliminated in round… |
| [Luffa-256](hash-functions/luffa-256.md) | 📰 Obsolete | SHA-3 candidate hash function producing 256-bit outputs using 3 parallel state chains with a sponge-like construction. Eliminated in round… |
| [Luffa-384](hash-functions/luffa-384.md) | 📰 Obsolete | SHA-3 candidate hash function producing 384-bit outputs using 4 parallel state chains with a sponge-like construction. Eliminated in round… |
| [Luffa-512](hash-functions/luffa-512.md) | 📰 Obsolete | SHA-3 candidate hash function producing 512-bit outputs using 5 parallel state chains with a sponge-like construction. Eliminated in round… |
| [MD2](hash-functions/md2.md) | — | MD2 is a 128-bit cryptographic hash function and predecessor to MD4 and MD5. It is extremely slow and cryptographically broken with known c… |
| [MD4](hash-functions/md4.md) | — | MD4 is a 128-bit cryptographic hash function and predecessor to MD5. It is cryptographically broken with practical collision attacks and sh… |
| [MD5](hash-functions/md5.md) | ❌ Broken | 128-bit cryptographic hash function designed by Ronald Rivest. Fast but cryptographically broken with practical collision attacks. |
| [MD6 (DarkCrypt)](hash-functions/md6-darkcrypt.md) | 🎓 Educational Only | MD6-512 as used by the DarkCrypt Total Commander plugin: the MIT reference MD6 as submitted to SHA-3 round 1 (d=512, r=168, L=64, no key),… |
| [MDC-2](hash-functions/mdc-2.md) | ⚠️ Deprecated | Modification Detection Code 2, an ISO/IEC 10118-2 standard hash function based on DES encryption. Produces 128-bit hashes using Davies-Meye… |
| [MurmurHash3](hash-functions/murmurhash3.md) | 🎓 Educational Only | Fast non-cryptographic hash function with excellent distribution properties. Designed for hash tables, bloom filters, and general purpose h… |
| [Panama-BE](hash-functions/panama-be.md) | ❌ Broken | Panama hash function with big-endian byte order. Belt-and-mill construction combining linear feedback shift register (belt) and nonlinear s… |
| [Panama-LE](hash-functions/panama-le.md) | ❌ Broken | Panama hash function with little-endian byte order. Belt-and-mill construction combining linear feedback shift register (belt) and nonlinea… |
| [ParallelHash128](hash-functions/parallelhash128.md) | 🛡️ Secure | ParallelHash128 is a parallel hash function from NIST SP 800-185 that supports efficient hashing of very long strings using parallelism. Ba… |
| [ParallelHash256](hash-functions/parallelhash256.md) | 🛡️ Secure | ParallelHash256 is a parallel hash function from NIST SP 800-185 that supports efficient hashing of very long strings using parallelism. Ba… |
| [PhotonBeetle Hash](hash-functions/photonbeetle-hash.md) | 🧪 Experimental | Lightweight hash function based on the PHOTON permutation, finalist in NIST Lightweight Cryptography competition. Optimized for constrained… |
| [RadioGatún](hash-functions/radiogat-n.md) | 🎓 Educational Only | RadioGatún is a belt-and-mill hash function that served as a predecessor to Keccak/SHA-3 design. Uses 19-word mill and 39-word belt with 32… |
| [RIPEMD-128](hash-functions/ripemd-128.md) | ⚠️ Deprecated | RACE Integrity Primitives Evaluation Message Digest with 128-bit output. Developed as part of the RIPEMD family with dual-path design. Prod… |
| [RIPEMD-160](hash-functions/ripemd-160.md) | 🎓 Educational Only | RACE Integrity Primitives Evaluation Message Digest with 160-bit output. Developed as a European alternative to SHA-1 with different design… |
| [RIPEMD-256](hash-functions/ripemd-256.md) | 🎓 Educational Only | RIPEMD-256 is an extension of RIPEMD-128 with 256-bit output. Uses two parallel computation lines with different initial values and no fina… |
| [RIPEMD-320](hash-functions/ripemd-320.md) | 🎓 Educational Only | Extended RIPEMD hash function producing 320-bit digest. Uses dual 160-bit computation pipelines for enhanced security margin. Part of the R… |
| [SHA-1](hash-functions/sha-1.md) | ❌ Broken | Secure Hash Algorithm producing 160-bit digest. CRYPTOGRAPHICALLY BROKEN - practical collision attacks demonstrated in 2017. DO NOT USE for… |
| [SHA-224](hash-functions/sha-224.md) | 🛡️ Secure | SHA-224 is a truncated version of SHA-256 producing a 224-bit digest. It is part of the SHA-2 family with identical security properties to… |
| [SHA-256](hash-functions/sha-256.md) | 🛡️ Secure | SHA-256 (Secure Hash Algorithm 256-bit) is a cryptographic hash function from the SHA-2 family designed by NIST. Produces 256-bit (32-byte)… |
| [SHA-3-224](hash-functions/sha-3-224.md) | — | SHA-3-224 produces 224-bit digests using the Keccak sponge construction with capacity 448 bits. Part of the NIST FIPS 202 standard. |
| [SHA-3-256](hash-functions/sha-3-256.md) | — | SHA-3-256 produces 256-bit digests using the Keccak sponge construction with capacity 512 bits. Part of the NIST FIPS 202 standard. |
| [SHA-3-384](hash-functions/sha-3-384.md) | — | SHA-3-384 produces 384-bit digests using the Keccak sponge construction with capacity 768 bits. Part of the NIST FIPS 202 standard. |
| [SHA-3-512](hash-functions/sha-3-512.md) | — | SHA-3-512 produces 512-bit digests using the Keccak sponge construction with capacity 1024 bits. Part of the NIST FIPS 202 standard. |
| [SHA-384](hash-functions/sha-384.md) | 🛡️ Secure | SHA-384 (Secure Hash Algorithm 384-bit) is a cryptographic hash function from the SHA-2 family. Uses SHA-512 algorithm with different initi… |
| [SHA-512](hash-functions/sha-512.md) | 🛡️ Secure | SHA-512 (Secure Hash Algorithm 512-bit) is a cryptographic hash function from the SHA-2 family designed by NIST. Produces 512-bit (64-byte)… |
| [SHA-512/224](hash-functions/sha-512-224.md) | 🛡️ Secure | SHA-512/224 is a truncated variant of SHA-512 with a modified initialization vector, producing 224-bit hash values. Defined in FIPS 180-4 f… |
| [SHA-512/256](hash-functions/sha-512-256.md) | 🛡️ Secure | SHA-512/256 is a truncated variant of SHA-512 with a modified initialization vector, producing 256-bit hash values. Defined in FIPS 180-4 f… |
| [Shabal-192](hash-functions/shabal-192.md) | 🎓 Educational Only | Shabal-192 is a cryptographic hash function submitted to the NIST SHA-3 competition by the Saphir project. It advanced to the second round… |
| [Shabal-224](hash-functions/shabal-224.md) | 🎓 Educational Only | Shabal-224 is a cryptographic hash function submitted to the NIST SHA-3 competition by the Saphir project. It advanced to the second round… |
| [Shabal-256](hash-functions/shabal-256.md) | 🎓 Educational Only | Shabal-256 is a cryptographic hash function submitted to the NIST SHA-3 competition by the Saphir project. It advanced to the second round… |
| [Shabal-384](hash-functions/shabal-384.md) | 🎓 Educational Only | Shabal-384 is a cryptographic hash function submitted to the NIST SHA-3 competition by the Saphir project. It advanced to the second round… |
| [Shabal-512](hash-functions/shabal-512.md) | 🎓 Educational Only | Shabal-512 is a cryptographic hash function submitted to the NIST SHA-3 competition by the Saphir project. It advanced to the second round… |
| [SHAKE128](hash-functions/shake128.md) | — | SHAKE128 is an extendable-output function (XOF) from NIST FIPS 202 with 128-bit security. Based on Keccak sponge construction with variable… |
| [SHAKE256](hash-functions/shake256.md) | — | SHAKE256 is an extendable-output function (XOF) from NIST FIPS 202 with 256-bit security. Can produce variable-length output, making it sui… |
| [SipHash-2-4](hash-functions/siphash-2-4.md) | 🎓 Educational Only | Fast cryptographically secure pseudorandom function designed for hash tables and data structures requiring collision resistance. |
| [Skein](hash-functions/skein.md) | 🎓 Educational Only | Skein-512 hash function from NIST SHA-3 competition. Built on Threefish-512 tweakable block cipher using UBI mode. Finalist in SHA-3 compet… |
| [Skein (DarkCrypt)](hash-functions/skein-darkcrypt.md) | 🎓 Educational Only | Skein-512-512 as used by the DarkCrypt Total Commander plugin: Skein version 1.1, the SHA-3 round 1 definition, with the original Threefish… |
| [SKINNY-tk2-HASH](hash-functions/skinny-tk2-hash.md) | 🧪 Experimental | Lightweight hash function based on SKINNY-128-256 tweakable block cipher. Uses 32-byte internal state with 4-byte absorption rate for effic… |
| [SKINNY-tk3-HASH](hash-functions/skinny-tk3-hash.md) | 🧪 Experimental | Lightweight hash function based on SKINNY-128-384 tweakable block cipher. Uses 48-byte internal state with 16-byte absorption rate for high… |
| [SM3](hash-functions/sm3.md) | — | Chinese national cryptographic hash standard producing 256-bit digests. Part of the ShangMi (Commercial Cryptography) suite used in China's… |
| [SparkleHash](hash-functions/sparklehash.md) | 🛡️ Secure | NIST Lightweight Cryptography finalist based on the Sparkle permutation. Provides 256-bit hash output (Esch256 variant) with efficient perf… |
| [Streebog-256](hash-functions/streebog-256.md) | — | Russian Federal standard hash function GOST R 34.11-2012, republished as RFC 6986. A 512-bit state is mixed by twelve rounds of an AES-like… |
| [Streebog-512](hash-functions/streebog-512.md) | — | Russian Federal standard hash function GOST R 34.11-2012, republished as RFC 6986. A 512-bit state is mixed by twelve rounds of an AES-like… |
| [Subterranean-Hash](hash-functions/subterranean-hash.md) | 🧪 Experimental | Lightweight cryptographic hash function designed by Joan Daemen based on a 257-bit permutation. Finalist in NIST's Lightweight Cryptography… |
| [Tiger](hash-functions/tiger.md) | — | Tiger is a 192-bit cryptographic hash function designed by Ross Anderson and Eli Biham in 1995 for efficiency on 64-bit platforms. Three pa… |
| [TupleHash128](hash-functions/tuplehash128.md) | 🛡️ Secure | SHA-3 derived function for unambiguous tuple hashing with 128-bit security. Encodes each tuple element to prevent collisions between differ… |
| [TupleHash256](hash-functions/tuplehash256.md) | 🛡️ Secure | SHA-3 derived function for unambiguous tuple hashing with 256-bit security. Encodes each tuple element to prevent collisions between differ… |
| [Whirlpool](hash-functions/whirlpool.md) | 🎓 Educational Only | Whirlpool is a cryptographic hash function designed by Vincent Rijmen and Paulo S. L. M. Barreto. It produces a 512-bit hash value and is b… |
| [Xoodyak Hash](hash-functions/xoodyak-hash.md) | 🧪 Experimental | NIST Lightweight Cryptography finalist based on the Xoodoo permutation. Designed for resource-constrained environments with strong security… |
| [xxHash3](hash-functions/xxhash3.md) | 🎓 Educational Only | Ultra-fast non-cryptographic hash function optimized for speed and quality. Latest generation of xxHash family with improved performance on… |
| [xxHash32](hash-functions/xxhash32.md) | 🎓 Educational Only | xxHash is an extremely fast non-cryptographic hash algorithm designed by Yann Collet. XXH32 produces a 32-bit hash and is optimized for spe… |
| [xxHash64](hash-functions/xxhash64.md) | 🎓 Educational Only | xxHash is an extremely fast non-cryptographic hash algorithm designed by Yann Collet. XXH64 produces a 64-bit hash and is the variant inten… |

## Key Derivation Functions

_Key derivation and stretching functions_

| Algorithm | Security | Summary |
| --- | --- | --- |
| [ANSI X9.63 KDF](key-derivation-functions/ansi-x9-63-kdf.md) | 🛡️ Secure | ANSI X9.63-2001 Key Derivation Function for elliptic curve cryptography. Industry-standard KDF used in ECDH key agreement, financial crypto… |
| [Argon2d](key-derivation-functions/argon2d.md) | 🛡️ Secure | Password Hashing Competition winner (2015) - data-dependent variant providing maximum resistance to GPU cracking attacks but vulnerable to… |
| [Argon2i](key-derivation-functions/argon2i.md) | 🛡️ Secure | Password Hashing Competition winner (2015) - data-independent variant resistant to side-channel attacks. Memory access patterns are indepen… |
| [Argon2id](key-derivation-functions/argon2id.md) | 🛡️ Secure | Password Hashing Competition winner (2015) - hybrid variant combining Argon2d and Argon2i. RECOMMENDED for general password hashing. First… |
| [Balloon Hashing](key-derivation-functions/balloon-hashing.md) | 🛡️ Secure | Memory-hard password hashing function with provable protection against sequential attacks. Simpler design than Argon2 with similar security… |
| [Bcrypt](key-derivation-functions/bcrypt.md) | 🛡️ Secure | Industry-standard password hashing function based on Blowfish cipher with expensive key schedule. Designed by Niels Provos and David Mazièr… |
| [Bcrypt-PBKDF](key-derivation-functions/bcrypt-pbkdf.md) | 🛡️ Secure | OpenBSD's password-based key derivation function using eksblowfish (expensive key schedule Blowfish). Uses Bcrypt as a cryptographic primit… |
| [Concat KDF (Hash)](key-derivation-functions/concat-kdf-hash.md) | 🛡️ Secure | NIST SP 800-56A/C Concatenation Key Derivation Function using hash functions. Official NIST-recommended KDF for key agreement protocols lik… |
| [Concat KDF (HMAC)](key-derivation-functions/concat-kdf-hmac.md) | 🛡️ Secure | NIST SP 800-56A/C Concatenation Key Derivation Function using HMAC. HMAC-based variant of the single-step KDF for enhanced security in key… |
| [HKDF](key-derivation-functions/hkdf.md) | 🎓 Educational Only | HMAC-based Key Derivation Function (HKDF) as defined in RFC 5869. Two-step Extract-and-Expand process for deriving cryptographic keys from… |
| [KDF1](key-derivation-functions/kdf1.md) | 🎓 Educational Only | KDF1 Key Derivation Function from IEEE 1363. Single-hash KDF limited to one hash block output, used primarily for compatibility with legacy… |
| [KDF1-ISO-18033](key-derivation-functions/kdf1-iso-18033.md) | 🎓 Educational Only | KDF1 Key Derivation Function from ISO/IEC 18033-2. Counter-based iterative hash KDF supporting arbitrary output lengths with 32-bit counter… |
| [KDF2](key-derivation-functions/kdf2.md) | 🎓 Educational Only | KDF2 Key Derivation Function as defined in IEEE 1363 and ISO/IEC 18033-2. Iterative hash-based KDF using a counter to generate cryptographi… |
| [PBKDF1](key-derivation-functions/pbkdf1.md) | ⚠️ Deprecated | Password-Based Key Derivation Function 1 (PBKDF1) from PKCS #5 v2.0 (RFC 2898 / RFC 8018). Derives cryptographic keys from passwords using… |
| [PBKDF2](key-derivation-functions/pbkdf2.md) | 🎓 Educational Only | Password-Based Key Derivation Function 2 (PBKDF2) using HMAC-SHA1 for key stretching. Converts passwords into cryptographic keys through it… |
| [scrypt](key-derivation-functions/scrypt.md) | 🛡️ Secure | Sequential memory-hard key derivation function designed to resist brute-force attacks using specialized hardware. Uses large memory require… |
| [SP800-108-Counter](key-derivation-functions/sp800-108-counter.md) | 🛡️ Secure | NIST SP 800-108 Key Derivation Function in Counter Mode. Uses HMAC with counter-based PRF expansion for deriving cryptographic keys from in… |
| [SP800-108-Feedback](key-derivation-functions/sp800-108-feedback.md) | 🛡️ Secure | NIST SP 800-108 Key Derivation Function in Feedback Mode. Uses HMAC with feedback-based PRF expansion where each iteration feeds the previo… |
| [SP800-108-Pipeline](key-derivation-functions/sp800-108-pipeline.md) | 🛡️ Secure | NIST SP 800-108 Key Derivation Function in Pipeline Mode. Uses HMAC with pipelined PRF expansion where each iteration computes an intermedi… |
| [SP800-56A](key-derivation-functions/sp800-56a.md) | 🛡️ Secure | NIST SP 800-56A Revision 3 single-step key derivation function for key agreement schemes. Uses concatenation format: counter \|\| Z \|\| FixedI… |
| [SP800-56C](key-derivation-functions/sp800-56c.md) | 🛡️ Secure | NIST SP 800-56C Two-Step Key Derivation Function. Extract-and-Expand pattern using HMAC for deriving cryptographic keys from shared secrets… |
| [TLS-12-PRF(HMAC(SHA-224))](key-derivation-functions/tls-12-prf-hmac-sha-224.md) | 🎓 Educational Only | TLS 1.2 Pseudorandom Function using HMAC-SHA-224. Modern TLS key derivation supporting arbitrary hash functions. Uses P_hash construction w… |
| [TLS-12-PRF(HMAC(SHA-256))](key-derivation-functions/tls-12-prf-hmac-sha-256.md) | 🛡️ Secure | TLS 1.2 Pseudorandom Function using HMAC-SHA-256. Modern TLS key derivation supporting arbitrary hash functions. Uses P_hash construction w… |
| [TLS-12-PRF(HMAC(SHA-384))](key-derivation-functions/tls-12-prf-hmac-sha-384.md) | 🛡️ Secure | TLS 1.2 Pseudorandom Function using HMAC-SHA-384. Modern TLS key derivation supporting arbitrary hash functions. Uses P_hash construction w… |
| [TLS-12-PRF(HMAC(SHA-512))](key-derivation-functions/tls-12-prf-hmac-sha-512.md) | 🛡️ Secure | TLS 1.2 Pseudorandom Function using HMAC-SHA-512. Modern TLS key derivation supporting arbitrary hash functions. Uses P_hash construction w… |
| [TLS-PRF](key-derivation-functions/tls-prf.md) | ⚠️ Deprecated | TLS 1.0/1.1 Pseudorandom Function using MD5 and SHA-1 in parallel. Derives keying material from secrets, labels, and seeds for SSL/TLS prot… |

## Message Authentication

_Message authentication codes_

| Algorithm | Security | Summary |
| --- | --- | --- |
| [BLAKE2b-MAC](message-authentication/blake2b-mac.md) | 🛡️ Secure | BLAKE2b in keyed hash mode for message authentication. Natively supports keying with variable-length MAC output (1-64 bytes). Faster than H… |
| [BLAKE3-MAC](message-authentication/blake3-mac.md) | 🛡️ Secure | BLAKE3 in keyed hash mode for message authentication. Uses 256-bit key to produce variable-length MAC output. Combines speed of BLAKE3 with… |
| [CBC-MAC](message-authentication/cbc-mac.md) | ⚠️ Deprecated | Cipher Block Chaining Message Authentication Code using a block cipher in CBC mode. Foundation for more secure variants like CMAC. |
| [CFB-MAC](message-authentication/cfb-mac.md) | 🎓 Educational Only | Cipher Feedback Mode MAC uses a block cipher in CFB mode to generate message authentication codes. Standardized in ISO/IEC 9797-1:1999. |
| [CMAC](message-authentication/cmac.md) | 🛡️ Secure | Cipher-based Message Authentication Code as defined in NIST SP 800-38B. Provides cryptographic authentication using AES block cipher. |
| [DMAC](message-authentication/dmac.md) | 🎓 Educational Only | Double MAC (DMAC) using two-key derivation for enhanced CBC-MAC security. Designed for real-time data sources with variable-length messages. |
| [DSTU 7624 MAC](message-authentication/dstu-7624-mac.md) | 🛡️ Secure | Ukrainian national MAC standard based on Kalyna block cipher. Provides cryptographic authentication. Current implementation supports 128-bi… |
| [F9](message-authentication/f9.md) | ⚠️ Deprecated | F9 is the integrity algorithm used in 3GPP/UMTS mobile communications. Uses KASUMI block cipher with dual-key MAC construction for message… |
| [GMAC](message-authentication/gmac.md) | 🛡️ Secure | Galois Message Authentication Code as defined in NIST SP 800-38D. Authentication component of GCM mode using Galois Field arithmetic. |
| [GOST 28147-89 MAC](message-authentication/gost-28147-89-mac.md) | ⚠️ Deprecated | CBC-MAC construction using GOST 28147-89 block cipher. Specified in GOST R 34.13-2015 for message authentication. |
| [HMAC](message-authentication/hmac.md) | 🛡️ Secure | Hash-based Message Authentication Code as defined in RFC 2104. Provides cryptographic authentication and integrity verification using any c… |
| [HMAC-SHA256](message-authentication/hmac-sha256.md) | 🛡️ Secure | Hash-based Message Authentication Code using SHA-256 as defined in RFC 2104 and RFC 4231. Combines cryptographic hashing with a secret key… |
| [ISO9797 Algorithm 3](message-authentication/iso9797-algorithm-3.md) | 🎓 Educational Only | Retail MAC (ANSI X9.19) using block cipher with encrypt-decrypt-encrypt pattern on final block. Two or three key construction commonly used… |
| [KMAC128](message-authentication/kmac128.md) | 🛡️ Secure | KMAC128 - NIST SP 800-185 Keccak Message Authentication Code with 128-bit security. |
| [KMAC256](message-authentication/kmac256.md) | 🛡️ Secure | KMAC256 - NIST SP 800-185 Keccak Message Authentication Code with 256-bit security. |
| [OMAC/CMAC](message-authentication/omac-cmac.md) | 🛡️ Secure | One-Key Cipher-Based Message Authentication Code as defined in NIST SP 800-38B. Provides provably secure message authentication using a sin… |
| [Panama-BE-MAC](message-authentication/panama-be-mac.md) | ❌ Broken | Panama-BE MAC using hermetic hash function construction. Key is prepended to message before hashing. Broken by collision attacks on underly… |
| [Panama-LE-MAC](message-authentication/panama-le-mac.md) | ❌ Broken | Panama-LE MAC using hermetic hash function construction. Key is prepended to message before hashing. Broken by collision attacks on underly… |
| [Pelican](message-authentication/pelican.md) | 🎓 Educational Only | Pelican MAC is an AES-based message authentication code using a 4-round compression function. Provides 128-bit authentication tags with 128… |
| [PMAC](message-authentication/pmac.md) | 🛡️ Secure | Parallelizable Message Authentication Code using AES-128. Provides provably secure message authentication with parallel processing capabili… |
| [Poly1305](message-authentication/poly1305.md) | 🎓 Educational Only | One-time message authenticator designed by D.J. Bernstein using 130-bit field arithmetic. Provides information-theoretic security when used… |
| [SipHash-128](message-authentication/siphash-128.md) | 🛡️ Secure | 128-bit output variant of SipHash. Fast cryptographically secure PRF producing 16-byte MAC tags. Default configuration uses 2 compression r… |
| [Skein-512-MAC](message-authentication/skein-512-mac.md) | 🎓 Educational Only | Skein-512 in keyed mode for message authentication. Uses Skein's native UBI framework with KEY block processing for secure MAC generation.… |
| [TTMAC](message-authentication/ttmac.md) | — | Two-Track MAC using dual RIPEMD-160 compression functions. Provides 160-bit authentication tags with 160-bit keys. Based on NESSIE submissi… |
| [VMAC](message-authentication/vmac.md) | — | Very high-speed message authentication code using universal hashing and AES-based key derivation. Designed for high performance with formal… |
| [VMPC-MAC](message-authentication/vmpc-mac.md) | 🧪 Experimental | Message authentication code based on VMPC stream cipher permutation with enhanced state mixing. Uses 32-byte accumulator and four mixing re… |
| [X9.19-MAC](message-authentication/x9-19-mac.md) | ⚠️ Deprecated | ANSI X9.19 Message Authentication Code using DES/3DES. Also known as ISO 9807-1 MAC Algorithm 3 Mode 1 or Retail MAC. Uses DES in CBC mode… |
| [XCBC-MAC](message-authentication/xcbc-mac.md) | 🛡️ Secure | Extended Cipher Block Chaining Message Authentication Code. Uses three derived keys with AES for cryptographic authentication. |
| [ZUC-128-MAC](message-authentication/zuc-128-mac.md) | 🛡️ Secure | 3GPP integrity algorithm 128-EIA3 for LTE/4G mobile communications. Uses ZUC-128 stream cipher to generate keystream and processes message… |

## Padding Schemes

_Data padding algorithms_

| Algorithm | Security | Summary |
| --- | --- | --- |
| [ANSI X9.23](padding-schemes/ansi-x9-23.md) | 🛡️ Secure | ANSI X9.23 padding scheme fills blocks with zero bytes except for the last byte, which indicates the padding length. This scheme is commonl… |
| [Bit Padding](padding-schemes/bit-padding.md) | 🛡️ Secure | Bit padding scheme appends a single '1' bit (0x80 byte) followed by zero bits to fill the block. This method provides unambiguous padding r… |
| [ISO 10126](padding-schemes/iso-10126.md) | ⚠️ Deprecated | ISO 10126 padding scheme fills blocks with random bytes except for the last byte, which indicates the padding length. This approach provide… |
| [ISO/IEC 7816-4](padding-schemes/iso-iec-7816-4.md) | 🛡️ Secure | ISO/IEC 7816-4 padding scheme appends a single '1' bit (0x80 byte) followed by zero bits to fill the block. This method is designed for sma… |
| [No Padding](padding-schemes/no-padding.md) | — | No padding scheme requires that input data must be an exact multiple of the block size. This approach is used when the application ensures… |
| [OAEP](padding-schemes/oaep.md) | 🛡️ Secure | OAEP (Optimal Asymmetric Encryption Padding) is a secure padding scheme for RSA encryption that provides strong security guarantees under t… |
| [OneAndZeros](padding-schemes/oneandzeros.md) | 🛡️ Secure | One and Zeros padding scheme appends a single '1' bit (0x80 byte) followed by zero bits (0x00 bytes) to fill the block. Provides unambiguou… |
| [PKCS#1 v1.5](padding-schemes/pkcs-1-v1-5.md) | 🎓 Educational Only | PKCS#1 version 1.5 padding scheme for RSA encryption and digital signatures. Provides randomized padding for RSA operations to prevent cert… |
| [PKCS#5](padding-schemes/pkcs-5.md) | 🛡️ Secure | PKCS#5 padding scheme is designed specifically for 8-byte block ciphers like DES. Each padding byte contains the number of padding bytes ad… |
| [PKCS#7](padding-schemes/pkcs-7.md) | 🛡️ Secure | PKCS#7 padding scheme where padding bytes contain the number of padding bytes added. This ensures data is padded to block boundary with det… |
| [PSS](padding-schemes/pss.md) | 🎓 Educational Only | Probabilistic Signature Scheme (PSS) padding for RSA signatures as defined in PKCS#1 v2.1. Provides provable security and resistance to sig… |
| [Random Padding](padding-schemes/random-padding.md) | 🎓 Educational Only | Random padding scheme fills remaining bytes with random values to reach the block size. This provides some obfuscation of message length pa… |
| [Zero Padding](padding-schemes/zero-padding.md) | 🎓 Educational Only | Zero padding scheme fills remaining bytes with zero values to reach the block size. This is the simplest padding method but has ambiguity i… |

## Post-Quantum Cryptography

_Quantum-resistant cryptographic algorithms_

| Algorithm | Security | Summary |
| --- | --- | --- |
| [ML-KEM](post-quantum-cryptography/ml-kem.md) | 🎓 Educational Only | Module Lattice-Based Key Encapsulation Mechanism standardized by NIST for post-quantum cryptography. Provides security against both classic… |

## Random Number Generators

_Pseudo-random number generators_

| Algorithm | Security | Summary |
| --- | --- | --- |
| [ACRNG (Additive Congruential RNG)](random-number-generators/acrng-additive-congruential-rng.md) | 🎓 Educational Only | The Additive Congruential Random Number Generator uses cascading additions through a state array, where each element is updated by adding t… |
| [ARS (AES-based Random Stream)](random-number-generators/ars-aes-based-random-stream.md) | 🎓 Educational Only | Counter-based PRNG using full AES round function with simplified Weyl-sequence key schedule. Designed for parallel computing with cryptogra… |
| [biski64](random-number-generators/biski64.md) | 🎓 Educational Only | biski64 is a very fast, high-quality 64-bit PRNG with 192-bit state combining a Weyl sequence with rotation-based mixing functions. It guar… |
| [Blum Blum Shub](random-number-generators/blum-blum-shub.md) | 🧪 Experimental | Blum Blum Shub (BBS) is a cryptographically secure pseudo-random number generator based on the difficulty of factoring and the quadratic re… |
| [Blum-Micali](random-number-generators/blum-micali.md) | 🧪 Experimental | Blum-Micali is a cryptographically secure pseudo-random bit generator based on the difficulty of computing discrete logarithms. It generate… |
| [ChaCha12 (PRNG)](random-number-generators/chacha12-prng.md) | 🎓 Educational Only | ChaCha stream cipher variant with 12 rounds designed by Daniel J. Bernstein. Counter-based PRNG providing excellent statistical properties… |
| [ChaCha20 (PRNG)](random-number-generators/chacha20-prng.md) | 🧪 Experimental | ChaCha stream cipher variant with 20 rounds designed by Daniel J. Bernstein. Counter-based PRNG providing excellent statistical properties… |
| [ChaCha8 (PRNG)](random-number-generators/chacha8-prng.md) | 🎓 Educational Only | ChaCha stream cipher variant with 8 rounds designed by Daniel J. Bernstein. Counter-based PRNG providing excellent statistical properties a… |
| [CMWC (Complementary Multiply-with-Carry)](random-number-generators/cmwc-complementary-multiply-with-carry.md) | 🎓 Educational Only | CMWC is an advanced pseudo-random number generator invented by George Marsaglia. It uses a large state array (4096 values) with multiply-an… |
| [Combined LCG](random-number-generators/combined-lcg.md) | 🎓 Educational Only | Combined Linear Congruential Generator combines outputs from multiple LCG instances to produce better statistical properties than a single… |
| [dSFMT-521 (Double precision SIMD-oriented Fast Mersenne Twister)](random-number-generators/dsfmt-521-double-precision-simd-oriented-fast-mersenne-twister.md) | 🎓 Educational Only | dSFMT-521 is a variant of Mersenne Twister optimized for generating double precision floating point numbers directly. It has period 2^521-1… |
| [FCSR](random-number-generators/fcsr.md) | 🎓 Educational Only | Feedback with Carry Shift Register is a pseudo-random sequence generator using arithmetic with carry instead of XOR operations. Operates in… |
| [Fortuna](random-number-generators/fortuna.md) | 🛡️ Secure | Fortuna is a cryptographically secure PRNG designed by Niels Ferguson and Bruce Schneier. Uses 32 SHA-256 entropy pools with exponential po… |
| [GFSR](random-number-generators/gfsr.md) | 🎓 Educational Only | Generalized Feedback Shift Register is a shift-register-based PRNG using multiple feedback taps for long-period pseudo-random sequences. Th… |
| [ICG (Inversive Congruential Generator)](random-number-generators/icg-inversive-congruential-generator.md) | 🎓 Educational Only | The Inversive Congruential Generator is a non-linear pseudorandom number generator that uses modular multiplicative inversion. It uses the… |
| [ISAAC](random-number-generators/isaac.md) | 🧪 Experimental | ISAAC (Indirection, Shift, Accumulate, Add, Count) is a cryptographically secure PRNG designed by Bob Jenkins. Features 8KB internal state,… |
| [JSF](random-number-generators/jsf.md) | 🎓 Educational Only | JSF (Jenkins Small Fast) is a compact, high-speed pseudo-random number generator by Bob Jenkins with 128-bit state. It uses simple operatio… |
| [KISS](random-number-generators/kiss.md) | 🎓 Educational Only | KISS (Keep It Simple Stupid) combines four simple generators (two MWC, one congruential, one shift-register) using XOR and addition to crea… |
| [Knuth-B](random-number-generators/knuth-b.md) | 🎓 Educational Only | Algorithm B from Knuth's The Art of Computer Programming, Volume 2. Implements a shuffle algorithm that wraps the minstd_rand0 linear congr… |
| [Lagged Fibonacci Generator](random-number-generators/lagged-fibonacci-generator.md) | 🎓 Educational Only | The Lagged Fibonacci Generator is a pseudo-random number generator based on the generalized Fibonacci recurrence X[n] = (X[n-j] ⊙ X[n-k]) m… |
| [LCG (Linear Congruential Generator)](random-number-generators/lcg-linear-congruential-generator.md) | 🎓 Educational Only | The Linear Congruential Generator is one of the oldest and most well-known pseudorandom number generator algorithms. It uses the formula X(… |
| [Lehmer RNG (Park-Miller)](random-number-generators/lehmer-rng-park-miller.md) | 🎓 Educational Only | A multiplicative linear congruential generator using the Park-Miller minimal standard parameters. Uses Schrage's method to avoid overflow w… |
| [Lehmer128](random-number-generators/lehmer128.md) | 🎓 Educational Only | Lehmer128 is a 128-bit multiplicative congruential generator (MCG) considered the minimal standard for modern 64-bit PRNGs. Based on Lehmer… |
| [Lehmer64](random-number-generators/lehmer64.md) | 🎓 Educational Only | Lehmer64 is a 64-bit multiplicative congruential generator (MCG) that uses 128-bit arithmetic internally for high-quality output. Based on… |
| [LFIB4](random-number-generators/lfib4.md) | 🎓 Educational Only | Marsaglia's 4-tap Lagged Fibonacci Generator uses four lags (256, 179, 119, 55) with additive operations to achieve better statistical prop… |
| [LFSR](random-number-generators/lfsr.md) | 🎓 Educational Only | Linear Feedback Shift Register is a fundamental pseudo-random sequence generator widely used in hardware testing, stream ciphers, and error… |
| [LFSR113](random-number-generators/lfsr113.md) | 🎓 Educational Only | LFSR113 is a combined linear feedback shift register using four Tausworthe components with primitive trinomials. With a period of approxima… |
| [LFSR258](random-number-generators/lfsr258.md) | 🎓 Educational Only | Combined Linear Feedback Shift Register using five 64-bit Tausworthe components with extremely long period (2^258). Developed for the TestU… |
| [LFSR88](random-number-generators/lfsr88.md) | 🎓 Educational Only | LFSR88 is a combined linear feedback shift register using three Tausworthe components with primitive trinomials. With a period of approxima… |
| [Mersenne Twister (MT19937)](random-number-generators/mersenne-twister-mt19937.md) | 🎓 Educational Only | MT19937 is a widely-used pseudo-random number generator with a period of 2^19937-1. It passes numerous statistical tests and is the default… |
| [Mersenne Twister 64-bit (MT19937-64)](random-number-generators/mersenne-twister-64-bit-mt19937-64.md) | 🎓 Educational Only | MT19937-64 is the 64-bit version of the widely-used Mersenne Twister PRNG with a period of 2^19937-1. It generates high-quality 64-bit pseu… |
| [Middle Square Method](random-number-generators/middle-square-method.md) | 🎓 Educational Only | The Middle Square Method is one of the earliest pseudorandom number generators, invented by John von Neumann in 1946. It generates numbers… |
| [Middle Square Weyl Sequence](random-number-generators/middle-square-weyl-sequence.md) | 🎓 Educational Only | MSWS is a modern improvement of von Neumann's 1949 Middle Square method. By adding a Weyl sequence with a golden ratio-derived increment, i… |
| [MIXMAX](random-number-generators/mixmax.md) | 🎓 Educational Only | MIXMAX is a matrix-recursive pseudo-random number generator based on Kolmogorov K-systems and Anosov C-systems. It uses a special NxN matri… |
| [MLCG (Multiplicative Linear Congruential Generator)](random-number-generators/mlcg-multiplicative-linear-congruential-generator.md) | 🎓 Educational Only | The Multiplicative Linear Congruential Generator is a simplified variant of LCG using only multiplication (no additive constant). It uses t… |
| [MRG32k3a](random-number-generators/mrg32k3a.md) | 🎓 Educational Only | MRG32k3a is a combined multiple recursive generator with period approximately 2^191. It combines two MRG components using carefully chosen… |
| [Mulberry32](random-number-generators/mulberry32.md) | 🎓 Educational Only | Mulberry32 is an extremely simple and fast 32-bit PRNG with single 32-bit state, designed by Tommy Ettinger. It uses a Weyl sequence combin… |
| [Multiply-with-Carry (MWC)](random-number-generators/multiply-with-carry-mwc.md) | 🎓 Educational Only | Multiply-with-Carry is a fast, simple PRNG invented by George Marsaglia. It uses multiply and carry operations to generate high-quality pse… |
| [MWC256 (Multiply-with-Carry 256)](random-number-generators/mwc256-multiply-with-carry-256.md) | 🎓 Educational Only | MWC256 is a multiply-with-carry generator with 256 32-bit elements invented by George Marsaglia. It achieves an extraordinary period of app… |
| [MWC64X](random-number-generators/mwc64x.md) | 🎓 Educational Only | MWC64X is a GPU-optimized 64-bit Multiply-With-Carry generator designed for OpenCL/CUDA with period ~2^63. It uses minimal state (64 bits)… |
| [PCG (Permuted Congruential Generator)](random-number-generators/pcg-permuted-congruential-generator.md) | 🎓 Educational Only | PCG is a family of simple, fast, space-efficient, statistically excellent pseudorandom number generators developed by Melissa O'Neill. This… |
| [PCG-RXS-M-XS](random-number-generators/pcg-rxs-m-xs.md) | 🎓 Educational Only | PCG variant using RXS-M-XS permutation (Random XorShift, Multiply, XorShift) - the most statistically powerful PCG output function. This 64… |
| [PCG-XSH-RS](random-number-generators/pcg-xsh-rs.md) | 🎓 Educational Only | PCG variant using 64-bit state with XSH-RS permutation (XOR-shift-high with random shift) to output 32-bit values. Requires 49 bits of stat… |
| [PCG-XSL-RR-64-32](random-number-generators/pcg-xsl-rr-64-32.md) | 🎓 Educational Only | PCG variant using 64-bit state with XSH-RR permutation (XOR-shift-high with random rotation) to output 32-bit values. This is the standard… |
| [PCG64-DXSM](random-number-generators/pcg64-dxsm.md) | 🎓 Educational Only | PCG variant using 128-bit state with DXSM (Double Xorshift Multiply) output permutation to produce 64-bit values. This is NumPy's default r… |
| [Philox4x32-10](random-number-generators/philox4x32-10.md) | 🎓 Educational Only | Counter-based PRNG using integer multiplication in a Feistel-like network. Trivially parallelizable with 2^128 period, passes all TestU01 s… |
| [Ran0 (Numerical Recipes)](random-number-generators/ran0-numerical-recipes.md) | 🎓 Educational Only | Park-Miller minimal standard PRNG from Numerical Recipes. Simple multiplicative linear congruential generator using Schrage's method to com… |
| [Ran1 (Numerical Recipes)](random-number-generators/ran1-numerical-recipes.md) | 🎓 Educational Only | Park-Miller Minimal Standard LCG combined with Bays-Durham shuffle (32 entries) from Numerical Recipes. Uses Schrage's method to compute (1… |
| [Ran2 (Numerical Recipes)](random-number-generators/ran2-numerical-recipes.md) | 🎓 Educational Only | Combined linear congruential generator with Bays-Durham shuffle from Numerical Recipes. Uses two LCGs with moduli 2147483563 and 2147483399… |
| [Ran3 (Numerical Recipes)](random-number-generators/ran3-numerical-recipes.md) | 🎓 Educational Only | Subtractive random number generator from Numerical Recipes based on Knuth's algorithm. Uses 55-element state array with subtractive method… |
| [RANLUX](random-number-generators/ranlux.md) | 🎓 Educational Only | RANLUX is a high-quality pseudo-random number generator based on subtract-with-borrow with luxury levels that control the fraction of disca… |
| [RANLUX24](random-number-generators/ranlux24.md) | 🎓 Educational Only | RANLUX24 is the C++ standard library implementation of Martin Lüscher's luxury-level random number generator. It uses a 24-bit subtract-wit… |
| [RANLUX48](random-number-generators/ranlux48.md) | 🎓 Educational Only | C++ standard library's highest-quality luxury PRNG using 48-bit subtract-with-borrow with luxury level 4. Designed for Monte Carlo simulati… |
| [Ranshi](random-number-generators/ranshi.md) | 🎓 Educational Only | Ranshi is a hardware-inspired shift register PRNG proposed by F. Gutbrod in 1995. It uses simple shift and XOR operations making it suitabl… |
| [RomuDuo](random-number-generators/romuduo.md) | 🎓 Educational Only | RomuDuo is a two-state member of the Romu (Rotate-Multiply) family of pseudo-random number generators designed by Mark Overton. It balances… |
| [RomuMono](random-number-generators/romumono.md) | 🎓 Educational Only | RomuMono is the fastest member of the Romu (Rotate-Multiply) family of pseudo-random number generators. It uses only a single 64-bit state… |
| [RomuQuad](random-number-generators/romuquad.md) | 🎓 Educational Only | RomuQuad is the highest-quality member of the Romu (Rotate-Multiply) family of pseudo-random number generators designed by Mark Overton. It… |
| [RomuTrio](random-number-generators/romutrio.md) | 🎓 Educational Only | RomuTrio is a member of the Romu (Rotate-Multiply) family of pseudo-random number generators designed by Mark Overton. It uses three 64-bit… |
| [Self-Shrinking Generator](random-number-generators/self-shrinking-generator.md) | 🎓 Educational Only | Self-Shrinking Generator (SSG) is a pseudorandom generator derived from a single Linear Feedback Shift Register (LFSR). It processes LFSR o… |
| [SFC32](random-number-generators/sfc32.md) | 🎓 Educational Only | Small Fast Counting (SFC32) is a high-quality PRNG by Chris Doty-Humphrey designed for the PractRand test suite. It combines a chaotic inve… |
| [SFC64](random-number-generators/sfc64.md) | 🎓 Educational Only | Small Fast Counting (SFC64) is a high-quality 64-bit PRNG by Chris Doty-Humphrey designed for the PractRand test suite. It combines a chaot… |
| [SFMT-19937 (SIMD-oriented Fast Mersenne Twister)](random-number-generators/sfmt-19937-simd-oriented-fast-mersenne-twister.md) | 🎓 Educational Only | SFMT19937 is a variant of Mersenne Twister optimized for modern CPUs with SIMD instructions. It generates 128-bit blocks with period 2^1993… |
| [Shioi128](random-number-generators/shioi128.md) | 🎓 Educational Only | Shioi128 is a fast LFSR-based pseudo-random number generator with 128-bit state producing 64-bit outputs. Designed for speed-critical appli… |
| [SHISHUA](random-number-generators/shishua.md) | 🎓 Educational Only | SHISHUA is the fastest PRNG in the world, achieving 0.06 cycles per byte on modern x86-64 processors. Designed by Thaddée Tyl using a shift… |
| [SplitMix32](random-number-generators/splitmix32.md) | 🎓 Educational Only | SplitMix32 is a fast 32-bit splittable PRNG based on MurmurHash3's fmix32 finalizer. It uses a Weyl sequence with golden ratio constant com… |
| [SplitMix64](random-number-generators/splitmix64.md) | 🎓 Educational Only | SplitMix64 is a very fast pseudo-random number generator designed by Guy L. Steele Jr. and Doug Lea. It uses a simple linear congruential u… |
| [Squares](random-number-generators/squares.md) | 🎓 Educational Only | Fast counter-based PRNG using multiple rounds of squaring, modernizing von Neumann's middle-square method. Trivially parallelizable with co… |
| [Subtract-with-Borrow (SWB)](random-number-generators/subtract-with-borrow-swb.md) | 🎓 Educational Only | Subtract-with-Borrow is a lagged Fibonacci generator with borrow propagation, invented by George Marsaglia and Arif Zaman in 1991. It uses… |
| [TEA-PRNG](random-number-generators/tea-prng.md) | 🎓 Educational Only | Pseudorandom number generator based on the Tiny Encryption Algorithm (TEA) operating in counter mode. Encrypts sequential 64-bit counter va… |
| [Threefry2x64-20](random-number-generators/threefry2x64-20.md) | 🎓 Educational Only | Counter-based PRNG using Threefish block cipher round function. Trivially parallelizable with 2^128 period, passes all TestU01 statistical… |
| [TinyMT (Tiny Mersenne Twister)](random-number-generators/tinymt-tiny-mersenne-twister.md) | 🎓 Educational Only | TinyMT32 is a compact variant of Mersenne Twister with 127-bit state and period of 2^127-1. Designed for embedded systems where MT19937's l… |
| [Tyche](random-number-generators/tyche.md) | 🧪 Experimental | Fast cryptographic PRNG based on 20-round ChaCha cipher designed by Samuel Neves and Filipe Araujo (2011). Tyche passes PractRand and TestU… |
| [WELL512a](random-number-generators/well512a.md) | 🎓 Educational Only | WELL (Well Equidistributed Long-period Linear) is a family of pseudo-random number generators designed to improve upon Mersenne Twister's e… |
| [Wichmann-Hill](random-number-generators/wichmann-hill.md) | 🎓 Educational Only | Combined random number generator using three Linear Congruential Generators with large prime moduli near 2^64. This modernized variant impr… |
| [Wyrand](random-number-generators/wyrand.md) | 🎓 Educational Only | Wyrand is an extremely fast 64-bit pseudo-random number generator based on the WyHash mixing function. Designed by Wang Yi, it passes TestU… |
| [XOR4096](random-number-generators/xor4096.md) | 🎓 Educational Only | XOR4096 is an extremely long-period pseudo-random number generator from Richard P. Brent's xorgens collection. With a 4096-bit state and pe… |
| [Xoroshiro128**](random-number-generators/xoroshiro128.md) | 🎓 Educational Only | Xoroshiro128** is a small, fast, all-purpose pseudo-random number generator with a 128-bit state. It features a multiplication-based scramb… |
| [Xoroshiro128+](random-number-generators/xoroshiro128-plus.md) | 🎓 Educational Only | Xoroshiro128+ is a fast, small-state pseudo-random number generator with a 128-bit state. The + variant uses simple addition as the scrambl… |
| [Xoroshiro128++](random-number-generators/xoroshiro128-plus-plus.md) | 🎓 Educational Only | Xoroshiro128++ is a small, fast, all-purpose pseudo-random number generator with a 128-bit state. It is the successor to xoroshiro128+, fea… |
| [Xoroshiro256**](random-number-generators/xoroshiro256.md) | 🎓 Educational Only | Xoroshiro256** is a large-state, high-quality pseudo-random number generator with a 256-bit state space. Adopted as the default PRNG for .N… |
| [XorShift*](random-number-generators/xorshift.md) | 🎓 Educational Only | XorShift* is a fast pseudo-random number generator using XOR-shift operations with multiplicative scrambling. Uses parameters (12, 25, 27)… |
| [XorShift+](random-number-generators/xorshift-plus.md) | 🎓 Educational Only | XorShift+ is a fast pseudo-random number generator using XOR-shift operations with addition scrambling. Uses parameters (23, 17, 26) and co… |
| [Xorshift1024*](random-number-generators/xorshift1024.md) | 🎓 Educational Only | Xorshift1024* is a large-state xorshift pseudo-random number generator with multiplicative scrambling by Sebastiano Vigna. Uses 1024 bits o… |
| [XorShift128](random-number-generators/xorshift128.md) | 🎓 Educational Only | XorShift128 is a very fast pseudo-random number generator invented by George Marsaglia. It uses three xorshift operations on a 128-bit stat… |
| [Xorshift32](random-number-generators/xorshift32.md) | 🎓 Educational Only | Xorshift32 is the simplest xorshift PRNG using a single 32-bit state with three XOR-shift operations. Invented by George Marsaglia in his s… |
| [Xorshift64](random-number-generators/xorshift64.md) | 🎓 Educational Only | Xorshift64 is a very fast pseudo-random number generator invented by George Marsaglia. It uses three xorshift operations on a single 64-bit… |
| [XorWow](random-number-generators/xorwow.md) | 🎓 Educational Only | XorWow combines George Marsaglia's XorShift algorithm with a Weyl sequence for improved statistical properties. It has a period of 2^192-2^… |
| [Xoshiro128**](random-number-generators/xoshiro128.md) | 🎓 Educational Only | Xoshiro128** is a 32-bit all-purpose, rock-solid pseudo-random number generator with excellent speed and statistical properties. It uses a… |
| [Xoshiro128++](random-number-generators/xoshiro128-plus-plus.md) | 🎓 Educational Only | Xoshiro128++ is a 32-bit all-purpose, rock-solid pseudo-random number generator with excellent speed and statistical properties. It feature… |
| [Xoshiro256**](random-number-generators/xoshiro256.md) | 🎓 Educational Only | Xoshiro256** is an all-purpose, rock-solid, small-state pseudo-random number generator with excellent speed and statistical properties. It… |
| [Xoshiro256+](random-number-generators/xoshiro256-plus.md) | 🎓 Educational Only | Xoshiro256+ is the fastest variant in the xoshiro256 family, using simple addition for the output function. It provides excellent speed but… |
| [Xoshiro256++](random-number-generators/xoshiro256-plus-plus.md) | 🎓 Educational Only | Xoshiro256++ is an all-purpose, rock-solid, small-state pseudo-random number generator with excellent speed and statistical properties. It… |
| [XXHash32 PRNG](random-number-generators/xxhash32-prng.md) | 🎓 Educational Only | Fast non-cryptographic PRNG based on XXHash32 mixing function, designed by Yann Collet. Uses XXHash32 finalizer for high-quality bit mixing… |
| [Yarrow-256](random-number-generators/yarrow-256.md) | 🎓 Educational Only | Yarrow-256 is a cryptographically secure pseudo-random number generator (CSPRNG) designed by Kelsey, Schneier, and Ferguson. Features dual… |

## Special Algorithms

_Special purpose algorithms_

| Algorithm | Security | Summary |
| --- | --- | --- |
| [3-Way](special-algorithms/3-way.md) | ❌ Broken | Block cipher designed by Joan Daemen in 1994 with unique 96-bit blocks and keys. Features elegant self-inverse properties and matrix operat… |
| [AES Key Wrap](special-algorithms/aes-key-wrap.md) | 🛡️ Secure | NIST-approved key wrapping algorithm (RFC 3394) that securely encrypts cryptographic keys using AES. Provides both confidentiality and inte… |
| [AES Key Wrap with Padding](special-algorithms/aes-key-wrap-with-padding.md) | 🛡️ Secure | RFC 5649 extension of AES Key Wrap that supports wrapping keys of any length (not limited to multiples of 8 bytes). Uses Alternative Initia… |
| [AES-SIV](special-algorithms/aes-siv.md) | 🎓 Educational Only | Educational implementation of AES-SIV deterministic authenticated encryption. Provides nonce misuse resistance with simplified cryptographi… |
| [ARIA Key Wrap with Padding](special-algorithms/aria-key-wrap-with-padding.md) | 🛡️ Secure | RFC 5649 key wrapping with padding applied to ARIA cipher. Supports arbitrary-length plaintext by padding to 8-byte multiples and embedding… |
| [ARIA-Wrap](special-algorithms/aria-wrap.md) | 🛡️ Secure | ARIA Key Wrap algorithm following RFC 3394 structure. Securely wraps cryptographic keys using ARIA block cipher with authenticated encrypti… |
| [Camellia Key Wrap](special-algorithms/camellia-key-wrap.md) | 🛡️ Secure | RFC 3657 key wrapping algorithm using Camellia cipher. Securely wraps cryptographic keys for transport using the RFC 3394 key wrap construc… |
| [Camellia Key Wrap with Padding](special-algorithms/camellia-key-wrap-with-padding.md) | 🛡️ Secure | RFC 5649 key wrapping with padding applied to Camellia cipher. Supports arbitrary-length plaintext by padding to 8-byte multiples and embed… |
| [CryptoPro Key Wrap](special-algorithms/cryptopro-key-wrap.md) | ⚠️ Deprecated | Russian GOST 28147-89 based key wrapping with RFC 4357 key diversification. Uses CryptoPro S-box and optional MAC for integrity. |
| [Fiat-Shamir Protocol](special-algorithms/fiat-shamir-protocol.md) | 🎓 Educational Only | Zero-knowledge identification protocol using quadratic residues. Demonstrates proof of knowledge without revealing secrets through interact… |
| [FISH Stream Cipher](special-algorithms/fish-stream-cipher.md) | ❌ Broken | FISH (FIbonacci SHrinking) Stream Cipher designed by Blöcher and Dichtl (1993). Combines Lagged Fibonacci generators with shrinking generat… |
| [Gimli](special-algorithms/gimli.md) | 🎓 Educational Only | Cross-platform 384-bit cryptographic permutation designed for high security and performance. Can construct hash functions or stream ciphers… |
| [GOST 28147-89 Key Wrap](special-algorithms/gost-28147-89-key-wrap.md) | ⚠️ Deprecated | Key wrapping algorithm using GOST 28147-89 block cipher with MAC authentication. Wraps keys by encrypting blocks and appending a 4-byte MAC… |
| [HOTP](special-algorithms/hotp.md) | 🛡️ Secure | HMAC-Based One-Time Password algorithm as defined in RFC 4226. Generates time-independent OTPs using HMAC-SHA1 for two-factor authenticatio… |
| [Kalyna Key Wrap](special-algorithms/kalyna-key-wrap.md) | 🛡️ Secure | RFC 3394-style key wrapping using the Kalyna block cipher as specified in DSTU 7624:2014. Provides authenticated encryption for key materia… |
| [RC2-WRAP](special-algorithms/rc2-wrap.md) | ⚠️ Deprecated | RC2 Key Wrap per RFC 3217. Wraps cryptographic key material using RC2-CBC with CMS Key Checksum for integrity verification. Deprecated in f… |
| [RFC 3211 Key Wrap](special-algorithms/rfc-3211-key-wrap.md) | ⚠️ Deprecated | Password-based key wrapping algorithm from RFC 3211 for CMS. Uses CBC mode with random padding and checksum verification. Older standard co… |
| [SEED Key Wrap with Padding](special-algorithms/seed-key-wrap-with-padding.md) | 🛡️ Secure | RFC 5649 key wrapping with padding applied to SEED cipher. Supports arbitrary-length plaintext by padding to 8-byte multiples and embedding… |
| [SEED-WRAP](special-algorithms/seed-wrap.md) | 🛡️ Secure | RFC 4010 SEED Key Wrap algorithm. Provides authenticated encryption for key material using SEED block cipher with RFC 3394 key wrap structu… |
| [Shamir Secret Sharing](special-algorithms/shamir-secret-sharing.md) | 🎓 Educational Only | Secret sharing scheme that splits a secret into n shares where any k shares can reconstruct the original secret. Based on polynomial interp… |
| [Simpira-128](special-algorithms/simpira-128.md) | 🧪 Experimental | Simpira-128 permutation using AES round function. Input/output size: 128 bits (16 bytes). Designed for Intel AES-NI optimization. |
| [Simpira-256](special-algorithms/simpira-256.md) | 🧪 Experimental | Simpira-256 permutation using AES round function. Input/output size: 256 bits (32 bytes). Designed for Intel AES-NI optimization. |
| [Simpira-512](special-algorithms/simpira-512.md) | 🧪 Experimental | Simpira-512 permutation using AES round function. Input/output size: 512 bits (64 bytes). Designed for Intel AES-NI optimization. |
| [Time-Lock Puzzle](special-algorithms/time-lock-puzzle.md) | 🎓 Educational Only | Timed-release cryptography that encrypts messages requiring specified computation time for decryption. Educational implementation of sequen… |
| [TOTP](special-algorithms/totp.md) | 🛡️ Secure | Time-Based One-Time Password algorithm as defined in RFC 6238. Generates time-dependent OTPs using HMAC for two-factor authentication, sync… |
| [Triple DES Key Wrap](special-algorithms/triple-des-key-wrap.md) | ⚠️ Deprecated | RFC 3217 key wrapping using Triple-DES in CBC mode with CMS key checksum. Wraps cryptographic keys for secure transport using 3DES encrypti… |
| [XChaCha20-Poly1305](special-algorithms/xchacha20-poly1305.md) | 🎓 Educational Only | Extended ChaCha20-Poly1305 authenticated encryption with 192-bit nonces. Provides the security and performance of ChaCha20-Poly1305 while e… |

## Stream Ciphers

_Stream-based symmetric encryption_

| Algorithm | Security | Summary |
| --- | --- | --- |
| [A5 (DarkCrypt)](stream-ciphers/a5-darkcrypt.md) | 🎓 Educational Only | A5-family stop/go three-LFSR stream cipher from the DarkCrypt Total Commander plugin. Loads the 64-bit key directly into the registers (no… |
| [A5/1](stream-ciphers/a5-1.md) | ❌ Broken | GSM stream cipher using three irregularly clocked LFSRs with majority voting. Educational implementation demonstrating telecommunications s… |
| [A5/2](stream-ciphers/a5-2.md) | ❌ Broken | Weakened GSM stream cipher using four irregularly clocked LFSRs. Intentionally weakened export version with severe cryptographic vulnerabil… |
| [A5/3](stream-ciphers/a5-3.md) | — | Stream cipher used in 3G/UMTS mobile communications based on KASUMI block cipher. More secure replacement for A5/1 and A5/2. Uses 128-bit k… |
| [Achterbahn-128/80](stream-ciphers/achterbahn-128-80.md) | ❌ Broken | NLFSR-based stream cipher from the eSTREAM project: 13 nonlinear feedback shift registers of lengths 21 to 33 feed a Boolean combining func… |
| [ACORN-128](stream-ciphers/acorn-128.md) | 🛡️ Secure | Production-grade authenticated encryption with associated data (AEAD) stream cipher. CAESAR competition winner for lightweight cryptography… |
| [AEGIS-128](stream-ciphers/aegis-128.md) | 🎓 Educational Only | High-performance authenticated encryption with associated data (AEAD) using AES round function. Winner of CAESAR competition high-performan… |
| [AES-GCM-SIV](stream-ciphers/aes-gcm-siv.md) | 🎓 Educational Only | Simplified educational implementation of nonce-misuse resistant AEAD. Demonstrates synthetic IV generation and stream encryption principles… |
| [Beth-Piper Stop-and-Go Generator](stream-ciphers/beth-piper-stop-and-go-generator.md) | 🎓 Educational Only | Clock-controlled LFSR stream cipher using stop-and-go clocking strategy. One LFSR controls the irregular clocking of a second LFSR to intro… |
| [CARACACHS (PC3)](stream-ciphers/caracachs-pc3.md) | 🎓 Educational Only | Variable-key stream cipher using PRNG-based keystream generation. Created by Alexandre Pukall in 2000, later used by Lazarus Group (North K… |
| [ChaCha20](stream-ciphers/chacha20.md) | — | Modern stream cipher designed by Daniel J. Bernstein as a variant of Salsa20 with improved diffusion. Uses 20 rounds of quarter-round opera… |
| [ChaCha8 (DarkCrypt)](stream-ciphers/chacha8-darkcrypt.md) | 🎓 Educational Only | Reduced-round (8-round) ChaCha variant with the original Bernstein state layout (64-bit block counter + 64-bit nonce, instead of RFC 7539's… |
| [CryptMT3 (DarkCrypt)](stream-ciphers/cryptmt3-darkcrypt.md) | 🎓 Educational Only | CryptMT version 3: an F2-linear (SFMT-family) generator combined with a nonlinear multiplicative filter with memory (Matsumoto, Saito, Nish… |
| [Crypto-1](stream-ciphers/crypto-1.md) | ❌ Broken | Proprietary stream cipher used in NXP MIFARE Classic cards, reverse-engineered by cryptographic community. Uses 48-bit LFSR with nonlinear… |
| [DECIM (DarkCrypt)](stream-ciphers/decim-darkcrypt.md) | 🎓 Educational Only | Non-standard DECIM-derived stream cipher (288-bit byte-per-bit LFSR, 128-bit key, 128-bit IV, 1152-round warm-up, standard 1-bit ABSG decim… |
| [DICING (DarkCrypt)](stream-ciphers/dicing-darkcrypt.md) | 🎓 Educational Only | DICING synchronous stream cipher, 256-bit key / 256-bit IV variant matching DarkCrypt's "Dicing (256 bit)". Two GF(2^m)-based projector pai… |
| [Dragon](stream-ciphers/dragon.md) | ❌ Broken | Word-based eSTREAM candidate using two NLFSRs with 32-bit operations for high-speed software. Designed by Chen, Henricksen, et al. but elim… |
| [Dragon (DarkCrypt)](stream-ciphers/dragon-darkcrypt.md) | 🎓 Educational Only | Real Dragon-256 eSTREAM Phase 3 Focus candidate: a single 1024-bit NLFSR filtered by a reversible F function built from two 8x32 S-boxes. 2… |
| [E0](stream-ciphers/e0.md) | ❌ Broken | Stream cipher used in Bluetooth protocol for encryption. Combines four LFSRs with nonlinear combining function using majority logic. Has kn… |
| [E2 (NTT AES candidate)](stream-ciphers/e2-ntt-aes-candidate.md) | educational | Educational implementation of E2 block cipher adapted as a stream cipher using keystream generation. Originally an AES candidate by NTT wit… |
| [Edon80](stream-ciphers/edon80.md) | 🎓 Educational Only | Edon80 quasigroup-based stream cipher, an eSTREAM hardware-profile candidate built from an 80-stage pipeline of e-transformers, each bound… |
| [F-FCSR](stream-ciphers/f-fcsr.md) | — | Feedback with Carry Shift Register stream cipher based on eSTREAM specification. Uses FCSR automaton with binary expansion of 2-adic number… |
| [F-FCSR (DarkCrypt)](stream-ciphers/f-fcsr-darkcrypt.md) | — | Feedback-with-Carry Shift Register (Galois FCSR) filter generator from the DarkCrypt Total Commander plugin. Non-standard 256-bit register… |
| [Fubuki (DarkCrypt)](stream-ciphers/fubuki-darkcrypt.md) | 🎓 Educational Only | Fubuki stream/block cipher built on an untempered Mersenne Twister (MT19937) generator: the key and initial value seed MT19937, whose raw o… |
| [Geffe Generator](stream-ciphers/geffe-generator.md) | — | Classical stream cipher using three Linear Feedback Shift Registers (LFSRs) and a Boolean combining function. Uses correlation between outp… |
| [Grain v1](stream-ciphers/grain-v1.md) | 🛡️ Secure | Lightweight stream cipher using LFSR and NFSR designed for restricted hardware environments. Selected for eSTREAM Portfolio Profile 2. Uses… |
| [Grain-128](stream-ciphers/grain-128.md) | 🛡️ Secure | Hardware-oriented stream cipher using LFSR and NFSR designed for restricted hardware environments. Selected for eSTREAM Portfolio Profile 2… |
| [HC-128](stream-ciphers/hc-128.md) | — | eSTREAM Profile 1 finalist with table-based design. Uses two 512-word tables with complex update functions for high-speed software encrypti… |
| [HC-256](stream-ciphers/hc-256.md) | — | eSTREAM Phase 3 finalist with large table-based design. Uses two 1024-word tables with nonlinear update functions for high-speed software e… |
| [Hermes8 (DarkCrypt)](stream-ciphers/hermes8-darkcrypt.md) | 🎓 Educational Only | Hermes8 byte-oriented stream cipher as shipped in the DarkCrypt Total Commander plugin. Built around the AES S-box with a 17-byte state reg… |
| [ISAAC (DarkCrypt)](stream-ciphers/isaac-darkcrypt.md) | 🎓 Educational Only | Bob Jenkins's ISAAC PRNG wrapped as a stream cipher by the DarkCrypt Total Commander plugin. Seeds from a full 1024-byte state buffer, disc… |
| [Konton (DarkCrypt)](stream-ciphers/konton-darkcrypt.md) | 🎓 Educational Only | 512-bit-key table-driven ARX stream cipher from the DarkCrypt Total Commander plugin. A 32-word table is derived from the key, then walked… |
| [Leviathan](stream-ciphers/leviathan.md) | 🎓 Educational Only | Large-state eSTREAM candidate with 4096-bit internal state. Uses 8 parallel LFSRs with nonlinear S-box filter for high security margin. Des… |
| [LEX2 (DarkCrypt)](stream-ciphers/lex2-darkcrypt.md) | 🎓 Educational Only | AES-128-based keystream leak-extraction stream cipher from the DarkCrypt Total Commander plugin, related to Alex Biryukov's eSTREAM candida… |
| [LILI-128 (DarkCrypt)](stream-ciphers/lili-128-darkcrypt.md) | 🎓 Educational Only | Clock-controlled LFSR keystream generator matching the public LILI-128 design (Simpson/Dawson/Golic/Millan, SAC 2000): a 39-bit LFSRc irreg… |
| [LILI-2 (DarkCrypt)](stream-ciphers/lili-2-darkcrypt.md) | 🎓 Educational Only | Enlarged successor to LILI-128 used by the DarkCrypt Total Commander plugin: two 128-bit clock-controlled shift registers (LFSRc, LFSRd) wi… |
| [MDC (DarkCrypt)](stream-ciphers/mdc-darkcrypt.md) | 🎓 Educational Only | Self-keying CFB stream cipher built on the standard MD5 compression function, with a 100-round self-referential key schedule that scrambles… |
| [MICKEY](stream-ciphers/mickey.md) | 🎓 Educational Only | Hardware-oriented stream cipher using two 100-bit registers with irregular clocking. Part of the eSTREAM hardware portfolio. Educational im… |
| [MICKEY 2.0 (DarkCrypt)](stream-ciphers/mickey-2-0-darkcrypt.md) | 🎓 Educational Only | MICKEY 2.0 mutual irregular-clocking stream cipher, 128-bit key / 128-bit IV variant with 160-bit R and S registers (DarkCrypt's "Mickey 12… |
| [MICKEY-128](stream-ciphers/mickey-128.md) | 🎓 Educational Only | Educational implementation of MICKEY-128 enhanced stream cipher based on MICKEY v2 eSTREAM winner. Features 128-bit keys and irregular cloc… |
| [Miller Encoding](stream-ciphers/miller-encoding.md) | 🎓 Educational Only | Educational implementation of Miller encoding adapted as a stream cipher. Miller encoding is a line code where data bits are encoded with c… |
| [Mir (DarkCrypt)](stream-ciphers/mir-darkcrypt.md) | 🎓 Educational Only | Mir stream cipher from the DarkCrypt Total Commander plugin. Six 64-bit state words mixed with 64-bit modular multiplications, a T-function… |
| [MORUS](stream-ciphers/morus.md) | 🧪 Experimental | CAESAR competition finalist for authenticated encryption. High-performance AEAD cipher with 5-register state machine optimized for modern p… |
| [Moustique](stream-ciphers/moustique.md) | ❌ Broken | Self-synchronizing stream cipher built around a 96-bit conjugated cellular shift register whose feedback rule is driven by the produced cip… |
| [MUGI Stream Cipher](stream-ciphers/mugi-stream-cipher.md) | 🎓 Educational Only | Educational implementation of MUGI stream cipher. MUGI is a word-oriented stream cipher with a 128-bit key and 128-bit internal state, desi… |
| [NLS2 (DarkCrypt)](stream-ciphers/nls2-darkcrypt.md) | 🎓 Educational Only | NLSv2 stream cipher (SOBER-family eSTREAM candidate) as implemented in the DarkCrypt Total Commander plugin. 17-word register with a rotate… |
| [NORX](stream-ciphers/norx.md) | 🎓 Educational Only | Educational implementation of NORX authenticated encryption algorithm. CAESAR competition candidate designed for high performance on 64-bit… |
| [Panama (DarkCrypt)](stream-ciphers/panama-darkcrypt.md) | 🎓 Educational Only | Panama belt-and-mill construction used as a keystream generator (PRNG mode), as implemented in the DarkCrypt Total Commander plugin. Distin… |
| [Phelix](stream-ciphers/phelix.md) | 🎓 Educational Only | Educational implementation inspired by Phelix stream cipher. eSTREAM candidate designed for high-speed authenticated encryption using XOR,… |
| [PIKE](stream-ciphers/pike.md) | 🎓 Educational Only | Educational implementation inspired by Pike stream cipher. Designed by Ross Anderson using three lagged Fibonacci generators with clock con… |
| [Pike (DarkCrypt)](stream-ciphers/pike-darkcrypt.md) | 🎓 Educational Only | Lagged-Fibonacci stream cipher with three add-with-carry registers of lengths 55, 57 and 58 words; each step, registers whose carry bit mat… |
| [Pomaranch](stream-ciphers/pomaranch.md) | 🎓 Educational Only | Educational implementation inspired by Pomaranch eSTREAM Phase 3 finalist. Uses nine linear feedback shift registers with nonlinear combini… |
| [Pomaranch (DarkCrypt)](stream-ciphers/pomaranch-darkcrypt.md) | 🎓 Educational Only | Cascade Jump Controlled Sequence Generator (CJCSG), the 128-bit-key stream cipher behind Pomaranch: nine cascaded jump registers whose cell… |
| [ProVEST-32](stream-ciphers/provest-32.md) | ❌ Broken | ProVEST-32, the Phase 1 VEST-32 root cipher in its eSTREAM API version: the VEST-32 structure with earlier counters, permutations and outpu… |
| [Py (DarkCrypt)](stream-ciphers/py-darkcrypt.md) | — | Py ("Roo") eSTREAM Phase 2 candidate by Biham and Seberry, using two rolling arrays (a 260-word Y array and a 256-byte permutation P) index… |
| [Py6 (DarkCrypt)](stream-ciphers/py6-darkcrypt.md) | — | Reduced-state variant of Py by Biham and Seberry: a 64-entry (6-bit) rolling permutation P and a 68-entry rolling word array Y, same round… |
| [Pypy (DarkCrypt)](stream-ciphers/pypy-darkcrypt.md) | — | Strengthened variant of Py by Biham and Seberry: same rolling-array key/IV setup as Py, but the round output stage is simplified to a singl… |
| [QCypher (DarkCrypt)](stream-ciphers/qcypher-darkcrypt.md) | 🎓 Educational Only | Autokey byte-feedback stream cipher from the DarkCrypt Total Commander plugin. A 256-entry table plus three running indices are updated on… |
| [Rabbit](stream-ciphers/rabbit.md) | — | High-speed stream cipher with 513-bit internal state using 8 state variables, 8 counter variables, and 1 carry bit. Designed for software i… |
| [Rabbit (DarkCrypt)](stream-ciphers/rabbit-darkcrypt.md) | — | DarkCrypt port of the Rabbit stream cipher. Identical state machine to RFC 4503, but the keystream words are serialized in little-endian or… |
| [RC4](stream-ciphers/rc4.md) | ❌ Broken | Variable-key-size stream cipher using 256-byte internal state with KSA and PRGA algorithms. BROKEN - deprecated by RFC 7465 due to statisti… |
| [RC4-drop[65536] (DarkCrypt)](stream-ciphers/rc4-drop-65536-darkcrypt.md) | ❌ Broken | Standard RC4 KSA/PRGA with a fixed 1024-bit (128-byte) key, discarding the first 65536 generated keystream bytes before output. As implemen… |
| [Rule30](stream-ciphers/rule30.md) | 🎓 Educational Only | Elementary cellular automaton-based pseudorandom number generator using Rule 30 pattern. Exhibits chaotic behavior but NOT cryptographicall… |
| [Salsa20](stream-ciphers/salsa20.md) | — | ARX-based stream cipher designed for high performance and security using Addition, Rotation, and XOR operations. Part of eSTREAM portfolio… |
| [SCOP-384 (DarkCrypt)](stream-ciphers/scop-384-darkcrypt.md) | 🎓 Educational Only | 384-bit table-driven stream cipher as implemented in the DarkCrypt Total Commander plugin kernel, built on an imul-chain key schedule and a… |
| [SEAL-3.0-BE](stream-ciphers/seal-3-0-be.md) | ❌ Broken | Software-optimized stream cipher designed by Rogaway and Coppersmith using SHA-1-based table generation. Generates 1024 bytes of keystream… |
| [SEAL-3.0-LE](stream-ciphers/seal-3-0-le.md) | ❌ Broken | Software-optimized stream cipher designed by Rogaway and Coppersmith using SHA-1-based table generation. Generates 1024 bytes of keystream… |
| [SEAL2 (DarkCrypt)](stream-ciphers/seal2-darkcrypt.md) | 🎓 Educational Only | Rogaway/Coppersmith SEAL variant from the DarkCrypt Total Commander plugin: SHA-0-shaped table generation (T[512]/S[256]/R[16]) from a 160-… |
| [Sfinks (DarkCrypt)](stream-ciphers/sfinks-darkcrypt.md) | 🎓 Educational Only | eSTREAM Phase-2 Sfinks nonlinear filter generator (256-bit LFSR, GF(2^16) inversion filter, 80-bit key, 80-bit IV, 128-round resynchronizat… |
| [Shannon (DarkCrypt)](stream-ciphers/shannon-darkcrypt.md) | 🎓 Educational Only | Shannon stream cipher (Hawkes, McDonald, Paddon, Rose, Wiggers de Vries), 256-bit key / 128-bit nonce, keystream-only path (MAC unused). Un… |
| [Shrinking Generator](stream-ciphers/shrinking-generator.md) | 🎓 Educational Only | LFSR-based stream cipher using irregular decimation by Coppersmith, Krawczyk, and Mansour. Uses two LFSRs where one controls bit selection… |
| [SN3 (DarkCrypt)](stream-ciphers/sn3-darkcrypt.md) | 🎓 Educational Only | Table-driven stream cipher with a 192-word key-dependent S-box, conventionally split into three 64-word tables that rotate roles every 64 s… |
| [SNOW 2.0 (DarkCrypt)](stream-ciphers/snow-2-0-darkcrypt.md) | 🎓 Educational Only | Ekdahl and Johansson's SNOW 2.0 stream cipher (16-word GF(2^32) LFSR + AES-S-box-based FSM), as implemented in the DarkCrypt Total Commande… |
| [SNOW 3G](stream-ciphers/snow-3g.md) | 🛡️ Secure | 3GPP standardized stream cipher for UMTS/3G networks. Used in UEA2 confidentiality and UIA2 integrity algorithms. Features LFSR-based desig… |
| [SOBER-128](stream-ciphers/sober-128.md) | 🎓 Educational Only | Word-based stream cipher with 17-stage LFSR and non-linear filter, designed by Greg Rose of QUALCOMM. Features key-dependent KONST generati… |
| [SOSEMANUK](stream-ciphers/sosemanuk.md) | 🛡️ Secure | ARX-based stream cipher combining SNOW-like LFSR with Serpent S-boxes. eSTREAM Profile 1 finalist with 128/256-bit keys and 128-bit IV. Des… |
| [Sosemanuk (DarkCrypt)](stream-ciphers/sosemanuk-darkcrypt.md) | 🎓 Educational Only | Sosemanuk stream cipher (eSTREAM Profile 1 software portfolio finalist) as implemented in the DarkCrypt Total Commander plugin. Combines a… |
| [Spritz](stream-ciphers/spritz.md) | 🧪 Experimental | Sponge-like stream cipher designed as RC4 successor by Rivest and Schuldt. Uses 256-byte state with absorb/squeeze operations similar to Ke… |
| [SSS (DarkCrypt)](stream-ciphers/sss-darkcrypt.md) | 🎓 Educational Only | SSS ("Self-Synchronizing SOBER") stream cipher as implemented in the DarkCrypt Total Commander plugin. A 17-word, 16-bit register is fed wi… |
| [TPy (DarkCrypt)](stream-ciphers/tpy-darkcrypt.md) | — | Tweaked-IV-setup variant of Py by Biham and Seberry (2007), fixing the equivalent-IV weakness of the original Py while keeping its key setu… |
| [TPy6 (DarkCrypt)](stream-ciphers/tpy6-darkcrypt.md) | — | Tweaked-IV-setup variant of Py6 by Biham and Seberry (2007): same reduced-state key setup and round function as Py6, but the IV mixing deri… |
| [TPypy (DarkCrypt)](stream-ciphers/tpypy-darkcrypt.md) | — | Tweaked-IV-setup variant of Pypy by Biham and Seberry (2007), the strongest published member of the Py family: Pypy's single-word-per-round… |
| [Trivium](stream-ciphers/trivium.md) | 🛡️ Secure | Hardware-oriented NLFSR-based stream cipher using three interconnected shift registers. eSTREAM hardware portfolio finalist and ISO/IEC 291… |
| [Trivium (DarkCrypt)](stream-ciphers/trivium-darkcrypt.md) | 🎓 Educational Only | Standard eSTREAM Trivium NLFSR (93+84+111 bit state, 80-bit key, 80-bit IV, 1152-round warm-up) as implemented in the DarkCrypt Total Comma… |
| [TSC-4](stream-ciphers/tsc-4.md) | 🎓 Educational Only | Stream cipher with extremely complex nonlinear operations using multiple S-boxes and parallel LFSRs. Submitted to eSTREAM but eliminated ea… |
| [Turing (DarkCrypt)](stream-ciphers/turing-darkcrypt.md) | 🎓 Educational Only | Turing stream cipher (Rose and Hawkes, Qualcomm), 256-bit key / 128-bit IV variant. LFSR + keyed S-box mixing, algorithm matches the publis… |
| [VEST-16](stream-ciphers/vest-16.md) | ❌ Broken | VEST-16 root cipher (eSTREAM Phase 2): 16 nonlinear RNS counters drive a 331-bit nonlinear accumulator through a linear diffusor; 16 output… |
| [VEST-32](stream-ciphers/vest-32.md) | ❌ Broken | VEST-32 root cipher (eSTREAM Phase 2): 16 nonlinear RNS counters drive a 587-bit nonlinear accumulator through a linear diffusor; 32 output… |
| [VEST-4](stream-ciphers/vest-4.md) | ❌ Broken | VEST-4 root cipher (eSTREAM Phase 2): 16 nonlinear RNS counters drive an 83-bit nonlinear accumulator through a linear diffusor; 4 output b… |
| [VEST-8](stream-ciphers/vest-8.md) | ❌ Broken | VEST-8 root cipher (eSTREAM Phase 2): 16 nonlinear RNS counters drive a 211-bit nonlinear accumulator through a linear diffusor; 8 output b… |
| [VMPC](stream-ciphers/vmpc.md) | 🧪 Experimental | Variably Modified Permutation Composition stream cipher using RC4-like structure with enhanced mixing function P[P[P[s]]+1]. Designed as im… |
| [VMPC-KSA3](stream-ciphers/vmpc-ksa3.md) | 🧪 Experimental | Enhanced VMPC variant with modified Key Scheduling Algorithm using three 768-round mixing phases (key-IV-key). Provides increased security… |
| [WAKE (DarkCrypt)](stream-ciphers/wake-darkcrypt.md) | ❌ Broken | David Wheeler's WAKE stream cipher as implemented in the DarkCrypt Total Commander plugin: a 257-word table-driven M() cascade over four ru… |
| [WAKE-OFB-BE](stream-ciphers/wake-ofb-be.md) | ❌ Broken | Table-driven stream cipher designed by David Wheeler using 32-bit word operations with auto-key generation. Operates in OFB mode with casca… |
| [WAKE-OFB-LE](stream-ciphers/wake-ofb-le.md) | ❌ Broken | Table-driven stream cipher designed by David Wheeler using 32-bit word operations with auto-key generation. Operates in OFB mode with casca… |
| [WG (DarkCrypt)](stream-ciphers/wg-darkcrypt.md) | 🎓 Educational Only | Welch-Gong (WG) transformation stream cipher: an 11-stage LFSR over GF(2^29) filtered by a degree-11 normal-basis nonlinear transformation.… |
| [XChaCha20 Extended-Nonce Stream Cipher](stream-ciphers/xchacha20-extended-nonce-stream-cipher.md) | 🧪 Experimental | Extended-nonce variant of ChaCha20 providing 192-bit nonces instead of 96-bit. Uses HChaCha20 key derivation to generate subkeys, eliminati… |
| [XSalsa20](stream-ciphers/xsalsa20.md) | 🛡️ Secure | Extended-nonce variant of Salsa20 stream cipher with 192-bit nonces. Uses HSalsa20 for subkey derivation enabling longer nonces without inc… |
| [Yamb (DarkCrypt)](stream-ciphers/yamb-darkcrypt.md) | ❌ Broken | T-function-based eSTREAM Phase 1 candidate by LAN Crypto, combining Galois-style word LFSRs (state OLZ, feedback 0x091B17C9) with a 256-byt… |
| [ZK-Crypt v3 (DarkCrypt)](stream-ciphers/zk-crypt-v3-darkcrypt.md) | 🎓 Educational Only | eSTREAM Profile II (hardware) 'Variable Clocking Mechanism' stream cipher: three irregularly-clocked nLFSR data banks with independent smal… |
| [ZUC](stream-ciphers/zuc.md) | 🛡️ Secure | Word-oriented stream cipher with 16-stage LFSR over GF(2^31-1). Core of 3GPP LTE/4G confidentiality (128-EEA3) and integrity (128-EIA3) alg… |
| [ZUC-256](stream-ciphers/zuc-256.md) | 🎓 Educational Only | Enhanced word-oriented stream cipher with 16-stage LFSR over GF(2^31-1). Successor to ZUC-128 for next-generation 5G/6G mobile communicatio… |

---

Regenerate with `node tools/generate-algorithm-docs.js`. CI regenerates and commits this tree on
every push to `main`, so the published reference follows the sources.

[← Cipher tools](../../)
