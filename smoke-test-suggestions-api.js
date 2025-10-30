import { suggest } from './dist/index.js';

console.log('=== Extended Suggestions API Smoke Test ===\n');

const candidates = [
  'New York Jets',
  'New York Giants',
  'Atlanta Falcons',
  'Dallas Cowboys',
  'Los Angeles Rams',
];

// Test 1: Using ratio metric
console.log('1. suggest() with ratio metric:');
const ratioResults = suggest('new york jets', candidates, {
  metric: 'ratio',
  max_suggestions: 3,
  min_score: 0.5,
});
console.log(`  Query: "new york jets"`);
ratioResults.forEach((result, i) => {
  console.log(`  ${i + 1}. "${result.value}" (score: ${result.score.toFixed(4)})`);
});

// Test 2: Using token_sort_ratio metric
console.log('\n2. suggest() with token_sort_ratio metric:');
const tokenSortResults = suggest('jets new york', candidates, {
  metric: 'token_sort_ratio',
  max_suggestions: 3,
  min_score: 0.5,
});
console.log(`  Query: "jets new york" (order different)`);
tokenSortResults.forEach((result, i) => {
  console.log(`  ${i + 1}. "${result.value}" (score: ${result.score.toFixed(4)})`);
});

// Test 3: Using token_set_ratio metric
console.log('\n3. suggest() with token_set_ratio metric:');
const tokenSetResults = suggest('new york', candidates, {
  metric: 'token_set_ratio',
  max_suggestions: 3,
  min_score: 0.4,
});
console.log(`  Query: "new york"`);
tokenSetResults.forEach((result, i) => {
  console.log(`  ${i + 1}. "${result.value}" (score: ${result.score.toFixed(4)})`);
});

// Test 4: Using partial_ratio metric
console.log('\n4. suggest() with partial_ratio metric:');
const partialResults = suggest('jets', candidates, {
  metric: 'partial_ratio',
  max_suggestions: 3,
  min_score: 0.5,
});
console.log(`  Query: "jets"`);
partialResults.forEach((result, i) => {
  console.log(`  ${i + 1}. "${result.value}" (score: ${result.score.toFixed(4)})`);
});

// Test 5: Using indel metric
console.log('\n5. suggest() with indel metric:');
const indelResults = suggest('atlanta', candidates, {
  metric: 'indel',
  max_suggestions: 2,
  min_score: 0.4,
});
console.log(`  Query: "atlanta"`);
indelResults.forEach((result, i) => {
  console.log(`  ${i + 1}. "${result.value}" (score: ${result.score.toFixed(4)})`);
});

// Test 6: Using lcs_seq metric
console.log('\n6. suggest() with lcs_seq metric:');
const lcsResults = suggest('dallas', candidates, {
  metric: 'lcs_seq',
  max_suggestions: 2,
  min_score: 0.4,
});
console.log(`  Query: "dallas"`);
lcsResults.forEach((result, i) => {
  console.log(`  ${i + 1}. "${result.value}" (score: ${result.score.toFixed(4)})`);
});

// Test 7: Default metric still works
console.log('\n7. suggest() with default metric (jaro_winkler):');
const defaultResults = suggest('new york', candidates, {
  max_suggestions: 2,
  min_score: 0.6,
});
console.log(`  Query: "new york"`);
defaultResults.forEach((result, i) => {
  console.log(`  ${i + 1}. "${result.value}" (score: ${result.score.toFixed(4)})`);
});

console.log('\n✅ Extended Suggestions API smoke test complete!');
