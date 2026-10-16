#!/usr/bin/env node
// Stamps every local script and stylesheet a desktop page loads with a
// version derived from the file's content, so a changed file gets a new
// address and a browser cache (GitHub Pages sends max-age=600 for every
// file) can never serve it stale, while unchanged files stay cached.
//
//   node .github/scripts/stamp-assets.js [--check] [<dir>...]
//
// Walks every .html page below the given directories (default: sz) and
// rewrites the src of <script src> and the href of <link rel="stylesheet">
// to <path>?v=<first 8 hex digits of the SHA-1 of the file>. An existing
// v= is replaced in place, other query parameters and the fragment are kept.
// Remote addresses (http:, https:, data:, //host) and references inside
// HTML comments are left alone. Absolute paths resolve against the
// repository root, which GitHub Pages serves as the site root.
//
// Running it again changes nothing. A referenced file that does not exist is
// reported as a warning and left unstamped.
// --check rewrites nothing and exits 1 when any page is not stamped current.
// Exit codes: 0 done (or current), 1 an error (or --check found stale pages).
'use strict';
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const args = process.argv.slice(2);
const check = args.includes('--check');
const dirs = args.filter(a => a !== '--check');
if (!dirs.length)
  dirs.push('sz');

const SKIP_DIRS = new Set(['.git', 'node_modules']);
const hashCache = new Map();
const warnings = [];
let pages = 0, references = 0, stamped = 0;
const changedPages = [];

function walk(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name))
      continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory())
      walk(full, out);
    else if (entry.isFile() && /\.html?$/i.test(entry.name))
      out.push(full);
  }
  return out;
}

// line endings are normalized so a checkout with CRLF stamps like one with LF
function contentHash(file) {
  let hash = hashCache.get(file);
  if (hash === undefined) {
    const text = fs.readFileSync(file, 'latin1').replace(/\r\n/g, '\n');
    hash = crypto.createHash('sha1').update(text, 'latin1').digest('hex').slice(0, 8);
    hashCache.set(file, hash);
  }
  return hash;
}

function isLocal(url) {
  return url !== ''
    && !/^[a-z][a-z0-9+.-]*:/i.test(url)
    && !url.startsWith('//')
    && !url.startsWith('#')
    && !/[{}$<>]/.test(url);
}

// the page is read as latin1 so every byte round-trips; addresses are UTF-8
function resolveFile(page, url) {
  let filePath = Buffer.from(url, 'latin1').toString('utf8');
  try { filePath = decodeURI(filePath); } catch (_) {}
  return filePath.startsWith('/')
    ? path.join(ROOT, filePath)
    : path.resolve(path.dirname(page), filePath);
}

function stampUrl(page, url) {
  const hashAt = url.indexOf('#');
  const fragment = hashAt < 0 ? '' : url.slice(hashAt);
  const beforeFragment = hashAt < 0 ? url : url.slice(0, hashAt);
  const queryAt = beforeFragment.indexOf('?');
  const filePart = queryAt < 0 ? beforeFragment : beforeFragment.slice(0, queryAt);
  const query = queryAt < 0 ? '' : beforeFragment.slice(queryAt + 1);
  if (!isLocal(filePart))
    return url;

  ++references;
  const file = resolveFile(page, filePart);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    warnings.push(`${path.relative(ROOT, page)}: ${filePart} not found, left unstamped`);
    return url;
  }

  const version = 'v=' + contentHash(file);
  const params = query === '' ? [] : query.split('&');
  const at = params.findIndex(p => p === 'v' || p.startsWith('v='));
  if (at < 0)
    params.push(version);
  else
    params[at] = version;
  ++stamped;
  return filePart + '?' + params.join('&') + fragment;
}

const ATTRIBUTE = name => new RegExp('(\\s' + name + '\\s*=\\s*)(?:"([^"]*)"|\'([^\']*)\'|([^\\s"\'>]+))', 'i');

function rewriteAttribute(page, tag, name) {
  return tag.replace(ATTRIBUTE(name), (match, prefix, dq, sq, bare) => {
    const value = dq !== undefined ? dq : sq !== undefined ? sq : bare;
    const quote = dq !== undefined ? '"' : sq !== undefined ? '\'' : '';
    const next = stampUrl(page, value);
    return prefix + quote + next + quote;
  });
}

function stampPage(page) {
  const html = fs.readFileSync(page, 'latin1');
  // comments are left exactly as written; only the markup between them is stamped
  const parts = html.split(/(<!--[\s\S]*?-->)/);
  for (let i = 0; i < parts.length; i += 2)
    parts[i] = parts[i]
      .replace(/<script\b[^>]*>/gi, tag => rewriteAttribute(page, tag, 'src'))
      .replace(/<link\b[^>]*>/gi, tag =>
        /\srel\s*=\s*(?:"[^"]*\bstylesheet\b[^"]*"|'[^']*\bstylesheet\b[^']*'|stylesheet\b)/i.test(tag)
          ? rewriteAttribute(page, tag, 'href')
          : tag);
  const next = parts.join('');
  ++pages;
  if (next === html)
    return;
  changedPages.push(path.relative(ROOT, page));
  if (!check)
    fs.writeFileSync(page, next, 'latin1');
}

try {
  for (const dir of dirs)
    for (const page of walk(path.resolve(ROOT, dir), []))
      stampPage(page);
} catch (error) {
  console.error(`[stamp-assets] ${error.message}`);
  process.exit(1);
}

for (const warning of warnings)
  console.log(`::warning::${warning}`);
console.log(`[stamp-assets] ${pages} page(s), ${references} local reference(s), ${stamped} stamped, ${warnings.length} missing`);
if (!changedPages.length) {
  console.log('[stamp-assets] every page is stamped current.');
  process.exit(0);
}
console.log(`[stamp-assets] ${changedPages.length} page(s) ${check ? 'need restamping' : 'restamped'}:`);
for (const page of changedPages)
  console.log(`  ${page}`);
process.exit(check ? 1 : 0);
