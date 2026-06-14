#!/usr/bin/env node

/**
 * Post-publish verification script for @3leaps/string-metrics-wasm
 *
 * Validates that a published npm package:
 * - Installs correctly
 * - Ships the embedded WASM contract (embedded dist/wasm-inline.js + JS glue, no raw .wasm)
 * - Core functions work
 * - New features work (locale-aware normalization)
 *
 * Usage:
 *   node scripts/verify-published-package.js [version]
 *   node scripts/verify-published-package.js        # Tests latest
 *   node scripts/verify-published-package.js 0.3.8  # Tests specific version
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PACKAGE_NAME = '@3leaps/string-metrics-wasm';

// Parse version argument
const version = process.argv[2] || 'latest';
const packageSpec = version === 'latest' ? PACKAGE_NAME : `${PACKAGE_NAME}@${version}`;

console.log('📦 Post-publish verification for', packageSpec);
console.log('');

// Create temp directory
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-string-metrics-'));
console.log('📁 Test directory:', tempDir);

let exitCode = 0;

try {
  // Change to temp directory
  process.chdir(tempDir);

  // Initialize package.json
  console.log('');
  console.log('🔧 Setting up test environment...');
  execSync('npm init -y', { stdio: 'ignore' });

  // Install package
  console.log('📥 Installing', packageSpec, '...');
  execSync(`npm install ${packageSpec}`, { stdio: 'inherit' });

  // Get installed version
  const installedVersion = JSON.parse(
    execSync(`npm view ${PACKAGE_NAME} version --json`, { encoding: 'utf8' }),
  );
  console.log('✅ Installed version:', installedVersion);

  // Verify the embedded-WASM package contract: the WASM bytes ship embedded in
  // dist/wasm-inline.js (loaded via initSync), the JS glue is present, and the
  // raw .wasm binary is NOT published (it would be dead weight).
  console.log('');
  console.log('🔍 Verifying package contents (embedded-WASM contract)...');
  const pkgRoot = path.join(tempDir, 'node_modules', '@3leaps', 'string-metrics-wasm');
  const embeddedPath = path.join(pkgRoot, 'dist', 'wasm-inline.js');
  const gluePath = path.join(pkgRoot, 'pkg', 'web', 'string_metrics_wasm.js');
  const rawWasmPath = path.join(pkgRoot, 'pkg', 'web', 'string_metrics_wasm_bg.wasm');

  if (!fs.existsSync(embeddedPath)) {
    console.error('❌ Embedded WASM not found at:', embeddedPath);
    exitCode = 1;
    throw new Error('Embedded WASM (dist/wasm-inline.js) missing from package');
  }
  if (!fs.existsSync(gluePath)) {
    console.error('❌ WASM JS glue not found at:', gluePath);
    exitCode = 1;
    throw new Error('WASM JS glue (pkg/web/string_metrics_wasm.js) missing from package');
  }
  if (fs.existsSync(rawWasmPath)) {
    console.error('❌ Redundant raw .wasm should not be published:', rawWasmPath);
    exitCode = 1;
    throw new Error('Redundant raw .wasm present in package (expected embedded-only)');
  }

  const embeddedSizeKB = Math.round(fs.statSync(embeddedPath).size / 1024);
  console.log('✅ Embedded WASM present:', `dist/wasm-inline.js (${embeddedSizeKB}KB)`);
  console.log('✅ JS glue present; redundant raw .wasm correctly absent');

  // Test package functionality
  console.log('');
  console.log('🧪 Testing package functionality...');

  // Write test file
  const testFile = path.join(tempDir, 'test-package.mjs');
  const testCode = `import * as pkg from '${PACKAGE_NAME}';

console.log('');
console.log('Testing core functions:');

// Test levenshtein
const lev = pkg.levenshtein('hello', 'hallo');
console.log('  levenshtein("hello", "hallo"):', lev);
if (lev !== 1) {
  console.error('  ❌ Expected 1, got', lev);
  process.exit(1);
}
console.log('  ✅ levenshtein works');

// Test jaro_winkler
const jw = pkg.jaro_winkler('hello', 'hallo');
console.log('  jaro_winkler("hello", "hallo"):', jw.toFixed(4));
if (jw < 0.85) {
  console.error('  ❌ Expected score > 0.85, got', jw);
  process.exit(1);
}
console.log('  ✅ jaro_winkler works');

// Test normalize (basic)
const norm1 = pkg.normalize('  HELLO  ', 'default');
console.log('  normalize("  HELLO  ", "default"):', JSON.stringify(norm1));
if (norm1 !== 'hello') {
  console.error('  ❌ Expected "hello", got', norm1);
  process.exit(1);
}
console.log('  ✅ normalize works');

console.log('');
console.log('Testing locale-aware normalization (v0.3.8+):');

// Test Turkish locale normalization
const turkish = pkg.normalize('İstanbul', 'default', 'tr');
console.log('  normalize("İstanbul", "default", "tr"):', JSON.stringify(turkish));
if (turkish !== 'istanbul') {
  console.error('  ❌ Expected "istanbul", got', turkish);
  process.exit(1);
}
console.log('  ✅ Turkish locale works');

// Test default (no locale) - should preserve combining dot
const unicode = pkg.normalize('İstanbul', 'default');
console.log('  normalize("İstanbul", "default"):', JSON.stringify(unicode));
if (unicode !== 'i̇stanbul') {
  console.error('  ❌ Expected "i̇stanbul" (with combining dot), got', unicode);
  process.exit(1);
}
console.log('  ✅ Unicode casefold works');

// Test ratio (RapidFuzz compatibility)
const ratio = pkg.ratio('fuzzy', 'wuzzy');
console.log('');
console.log('Testing RapidFuzz compatibility:');
console.log('  ratio("fuzzy", "wuzzy"):', ratio.toFixed(2));
if (ratio < 50) {
  console.error('  ❌ Expected ratio > 50, got', ratio);
  process.exit(1);
}
console.log('  ✅ ratio works');

console.log('');
console.log('✅ All tests passed!');
console.log('');
console.log('📊 Package verification summary:');
console.log('  Package: ${PACKAGE_NAME}@${installedVersion}');
console.log('  Embedded WASM size: ${embeddedSizeKB}KB');
console.log('  Core metrics: ✅');
console.log('  Locale normalization: ✅');
console.log('  RapidFuzz compatibility: ✅');
`;

  fs.writeFileSync(testFile, testCode);

  execSync(`node ${testFile}`, {
    stdio: 'inherit',
    cwd: tempDir,
  });
} catch (error) {
  console.error('');
  console.error('❌ Verification failed:', error.message);
  exitCode = 1;
} finally {
  // Cleanup
  console.log('');
  console.log('🧹 Cleaning up...');
  try {
    process.chdir('/');
    fs.rmSync(tempDir, { recursive: true, force: true });
    console.log('✅ Cleanup complete');
  } catch (cleanupError) {
    console.error('⚠️  Cleanup warning:', cleanupError.message);
  }
}

console.log('');
if (exitCode === 0) {
  console.log('✅ Package verification PASSED');
} else {
  console.log('❌ Package verification FAILED');
}

process.exit(exitCode);
