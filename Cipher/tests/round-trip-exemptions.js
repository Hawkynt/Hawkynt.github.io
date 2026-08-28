/*
 * Shared invertibility exemptions
 *
 * The encoding-stability property
 *
 *   encode(data) == encode(decode(encode(data)))
 *
 * presumes that what a vector produces is a codeword, so that handing it back to
 * the decoder is a meaningful thing to do. A few committed vectors do not encode
 * anything at all: they drive the algorithm in a measurement mode, where the
 * result is a stabilizer syndrome or a single eigenvalue rather than a codeword.
 * Those are projections onto far fewer bits than they consume, so they are not
 * injective and no decoder - correct or otherwise - could invert them. For those
 * vectors the property is undefined rather than violated.
 *
 * This list is deliberately narrow. An entry earns its place only when the
 * vector itself declares the measurement mode through a property the algorithm
 * reads, and the exemption is matched per vector rather than per algorithm, so
 * the encoding vectors of the very same algorithm stay fully gated. Nothing is
 * listed here because it is inconvenient or because it is red: a decoder that
 * returns corrupt data without signalling failure is a defect to repair, and
 * repairing it is what the rest of this collection does.
 *
 * (c)2006-2025 Hawkynt
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.RoundTripExemptions = factory();
  }
}((function () {
  if (typeof globalThis !== 'undefined') return globalThis;
  if (typeof window !== 'undefined') return window;
  if (typeof global !== 'undefined') return global;
  if (typeof self !== 'undefined') return self;
  throw new Error('Unable to locate global object');
})(), function () {
  'use strict';

  // Each entry names the algorithm, the vector property that puts the instance
  // into a measurement mode, and why the round trip cannot apply. The property
  // must be present and truthy on the vector for the exemption to fire.
  const ENCODING_STABILITY_EXEMPT = [
    {
      algorithm: 'Topological Surface Code',
      property: 'syndromeExtraction',
      reason: 'syndrome extraction, not encoding: the vector projects 17 physical qubits onto an '
        + '8-bit X-stabilizer syndrome. That result is a measurement outcome rather than a codeword, '
        + 'and the projection discards 9 bits, so it has no inverse to test. The decoder rejecting an '
        + '8-bit input as not being a 17-qubit codeword is the correct response, not a defect'
    },
    {
      algorithm: 'GKP Quantum Code',
      property: 'measureStabilizer',
      reason: 'stabilizer measurement, not encoding: the vector projects a 25-site grid state onto a '
        + 'single +1/-1 eigenvalue. That one bit is a measurement outcome rather than a codeword, and '
        + 'cannot reconstruct the grid it came from, so the round trip is undefined. The remaining '
        + 'vectors of this algorithm encode logical states and stay gated'
    }
  ];

  /**
   * Report why a vector is exempt from the encoding-stability property.
   * @param {object} algorithm - Algorithm instance under test
   * @param {object} vector - The test vector being executed
   * @returns {string|null} The reason, or null when the property does apply
   */
  function encodingStabilityExemption(algorithm, vector) {
    if (!algorithm || !vector) return null;

    for (const entry of ENCODING_STABILITY_EXEMPT) {
      if (algorithm.name !== entry.algorithm) continue;
      if (!vector[entry.property]) continue;
      return entry.reason;
    }

    return null;
  }

  return {
    ENCODING_STABILITY_EXEMPT,
    encodingStabilityExemption
  };
}));
