import { extractOne, ratio } from './dist/index.js';

console.log('=== extractOne Cutoff Fix Verification ===\n');

// Create a custom scorer that returns exactly 80 for a specific match
const customScorer = (query, choice) => {
  if (query === 'test' && choice === 'exact match') {
    return 80; // Exactly equals cutoff
  }
  if (query === 'test' && choice === 'below cutoff') {
    return 79.9; // Just below cutoff
  }
  if (query === 'test' && choice === 'above cutoff') {
    return 80.1; // Just above cutoff
  }
  return 50; // Other choices
};

const choices = ['exact match', 'below cutoff', 'above cutoff', 'other'];

// Test 1: Score exactly equals cutoff (should return the match)
console.log('1. Score exactly equals cutoff (80):');
const exactMatch = extractOne('test', choices, {
  scorer: customScorer,
  score_cutoff: 80,
});
console.log(`  Expected: "exact match" or "above cutoff" with score >= 80`);
console.log(
  `  Result: ${exactMatch ? `"${exactMatch.choice}" (score: ${exactMatch.score})` : 'null'}`,
);
console.log(`  Status: ${exactMatch && exactMatch.score >= 80 ? '✅ PASS' : '❌ FAIL'}`);

// Test 2: Best score is below cutoff (should return null)
console.log('\n2. Best score below cutoff (cutoff: 85):');
const belowCutoff = extractOne('test', choices, {
  scorer: customScorer,
  score_cutoff: 85,
});
console.log(`  Expected: null (no match >= 85)`);
console.log(
  `  Result: ${belowCutoff === null ? 'null' : `"${belowCutoff.choice}" (score: ${belowCutoff.score})`}`,
);
console.log(`  Status: ${belowCutoff === null ? '✅ PASS' : '❌ FAIL'}`);

// Test 3: Real-world scenario with ratio scorer
console.log('\n3. Real-world test with ratio scorer:');
const realChoices = ['Dallas Cowboys', 'Dallas Mavericks', 'Houston Texans'];

// Find the exact score first
const dallasScore = ratio('dallas cowboys', 'Dallas Cowboys');
console.log(`  ratio("dallas cowboys", "Dallas Cowboys") = ${dallasScore.toFixed(2)}`);

// Now use that exact score as cutoff (with normalization to 0-1)
const exactCutoffMatch = extractOne('dallas cowboys', realChoices, {
  scorer: ratio,
  score_cutoff: dallasScore, // Use exact score as cutoff
});
console.log(`  extractOne with score_cutoff = ${dallasScore.toFixed(2)}:`);
console.log(
  `  Result: ${exactCutoffMatch ? `"${exactCutoffMatch.choice}" (score: ${exactCutoffMatch.score.toFixed(2)})` : 'null'}`,
);
console.log(
  `  Status: ${exactCutoffMatch && exactCutoffMatch.choice === 'Dallas Cowboys' ? '✅ PASS' : '❌ FAIL'}`,
);

// Test 4: Default cutoff (0) should return best match
console.log('\n4. Default cutoff (0) should always return best match:');
const defaultCutoff = extractOne('test', choices, {
  scorer: customScorer,
  // No score_cutoff specified, defaults to 0
});
console.log(`  Expected: Best match (score >= 0)`);
console.log(
  `  Result: ${defaultCutoff ? `"${defaultCutoff.choice}" (score: ${defaultCutoff.score})` : 'null'}`,
);
console.log(`  Status: ${defaultCutoff !== null ? '✅ PASS' : '❌ FAIL'}`);

// Test 5: Multiple matches at exact cutoff
console.log('\n5. Multiple matches at exact cutoff (returns first best):');
const tiedScorer = (_query, choice) => {
  if (choice === 'first 80' || choice === 'second 80') return 80;
  return 70;
};
const tiedChoices = ['first 80', 'second 80', 'lower'];
const tiedMatch = extractOne('test', tiedChoices, {
  scorer: tiedScorer,
  score_cutoff: 80,
});
console.log(`  Expected: One of the matches with score 80`);
console.log(
  `  Result: ${tiedMatch ? `"${tiedMatch.choice}" (score: ${tiedMatch.score})` : 'null'}`,
);
console.log(`  Status: ${tiedMatch && tiedMatch.score === 80 ? '✅ PASS' : '❌ FAIL'}`);

console.log('\n=== Cutoff Fix Verification Complete ===');
