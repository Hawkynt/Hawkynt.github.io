#!/usr/bin/env node
/*
 * ByteBuffer tests
 * (c)2006-2025 Hawkynt
 *
 * Covers the growth path, the mixed input types, the view-versus-copy
 * distinction, and the memory behaviour that motivates the type at all.
 *
 * Usage: node tests/ByteBufferTests.js
 */

'use strict';

const path = require('path');
const ByteBuffer = require(path.join(__dirname, '..', 'ByteBuffer.js'));

let passed = 0;
const failures = [];

function check(name, condition, detail) {
  if (condition) { passed++; return; }
  failures.push(`${name}${detail ? ' - ' + detail : ''}`);
  console.log(`FAIL  ${name}${detail ? ' - ' + detail : ''}`);
}

function sameBytes(actual, expected) {
  if (!actual || actual.length !== expected.length) return false;
  for (let i = 0; i < expected.length; i++) if (actual[i] !== expected[i]) return false;
  return true;
}

//#region ===== basics =====

{
  const buffer = new ByteBuffer();
  check('empty buffer has zero length', buffer.length === 0);
  check('empty buffer yields empty view', buffer.toUint8Array().length === 0);
  check('empty buffer yields empty array', buffer.toArray().length === 0);
}

{
  const buffer = new ByteBuffer();
  buffer.push(0x41).push(0x42).push(0x43);
  check('push records bytes in order', sameBytes(buffer.toUint8Array(), [0x41, 0x42, 0x43]));
  check('push updates length', buffer.length === 3);
}

{
  const buffer = new ByteBuffer();
  buffer.append([1, 2, 3]);
  buffer.append(new Uint8Array([4, 5]));
  buffer.append(Buffer.from([6]));
  buffer.append([]);
  buffer.append(null);
  check('append accepts arrays, typed arrays and buffers',
    sameBytes(buffer.toUint8Array(), [1, 2, 3, 4, 5, 6]));
}

//#endregion

//#region ===== growth =====

{
  // Start below the default so growth is exercised many times over.
  const buffer = new ByteBuffer(1);
  const expected = [];
  for (let i = 0; i < 10000; i++) { buffer.push(i & 0xff); expected.push(i & 0xff); }
  check('growth preserves every byte across many reallocations',
    sameBytes(buffer.toUint8Array(), expected));
  check('capacity grows to at least the length', buffer.capacity >= buffer.length);
}

{
  // A single append larger than the doubled capacity must still fit.
  const buffer = new ByteBuffer(4);
  const big = new Uint8Array(5000).fill(0x7f);
  buffer.append(big);
  check('single oversized append grows enough', buffer.length === 5000);
  check('oversized append preserves content', buffer.toUint8Array()[4999] === 0x7f);
}

//#endregion

//#region ===== views versus copies =====

{
  const buffer = new ByteBuffer();
  buffer.append([9, 8, 7]);
  const view = buffer.toUint8Array();
  const copy = buffer.toCopy();
  buffer.set(0, 1);
  check('toUint8Array returns a live view', view[0] === 1);
  check('toCopy returns an independent copy', copy[0] === 9);
}

{
  const buffer = ByteBuffer.from([3, 1, 4]);
  check('static from seeds contents', sameBytes(buffer.toUint8Array(), [3, 1, 4]));
  buffer.clear();
  check('clear resets length', buffer.length === 0);
  check('clear keeps the allocation', buffer.capacity >= 3);
  buffer.push(2);
  check('buffer is reusable after clear', sameBytes(buffer.toUint8Array(), [2]));
}

{
  const buffer = new ByteBuffer();
  buffer.append([0x10, 0x20]);
  check('get reads back', buffer.get(1) === 0x20);
  buffer.set(1, 0x21);
  check('set overwrites', buffer.get(1) === 0x21);
}

//#endregion

//#region ===== the point of the type =====

{
  // A plain array of numbers costs about 8 bytes per element in V8; the whole
  // reason for this type is that a Uint8Array costs one. Measure it rather than
  // asserting it, so the claim stays honest if the engine changes.
  const size = 4 * 1024 * 1024;

  // A typed array's storage is an ArrayBuffer, which lives OUTSIDE the V8 heap -
  // measuring heapUsed alone would credit ByteBuffer with zero cost and flatter
  // the result. Count heap plus external allocation so both are measured fairly.
  const footprint = () => {
    const usage = process.memoryUsage();
    return usage.heapUsed + (usage.arrayBuffers || 0);
  };

  global.gc && global.gc();
  const beforeArray = footprint();
  const plain = [];
  for (let i = 0; i < size; i++) plain.push(i & 0xff);
  const arrayCost = footprint() - beforeArray;

  const beforeBuffer = footprint();
  const buffer = new ByteBuffer();
  for (let i = 0; i < size; i++) buffer.push(i & 0xff);
  const bufferCost = footprint() - beforeBuffer;

  const arrayPerByte = arrayCost / size;
  const bufferPerByte = bufferCost / size;
  console.log(`      plain array: ${arrayPerByte.toFixed(2)} bytes/element`);
  console.log(`      ByteBuffer:  ${bufferPerByte.toFixed(2)} bytes/element`);
  check('ByteBuffer uses materially less memory than a plain array',
    bufferPerByte < arrayPerByte / 2,
    `${bufferPerByte.toFixed(2)} vs ${arrayPerByte.toFixed(2)} bytes per element`);
  check('buffer still holds the right bytes', buffer.length === size && buffer.get(size - 1) === ((size - 1) & 0xff));
}

//#endregion

console.log(`\n${passed} passed, ${failures.length} failed`);
process.exitCode = failures.length ? 1 : 0;
