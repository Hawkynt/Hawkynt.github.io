#!/usr/bin/env node
/*
 * Round-trip exemptions - the single list of algorithms not required to invert
 * (c)2006-2025 Hawkynt
 *
 * Two suites ask the same question and used to answer it separately.
 * RoundTripSuite drives every reversible algorithm with an adversarial corpus;
 * TestEngine checks each algorithm against its own vectors and marks one
 * 'failed-roundtrips' when the inverse does not recover the input. Because
 * TestEngine had no notion of which algorithms are supposed to have an inverse,
 * its verdict could not be acted on: a signature scheme has no decryption
 * direction and would fail forever, so the result was displayed and discarded,
 * and 36 algorithms reported a failed invertibility requirement inside a run
 * that printed 100% and exited 0.
 *
 * Keeping the list here lets both suites gate on it. A name on this list is
 * declared to have no meaningful inverse, or an inverse that recovers a
 * normalised form of the input rather than the input; a name absent from it
 * that fails to invert is a defect and fails the run.
 *
 * Every entry carries its reason, and the reason has to say which of those two
 * it is. Nothing belongs here because it is inconvenient.
 */

// Exempt from the cipher tier, with the reason next to each. Two kinds appear
// here and the wording says which: constructions that have no inverse at all,
// and ciphers whose output is a normalised form of their input rather than the
// input itself. Nothing is listed here merely because it is inconvenient - a
// wrong answer from anything not on this list fails the run.
const ROUND_TRIP_EXEMPT = new Map([
  // --- no inverse exists ---
  ['HOTP', 'one-time password generator: a counter yields a short code and nothing maps back'],
  ['TOTP', 'one-time password generator: a time step yields a short code and nothing maps back'],
  ['Shamir Secret Sharing', 'splits a secret into shares; one share is by construction not the secret'],
  ['Time-Lock Puzzle', 'recovery is deliberately expensive sequential squaring, not an inverse operation'],
  ['Al-Kindi Frequency Analysis', 'a cryptanalysis aid that reports letter statistics; it is not a cipher'],
  ['PSS', 'PKCS#1 v2.1 defines EMSA-PSS-VERIFY and no decode: the encoded message holds '
    + 'Hash(padding || messageHash || salt), never the message hash itself'],

  // --- output is a normalised form of the input ---
  // The classical squares hold 25 cells for 26 letters, so J is folded into I,
  // and the digraph ciphers pad an odd-length message with a filler letter.
  // Verified: "PUBOCJVLFK" comes back as "PUBOCIVLFK", and "A" as "AX".
  ['Playfair Cipher', '5x5 square folds J into I and pads odd length with X, so the plaintext is normalised'],
  ['Polybius Square', '5x5 square folds J into I, so the plaintext is normalised'],
  ['Bifid Cipher', '5x5 square folds J into I, so the plaintext is normalised'],
  ['Trifid Cipher', '27-symbol fractionating alphabet normalises the plaintext and re-groups it'],
  ['Nihilist Cipher', '5x5 square folds J into I, so the plaintext is normalised'],
  ['Phillips Cipher', '5x5 square folds J into I, so the plaintext is normalised'],
  ['Four-Square Cipher', '5x5 squares fold J into I and pad odd length with X'],
  ['Two-Square Cipher', '5x5 squares fold J into I and pad odd length with X'],
  ['CADAENUS Cipher', 'keyed columnar transposition folds J into I and normalises the block shape'],
  // Verified: "ABCX" comes back as "ABC" and "ZRDSSTNX" as "ZRDSSTN".
  ['Hill Cipher', 'pads the message to a whole block with X and strips trailing X again, so a '
    + 'message that genuinely ends in X comes back short - the same ambiguity as zero padding'],
  // Refuses anything outside A-Z by name and position, so only this one
  // normalisation is left. Verified: "HELLX" comes back as "HELL".
  ['Columnar Transposition', 'complete columnar transposition fills the last row of the grid with X '
    + 'and strips trailing X again, so a message that genuinely ends in X comes back short - the '
    + 'same ambiguity as zero padding'],
  ['Jefferson Wheel', 'wheel alphabets normalise the plaintext to the 26 letters they carry'],

  // --- already failing their own committed vectors ---
  // TestSuite reports each of these as a round-trip failure today; they are
  // listed so this sweep stays gating on everything else rather than being
  // switched off. Each needs its decryption path repaired on its own merits.

  ['Hierocrypt-3', 'not invertible by construction: its S-box maps all 256 byte values onto only '
    + '32, so encryption discards three bits per byte per round. 00112233445566778899AABBCCDDEEFF '
    + 'and 33112233445566778899AABBCCDDEEFF encrypt to the same block under the committed key, so '
    + 'no decryption function exists. Needs a real Hierocrypt-3 round function, not a repaired inverse'],

  // ===== Asymmetric Ciphers =====
  //
  // The category is one name over four unrelated kinds of construction, and only
  // one of them is an encrypt-then-decrypt cipher. Grouping them all under
  // "asymmetric" is what let the sweep skip the category for so long, so each
  // entry below says which kind the algorithm is and therefore why the property
  // this sweep asserts either does not exist for it or is not yet met.
  //
  // Not listed, because they are driven and pass: Rabin and FrodoKEM, both of
  // which expose an encrypt/decrypt interface and recover their plaintext.

  // --- signature schemes: sign and verify, never encrypt and decrypt ---
  // There is no decryption direction and no plaintext to recover, so a message
  // fed to one of these comes back as a signature or as a verification result.
  // Every one of them is listed by name rather than by category so that a real
  // encryption scheme cannot be quietly parked here.
  ['DSA', 'signature scheme (FIPS 186-4): produces r and s over a digest and verifies them; '
    + 'there is no decryption path and no plaintext to recover'],
  ['ECDSA', 'signature scheme (FIPS 186-4, SEC 1): produces r and s over a digest and verifies '
    + 'them; there is no decryption path and no plaintext to recover'],
  ['Ed25519', 'signature scheme (RFC 8032): CreateInstance(true) returns null by design because '
    + 'signing has no inverse; verification consumes a signature, not a ciphertext'],
  ['Schnorr (BIP-340)', 'signature scheme (BIP-340): CreateInstance(true) returns null by design; '
    + 'verification consumes a signature, not a ciphertext'],
  ['Dilithium', 'signature scheme (CRYSTALS-Dilithium, NIST PQC round 3): signs and verifies, '
    + 'so no plaintext is ever recovered from its output'],
  ['ML-DSA', 'signature scheme (FIPS 204): signs and verifies, so no plaintext is ever recovered '
    + 'from its output'],
  ['FALCON', 'signature scheme (Falcon, NIST PQC round 3): signs and verifies, so no plaintext is '
    + 'ever recovered from its output'],
  ['SLH-DSA', 'signature scheme (FIPS 205): stateless hash-based signing and verification, with '
    + 'no decryption direction at all'],
  ['SPHINCS+', 'signature scheme (SPHINCS+, NIST PQC round 3): stateless hash-based signing and '
    + 'verification, with no decryption direction at all'],
  ['Rainbow', 'signature scheme (Rainbow, multivariate, NIST PQC round 3): signs and verifies; '
    + 'its trapdoor inverts a signature, not a message'],
  ['SQIsign', 'signature scheme (SQIsign, NIST additional signatures): signs and verifies, so no '
    + 'plaintext is ever recovered from its output'],
  ['MAYO', 'signature scheme (MAYO, NIST additional signatures): signs and verifies, so no '
    + 'plaintext is ever recovered from its output'],
  ['PERK', 'signature scheme (PERK, MPC-in-the-head, NIST additional signatures): signs and '
    + 'verifies, so no plaintext is ever recovered from its output'],
  ['CROSS', 'signature scheme (CROSS, restricted decoding, NIST additional signatures): signs and '
    + 'verifies, so no plaintext is ever recovered from its output'],
  ['HAWK', 'signature scheme (HAWK, NIST additional signatures): signs and verifies, so no '
    + 'plaintext is ever recovered from its output'],
  ['FAEST', 'signature scheme (FAEST, VOLE-in-the-head, NIST additional signatures): signs and '
    + 'verifies, so no plaintext is ever recovered from its output'],
  ['LWE-Signature', 'signature scheme (lattice-based, Lyubashevsky-style): signs and verifies, so '
    + 'no plaintext is ever recovered from its output'],
  ['ESIGN', 'signature scheme (ESIGN, Okamoto; NESSIE submission): signs and verifies, so no '
    + 'plaintext is ever recovered from its output'],

  // --- key agreement: no plaintext exists ---
  // Both parties derive the same secret from public values. Nothing is sent that
  // could be decrypted, and both of these say so by returning null for the
  // inverse instance rather than inventing one.
  ['Diffie-Hellman', 'key agreement (RFC 2631): each side derives a shared secret from the '
    + "other's public value; no plaintext is transmitted, and CreateInstance(true) returns null"],
  ['X25519', 'key agreement (RFC 7748): each side derives a shared secret from the other\'s '
    + 'public value; no plaintext is transmitted, and CreateInstance(true) returns null'],

  // --- key encapsulation: the property is shared-secret recovery, not plaintext ---
  // A KEM encapsulates to a ciphertext plus a shared secret and decapsulates the
  // ciphertext back to that secret, so the round trip is over the secret rather
  // than over a message. None of the four below performs either operation. They
  // are not decryption paths that need repairing: they are stubs standing where
  // an implementation should be, and each entry records exactly what the code
  // returns instead so the gap cannot be mistaken for a subtle bug. Repairing
  // any of them means writing the scheme and replacing its committed vector,
  // because the vector is the stub's own output.
  ['NTRU', 'open defect (stub): not an implementation of NTRU. The forward path returns the '
    + 'ASCII text NTRU_ENCRYPTED_<paramset>_<length>_BYTES_NTRU_<paramset>_EDUCATIONAL and the '
    + 'inverse path returns the letter A repeated <length> times, so neither a message nor a '
    + 'shared secret is ever recovered; the committed vector is that ASCII text. Needs a real '
    + 'NTRU-HPS ring implementation and NIST vectors, not a repaired inverse'],
  ['Classic McEliece', 'open defect (stub): not an implementation of Classic McEliece. Result() '
    + 'returns the ASCII parameter-set name mceliece348864 for every input in both directions, '
    + 'which is why a 12-byte message comes back as those 14 bytes. The _encapsulate/_decapsulate '
    + 'pair is unreachable from Feed/Result and carries the shared secret through the ciphertext '
    + 'in the clear, so wiring it up would buy a passing round trip over no cryptography at all. '
    + 'Needs real binary Goppa key generation and Patterson decoding, and NIST vectors'],
  ['BIKE', 'open defect (stub): not an implementation of BIKE. There is no key pair, no '
    + 'encapsulation and no decapsulation; CreateInstance ignores its isInverse argument entirely, '
    + 'so a single direction exists, and Result() folds any input into eight bytes with an ad-hoc '
    + 'rotate-and-add mixer. Both committed vectors are outputs of that mixer. Needs real QC-MDPC '
    + 'key generation and a bit-flipping decoder, and NIST vectors'],
  ['HQC', 'open defect (stub): not an implementation of HQC. Result() returns the ASCII '
    + 'parameter-set name hqc-128 for every input in both directions. The _encapsulate/_decapsulate '
    + 'pair is unreachable from Feed/Result and carries the shared secret through the ciphertext in '
    + 'the clear. Needs a real quasi-cyclic construction with the concatenated Reed-Muller and '
    + 'Reed-Solomon decoder, and NIST vectors'],
  ['SIKE', 'open defect (stub): not an implementation of SIKE, and the scheme itself is dead - '
    + 'Castryck and Decru recover the key in minutes (eprint 2022/975), which is why it is already '
    + 'marked BROKEN here. The code carries no isogeny arithmetic and no key pair; CreateInstance '
    + 'ignores isInverse and Result() folds any input into eight bytes with a rotate-and-xor mixer'],

  // RSA, ElGamal, LUC and Rabin-Williams were listed here while their decryption
  // paths were repaired. All four round-trip now and are driven by the suite, so
  // the entries are gone rather than left behind to excuse a future regression.

]);

// TestEngine runs in the browser as well as under Node, so the list is exported
// both ways.
if (typeof module !== 'undefined' && module.exports)
  module.exports = { ROUND_TRIP_EXEMPT };

if (typeof window !== 'undefined')
  window.ROUND_TRIP_EXEMPT = ROUND_TRIP_EXEMPT;
