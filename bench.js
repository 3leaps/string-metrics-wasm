#!/usr/bin/env node

/**
 * Benchmark harness for string-metrics-wasm
 *
 * Tests:
 * - Cold init: module loading time
 * - Hot loops: repeated calls to core functions
 */

import { performance } from 'node:perf_hooks';
import {
  levenshtein,
  normalized_levenshtein,
  damerau_levenshtein,
  normalized_damerau_levenshtein,
  jaro,
  jaro_winkler,
} from './dist/index.js';

// Test data sets
const TEST_PAIRS = [
  // Short strings
  ['kitten', 'sitting'],
  ['saturday', 'sunday'],
  ['book', 'back'],

  // Medium strings
  ['JavaScript', 'TypeScript'],
  ['algorithm', 'logarithm'],
  ['database', 'data base'],

  // Long strings
  ['The quick brown fox jumps over the lazy dog', 'The quick brown dog jumps over the lazy fox'],
  ['supercalifragilisticexpialidocious', 'supercalifragilisticexpialidocious'],
  ['PostgreSQL database connection', 'MySQL database connection'],

  // Unicode
  ['café', 'cafe'],
  ['Москва', 'Москва'],
  ['日本語', '日本語'],
];

// Benchmark configuration
const WARMUP_ITERATIONS = 100;
const BENCH_ITERATIONS = 10000;

function formatTime(ms) {
  if (ms < 1) return `${(ms * 1000).toFixed(2)} µs`;
  return `${ms.toFixed(3)} ms`;
}

function formatThroughput(ops) {
  if (ops > 1000000) return `${(ops / 1000000).toFixed(2)}M ops/sec`;
  if (ops > 1000) return `${(ops / 1000).toFixed(2)}K ops/sec`;
  return `${ops.toFixed(0)} ops/sec`;
}

/**
 * Benchmark a function with warmup
 */
function benchmark(name, fn, iterations = BENCH_ITERATIONS) {
  // Warmup
  for (let i = 0; i < WARMUP_ITERATIONS; i++) {
    fn();
  }

  // Actual benchmark
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    fn();
  }
  const end = performance.now();

  const totalTime = end - start;
  const avgTime = totalTime / iterations;
  const throughput = (iterations / totalTime) * 1000;

  return { name, totalTime, avgTime, throughput, iterations };
}

/**
 * Run benchmarks for a single function across all test pairs
 */
function benchmarkFunction(funcName, func) {
  const results = [];

  for (const [a, b] of TEST_PAIRS) {
    const result = benchmark(`${funcName}('${a.slice(0, 20)}...', '${b.slice(0, 20)}...')`, () =>
      func(a, b),
    );
    results.push(result);
  }

  return results;
}

/**
 * Cold init benchmark - measure module load time
 */
function benchmarkColdInit() {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('COLD INIT BENCHMARK');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const iterations = 10;
  const times = [];

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    // In a real cold-init test, we'd reload the module
    // For now, we measure a representative operation
    levenshtein('test', 'test');
    const end = performance.now();
    times.push(end - start);
  }

  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const min = Math.min(...times);
  const max = Math.max(...times);

  console.log('First-call latency (proxy for init):');
  console.log(`  Average: ${formatTime(avg)}`);
  console.log(`  Min:     ${formatTime(min)}`);
  console.log(`  Max:     ${formatTime(max)}`);
  console.log(`  Samples: ${iterations}`);
}

/**
 * Hot loop benchmarks - measure sustained throughput
 */
function benchmarkHotLoops() {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('HOT LOOP BENCHMARKS');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const functions = [
    { name: 'levenshtein', func: levenshtein },
    { name: 'normalized_levenshtein', func: normalized_levenshtein },
    { name: 'damerau_levenshtein', func: damerau_levenshtein },
    { name: 'normalized_damerau_levenshtein', func: normalized_damerau_levenshtein },
    { name: 'jaro', func: jaro },
    { name: 'jaro_winkler', func: jaro_winkler },
  ];

  const allResults = [];

  for (const { name, func } of functions) {
    console.log(`\n${name}:`);
    console.log('─'.repeat(65));

    const results = benchmarkFunction(name, func);
    allResults.push({ function: name, results });

    // Calculate aggregates
    const totalOps = results.reduce((sum, r) => sum + r.iterations, 0);
    const totalTime = results.reduce((sum, r) => sum + r.totalTime, 0);
    const avgThroughput = (totalOps / totalTime) * 1000;
    const avgLatency = totalTime / totalOps;

    console.log(`  Total operations: ${totalOps.toLocaleString()}`);
    console.log(`  Total time:       ${formatTime(totalTime)}`);
    console.log(`  Avg throughput:   ${formatThroughput(avgThroughput)}`);
    console.log(`  Avg latency:      ${formatTime(avgLatency)}`);
  }

  return allResults;
}

/**
 * Summary comparison across functions
 */
function printSummary(results) {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════\n');

  console.log('Function Performance (averaged across all test pairs):');
  console.log('─'.repeat(65));
  console.log('Function                          Throughput        Latency');
  console.log('─'.repeat(65));

  for (const { function: name, results: fnResults } of results) {
    const totalOps = fnResults.reduce((sum, r) => sum + r.iterations, 0);
    const totalTime = fnResults.reduce((sum, r) => sum + r.totalTime, 0);
    const throughput = (totalOps / totalTime) * 1000;
    const latency = totalTime / totalOps;

    const nameCol = name.padEnd(32);
    const throughputCol = formatThroughput(throughput).padStart(15);
    const latencyCol = formatTime(latency).padStart(12);

    console.log(`${nameCol} ${throughputCol}  ${latencyCol}`);
  }

  console.log('\nNotes:');
  console.log('  - Benchmarks run with warmup to eliminate JIT compilation effects');
  console.log('  - Each test pair runs 10,000 iterations after 100 warmup iterations');
  console.log('  - Results show sustained throughput on hot code paths');
}

/**
 * Main benchmark suite
 */
async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`string-metrics-wasm Benchmark Suite`);
  console.log(`Node.js ${process.version}`);
  console.log(`Platform: ${process.platform}-${process.arch}`);
  console.log('═══════════════════════════════════════════════════════════════');

  benchmarkColdInit();
  const results = benchmarkHotLoops();
  printSummary(results);

  console.log('\n✅ Benchmarks complete\n');
}

main().catch(console.error);
