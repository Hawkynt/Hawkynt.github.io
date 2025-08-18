#!/usr/bin/env node
/*
 * Master Test Runner
 * Executes all infrastructure tests and generates comprehensive report
 * (c)2006-2025 Hawkynt
 */

const fs = require('fs');
const path = require('path');

console.log('SynthelicZ Cipher Tools - Master Test Suite');
console.log('===========================================');
console.log('Running comprehensive infrastructure validation...\n');

const startTime = Date.now();
const results = {
  infrastructure: null,
  testVectors: null,
  languageConversion: null,
  chainingSystem: null,
  summary: {
    totalTests: 0,
    totalPassed: 0,
    totalFailed: 0,
    overallSuccessRate: 0,
    totalTime: 0
  }
};

// Run Infrastructure Tests
console.log('1/4: Running Infrastructure Tests...');
try {
  const InfrastructureTests = require('./infrastructure-test-runner.js');
  results.infrastructure = InfrastructureTests.runAllTests();
} catch (e) {
  console.error('Infrastructure tests failed:', e.message);
  results.infrastructure = { total: 0, passed: 0, failed: 1, error: e.message };
}

console.log('\n' + '='.repeat(50) + '\n');

// Run Test Vector Validation
console.log('2/4: Running Test Vector Validation...');
try {
  const TestVectorValidator = require('./test-vector-validation.js');
  const vectorResults = TestVectorValidator.runValidation();
  results.testVectors = {
    total: vectorResults.summary.totalVectors,
    passed: vectorResults.summary.passedVectors,
    failed: vectorResults.summary.failedVectors,
    successRate: parseFloat(vectorResults.summary.successRate),
    algorithms: vectorResults.summary.totalAlgorithms
  };
} catch (e) {
  console.error('Test vector validation failed:', e.message);
  results.testVectors = { total: 0, passed: 0, failed: 1, error: e.message };
}

console.log('\n' + '='.repeat(50) + '\n');

// Run Language Conversion Tests
console.log('3/4: Running Language Conversion Tests...');
try {
  const LanguageConversionTest = require('./language-conversion-test.js');
  results.languageConversion = LanguageConversionTest.testAllLanguages();
} catch (e) {
  console.error('Language conversion tests failed:', e.message);
  results.languageConversion = { total: 0, passed: 0, failed: 1, error: e.message };
}

console.log('\n' + '='.repeat(50) + '\n');

// Run Chaining System Tests
console.log('4/4: Running Chaining System Tests...');
try {
  const ChainingSystemTest = require('./chaining-system-test.js');
  results.chainingSystem = ChainingSystemTest.testChainingSystem();
} catch (e) {
  console.error('Chaining system tests failed:', e.message);
  results.chainingSystem = { total: 0, passed: 0, failed: 1, error: e.message };
}

const endTime = Date.now();
const totalTime = endTime - startTime;

// Calculate summary
results.summary.totalTests = 
  (results.infrastructure?.total || 0) + 
  (results.testVectors?.total || 0) + 
  (results.languageConversion?.total || 0) + 
  (results.chainingSystem?.total || 0);

results.summary.totalPassed = 
  (results.infrastructure?.passed || 0) + 
  (results.testVectors?.passed || 0) + 
  (results.languageConversion?.passed || 0) + 
  (results.chainingSystem?.passed || 0);

results.summary.totalFailed = 
  (results.infrastructure?.failed || 0) + 
  (results.testVectors?.failed || 0) + 
  (results.languageConversion?.failed || 0) + 
  (results.chainingSystem?.failed || 0);

results.summary.overallSuccessRate = results.summary.totalTests > 0 ? 
  (results.summary.totalPassed / results.summary.totalTests) * 100 : 0;

results.summary.totalTime = totalTime;

// Generate comprehensive report
console.log('\n' + '='.repeat(50));
console.log('COMPREHENSIVE TEST RESULTS');
console.log('='.repeat(50));

console.log('\n📊 Overall Summary:');
console.log(`   Total Tests: ${results.summary.totalTests}`);
console.log(`   Passed: ${results.summary.totalPassed}`);
console.log(`   Failed: ${results.summary.totalFailed}`);
console.log(`   Success Rate: ${results.summary.overallSuccessRate.toFixed(1)}%`);
console.log(`   Total Time: ${results.summary.totalTime}ms`);

console.log('\n🔧 Infrastructure Tests:');
if (results.infrastructure) {
  console.log(`   Status: ${results.infrastructure.passed}/${results.infrastructure.total} passed (${results.infrastructure.successRate?.toFixed(1) || 0}%)`);
  if (results.infrastructure.error) {
    console.log(`   Error: ${results.infrastructure.error}`);
  }
} else {
  console.log('   Status: Not run');
}

console.log('\n🧪 Test Vector Validation:');
if (results.testVectors) {
  console.log(`   Status: ${results.testVectors.passed}/${results.testVectors.total} passed (${results.testVectors.successRate?.toFixed(1) || 0}%)`);
  if (results.testVectors.algorithms) {
    console.log(`   Algorithms: ${results.testVectors.algorithms} tested`);
  }
  if (results.testVectors.error) {
    console.log(`   Error: ${results.testVectors.error}`);
  }
} else {
  console.log('   Status: Not run');
}

console.log('\n🌐 Language Conversion:');
if (results.languageConversion) {
  console.log(`   Status: ${results.languageConversion.passed}/${results.languageConversion.total} passed (${results.languageConversion.successRate?.toFixed(1) || 0}%)`);
  if (results.languageConversion.error) {
    console.log(`   Error: ${results.languageConversion.error}`);
  }
} else {
  console.log('   Status: Not run');
}

console.log('\n⛓️  Algorithm Chaining:');
if (results.chainingSystem) {
  console.log(`   Status: ${results.chainingSystem.passed}/${results.chainingSystem.total} passed (${results.chainingSystem.successRate?.toFixed(1) || 0}%)`);
  if (results.chainingSystem.error) {
    console.log(`   Error: ${results.chainingSystem.error}`);
  }
} else {
  console.log('   Status: Not run');
}

// Determine overall health
let healthStatus = '🔴 CRITICAL';
if (results.summary.overallSuccessRate >= 90) {
  healthStatus = '🟢 EXCELLENT';
} else if (results.summary.overallSuccessRate >= 75) {
  healthStatus = '🟡 GOOD';
} else if (results.summary.overallSuccessRate >= 50) {
  healthStatus = '🟠 FAIR';
}

console.log(`\n🏥 System Health: ${healthStatus} (${results.summary.overallSuccessRate.toFixed(1)}%)`);

// Recommendations
console.log('\n📋 Recommendations:');
if (results.summary.overallSuccessRate < 90) {
  console.log('   • Review failed tests and address issues');
  if (results.infrastructure?.failed > 0) {
    console.log('   • Fix infrastructure issues first - they affect everything else');
  }
  if (results.testVectors?.failed > 0) {
    console.log('   • Update algorithm test vectors and documentation');
  }
  if (results.languageConversion?.failed > 0) {
    console.log('   • Improve code generation templates and validation');
  }
  if (results.chainingSystem?.failed > 0) {
    console.log('   • Fix algorithm chaining system integration');
  }
} else {
  console.log('   • System is performing well!');
  console.log('   • Consider adding more comprehensive test vectors');
  console.log('   • Expand language support for code generation');
}

// Save detailed results
const reportPath = path.join(__dirname, 'test-results.json');
fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
console.log(`\n📄 Detailed results saved to: ${reportPath}`);

console.log('\n' + '='.repeat(50));
console.log('MASTER TEST SUITE COMPLETE');
console.log('='.repeat(50));

// Exit with appropriate code
process.exit(results.summary.overallSuccessRate >= 75 ? 0 : 1);