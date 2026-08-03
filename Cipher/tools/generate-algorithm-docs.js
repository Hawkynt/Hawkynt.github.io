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
// the implementation it documents.
function loadAlgorithms() {
  const AlgorithmFramework = require(path.join(CIPHER_ROOT, 'AlgorithmFramework.js'));
  const OpCodes = require(path.join(CIPHER_ROOT, 'OpCodes.js'));
  global.AlgorithmFramework = AlgorithmFramework;
  global.OpCodes = OpCodes;

  const sources = new Map();
  let currentFile = null;
  const register = AlgorithmFramework.RegisterAlgorithm;
  AlgorithmFramework.RegisterAlgorithm = function (algorithm) {
    if (currentFile && !sources.has(algorithm)) sources.set(algorithm, currentFile);
    return register.apply(this, arguments);
  };

  const failures = [];
  for (const category of fs.readdirSync(ALGORITHM_ROOT).sort()) {
    const categoryDir = path.join(ALGORITHM_ROOT, category);
    if (!fs.statSync(categoryDir).isDirectory()) continue;
    for (const file of fs.readdirSync(categoryDir).sort()) {
      if (!file.endsWith('.js')) continue;
      currentFile = path.posix.join('algorithms', category, file);
      try {
        require(path.join(categoryDir, file));
      } catch (error) {
        failures.push(`${currentFile}: ${error.message}`);
      }
    }
  }
  currentFile = null;

  return { algorithms: AlgorithmFramework.Algorithms || [], sources, failures };
}

//#endregion

//#region ===== formatting helpers =====

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

function escapeText(text) {
  return String(text == null ? '' : text).trim();
}

function labelOf(value, fallback = 'Not specified') {
  if (!value) return fallback;
  if (typeof value === 'string') return value;
  const icon = value.icon ? `${value.icon} ` : '';
  return value.name ? `${icon}${value.name}`.trim() : fallback;
}

function bytesLabel(count) {
  return `${count} byte${count === 1 ? '' : 's'} (${count * 8} bits)`;
}

// KeySize carries {minSize, maxSize, stepSize}; a zero/absent step means fixed.
function describeSize(size) {
  if (!size) return null;
  const { minSize, maxSize, stepSize } = size;
  if (minSize === maxSize || !maxSize) return bytesLabel(minSize);
  const step = stepSize && stepSize > 0 ? stepSize : 1;
  const stepNote = step === 1 ? '' : ` in steps of ${step} byte${step === 1 ? '' : 's'}`;
  return `${bytesLabel(minSize)} to ${bytesLabel(maxSize)}${stepNote}`;
}

function describeSizes(sizes) {
  if (!Array.isArray(sizes) || sizes.length === 0) return null;
  const described = sizes.map(describeSize).filter(Boolean);
  return described.length ? described.join('; ') : null;
}

function toHex(bytes) {
  if (!bytes || typeof bytes.length !== 'number') return null;
  const parts = [];
  for (let i = 0; i < bytes.length; i++) parts.push((bytes[i] & 0xff).toString(16).padStart(2, '0'));
  return parts.join('');
}

// Long vectors are summarised rather than dumped, so pages stay readable.
function hexCell(bytes, limit = 32) {
  if (!bytes || typeof bytes.length !== 'number') return '';
  if (bytes.length === 0) return '_(empty)_';
  const hex = toHex(bytes);
  if (bytes.length <= limit) return `\`${hex}\``;
  return `\`${hex.slice(0, limit * 2)}…\` (${bytes.length} bytes)`;
}

// Several algorithms pass explanatory prose where a URI is expected, so only
// genuine locations are ever turned into links.
function isUrl(value) {
  return typeof value === 'string' && /^(https?:\/\/|mailto:|\/|\.{1,2}\/)/i.test(value.trim());
}

function linkList(items) {
  if (!Array.isArray(items) || items.length === 0) return null;
  return items
    .filter(item => item && (item.text || item.uri))
    .map(item => {
      const text = escapeText(item.text) || item.uri;
      if (isUrl(item.uri)) return `- [${text}](${item.uri.trim()})`;
      const note = escapeText(item.uri);
      return note && note !== text ? `- ${text} — ${note}` : `- ${text}`;
    })
    .join('\n');
}

//#endregion

//#region ===== page rendering =====

const SIZE_FIELDS = [
  ['SupportedKeySizes', 'Key size'],
  ['SupportedBlockSizes', 'Block size'],
  ['SupportedOutputSizes', 'Output size'],
  ['SupportedMacSizes', 'MAC size'],
  ['SupportedIVSizes', 'IV size'],
  ['SupportedTagSizes', 'Tag size'],
  ['SupportedSeedSizes', 'Seed size']
];

function renderAlgorithm(algorithm, meta) {
  const { sourceFile, categoryName } = meta;
  const lines = [];

  lines.push(`# ${escapeText(algorithm.name)}`);
  lines.push('');
  if (algorithm.description) {
    lines.push(`> ${escapeText(algorithm.description).replace(/\s*\n\s*/g, ' ')}`);
    lines.push('');
  }

  // --- properties -----------------------------------------------------------
  const properties = [
    ['Category', categoryName],
    ['Sub-category', algorithm.subCategory],
    ['Security status', labelOf(algorithm.securityStatus, 'Not classified')],
    ['Complexity', labelOf(algorithm.complexity, 'Not specified')],
    ['Inventor', algorithm.inventor],
    ['Year', algorithm.year],
    ['Origin', labelOf(algorithm.country, 'Not specified')]
  ].filter(([, value]) => value != null && value !== '');

  lines.push('## Properties');
  lines.push('');
  lines.push('| Property | Value |');
  lines.push('| --- | --- |');
  for (const [key, value] of properties) lines.push(`| ${cell(key)} | ${cell(value)} |`);
  lines.push(`| Source | [\`${sourceFile}\`](${path.posix.relative(path.posix.dirname(meta.docPath), sourceFile)}) |`);
  lines.push('');

  // --- parameters -----------------------------------------------------------
  const parameters = SIZE_FIELDS
    .map(([field, label]) => [label, describeSizes(algorithm[field])])
    .filter(([, value]) => value);

  if (parameters.length) {
    lines.push('## Parameters');
    lines.push('');
    lines.push('| Parameter | Supported values |');
    lines.push('| --- | --- |');
    for (const [label, value] of parameters) lines.push(`| ${cell(label)} | ${cell(value)} |`);
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

  const vulnerabilities = Array.isArray(algorithm.knownVulnerabilities) ? algorithm.knownVulnerabilities : [];
  if (vulnerabilities.length) {
    lines.push('### Known vulnerabilities');
    lines.push('');
    lines.push('| Issue | Description | Mitigation |');
    lines.push('| --- | --- | --- |');
    for (const vulnerability of vulnerabilities) {
      const name = isUrl(vulnerability.uri)
        ? `[${cell(vulnerability.text)}](${vulnerability.uri.trim()})`
        : cell(vulnerability.text);
      // Guard against prose ever landing in the URI slot again.
      const description = [vulnerability.description, isUrl(vulnerability.uri) ? null : vulnerability.uri]
        .map(escapeText)
        .filter(Boolean)
        .join(' — ');
      lines.push(`| ${name} | ${cell(description) || '—'} | ${cell(escapeText(vulnerability.mitigation)) || '—'} |`);
    }
    lines.push('');
  } else {
    lines.push('No vulnerabilities are recorded for this implementation.');
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
    lines.push(`${tests.length} vector${tests.length === 1 ? '' : 's'} ship with this algorithm and run in the test suite.`);
    lines.push('');
    lines.push('| # | Description | Input | Expected |');
    lines.push('| --- | --- | --- | --- |');
    tests.forEach((test, index) => {
      const description = escapeText(test.text) || `Vector ${index + 1}`;
      const named = isUrl(test.uri) ? `[${cell(description)}](${test.uri.trim()})` : cell(description);
      lines.push(`| ${index + 1} | ${named} | ${cell(hexCell(test.input))} | ${cell(hexCell(test.expected))} |`);
    });
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push(`[← All algorithms](${path.posix.relative(path.posix.dirname(meta.docPath), 'docs/algorithms/README.md')})`);
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
      lines.push(`_${category.description}_`);
      lines.push('');
    }
    lines.push('| Algorithm | Security | Summary |');
    lines.push('| --- | --- | --- |');
    for (const entry of category.entries) {
      const relative = path.posix.relative('docs/algorithms', entry.docPath);
      const summary = escapeText(entry.algorithm.description).replace(/\s*\n\s*/g, ' ');
      const short = summary.length > 140 ? `${summary.slice(0, 139).trimEnd()}…` : summary;
      lines.push(`| [${cell(entry.algorithm.name)}](${relative}) | ${cell(labelOf(entry.algorithm.securityStatus, '—'))} | ${cell(short)} |`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push('Regenerate with `node tools/generate-algorithm-docs.js`; CI verifies the tree is current.');
  lines.push('');

  return lines.join('\n');
}

//#endregion

//#region ===== tree writing =====

function collectExisting(root) {
  const found = new Map();
  if (!fs.existsSync(root)) return found;
  const walk = directory => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.md')) found.set(path.resolve(full), fs.readFileSync(full, 'utf8'));
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

  const rendered = new Map();
  for (const entry of entries) {
    rendered.set(path.resolve(CIPHER_ROOT, entry.docPath), renderAlgorithm(entry.algorithm, entry));
  }
  rendered.set(path.resolve(DOCS_ROOT, 'README.md'), renderIndex(entries, categories));

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
