import { distance, score } from './dist/index.js';

console.log('=== Unified API Smoke Test ===\n');

const a = 'kitten';
const b = 'sitting';

// Test 1: distance() with different metrics
console.log('1. distance() - raw edit distances:');
console.log(`  Strings: "${a}" vs "${b}"`);
console.log(`  levenshtein: ${distance(a, b, 'levenshtein')}`);
console.log(`  damerau_levenshtein: ${distance(a, b, 'damerau_levenshtein')}`);
console.log(`  osa: ${distance(a, b, 'osa')}`);
console.log(`  indel: ${distance(a, b, 'indel')}`);
console.log(`  lcs_seq: ${distance(a, b, 'lcs_seq')}`);

// Test 2: score() with different metrics - normalized 0-1
console.log('\n2. score() - normalized similarity (0.0-1.0):');
console.log(`  Strings: "${a}" vs "${b}"`);
console.log(`  levenshtein: ${score(a, b, 'levenshtein').toFixed(4)}`);
console.log(`  damerau_levenshtein: ${score(a, b, 'damerau_levenshtein').toFixed(4)}`);
console.log(`  osa: ${score(a, b, 'osa').toFixed(4)}`);
console.log(`  jaro: ${score(a, b, 'jaro').toFixed(4)}`);
console.log(`  jaro_winkler: ${score(a, b, 'jaro_winkler').toFixed(4)}`);
console.log(`  indel: ${score(a, b, 'indel').toFixed(4)}`);
console.log(`  lcs_seq: ${score(a, b, 'lcs_seq').toFixed(4)}`);

// Test 3: Token-based metrics via score()
console.log('\n3. score() - token-based metrics (0.0-1.0):');
const c = 'new york mets';
const d = 'mets york new';
console.log(`  Strings: "${c}" vs "${d}"`);
console.log(`  ratio: ${score(c, d, 'ratio').toFixed(4)}`);
console.log(`  token_sort_ratio: ${score(c, d, 'token_sort_ratio').toFixed(4)}`);
console.log(`  token_set_ratio: ${score(c, d, 'token_set_ratio').toFixed(4)}`);

// Test 4: Partial ratio
console.log('\n4. score() - partial_ratio for substring matching:');
const e = 'fuzzy';
const f = 'fuzzy wuzzy was a bear';
console.log(`  Strings: "${e}" vs "${f}"`);
console.log(`  ratio: ${score(e, f, 'ratio').toFixed(4)}`);
console.log(`  partial_ratio: ${score(e, f, 'partial_ratio').toFixed(4)}`);

// Test 5: Default metric
console.log('\n5. Defaults (no metric specified):');
console.log(`  distance("${a}", "${b}") = ${distance(a, b)} (default: levenshtein)`);
console.log(`  score("${a}", "${b}") = ${score(a, b).toFixed(4)} (default: jaro_winkler)`);

// Test 6: Identical strings
console.log('\n6. Identical strings:');
console.log(`  distance("hello", "hello") = ${distance('hello', 'hello')}`);
console.log(`  score("hello", "hello") = ${score('hello', 'hello').toFixed(4)}`);

// Test 7: Completely different strings
console.log('\n7. Completely different strings:');
console.log(`  distance("abc", "xyz") = ${distance('abc', 'xyz')}`);
console.log(`  score("abc", "xyz") = ${score('abc', 'xyz').toFixed(4)}`);

console.log('\n✅ Unified API smoke test complete!');
