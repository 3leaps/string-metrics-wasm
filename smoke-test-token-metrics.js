import { ratio, partialRatio, tokenSortRatio, tokenSetRatio } from './dist/index.js';

console.log('=== Token-Based Metrics Smoke Test ===\n');

// Test 1: partialRatio - substring matching
console.log('1. partialRatio - substring matching:');
const partial1 = partialRatio('this is a test', 'this is a test!');
console.log(`  partialRatio("this is a test", "this is a test!") = ${partial1.toFixed(2)}`);

const partial2 = partialRatio('fuzzy', 'fuzzy wuzzy was a bear');
console.log(`  partialRatio("fuzzy", "fuzzy wuzzy was a bear") = ${partial2.toFixed(2)}`);

// Test 2: tokenSortRatio - order-insensitive
console.log('\n2. tokenSortRatio - order-insensitive:');
const tokenSort1 = tokenSortRatio('fuzzy wuzzy was a bear', 'wuzzy bear was a fuzzy');
console.log(
  `  tokenSortRatio("fuzzy wuzzy was a bear", "wuzzy bear was a fuzzy") = ${tokenSort1.toFixed(2)}`,
);

const tokenSort2 = tokenSortRatio('new york mets', 'mets york new');
console.log(`  tokenSortRatio("new york mets", "mets york new") = ${tokenSort2.toFixed(2)}`);

// Test 3: tokenSetRatio - handles duplication and order
console.log('\n3. tokenSetRatio - handles duplication and order:');
const tokenSet1 = tokenSetRatio('mariners vs angels', 'angels vs mariners');
console.log(
  `  tokenSetRatio("mariners vs angels", "angels vs mariners") = ${tokenSet1.toFixed(2)}`,
);

const tokenSet2 = tokenSetRatio(
  'new york mets vs atlanta braves',
  'atlanta braves vs new york mets',
);
console.log(
  `  tokenSetRatio("new york mets vs atlanta braves", "atlanta braves vs new york mets") = ${tokenSet2.toFixed(2)}`,
);

// Test 4: Compare all metrics on same strings
console.log('\n4. Comparing all metrics:');
const a = 'the cat sat on the mat';
const b = 'cat sat mat the on the';
console.log(`  Strings: "${a}" vs "${b}"`);
console.log(`  ratio: ${ratio(a, b).toFixed(2)}`);
console.log(`  partialRatio: ${partialRatio(a, b).toFixed(2)}`);
console.log(`  tokenSortRatio: ${tokenSortRatio(a, b).toFixed(2)}`);
console.log(`  tokenSetRatio: ${tokenSetRatio(a, b).toFixed(2)}`);

console.log('\n✅ Token-based metrics smoke test complete!');
