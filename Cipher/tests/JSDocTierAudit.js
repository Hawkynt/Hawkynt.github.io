#!/usr/bin/env node
/**
 * JSDocTierAudit.js - completeness audit of the two library type tiers the
 * transpiler resolves types from before it ever looks at an algorithm file:
 *
 *   tier 1  OpCodes.js           every exported member (and the members of the
 *                                exported UInt64/UInt128/UInt256/UInt512 objects)
 *   tier 2  AlgorithmFramework.js every public class member (methods, accessors,
 *                                constructor-initialised fields)
 *
 * A member is "fully typed" when its JSDoc block names every declared
 * parameter with a precise type and declares a precise @returns (or @type for
 * a data member). "Precise" means element width and signedness are stated:
 * `Array`, `*`, `any`, `Object`, `object`, `Function` and bare `number` are
 * not precise. `number` is only accepted for members listed in
 * FLOAT_MEMBERS, whose values genuinely are floating point.
 *
 * Usage:
 *   node tests/JSDocTierAudit.js            summary of both tiers
 *   node tests/JSDocTierAudit.js --verbose  also list every gap
 *   node tests/JSDocTierAudit.js --strict   exit 1 when any gap remains
 */

'use strict';

const fs = require('fs');
const path = require('path');

const CIPHER_DIR = path.join(__dirname, '..');

/** Types that name no element width or signedness. */
const IMPRECISE = new Set(['Array', '*', 'any', 'Object', 'object', 'Function', 'function', 'number', 'Array<*>', 'Array<number>', 'number[]', 'Object[]', 'object[]', '?', 'mixed']);

/** Members whose `number` really is a floating-point value. */
const FLOAT_MEMBERS = new Set([]);

/**
 * Split a JSDoc type expression into its alternatives, respecting nesting.
 * @param {string} type - e.g. "uint8[]|string" or "(h: uint32, l: uint32)"
 * @returns {string[]} top-level alternatives
 */
function splitUnion(type) {
  const parts = [];
  let depth = 0, cur = '';
  for (const ch of type) {
    if (ch === '(' || ch === '<' || ch === '{') ++depth;
    if (ch === ')' || ch === '>' || ch === '}') --depth;
    if (ch === '|' && depth === 0) { parts.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

/**
 * Whether a JSDoc type expression states width and signedness everywhere.
 * @param {string} type - JSDoc type expression without braces
 * @param {boolean} allowFloatNumber - accept `number` (float members only)
 * @returns {boolean} true when precise
 */
function isPreciseType(type, allowFloatNumber) {
  if (!type) return false;
  type = type.trim();
  if (type.startsWith('...')) return isPreciseType(type.slice(3), allowFloatNumber);
  if (type.startsWith('?') || type.endsWith('?') || type.startsWith('!'))
    return isPreciseType(type.replace(/^[?!]|\?$/g, ''), allowFloatNumber);
  if (type.startsWith('(') && type.endsWith(')')) {
    // tuple shape: (name: type, name: type)
    const inner = type.slice(1, -1);
    return inner.split(',').every(p => {
      const colon = p.indexOf(':');
      return colon > 0 && isPreciseType(p.slice(colon + 1), allowFloatNumber);
    });
  }
  const alts = splitUnion(type);
  if (alts.length > 1) return alts.every(a => isPreciseType(a, allowFloatNumber));
  if (type === 'number' || type === 'number[]') return allowFloatNumber;
  if (IMPRECISE.has(type)) return false;
  if (type.endsWith('[]')) return isPreciseType(type.slice(0, -2), allowFloatNumber);
  const generic = type.match(/^(\w+)<(.+)>$/);
  if (generic) return splitTopLevel(generic[2]).every(t => isPreciseType(t, allowFloatNumber));
  return true;
}

/**
 * Split a comma list, respecting nesting.
 * @param {string} list - e.g. "uint32, uint32"
 * @returns {string[]} parts
 */
function splitTopLevel(list) {
  const parts = [];
  let depth = 0, cur = '';
  for (const ch of list) {
    if (ch === '(' || ch === '<' || ch === '{') ++depth;
    if (ch === ')' || ch === '>' || ch === '}') --depth;
    if (ch === ',' && depth === 0) { parts.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

/**
 * Extract a balanced `{...}` JSDoc type starting at an opening brace.
 * @param {string} text - comment text
 * @param {int32} open - index of `{`
 * @returns {(type: string, end: int32)} the type and the index after `}`
 */
function readBraced(text, open) {
  let depth = 0;
  for (let i = open; i < text.length; ++i) {
    if (text[i] === '{') ++depth;
    else if (text[i] === '}' && --depth === 0) return { type: text.slice(open + 1, i), end: i + 1 };
  }
  return { type: text.slice(open + 1), end: text.length };
}

/**
 * Parse the tags of one JSDoc block.
 * @param {string} block - comment text including delimiters
 * @returns {(params: Object[], returns: string, type: string)} parsed tags
 */
function parseTags(block) {
  const result = { params: [], returns: null, type: null };
  const tagRe = /@(param|returns?|type)\s*(?=\{)/g;
  let m;
  while ((m = tagRe.exec(block)) !== null) {
    const { type, end } = readBraced(block, tagRe.lastIndex);
    if (m[1] === 'param') {
      const nm = block.slice(end).match(/^\s*\[?\s*([\w$.]+)/);
      result.params.push({ name: nm ? nm[1].split('.')[0] : '', type, nested: !!(nm && nm[1].includes('.')) });
    } else if (m[1] === 'type') result.type = type;
    else result.returns = type;
    tagRe.lastIndex = end;
  }
  result.params = result.params.filter(p => !p.nested);
  return result;
}

/**
 * Parameter names of a declared parameter list.
 * @param {string} list - text between the parentheses
 * @returns {string[]} names, rest parameters without the dots
 */
function paramNames(list) {
  return splitTopLevel(list.replace(/\/\*[\s\S]*?\*\//g, ''))
    .map(p => p.replace(/=.*$/s, '').replace(/^\.\.\./, '').trim())
    .filter(Boolean);
}

/**
 * JSDoc block that immediately precedes a position, if any.
 * @param {string} src - source text
 * @param {int32} pos - declaration start
 * @returns {string} the block or null
 */
function precedingJSDoc(src, pos) {
  const before = src.slice(0, pos).replace(/\s+$/, '');
  if (!before.endsWith('*/')) return null;
  const start = before.lastIndexOf('/**');
  if (start < 0) return null;
  const block = before.slice(start);
  return block.indexOf('*/') === block.length - 2 ? block : null;
}

/**
 * Judge one member against its JSDoc.
 * @param {string} name - qualified member name
 * @param {string} doc - JSDoc block or null
 * @param {string[]} params - declared parameter names, or null for a data member
 * @param {boolean} needsReturn - whether a value is returned
 * @returns {string[]} list of gaps (empty = fully typed)
 */
function judge(name, doc, params, needsReturn) {
  const gaps = [];
  const allowFloat = FLOAT_MEMBERS.has(name);
  // Nothing to type: no parameters and no value returned.
  if (!doc && params && params.length === 0 && !needsReturn) return [];
  if (!doc) return ['no JSDoc'];
  const tags = parseTags(doc);
  if (params === null) {
    const t = tags.type || tags.returns;
    if (!t) gaps.push('no @type');
    else if (!isPreciseType(t, allowFloat)) gaps.push(`imprecise @type {${t}}`);
    return gaps;
  }
  params.forEach((p, i) => {
    const tag = tags.params.find(x => x.name === p);
    if (!tag) gaps.push(`@param ${p} missing`);
    else if (!isPreciseType(tag.type, allowFloat)) gaps.push(`imprecise @param {${tag.type}} ${p}`);
    else if (tags.params.indexOf(tag) !== i) gaps.push(`@param ${p} out of order`);
  });
  if (!tags.returns) {
    if (needsReturn && !/@(constructor|class)\b/.test(doc)) gaps.push('@returns missing');
  } else if (tags.returns !== 'void' && !isPreciseType(tags.returns, allowFloat)) {
    gaps.push(`imprecise @returns {${tags.returns}}`);
  }
  return gaps;
}

/**
 * Whether a function body returns a value.
 * @param {string} src - source text
 * @param {int32} braceOpen - index of the body's opening brace
 * @returns {boolean} true when a `return <expr>` occurs at this nesting level
 */
function returnsValue(src, braceOpen) {
  let depth = 0, i = braceOpen;
  for (; i < src.length; ++i) {
    if (src[i] === '{') ++depth;
    else if (src[i] === '}' && --depth === 0) break;
  }
  const body = src.slice(braceOpen, i + 1)
    .replace(/function\s*\w*\s*\([^)]*\)\s*\{[\s\S]*?\n\s*\}/g, '')
    .replace(/\([^()]*\)\s*=>\s*\{[\s\S]*?\}/g, '');
  return /\breturn\s+[^;\s]/.test(body);
}

/**
 * Audit OpCodes.js (tier 1).
 * @param {string} source - optional OpCodes.js source (defaults to the file)
 * @returns {Object} { total, typed, members: [{name, gaps}] }
 */
function auditOpCodes(source) {
  const src = source || fs.readFileSync(path.join(CIPHER_DIR, 'OpCodes.js'), 'utf8');
  const members = [];
  // Top-level members sit at 4 spaces; members of the exported UIntN objects
  // and instance methods of an exported constructor (`this.x = function`) at 6.
  const re = /^( {4}| {6})(?:this\.)?([A-Za-z_$][\w$]*)\s*(?::|=)\s*(function\s*\(([^)]*)\)\s*\{|\{|[^,\n]+,)/gm;
  let m, owner = null;
  while ((m = re.exec(src)) !== null) {
    const indent = m[1].length, name = m[2], rest = m[3];
    const isThis = m[0].trimStart().startsWith('this.');
    if (indent === 4) owner = null;
    if (indent === 6 && !owner) continue;
    const qualified = indent === 6 ? `${owner}${isThis ? '#' : '.'}${name}` : name;
    const doc = precedingJSDoc(src, m.index);
    if (rest.startsWith('function')) {
      const braceOpen = m.index + m[0].length - 1;
      members.push({ name: qualified, gaps: judge(qualified, doc, paramNames(m[4]), returnsValue(src, braceOpen)) });
      if (indent === 4 && doc && /@constructor\b/.test(doc)) owner = name;
    } else if (rest === '{') {
      if (indent === 4) owner = name;
    } else if (!isThis) {
      members.push({ name: qualified, gaps: judge(qualified, doc, null, true) });
    }
  }
  return summarize(members);
}

/**
 * Audit AlgorithmFramework.js (tier 2): methods, accessors and
 * constructor-initialised `this.x` fields of every class.
 * @param {string} source - optional source (defaults to the file)
 * @returns {Object} { total, typed, members: [{name, gaps}] }
 */
function auditFramework(source) {
  const src = source || fs.readFileSync(path.join(CIPHER_DIR, 'AlgorithmFramework.js'), 'utf8');
  const members = [];
  // Exported free functions (named in the factory's returned object).
  const exportBlock = src.slice(src.lastIndexOf('return {'));
  const exported = new Set((exportBlock.match(/\b[A-Za-z_$][\w$]*\b/g) || []));
  const fnRe = /^[ \t]*function\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)\s*\{/gm;
  let fm;
  while ((fm = fnRe.exec(src)) !== null) {
    if (!exported.has(fm[1])) continue;
    const braceOpen = fm.index + fm[0].length - 1;
    members.push({ name: fm[1], gaps: judge(fm[1], precedingJSDoc(src, fm.index), paramNames(fm[2]), returnsValue(src, braceOpen)) });
  }
  const classRe = /class\s+(\w+)(?:\s+extends\s+([\w.]+))?\s*\{/g;
  let c;
  while ((c = classRe.exec(src)) !== null) {
    const cls = c[1];
    const open = c.index + c[0].length - 1;
    let depth = 0, end = open;
    for (; end < src.length; ++end) {
      if (src[end] === '{') ++depth;
      else if (src[end] === '}' && --depth === 0) break;
    }
    const body = src.slice(open + 1, end);
    const base = open + 1;
    // Methods and accessors at class-body depth 0.
    let d = 0;
    const methodRe = /^\s*(?:static\s+)?(?:async\s+)?(?:(get|set)\s+)?([A-Za-z_$][\w$]*)\s*\(([^)]*)\)\s*\{/;
    for (let i = 0; i < body.length; ++i) {
      const ch = body[i];
      if (ch === '{') { ++d; continue; }
      if (ch === '}') { --d; continue; }
      if (d !== 0 || (i > 0 && body[i - 1] !== '\n')) continue;
      const line = body.slice(i, body.indexOf('\n', i) + 1 || body.length);
      const mm = line.match(methodRe);
      if (!mm || ['if', 'for', 'while', 'switch', 'catch', 'function'].includes(mm[2])) continue;
      const kind = mm[1], name = mm[2];
      const doc = precedingJSDoc(src, base + i);
      const braceOpen = base + i + line.indexOf('{', line.indexOf(')'));
      if (name === 'constructor') {
        members.push({ name: `${cls}.constructor`, gaps: judge(`${cls}.constructor`, doc, paramNames(mm[3]), false) });
        // Fields assigned in the constructor.
        let cd = 0, ce = braceOpen;
        for (; ce < src.length; ++ce) {
          if (src[ce] === '{') ++cd;
          else if (src[ce] === '}' && --cd === 0) break;
        }
        const ctor = src.slice(braceOpen, ce);
        const seen = new Set();
        const fieldRe = /^[ \t]*this\.([A-Za-z_$][\w$]*)\s*=(?!=)/gm;
        let f;
        while ((f = fieldRe.exec(ctor)) !== null) {
          if (seen.has(f[1])) continue;
          seen.add(f[1]);
          const fdoc = precedingJSDoc(src, braceOpen + f.index + f[0].indexOf('this'));
          members.push({ name: `${cls}.${f[1]}`, gaps: judge(`${cls}.${f[1]}`, fdoc, null, true) });
        }
      } else if (kind === 'set') {
        members.push({ name: `${cls}.${name}=`, gaps: judge(`${cls}.${name}=`, doc, paramNames(mm[3]), false) });
      } else {
        members.push({ name: `${cls}.${kind === 'get' ? name : name + '()'}`,
          gaps: judge(`${cls}.${name}`, doc, paramNames(mm[3]), kind === 'get' || returnsValue(src, braceOpen)) });
      }
    }
  }
  return summarize(members);
}

/**
 * @param {Object[]} members - audited members
 * @returns {Object} totals plus the member list
 */
function summarize(members) {
  return { total: members.length, typed: members.filter(m => m.gaps.length === 0).length, members };
}

module.exports = { auditOpCodes, auditFramework, isPreciseType, parseTags, FLOAT_MEMBERS };

if (require.main === module) {
  const verbose = process.argv.includes('--verbose');
  const strict = process.argv.includes('--strict');
  let gaps = 0;
  for (const [label, audit] of [['OpCodes (tier 1)', auditOpCodes()], ['AlgorithmFramework (tier 2)', auditFramework()]]) {
    console.log(`${label}: ${audit.typed}/${audit.total} members fully typed`);
    for (const m of audit.members) {
      if (!m.gaps.length) continue;
      ++gaps;
      if (verbose) console.log(`  ${m.name}: ${m.gaps.join('; ')}`);
    }
  }
  process.exit(strict && gaps ? 1 : 0);
}
