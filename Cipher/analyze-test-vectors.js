#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function checkTestVectors(dir) {
  const files = fs.readdirSync(dir, { withFileTypes: true });
  let results = [];
  
  for (const file of files) {
    const fullPath = path.join(dir, file.name);
    if (file.isDirectory()) {
      results = results.concat(checkTestVectors(fullPath));
    } else if (file.name.endsWith('.js')) {
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        const hasTestVectors = content.includes('testVectors');
        const vectorCount = (content.match(/"input":/g) || []).length;
        results.push({
          file: fullPath.replace(process.cwd() + '/', ''),
          hasTestVectors,
          vectorCount
        });
      } catch (e) {
        // Skip files we can't read
      }
    }
  }
  return results;
}

const results = checkTestVectors('./algorithms');
const withoutVectors = results.filter(r => !r.hasTestVectors);
const withFewVectors = results.filter(r => r.hasTestVectors && r.vectorCount < 3);

console.log('Total files analyzed:', results.length);
console.log('Files missing test vectors:', withoutVectors.length);
console.log('Files with few test vectors (<3):', withFewVectors.length);

if (withoutVectors.length > 0) {
  console.log('\nFiles missing test vectors:');
  withoutVectors.slice(0, 15).forEach(r => console.log('-', r.file));
}

if (withFewVectors.length > 0) {
  console.log('\nFiles with few test vectors:');
  withFewVectors.slice(0, 15).forEach(r => console.log('-', r.file, '(' + r.vectorCount + ' vectors)'));
}

// Statistics by category
const byCategory = {};
results.forEach(r => {
  const category = r.file.split('/')[1];
  if (!byCategory[category]) byCategory[category] = { total: 0, withVectors: 0, goodVectors: 0 };
  byCategory[category].total++;
  if (r.hasTestVectors) byCategory[category].withVectors++;
  if (r.vectorCount >= 3) byCategory[category].goodVectors++;
});

console.log('\nBy category:');
Object.entries(byCategory).forEach(([cat, stats]) => {
  console.log(`${cat}: ${stats.withVectors}/${stats.total} with vectors, ${stats.goodVectors}/${stats.total} with 3+ vectors`);
});