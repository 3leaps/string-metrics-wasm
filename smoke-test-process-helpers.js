import { extract, extractOne, levenshtein, tokenSortRatio } from './dist/index.js';

console.log('=== Process Helpers Smoke Test ===\n');

const choices = [
  'Atlanta Falcons',
  'New York Jets',
  'New York Giants',
  'Dallas Cowboys',
  'Los Angeles Rams',
  'Green Bay Packers',
  'San Francisco 49ers',
];

// Test 1: extractOne - find best match
console.log('1. extractOne - find best match:');
const best = extractOne('new york jets', choices);
console.log(`  Query: "new york jets"`);
console.log(
  `  Best match: "${best.choice}" (score: ${best.score.toFixed(2)}, index: ${best.index})`,
);

// Test 2: extractOne with different scorer
console.log('\n2. extractOne with tokenSortRatio:');
const best2 = extractOne('jets new york', choices, { scorer: tokenSortRatio });
console.log(`  Query: "jets new york" (order different)`);
console.log(
  `  Best match: "${best2.choice}" (score: ${best2.score.toFixed(2)}, index: ${best2.index})`,
);

// Test 3: extract - find top N matches
console.log('\n3. extract - find top 3 matches:');
const top3 = extract('new york', choices, { limit: 3 });
console.log(`  Query: "new york"`);
top3.forEach((result, i) => {
  console.log(
    `  ${i + 1}. "${result.choice}" (score: ${result.score.toFixed(2)}, index: ${result.index})`,
  );
});

// Test 4: extract with score cutoff
console.log('\n4. extract with score cutoff (>= 60):');
const filtered = extract('atlanta', choices, { score_cutoff: 60 });
console.log(`  Query: "atlanta"`);
filtered.forEach((result, i) => {
  console.log(
    `  ${i + 1}. "${result.choice}" (score: ${result.score.toFixed(2)}, index: ${result.index})`,
  );
});

// Test 5: extract with processor (case normalization)
console.log('\n5. extract with processor (lowercase):');
const processor = (s) => s.toLowerCase();
const processed = extract('DALLAS COWBOYS', choices, { processor, limit: 2 });
console.log(`  Query: "DALLAS COWBOYS" (uppercase)`);
processed.forEach((result, i) => {
  console.log(
    `  ${i + 1}. "${result.choice}" (score: ${result.score.toFixed(2)}, index: ${result.index})`,
  );
});

// Test 6: extractOne with custom scorer (levenshtein distance)
// Note: levenshtein returns distance (lower is better), not similarity
// So we need to convert it to a similarity score
console.log('\n6. Using different scorers:');
const customScorer = (a, b) => {
  // Convert levenshtein distance to similarity score (0-100)
  const dist = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length);
  return maxLen === 0 ? 100 : ((maxLen - dist) / maxLen) * 100;
};
const custom = extractOne('packers', choices, { scorer: customScorer });
console.log(`  Query: "packers"`);
console.log(
  `  Best match: "${custom.choice}" (score: ${custom.score.toFixed(2)}, index: ${custom.index})`,
);

// Test 7: No match above cutoff
console.log('\n7. No match above cutoff:');
const noMatch = extractOne('baseball', choices, { score_cutoff: 80 });
console.log(`  Query: "baseball" (cutoff: 80)`);
console.log(`  Best match: ${noMatch === null ? 'null (no match)' : noMatch.choice}`);

console.log('\n✅ Process helpers smoke test complete!');
