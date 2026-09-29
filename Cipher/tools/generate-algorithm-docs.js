#!/usr/bin/env node
/*
 * Algorithm documentation generator
 * (c)2006-2025 Hawkynt
 *
 * Renders one markdown page per registered algorithm from the metadata the
 * implementation itself declares - parameters, security status, known
 * vulnerabilities, documentation links, references and test vectors - plus a
 * linked index. Nothing is hand-maintained, so the pages cannot drift away from
 * the code.
 *
 * Usage:
 *   node tools/generate-algorithm-docs.js            # write docs/algorithms/
 *   node tools/generate-algorithm-docs.js --check    # exit 1 if the tree is stale
 *
 * Output is deterministic (sorted, no timestamps) so --check is meaningful in CI.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const CIPHER_ROOT = path.resolve(__dirname, '..');
const ALGORITHM_ROOT = path.join(CIPHER_ROOT, 'algorithms');
const DOCS_ROOT = path.join(CIPHER_ROOT, 'docs', 'algorithms');
const CHECK_ONLY = process.argv.includes('--check');

//#region ===== loading =====

// Record which source file registered each algorithm so every page can link to
// the implementation it documents. The file being walked is not necessarily the
// one registering: a file that require()s another (LION pulling in SHA-1, a
// cascade pulling in Rijndael) triggers the dependency's registration while it
// loads. The innermost algorithm module still being evaluated is the one whose
// top-level code made the call, so that is what gets recorded.
function loadAlgorithms() {
  const AlgorithmFramework = require(path.join(CIPHER_ROOT, 'AlgorithmFramework.js'));
  const OpCodes = require(path.join(CIPHER_ROOT, 'OpCodes.js'));
  global.AlgorithmFramework = AlgorithmFramework;
  global.OpCodes = OpCodes;

  const Module = require('module');
  const evaluating = [];
  const compile = Module.prototype._compile;
  Module.prototype._compile = function (content, filename) {
    evaluating.push(filename);
    try {
      return compile.apply(this, arguments);
    } finally {
      evaluating.pop();
    }
  };

  const algorithmPrefix = ALGORITHM_ROOT + path.sep;
  const sources = new Map();
  const register = AlgorithmFramework.RegisterAlgorithm;
  AlgorithmFramework.RegisterAlgorithm = function (algorithm) {
    const file = [...evaluating].reverse().find(name => name.startsWith(algorithmPrefix));
    if (file && !sources.has(algorithm)) {
      sources.set(algorithm, path.relative(CIPHER_ROOT, file).split(path.sep).join('/'));
    }
    return register.apply(this, arguments);
  };

  const failures = [];
  for (const category of fs.readdirSync(ALGORITHM_ROOT).sort()) {
    const categoryDir = path.join(ALGORITHM_ROOT, category);
    if (!fs.statSync(categoryDir).isDirectory()) continue;
    for (const file of fs.readdirSync(categoryDir).sort()) {
      if (!file.endsWith('.js')) continue;
      try {
        require(path.join(categoryDir, file));
      } catch (error) {
        failures.push(`${path.posix.join('algorithms', category, file)}: ${error.message}`);
      }
    }
  }
  Module.prototype._compile = compile;

  return { algorithms: AlgorithmFramework.Algorithms || [], sources, failures };
}

//#endregion

//#region ===== formatting helpers =====

// Byte values up to this length are printed in full; longer ones (generated
// megabyte inputs, full KAT records) show a prefix and their length instead.
const HEX_FULL_LIMIT = 256;
const HEX_PREVIEW = 64;
const JSON_LIMIT = 400;

function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/\+/g, '-plus')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'algorithm';
}

// Markdown table cells cannot contain raw pipes or newlines.
function cell(text) {
  return String(text == null ? '' : text).replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ').trim();
}

// Declared prose goes onto one line, and a bare '<' is escaped so a comparison
// in a description is never taken for the start of an HTML tag.
function prose(text) {
  return String(text == null ? '' : text).replace(/\s+/g, ' ').trim().replace(/</g, '&lt;');
}

// An inline code span that survives backticks in its content.
function code(text) {
  const value = String(text);
  return value.includes('`') ? `\`\` ${value} \`\`` : `\`${value}\``;
}

function labelOf(value, fallback = 'Not specified') {
  if (!value) return fallback;
  if (typeof value === 'string') return prose(value);
  const icon = value.icon ? `${value.icon} ` : '';
  return value.name ? prose(`${icon}${value.name}`) : fallback;
}

function plural(count, word) {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

function bytesLabel(count) {
  return `${plural(count, 'byte')} (${count * 8} bits)`;
}

// "SupportedIVSizes" -> "IV sizes", "SupportedMacSizes" -> "MAC sizes".
function fieldLabel(field) {
  const words = field
    .replace(/^Supported/, '')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(' ')
    .map(word => (word === 'Mac' ? 'MAC' : word));
  return words
    .map((word, index) => (index === 0 || word === word.toUpperCase() ? word : word.toLowerCase()))
    .join(' ');
}

// Size lists hold KeySize {minSize, maxSize, stepSize} ranges (a few spell the
// step "step"), plain numbers, or {size, description} pairs. Sizes are bytes by
// framework convention; a rounds list counts rounds.
function describeSize(entry, unit) {
  const amount = count => (unit === 'rounds' ? plural(count, 'round') : bytesLabel(count));
  if (typeof entry === 'number') return amount(entry);
  if (!entry || typeof entry !== 'object') return null;
  if (typeof entry.size === 'number') {
    return entry.description ? `${amount(entry.size)} — ${prose(entry.description)}` : amount(entry.size);
  }
  const { minSize } = entry;
  if (typeof minSize !== 'number') return null;
  const maxSize = typeof entry.maxSize === 'number' && entry.maxSize ? entry.maxSize : minSize;
  if (minSize === maxSize) return amount(minSize);
  const declaredStep = entry.stepSize != null ? entry.stepSize : entry.step;
  const step = declaredStep && declaredStep > 0 ? declaredStep : 1;
  const stepNote = step === 1 ? '' : ` in steps of ${unit === 'rounds' ? step : plural(step, 'byte')}`;
  return `${amount(minSize)} to ${amount(maxSize)}${stepNote}`;
}

// The usual reading order; anything else keeps its declaration order after these.
const SIZE_ORDER = ['Key', 'Block', 'Nonce', 'IV', 'Tag', 'Mac', 'Output', 'Hash', 'Digest', 'Seed']
  .map(name => `Supported${name}Sizes`);

function sizeRank(field) {
  const rank = SIZE_ORDER.indexOf(field);
  return rank < 0 ? SIZE_ORDER.length : rank;
}

function describeSizes(field, sizes) {
  if (!Array.isArray(sizes) || sizes.length === 0) return null;
  const unit = /Rounds$/.test(field) ? 'rounds' : 'bytes';
  const described = sizes.map(size => describeSize(size, unit)).filter(Boolean);
  return described.length ? described.join('; ') : null;
}

function isByteSequence(value) {
  if (ArrayBuffer.isView(value) && !(value instanceof DataView)) return true;
  return Array.isArray(value) && value.every(item => Number.isInteger(item) && item >= 0 && item <= 255);
}

function toHex(bytes) {
  const parts = [];
  for (let i = 0; i < bytes.length; i++) parts.push((Number(bytes[i]) & 0xff).toString(16).padStart(2, '0'));
  return parts.join('');
}

// Longer values are grouped in 16-byte runs so the page can wrap them.
function groupedHex(bytes) {
  const hex = toHex(bytes);
  return bytes.length <= 32 ? hex : hex.match(/.{1,32}/g).join(' ');
}

function hexValue(bytes) {
  if (bytes.length === 0) return '_(empty)_';
  if (bytes.length <= HEX_FULL_LIMIT) return code(groupedHex(bytes));
  const preview = groupedHex(Array.prototype.slice.call(bytes, 0, HEX_PREVIEW));
  return `${code(`${preview} …`)} (${bytes.length} bytes; the full value is in the source)`;
}

function toJson(value) {
  const text = JSON.stringify(value, (key, item) => {
    if (typeof item === 'bigint') return item.toString();
    if (ArrayBuffer.isView(item)) return Array.from(item);
    return item;
  });
  if (text == null) return String(value);
  return text.length > JSON_LIMIT ? `${text.slice(0, JSON_LIMIT)}…` : text;
}

// One declared value, whatever its type, as a table cell.
function formatValue(value) {
  if (value == null) return code(String(value));
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number' || typeof value === 'bigint') return code(value.toString());
  if (typeof value === 'string') return prose(value) || '_(empty)_';
  if (isByteSequence(value)) return hexValue(value);
  if (typeof value === 'function') return '_(function)_';
  return code(toJson(value));
}

// Several algorithms pass explanatory prose where a URI is expected, so only
// genuine locations are ever turned into links.
function isUrl(value) {
  return typeof value === 'string' && /^(https?:\/\/|mailto:|\/|\.{1,2}\/)/i.test(value.trim());
}

function linkList(items) {
  if (!Array.isArray(items) || items.length === 0) return null;
  const lines = items
    .filter(item => item && (item.text || item.uri))
    .map(item => {
      const text = prose(item.text) || prose(item.uri);
      if (isUrl(item.uri)) return `- [${text}](${item.uri.trim()})`;
      const note = prose(item.uri);
      return note && note !== text ? `- ${text} — ${note}` : `- ${text}`;
    });
  return lines.length ? lines.join('\n') : null;
}

// Nested declarative data (educational notes and the like) as a bullet tree.
function renderTree(value, depth = 0) {
  const indent = '  '.repeat(depth);
  const lines = [];
  const entries = (Array.isArray(value) ? value.map(item => [null, item]) : Object.entries(value))
    .filter(([, item]) => typeof item !== 'function');
  for (const [key, item] of entries) {
    const label = key == null ? '' : `**${prose(key)}:** `;
    if (item && typeof item === 'object' && !isByteSequence(item)) {
      lines.push(`${indent}- ${label || '_(item)_'}`.trimEnd());
      lines.push(...renderTree(item, depth + 1));
    } else {
      lines.push(`${indent}- ${label}${cell(formatValue(item))}`);
    }
  }
  return lines;
}

//#endregion

//#region ===== page rendering =====

// Boolean capability flags: the framework's PascalCase ones (NeedsKey,
// RequiresIV, IsDeterministic, ...) and the descriptive lower-case ones.
// Runtime state that merely happens to be boolean is left out.
const RUNTIME_STATE_FLAGS = new Set(['isInitialized', 'keyScheduled']);

function capabilityFlags(algorithm) {
  return Object.keys(algorithm)
    .filter(key => typeof algorithm[key] === 'boolean' && !RUNTIME_STATE_FLAGS.has(key))
    .filter(key => /^[A-Z]/.test(key) || /^(supports|is|cant)[A-Z]/.test(key));
}

// knownVulnerabilities is the framework field; some implementations declare
// theirs as `vulnerabilities`, sometimes as {name, severity, reference}.
function vulnerabilitiesOf(algorithm) {
  const seen = new Set();
  const result = [];
  for (const source of [algorithm.knownVulnerabilities, algorithm.vulnerabilities]) {
    if (!Array.isArray(source)) continue;
    for (const item of source) {
      if (!item) continue;
      const entry = typeof item === 'string'
        ? { name: item }
        : {
          name: item.text || item.name || '',
          uri: item.uri || item.reference || '',
          description: item.description || '',
          mitigation: item.mitigation || '',
          severity: item.severity || ''
        };
      const key = String(entry.name).toLowerCase();
      if (!entry.name || seen.has(key)) continue;
      seen.add(key);
      result.push(entry);
    }
  }
  return result;
}

// A text slot that may hold something else: a few declarations pass a status
// object ({name, icon}) where prose is expected.
function declared(value) {
  if (value == null || value === '') return '';
  if (typeof value === 'string') return prose(value);
  if (typeof value === 'object' && value.name) return labelOf(value);
  return formatValue(value);
}

function renderTable(headers, rows) {
  const lines = [`| ${headers.join(' | ')} |`, `| ${headers.map(() => '---').join(' | ')} |`];
  for (const row of rows) lines.push(`| ${row.map(value => cell(value) || '—').join(' | ')} |`);
  return lines;
}

// A list of plain names, or a list of records rendered as one table.
function renderParameterSets(sets) {
  if (sets.every(set => set == null || typeof set !== 'object')) {
    return sets.map(set => `- ${cell(formatValue(set))}`);
  }
  const columns = [];
  for (const set of sets) {
    for (const key of Object.keys(set || {})) if (!columns.includes(key)) columns.push(key);
  }
  return renderTable(columns.map(key => code(key)), sets.map(set => columns.map(key => (set && key in set ? formatValue(set[key]) : ''))));
}

function renderVector(test, index) {
  const lines = [];
  const description = prose(test.text) || `Vector ${index + 1}`;
  const title = isUrl(test.uri) ? `[${description}](${test.uri.trim()})` : description;
  lines.push(`**Vector ${index + 1}** — ${title}`);
  lines.push('');
  const source = isUrl(test.uri) ? '' : prose(test.uri);
  if (source && source !== description) {
    lines.push(`Source: ${source}`);
    lines.push('');
  }
  const fields = Object.keys(test).filter(key => !['text', 'uri', 'input', 'expected'].includes(key));
  for (const key of ['input', 'expected']) if (key in test) fields.push(key);
  lines.push(...renderTable(['Field', 'Value'], fields.map(key => [code(key), formatValue(test[key])])));
  lines.push('');
  return lines;
}

function renderAlgorithm(algorithm, meta) {
  const { sourceFile, categoryName } = meta;
  const here = path.posix.dirname(meta.docPath);
  const lines = [];

  lines.push(`# ${prose(algorithm.name)}`);
  lines.push('');
  if (algorithm.description) {
    lines.push(`> ${prose(algorithm.description)}`);
    lines.push('');
  }

  // --- properties -----------------------------------------------------------
  const restricted = algorithm.restrictedInputDomain;
  const properties = [
    ['Category', prose(categoryName)],
    ['Sub-category', prose(algorithm.subCategory)],
    ['Variant', algorithm.variant == null ? null : prose(algorithm.variant)],
    ['Security status', labelOf(algorithm.securityStatus, 'Not classified')],
    ['Complexity', labelOf(algorithm.complexity, 'Not specified')],
    ['Inventor', prose(algorithm.inventor)],
    ['Year', algorithm.year],
    ['Origin', labelOf(algorithm.country, 'Not specified')],
    ['Restricted input domain', restricted == null ? null : formatValue(restricted)]
  ].filter(([, value]) => value != null && value !== '');

  lines.push('## Properties');
  lines.push('');
  lines.push(...renderTable(['Property', 'Value'], properties));
  lines.push(`| Source | [\`${sourceFile}\`](${path.posix.relative(here, sourceFile)}) |`);
  lines.push('');

  // --- parameters -----------------------------------------------------------
  const parameters = Object.keys(algorithm)
    .filter(key => /^Supported[A-Z]/.test(key))
    .sort((a, b) => sizeRank(a) - sizeRank(b))
    .map(key => [fieldLabel(key), describeSizes(key, algorithm[key])])
    .filter(([, value]) => value);

  if (parameters.length) {
    lines.push('## Parameters');
    lines.push('');
    lines.push(...renderTable(['Parameter', 'Supported values'], parameters));
    lines.push('');
  }

  if (Array.isArray(algorithm.parameterSets) && algorithm.parameterSets.length) {
    lines.push('## Parameter sets');
    lines.push('');
    lines.push(...renderParameterSets(algorithm.parameterSets));
    lines.push('');
  }

  for (const [field, title] of [['parameters', 'Parameter set details'], ['sizes', 'Derived sizes']]) {
    const value = algorithm[field];
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    lines.push(`## ${title}`);
    lines.push('');
    lines.push(...renderTable(['Name', 'Value'], Object.keys(value).map(key => [code(key), formatValue(value[key])])));
    lines.push('');
  }

  const flags = capabilityFlags(algorithm);
  if (flags.length) {
    lines.push('## Capabilities');
    lines.push('');
    lines.push(...renderTable(['Flag', 'Value'], flags.map(key => [code(key), formatValue(algorithm[key])])));
    lines.push('');
  }

  // --- security -------------------------------------------------------------
  lines.push('## Security');
  lines.push('');
  const status = algorithm.securityStatus;
  lines.push(status
    ? `**Status:** ${labelOf(status)}`
    : '**Status:** not classified — treat as unverified.');
  lines.push('');
  if (algorithm.securityNotes) {
    lines.push(prose(algorithm.securityNotes));
    lines.push('');
  }

  const vulnerabilities = vulnerabilitiesOf(algorithm);
  if (vulnerabilities.length) {
    lines.push('### Known vulnerabilities');
    lines.push('');
    lines.push(...renderTable(['Issue', 'Description', 'Mitigation'], vulnerabilities.map(vulnerability => {
      const name = isUrl(vulnerability.uri)
        ? `[${prose(vulnerability.name)}](${vulnerability.uri.trim()})`
        : prose(vulnerability.name);
      // Guard against prose ever landing in the URI slot again.
      const details = [vulnerability.description, isUrl(vulnerability.uri) ? '' : vulnerability.uri]
        .map(declared)
        .filter(Boolean)
        .join(' — ');
      const severity = vulnerability.severity ? `Severity: ${declared(vulnerability.severity)}.` : '';
      const description = [severity, details].filter(Boolean).join(' ');
      return [name, description, declared(vulnerability.mitigation)];
    })));
    lines.push('');
  } else {
    lines.push('No vulnerabilities are recorded for this implementation.');
    lines.push('');
  }

  // --- notes ----------------------------------------------------------------
  const notes = [];
  if (Array.isArray(algorithm.notes)) {
    for (const note of algorithm.notes) if (note != null && note !== '') notes.push(`- ${cell(formatValue(note))}`);
  }
  if (algorithm.implementation) notes.push(`- **Implementation:** ${prose(algorithm.implementation)}`);
  if (algorithm.comment) notes.push(`- ${prose(algorithm.comment)}`);
  if (notes.length) {
    lines.push('## Notes');
    lines.push('');
    lines.push(...notes);
    lines.push('');
  }

  if (algorithm.educationalInfo && typeof algorithm.educationalInfo === 'object') {
    lines.push('## Background');
    lines.push('');
    lines.push(...renderTree(algorithm.educationalInfo));
    lines.push('');
  }

  // --- sources --------------------------------------------------------------
  const documentation = linkList(algorithm.documentation);
  if (documentation) {
    lines.push('## Documentation');
    lines.push('');
    lines.push(documentation);
    lines.push('');
  }

  const references = linkList(algorithm.references);
  if (references) {
    lines.push('## References');
    lines.push('');
    lines.push(references);
    lines.push('');
  }

  // --- test vectors ---------------------------------------------------------
  const tests = Array.isArray(algorithm.tests) ? algorithm.tests : [];
  lines.push('## Test vectors');
  lines.push('');
  if (tests.length === 0) {
    lines.push('No test vectors are declared for this algorithm.');
    lines.push('');
  } else {
    lines.push(`${plural(tests.length, 'vector')} ship with this algorithm and run in the test suite. Byte values are hexadecimal.`);
    lines.push('');
    tests.forEach((test, index) => lines.push(...renderVector(test, index)));
  }

  lines.push('---');
  lines.push('');
  lines.push(`[← All algorithms](${path.posix.relative(here, 'docs/algorithms/README.md')})`);
  lines.push('');

  return lines.join('\n');
}

function renderIndex(entries, categories) {
  const lines = [];
  lines.push('# Algorithm reference');
  lines.push('');
  lines.push('> One page per algorithm, generated from the implementations themselves.');
  lines.push('');
  lines.push(`This reference covers **${entries.length} algorithms** across **${categories.length} categories**.`);
  lines.push('Every page is produced by `tools/generate-algorithm-docs.js` from the metadata an');
  lines.push('algorithm declares in its own source file, so the properties, parameters, security');
  lines.push('status, references and test vectors shown here always match the code.');
  lines.push('');
  lines.push('## Contents');
  lines.push('');
  for (const category of categories) {
    lines.push(`- [${category.name}](#${slugify(category.name)}) (${category.entries.length})`);
  }
  lines.push('');

  for (const category of categories) {
    lines.push(`## ${category.name}`);
    lines.push('');
    if (category.description) {
      lines.push(`_${prose(category.description)}_`);
      lines.push('');
    }
    lines.push('| Algorithm | Security | Summary |');
    lines.push('| --- | --- | --- |');
    for (const entry of category.entries) {
      const relative = path.posix.relative('docs/algorithms', entry.docPath);
      const summary = Array.from(String(entry.algorithm.description || '').replace(/\s+/g, ' ').trim());
      const short = summary.length > 140 ? `${summary.slice(0, 139).join('').trimEnd()}…` : summary.join('');
      lines.push(`| [${cell(prose(entry.algorithm.name))}](${relative}) | ${cell(labelOf(entry.algorithm.securityStatus, '—'))} | ${cell(prose(short)) || '—'} |`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push('Regenerate with `node tools/generate-algorithm-docs.js`. CI regenerates and commits this tree on');
  lines.push('every push to `main`, so the published reference follows the sources.');
  lines.push('');
  lines.push('[← Cipher tools](../../)');
  lines.push('');

  return lines.join('\n');
}

//#endregion

//#region ===== tree writing =====

// GitHub Pages runs every page through Jekyll, which evaluates Liquid before
// the markdown is rendered: a stray "{{" or "{%" in a description or vector
// would be executed, and a malformed one fails the whole site build. A page
// containing either is wrapped in a raw block. An "endraw" inside the text
// would close that block early, so its opening brace is written as an entity.
// The heading stays outside the block when it can, because the page title is
// taken from the first line.
function guardLiquid(content) {
  const LIQUID = /\{[{%]/;
  if (!LIQUID.test(content)) return content;
  const safe = content.replace(/\{%(-?\s*endraw)/g, '&#123;%$1');
  const newline = safe.indexOf('\n');
  const heading = safe.slice(0, newline + 1);
  if (newline > 0 && !LIQUID.test(heading)) return `${heading}{% raw %}\n${safe.slice(newline + 1)}{% endraw %}\n`;
  return `{% raw %}\n${safe}{% endraw %}\n`;
}

function collectExisting(root) {
  const found = new Map();
  if (!fs.existsSync(root)) return found;
  const walk = directory => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(full);
      // A Windows checkout with core.autocrlf hands the committed pages back
      // with CRLF endings; that is not a difference in content.
      else if (entry.name.endsWith('.md')) found.set(path.resolve(full), fs.readFileSync(full, 'utf8').replace(/\r\n/g, '\n'));
    }
  };
  walk(root);
  return found;
}

function main() {
  const { algorithms, sources, failures } = loadAlgorithms();
  if (failures.length) {
    console.error('Some algorithm files could not be loaded:');
    failures.forEach(failure => console.error(`  ${failure}`));
    process.exitCode = 1;
    return;
  }
  if (algorithms.length === 0) {
    console.error('No algorithms were registered — nothing to document.');
    process.exitCode = 1;
    return;
  }

  // Build entries with stable slugs; disambiguate any slug collision by name order.
  const sorted = [...algorithms].sort((a, b) => String(a.name).localeCompare(String(b.name)));
  const usedSlugs = new Map();
  const entries = sorted.map(algorithm => {
    const category = algorithm.category || {};
    const categoryName = category.name || 'Uncategorised';
    const categorySlug = slugify(categoryName);
    let slug = slugify(algorithm.name);
    const key = `${categorySlug}/${slug}`;
    if (usedSlugs.has(key)) {
      const next = usedSlugs.get(key) + 1;
      usedSlugs.set(key, next);
      slug = `${slug}-${next}`;
    } else {
      usedSlugs.set(key, 1);
    }
    const docPath = path.posix.join('docs', 'algorithms', categorySlug, `${slug}.md`);
    return {
      algorithm,
      categoryName,
      categoryDescription: category.description || '',
      docPath,
      sourceFile: sources.get(algorithm) || 'algorithms'
    };
  });

  const categoryMap = new Map();
  for (const entry of entries) {
    if (!categoryMap.has(entry.categoryName)) {
      categoryMap.set(entry.categoryName, {
        name: entry.categoryName,
        description: entry.categoryDescription,
        entries: []
      });
    }
    categoryMap.get(entry.categoryName).entries.push(entry);
  }
  const categories = [...categoryMap.values()].sort((a, b) => a.name.localeCompare(b.name));

  // Every page links to its implementation; a page that cannot is a defect.
  const unattributed = entries.filter(entry => !sources.has(entry.algorithm));
  if (unattributed.length) {
    console.error('No source file could be attributed to:');
    unattributed.forEach(entry => console.error(`  ${entry.algorithm.name}`));
    process.exitCode = 1;
    return;
  }

  const rendered = new Map();
  for (const entry of entries) {
    rendered.set(path.resolve(CIPHER_ROOT, entry.docPath), guardLiquid(renderAlgorithm(entry.algorithm, entry)));
  }
  rendered.set(path.resolve(DOCS_ROOT, 'README.md'), guardLiquid(renderIndex(entries, categories)));

  const existing = collectExisting(DOCS_ROOT);
  const stale = [];
  for (const [file, content] of rendered) {
    if (existing.get(file) !== content) stale.push(path.relative(CIPHER_ROOT, file));
  }
  for (const file of existing.keys()) {
    if (!rendered.has(file)) stale.push(`${path.relative(CIPHER_ROOT, file)} (obsolete)`);
  }

  if (CHECK_ONLY) {
    if (stale.length === 0) {
      console.log(`Algorithm documentation is up to date (${entries.length} pages).`);
      return;
    }
    console.error(`Algorithm documentation is stale — ${stale.length} file(s) differ from the code:`);
    stale.slice(0, 25).forEach(file => console.error(`  ${file}`));
    if (stale.length > 25) console.error(`  … and ${stale.length - 25} more`);
    console.error('Run: node tools/generate-algorithm-docs.js');
    process.exitCode = 1;
    return;
  }

  for (const file of existing.keys()) {
    if (!rendered.has(file)) fs.unlinkSync(file);
  }
  for (const [file, content] of rendered) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    if (existing.get(file) !== content) fs.writeFileSync(file, content);
  }

  console.log(`Wrote ${entries.length} algorithm pages across ${categories.length} categories to docs/algorithms/.`);
}

main();
