use chrono::Utc;
use clap::{Parser, Subcommand};
use colored::Colorize;
use glob::glob;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::process;
use unicode_normalization::UnicodeNormalization;

const VERSION: &str = env!("CARGO_PKG_VERSION");

#[derive(Parser)]
#[command(name = "similarity-validator")]
#[command(version = VERSION)]
#[command(about = "Validate and generate similarity metrics test fixtures", long_about = None)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Validate fixtures against rapidfuzz-rs canonical implementation
    Validate {
        /// Glob pattern for fixture files to validate
        pattern: String,
    },
    /// Generate fixture expected values using rapidfuzz-rs
    Generate {
        /// Input fixture file path
        #[arg(short, long)]
        input: PathBuf,

        /// Output file path (defaults to input file)
        #[arg(short, long)]
        output: Option<PathBuf>,

        /// Overwrite existing expected values
        #[arg(long)]
        overwrite: bool,

        /// Dry run - show what would be generated without writing
        #[arg(long)]
        dry_run: bool,
    },
}

#[derive(Debug, Deserialize, Serialize)]
struct Fixture {
    #[serde(rename = "$schema")]
    schema: String,
    version: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    generator: Option<GeneratorMetadata>,
    #[serde(skip_serializing_if = "Option::is_none")]
    notes: Option<String>,
    test_cases: Vec<CategoryGroup>,
}

#[derive(Debug, Deserialize, Serialize)]
struct GeneratorMetadata {
    tool: String,
    tool_version: String,
    source_library: String,
    source_version: String,
    generated_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    command: Option<String>,
}

#[derive(Debug, Deserialize, Serialize)]
struct CategoryGroup {
    category: String,
    cases: Vec<TestCase>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
struct TestCase {
    #[serde(flatten)]
    inputs: HashMap<String, serde_yaml::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    expected_distance: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    expected_score: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    expected_range: Option<Range>,
    #[serde(skip_serializing_if = "Option::is_none")]
    expected: Option<serde_yaml::Value>,
    description: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    tags: Option<Vec<String>>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
struct Range {
    start: usize,
    end: usize,
}

#[derive(Debug, Clone)]
struct SuggestionResult {
    value: String,
    score: f64,
    matched_range: Option<Range>,
    normalized_value: String,
}

#[derive(Debug)]
struct ValidationResult {
    file: String,
    category: String,
    description: String,
    passed: bool,
    expected: Option<String>,
    actual: Option<String>,
    error: Option<String>,
}

fn main() {
    let cli = Cli::parse();

    match cli.command {
        Commands::Validate { pattern } => validate_fixtures(&pattern),
        Commands::Generate {
            input,
            output,
            overwrite,
            dry_run,
        } => generate_fixture(&input, output.as_deref(), overwrite, dry_run),
    }
}

// ============================================================================
// VALIDATION MODE
// ============================================================================

fn validate_fixtures(pattern: &str) {
    println!("{} fixtures matching: {}", "Validating".cyan(), pattern);
    println!();

    let mut files_processed = 0;
    let mut total_tests = 0;
    let mut passed_tests = 0;
    let mut failed_tests = 0;
    let mut results: Vec<ValidationResult> = Vec::new();

    for entry in glob(pattern).expect("Failed to read glob pattern") {
        match entry {
            Ok(path) => {
                files_processed += 1;
                match validate_file(&path) {
                    Ok(file_results) => {
                        total_tests += file_results.len();
                        for result in file_results {
                            if result.passed {
                                passed_tests += 1;
                            } else {
                                failed_tests += 1;
                            }
                            results.push(result);
                        }
                    }
                    Err(e) => {
                        eprintln!("{} {}: {}", "Error".red(), path.display(), e);
                    }
                }
            }
            Err(e) => eprintln!("{}: {}", "Error".red(), e),
        }
    }

    // Print summary
    println!();
    println!("{}", "=".repeat(80));
    println!("{}", "SUMMARY".bold());
    println!("{}", "=".repeat(80));
    println!("Files processed: {}", files_processed);
    println!("Total tests:     {}", total_tests);
    println!("Passed:          {}", passed_tests.to_string().green());
    println!("Failed:          {}", failed_tests.to_string().red());
    println!();

    // Print failures
    if failed_tests > 0 {
        println!("{}", "FAILURES:".red().bold());
        println!();
        for result in results.iter().filter(|r| !r.passed) {
            println!(
                "  {} [{}] {}",
                "✗".red(),
                result.category,
                result.description
            );
            println!("    File: {}", result.file);
            if let Some(expected) = &result.expected {
                println!("    Expected: {}", expected);
            }
            if let Some(actual) = &result.actual {
                println!("    Actual:   {}", actual);
            }
            if let Some(error) = &result.error {
                println!("    Error: {}", error);
            }
            println!();
        }
        process::exit(1);
    } else {
        println!("{}", "All tests passed!".green().bold());
        process::exit(0);
    }
}

fn validate_file(path: &PathBuf) -> Result<Vec<ValidationResult>, Box<dyn std::error::Error>> {
    let contents = fs::read_to_string(path)?;
    let fixture: Fixture = serde_yaml::from_str(&contents)?;
    let filename = path.file_name().unwrap().to_string_lossy().to_string();

    let mut results = Vec::new();

    for group in fixture.test_cases {
        for test in group.cases {
            let result = validate_test_case(&filename, &group.category, &test);
            results.push(result);
        }
    }

    Ok(results)
}

fn validate_test_case(file: &str, category: &str, test: &TestCase) -> ValidationResult {
    match category {
        "levenshtein" => validate_levenshtein(file, category, test),
        "damerau_osa" => validate_damerau_osa(file, category, test),
        "damerau_unrestricted" => validate_damerau_unrestricted(file, category, test),
        "jaro_winkler" => validate_jaro_winkler(file, category, test),
        "indel" => validate_indel(file, category, test),
        "lcs_seq" => validate_lcs_seq(file, category, test),
        "ratio" => validate_ratio(file, category, test),
        "substring" => validate_substring(file, category, test),
        "normalization_presets" => validate_normalization(file, category, test),
        "suggestions" => validate_suggestions(file, category, test),
        "unified_distance" => validate_unified_distance(file, category, test),
        "unified_score" => validate_unified_score(file, category, test),
        // TypeScript-only categories - validated by TypeScript test suite
        "partial_ratio" | "token_sort_ratio" | "token_set_ratio" | "extract_one" | "extract" => {
            ValidationResult {
                file: file.to_string(),
                category: category.to_string(),
                description: test.description.clone(),
                passed: true,
                expected: Some("(TypeScript implementation)".to_string()),
                actual: Some("(skipped - validated by TS tests)".to_string()),
                error: None,
            }
        }
        _ => ValidationResult {
            file: file.to_string(),
            category: category.to_string(),
            description: test.description.clone(),
            passed: false,
            expected: None,
            actual: None,
            error: Some(format!("Unknown category: {}", category)),
        },
    }
}

fn get_string_input(inputs: &HashMap<String, serde_yaml::Value>, key: &str) -> Option<String> {
    inputs
        .get(key)
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
}

fn validate_levenshtein(file: &str, category: &str, test: &TestCase) -> ValidationResult {
    let input_a = get_string_input(&test.inputs, "input_a").unwrap_or_default();
    let input_b = get_string_input(&test.inputs, "input_b").unwrap_or_default();

    let actual_distance =
        rapidfuzz::distance::levenshtein::distance(input_a.chars(), input_b.chars());
    let actual_score =
        rapidfuzz::distance::levenshtein::normalized_similarity(input_a.chars(), input_b.chars());

    let distance_matches = test
        .expected_distance
        .map_or(true, |exp| exp == actual_distance);
    let score_matches = test
        .expected_score
        .map_or(true, |exp| (exp - actual_score).abs() < 1e-10);

    ValidationResult {
        file: file.to_string(),
        category: category.to_string(),
        description: test.description.clone(),
        passed: distance_matches && score_matches,
        expected: Some(format!(
            "distance={:?}, score={:?}",
            test.expected_distance, test.expected_score
        )),
        actual: Some(format!(
            "distance={}, score={}",
            actual_distance, actual_score
        )),
        error: None,
    }
}

fn validate_damerau_osa(file: &str, category: &str, test: &TestCase) -> ValidationResult {
    let input_a = get_string_input(&test.inputs, "input_a").unwrap_or_default();
    let input_b = get_string_input(&test.inputs, "input_b").unwrap_or_default();

    let actual_distance = rapidfuzz::distance::osa::distance(input_a.chars(), input_b.chars());
    let actual_score =
        rapidfuzz::distance::osa::normalized_similarity(input_a.chars(), input_b.chars());

    let distance_matches = test
        .expected_distance
        .map_or(true, |exp| exp == actual_distance);
    let score_matches = test
        .expected_score
        .map_or(true, |exp| (exp - actual_score).abs() < 1e-10);

    ValidationResult {
        file: file.to_string(),
        category: category.to_string(),
        description: test.description.clone(),
        passed: distance_matches && score_matches,
        expected: Some(format!(
            "distance={:?}, score={:?}",
            test.expected_distance, test.expected_score
        )),
        actual: Some(format!(
            "distance={}, score={}",
            actual_distance, actual_score
        )),
        error: None,
    }
}

fn validate_damerau_unrestricted(file: &str, category: &str, test: &TestCase) -> ValidationResult {
    let input_a = get_string_input(&test.inputs, "input_a").unwrap_or_default();
    let input_b = get_string_input(&test.inputs, "input_b").unwrap_or_default();

    let actual_distance =
        rapidfuzz::distance::damerau_levenshtein::distance(input_a.chars(), input_b.chars());
    let actual_score = rapidfuzz::distance::damerau_levenshtein::normalized_similarity(
        input_a.chars(),
        input_b.chars(),
    );

    let distance_matches = test
        .expected_distance
        .map_or(true, |exp| exp == actual_distance);
    let score_matches = test
        .expected_score
        .map_or(true, |exp| (exp - actual_score).abs() < 1e-10);

    ValidationResult {
        file: file.to_string(),
        category: category.to_string(),
        description: test.description.clone(),
        passed: distance_matches && score_matches,
        expected: Some(format!(
            "distance={:?}, score={:?}",
            test.expected_distance, test.expected_score
        )),
        actual: Some(format!(
            "distance={}, score={}",
            actual_distance, actual_score
        )),
        error: None,
    }
}

fn validate_jaro_winkler(file: &str, category: &str, test: &TestCase) -> ValidationResult {
    let input_a = get_string_input(&test.inputs, "input_a").unwrap_or_default();
    let input_b = get_string_input(&test.inputs, "input_b").unwrap_or_default();

    let actual_score =
        rapidfuzz::distance::jaro_winkler::similarity(input_a.chars(), input_b.chars());
    let score_matches = test
        .expected_score
        .map_or(true, |exp| (exp - actual_score).abs() < 1e-10);

    ValidationResult {
        file: file.to_string(),
        category: category.to_string(),
        description: test.description.clone(),
        passed: score_matches,
        expected: Some(format!("score={:?}", test.expected_score)),
        actual: Some(format!("score={}", actual_score)),
        error: None,
    }
}

fn validate_indel(file: &str, category: &str, test: &TestCase) -> ValidationResult {
    let input_a = get_string_input(&test.inputs, "input_a").unwrap_or_default();
    let input_b = get_string_input(&test.inputs, "input_b").unwrap_or_default();

    let actual_distance = rapidfuzz::distance::indel::distance(input_a.chars(), input_b.chars());
    let actual_score =
        rapidfuzz::distance::indel::normalized_similarity(input_a.chars(), input_b.chars());

    let distance_matches = test
        .expected_distance
        .map_or(true, |exp| exp == actual_distance);
    let score_matches = test
        .expected_score
        .map_or(true, |exp| (exp - actual_score).abs() < 1e-10);

    ValidationResult {
        file: file.to_string(),
        category: category.to_string(),
        description: test.description.clone(),
        passed: distance_matches && score_matches,
        expected: Some(format!(
            "distance={:?}, score={:?}",
            test.expected_distance, test.expected_score
        )),
        actual: Some(format!(
            "distance={}, score={}",
            actual_distance, actual_score
        )),
        error: None,
    }
}

fn validate_lcs_seq(file: &str, category: &str, test: &TestCase) -> ValidationResult {
    let input_a = get_string_input(&test.inputs, "input_a").unwrap_or_default();
    let input_b = get_string_input(&test.inputs, "input_b").unwrap_or_default();

    let actual_distance = rapidfuzz::distance::lcs_seq::distance(input_a.chars(), input_b.chars());
    let actual_score =
        rapidfuzz::distance::lcs_seq::normalized_similarity(input_a.chars(), input_b.chars());

    let distance_matches = test
        .expected_distance
        .map_or(true, |exp| exp == actual_distance);
    let score_matches = test
        .expected_score
        .map_or(true, |exp| (exp - actual_score).abs() < 1e-10);

    ValidationResult {
        file: file.to_string(),
        category: category.to_string(),
        description: test.description.clone(),
        passed: distance_matches && score_matches,
        expected: Some(format!(
            "distance={:?}, score={:?}",
            test.expected_distance, test.expected_score
        )),
        actual: Some(format!(
            "distance={}, score={}",
            actual_distance, actual_score
        )),
        error: None,
    }
}

fn validate_ratio(file: &str, category: &str, test: &TestCase) -> ValidationResult {
    let input_a = get_string_input(&test.inputs, "input_a").unwrap_or_default();
    let input_b = get_string_input(&test.inputs, "input_b").unwrap_or_default();

    let actual_score = rapidfuzz::fuzz::ratio(input_a.chars(), input_b.chars());
    let score_matches = test
        .expected_score
        .map_or(true, |exp| (exp - actual_score).abs() < 1e-10);

    ValidationResult {
        file: file.to_string(),
        category: category.to_string(),
        description: test.description.clone(),
        passed: score_matches,
        expected: Some(format!("score={:?}", test.expected_score)),
        actual: Some(format!("score={}", actual_score)),
        error: None,
    }
}

fn validate_unified_distance(file: &str, category: &str, test: &TestCase) -> ValidationResult {
    let input_a = get_string_input(&test.inputs, "input_a").unwrap_or_default();
    let input_b = get_string_input(&test.inputs, "input_b").unwrap_or_default();
    let metric = get_string_input(&test.inputs, "metric").unwrap_or_else(|| "levenshtein".to_string());

    let actual_distance = match metric.as_str() {
        "levenshtein" => rapidfuzz::distance::levenshtein::distance(input_a.chars(), input_b.chars()),
        "damerau_levenshtein" => rapidfuzz::distance::damerau_levenshtein::distance(input_a.chars(), input_b.chars()),
        "osa" => rapidfuzz::distance::osa::distance(input_a.chars(), input_b.chars()),
        "indel" => rapidfuzz::distance::indel::distance(input_a.chars(), input_b.chars()),
        "lcs_seq" => rapidfuzz::distance::lcs_seq::distance(input_a.chars(), input_b.chars()),
        _ => return ValidationResult {
            file: file.to_string(),
            category: category.to_string(),
            description: test.description.clone(),
            passed: false,
            expected: None,
            actual: None,
            error: Some(format!("Unknown distance metric: {}", metric)),
        },
    };

    let distance_matches = test
        .expected_distance
        .map_or(true, |exp| exp == actual_distance);

    ValidationResult {
        file: file.to_string(),
        category: category.to_string(),
        description: test.description.clone(),
        passed: distance_matches,
        expected: Some(format!("distance={:?}", test.expected_distance)),
        actual: Some(format!("distance={}", actual_distance)),
        error: None,
    }
}

fn validate_unified_score(file: &str, category: &str, test: &TestCase) -> ValidationResult {
    let input_a = get_string_input(&test.inputs, "input_a").unwrap_or_default();
    let input_b = get_string_input(&test.inputs, "input_b").unwrap_or_default();
    let metric = get_string_input(&test.inputs, "metric").unwrap_or_else(|| "jaro_winkler".to_string());

    let actual_score = match metric.as_str() {
        "levenshtein" => rapidfuzz::distance::levenshtein::normalized_similarity(input_a.chars(), input_b.chars()),
        "damerau_levenshtein" => rapidfuzz::distance::damerau_levenshtein::normalized_similarity(input_a.chars(), input_b.chars()),
        "osa" => rapidfuzz::distance::osa::normalized_similarity(input_a.chars(), input_b.chars()),
        "jaro" => rapidfuzz::distance::jaro::similarity(input_a.chars(), input_b.chars()),
        "jaro_winkler" => rapidfuzz::distance::jaro_winkler::similarity(input_a.chars(), input_b.chars()),
        "indel" => rapidfuzz::distance::indel::normalized_similarity(input_a.chars(), input_b.chars()),
        "lcs_seq" => rapidfuzz::distance::lcs_seq::normalized_similarity(input_a.chars(), input_b.chars()),
        "ratio" => rapidfuzz::fuzz::ratio(input_a.chars(), input_b.chars()) / 100.0, // ratio returns 0-100, normalize to 0-1
        // TypeScript-only metrics - these can't be validated in Rust
        "partial_ratio" | "token_sort_ratio" | "token_set_ratio" => {
            return ValidationResult {
                file: file.to_string(),
                category: category.to_string(),
                description: test.description.clone(),
                passed: true,
                expected: Some("(TypeScript implementation)".to_string()),
                actual: Some("(skipped - validated by TS tests)".to_string()),
                error: None,
            }
        }
        _ => return ValidationResult {
            file: file.to_string(),
            category: category.to_string(),
            description: test.description.clone(),
            passed: false,
            expected: None,
            actual: None,
            error: Some(format!("Unknown score metric: {}", metric)),
        },
    };

    let score_matches = test
        .expected_score
        .map_or(true, |exp| (exp - actual_score).abs() < 1e-10);

    ValidationResult {
        file: file.to_string(),
        category: category.to_string(),
        description: test.description.clone(),
        passed: score_matches,
        expected: Some(format!("score={:?}", test.expected_score)),
        actual: Some(format!("score={}", actual_score)),
        error: None,
    }
}

fn validate_substring(file: &str, category: &str, test: &TestCase) -> ValidationResult {
    let needle = get_string_input(&test.inputs, "needle").unwrap_or_default();
    let haystack = get_string_input(&test.inputs, "haystack").unwrap_or_default();

    let (actual_score, actual_range) = compute_substring_similarity(&needle, &haystack);

    let score_matches = test
        .expected_score
        .map_or(true, |exp| (exp - actual_score).abs() < 1e-10);

    let range_matches = match (&test.expected_range, &actual_range) {
        (Some(exp), Some(act)) => exp.start == act.start && exp.end == act.end,
        (None, None) => true,
        _ => false,
    };

    ValidationResult {
        file: file.to_string(),
        category: category.to_string(),
        description: test.description.clone(),
        passed: score_matches && range_matches,
        expected: Some(format!(
            "score={:?}, range={:?}",
            test.expected_score, test.expected_range
        )),
        actual: Some(format!("score={}, range={:?}", actual_score, actual_range)),
        error: None,
    }
}

fn validate_normalization(file: &str, category: &str, test: &TestCase) -> ValidationResult {
    let input = get_string_input(&test.inputs, "input").unwrap_or_default();
    let preset = get_string_input(&test.inputs, "preset").unwrap_or_default();

    let actual_normalized = normalize(&input, &preset);

    let expected_normalized = test
        .expected
        .as_ref()
        .and_then(|v| v.as_str())
        .unwrap_or("");

    let matches = actual_normalized == expected_normalized;

    ValidationResult {
        file: file.to_string(),
        category: category.to_string(),
        description: test.description.clone(),
        passed: matches,
        expected: Some(format!("\"{}\"", expected_normalized)),
        actual: Some(format!("\"{}\"", actual_normalized)),
        error: if matches {
            None
        } else {
            Some("Normalization mismatch".to_string())
        },
    }
}

fn validate_suggestions(file: &str, category: &str, test: &TestCase) -> ValidationResult {
    // Extract inputs
    let input = get_string_input(&test.inputs, "input").unwrap_or_default();
    let candidates = test
        .inputs
        .get("candidates")
        .and_then(|v| v.as_sequence())
        .map(|seq| {
            seq.iter()
                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                .collect::<Vec<String>>()
        })
        .unwrap_or_default();

    // Extract options
    let options = test
        .inputs
        .get("options")
        .and_then(|v| v.as_mapping())
        .cloned()
        .unwrap_or_default();

    let min_score = options
        .get(&serde_yaml::Value::String("min_score".to_string()))
        .and_then(|v| v.as_f64())
        .unwrap_or(0.6);

    let max_suggestions = options
        .get(&serde_yaml::Value::String("max_suggestions".to_string()))
        .and_then(|v| v.as_u64())
        .unwrap_or(3) as usize;

    let metric = options
        .get(&serde_yaml::Value::String("metric".to_string()))
        .and_then(|v| v.as_str())
        .unwrap_or("levenshtein");

    let normalize_preset = options
        .get(&serde_yaml::Value::String("normalize_preset".to_string()))
        .and_then(|v| v.as_str())
        .unwrap_or("default");

    let prefer_prefix = options
        .get(&serde_yaml::Value::String("prefer_prefix".to_string()))
        .and_then(|v| v.as_bool())
        .unwrap_or(false);

    // Normalize input
    let normalized_input = normalize(&input, normalize_preset);

    // Compute scores for each candidate with original index for stable sorting
    let mut results: Vec<(usize, SuggestionResult)> = candidates
        .iter()
        .enumerate()
        .map(|(idx, candidate)| {
            let normalized_candidate = normalize(candidate, normalize_preset);
            let (mut score, matched_range) =
                compute_score_for_metric(&normalized_input, &normalized_candidate, metric);

            // Apply prefix bonus if enabled
            // Formula: finalScore = min(1.0, score + (1 - score) * 0.1)
            if prefer_prefix && normalized_candidate.starts_with(&normalized_input) {
                let bonus_weight = 0.1;
                score = (score + (1.0 - score) * bonus_weight).min(1.0);
            }

            (
                idx,
                SuggestionResult {
                    value: candidate.clone(),
                    score,
                    matched_range,
                    normalized_value: normalized_candidate.clone(),
                },
            )
        })
        .filter(|(_, r)| r.score >= min_score)
        .collect();

    // Sort by score (descending), preserving original order for ties
    results.sort_by(|(idx_a, a), (idx_b, b)| {
        b.score
            .partial_cmp(&a.score)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| idx_a.cmp(idx_b))
    });

    // Truncate to max_suggestions
    results.truncate(max_suggestions);

    // Extract just the results, discarding indices
    let results: Vec<SuggestionResult> = results.into_iter().map(|(_, r)| r).collect();

    // Validate against expected
    let empty_vec = vec![];
    let expected_suggestions = test
        .expected
        .as_ref()
        .and_then(|v| v.as_sequence())
        .unwrap_or(&empty_vec);

    // Check length matches
    if results.len() != expected_suggestions.len() {
        return ValidationResult {
            file: file.to_string(),
            category: category.to_string(),
            description: test.description.clone(),
            passed: false,
            expected: Some(format!("{} suggestions", expected_suggestions.len())),
            actual: Some(format!("{} suggestions", results.len())),
            error: Some("Suggestion count mismatch".to_string()),
        };
    }

    // Check each suggestion
    for (i, (actual, expected)) in results.iter().zip(expected_suggestions.iter()).enumerate() {
        let expected_map = expected.as_mapping();
        if expected_map.is_none() {
            continue;
        }
        let expected_map = expected_map.unwrap();

        // Check value
        let expected_value = expected_map
            .get(&serde_yaml::Value::String("value".to_string()))
            .and_then(|v| v.as_str())
            .unwrap_or("");
        if actual.value != expected_value {
            return ValidationResult {
                file: file.to_string(),
                category: category.to_string(),
                description: test.description.clone(),
                passed: false,
                expected: Some(format!("suggestion[{}].value = {}", i, expected_value)),
                actual: Some(format!("suggestion[{}].value = {}", i, actual.value)),
                error: Some("Value mismatch".to_string()),
            };
        }

        // Check score
        let expected_score = expected_map
            .get(&serde_yaml::Value::String("score".to_string()))
            .and_then(|v| v.as_f64())
            .unwrap_or(0.0);
        if (actual.score - expected_score).abs() >= 1e-10 {
            return ValidationResult {
                file: file.to_string(),
                category: category.to_string(),
                description: test.description.clone(),
                passed: false,
                expected: Some(format!("suggestion[{}].score = {}", i, expected_score)),
                actual: Some(format!("suggestion[{}].score = {}", i, actual.score)),
                error: Some("Score mismatch".to_string()),
            };
        }

        // Check matched_range if present
        if let Some(expected_range) = expected_map
            .get(&serde_yaml::Value::String("matched_range".to_string()))
            .and_then(|v| v.as_mapping())
        {
            let exp_start = expected_range
                .get(&serde_yaml::Value::String("start".to_string()))
                .and_then(|v| v.as_u64())
                .unwrap_or(0) as usize;
            let exp_end = expected_range
                .get(&serde_yaml::Value::String("end".to_string()))
                .and_then(|v| v.as_u64())
                .unwrap_or(0) as usize;

            match &actual.matched_range {
                Some(range) => {
                    if range.start != exp_start || range.end != exp_end {
                        return ValidationResult {
                            file: file.to_string(),
                            category: category.to_string(),
                            description: test.description.clone(),
                            passed: false,
                            expected: Some(format!(
                                "suggestion[{}].matched_range = [{}, {})",
                                i, exp_start, exp_end
                            )),
                            actual: Some(format!(
                                "suggestion[{}].matched_range = [{}, {})",
                                i, range.start, range.end
                            )),
                            error: Some("Range mismatch".to_string()),
                        };
                    }
                }
                None => {
                    return ValidationResult {
                        file: file.to_string(),
                        category: category.to_string(),
                        description: test.description.clone(),
                        passed: false,
                        expected: Some(format!(
                            "suggestion[{}].matched_range = [{}, {})",
                            i, exp_start, exp_end
                        )),
                        actual: Some(format!("suggestion[{}].matched_range = None", i)),
                        error: Some("Expected matched_range but got None".to_string()),
                    };
                }
            }
        }
    }

    ValidationResult {
        file: file.to_string(),
        category: category.to_string(),
        description: test.description.clone(),
        passed: true,
        expected: Some(format!("{} suggestions", expected_suggestions.len())),
        actual: Some(format!("{} suggestions", results.len())),
        error: None,
    }
}

// ============================================================================
// GENERATION MODE
// ============================================================================

fn generate_fixture(
    input_path: &PathBuf,
    output_path: Option<&std::path::Path>,
    overwrite: bool,
    dry_run: bool,
) {
    let output_path = output_path.unwrap_or(input_path.as_path());

    println!("{} {}", "Generating fixture:".cyan(), input_path.display());

    // Read fixture
    let contents = fs::read_to_string(input_path).expect("Failed to read input file");
    let mut fixture: Fixture = serde_yaml::from_str(&contents).expect("Failed to parse YAML");

    // Generate expected values for each test case
    let mut total_generated = 0;
    let mut skipped = 0;

    for group in &mut fixture.test_cases {
        for case in &mut group.cases {
            let generated = generate_test_case(&group.category, case, overwrite);
            if generated {
                total_generated += 1;
            } else {
                skipped += 1;
            }
        }
    }

    // Update generator metadata
    fixture.generator = Some(GeneratorMetadata {
        tool: "similarity-validator".to_string(),
        tool_version: VERSION.to_string(),
        source_library: "rapidfuzz-rs".to_string(),
        source_version: "3.0".to_string(),
        generated_at: Utc::now().to_rfc3339(),
        command: Some(format!(
            "similarity-validator generate --input {} {}",
            input_path.display(),
            if overwrite { "--overwrite" } else { "" }
        )),
    });

    // Update notes
    fixture.notes = Some(format!(
        "GENERATED FILE - DO NOT EDIT EXPECTED VALUES BY HAND\n\n\
         This fixture was generated using similarity-validator with rapidfuzz-rs as the\n\
         canonical source. Values are authoritative and ready for cross-language validation.\n\n\
         Reference implementations:\n\
         - Canonical: rapidfuzz-rs 3.x (Rust, used for generation)\n\
         - Cross-check: rapidfuzz 3.x (Python, pyfulmen)\n\
         - Under test: string-metrics-wasm (TypeScript/WASM)\n\n\
         To regenerate:\n\
           similarity-validator generate --input {} --overwrite",
        input_path.display()
    ));

    println!(
        "Generated: {} | Skipped: {}",
        total_generated.to_string().green(),
        skipped.to_string().yellow()
    );

    if dry_run {
        println!("{}", "\n[DRY RUN - No files written]".yellow());
        println!("\nGenerated YAML preview:");
        println!("{}", "=".repeat(80));
        let yaml = serde_yaml::to_string(&fixture).expect("Failed to serialize YAML");
        println!("{}", yaml);
    } else {
        // Write output
        let yaml = serde_yaml::to_string(&fixture).expect("Failed to serialize YAML");
        fs::write(output_path, yaml).expect("Failed to write output file");
        println!("{} {}", "✅ Written:".green(), output_path.display());
    }
}

fn generate_test_case(category: &str, case: &mut TestCase, overwrite: bool) -> bool {
    match category {
        "levenshtein" => generate_levenshtein(case, overwrite),
        "damerau_osa" => generate_damerau_osa(case, overwrite),
        "damerau_unrestricted" => generate_damerau_unrestricted(case, overwrite),
        "jaro_winkler" => generate_jaro_winkler(case, overwrite),
        "indel" => generate_indel(case, overwrite),
        "lcs_seq" => generate_lcs_seq(case, overwrite),
        "ratio" => generate_ratio(case, overwrite),
        "substring" => generate_substring(case, overwrite),
        "normalization_presets" => generate_normalization(case, overwrite),
        "suggestions" => generate_suggestions(case, overwrite),
        "unified_distance" => generate_unified_distance(case, overwrite),
        "unified_score" => generate_unified_score(case, overwrite),
        // TypeScript-only categories - skip generation
        "partial_ratio" | "token_sort_ratio" | "token_set_ratio" | "extract_one" | "extract" => {
            false
        }
        _ => {
            eprintln!("⚠️  Unknown category: {}", category);
            false
        }
    }
}

fn generate_levenshtein(case: &mut TestCase, overwrite: bool) -> bool {
    if !overwrite && case.expected_distance.is_some() && case.expected_score.is_some() {
        return false;
    }

    let input_a = get_string_input(&case.inputs, "input_a").unwrap_or_default();
    let input_b = get_string_input(&case.inputs, "input_b").unwrap_or_default();

    let distance = rapidfuzz::distance::levenshtein::distance(input_a.chars(), input_b.chars());
    let score =
        rapidfuzz::distance::levenshtein::normalized_similarity(input_a.chars(), input_b.chars());

    case.expected_distance = Some(distance);
    case.expected_score = Some(score);
    true
}

fn generate_damerau_osa(case: &mut TestCase, overwrite: bool) -> bool {
    if !overwrite && case.expected_distance.is_some() && case.expected_score.is_some() {
        return false;
    }

    let input_a = get_string_input(&case.inputs, "input_a").unwrap_or_default();
    let input_b = get_string_input(&case.inputs, "input_b").unwrap_or_default();

    let distance = rapidfuzz::distance::osa::distance(input_a.chars(), input_b.chars());
    let score = rapidfuzz::distance::osa::normalized_similarity(input_a.chars(), input_b.chars());

    case.expected_distance = Some(distance);
    case.expected_score = Some(score);
    true
}

fn generate_damerau_unrestricted(case: &mut TestCase, overwrite: bool) -> bool {
    if !overwrite && case.expected_distance.is_some() && case.expected_score.is_some() {
        return false;
    }

    let input_a = get_string_input(&case.inputs, "input_a").unwrap_or_default();
    let input_b = get_string_input(&case.inputs, "input_b").unwrap_or_default();

    let distance =
        rapidfuzz::distance::damerau_levenshtein::distance(input_a.chars(), input_b.chars());
    let score = rapidfuzz::distance::damerau_levenshtein::normalized_similarity(
        input_a.chars(),
        input_b.chars(),
    );

    case.expected_distance = Some(distance);
    case.expected_score = Some(score);
    true
}

fn generate_jaro_winkler(case: &mut TestCase, overwrite: bool) -> bool {
    if !overwrite && case.expected_score.is_some() {
        return false;
    }

    let input_a = get_string_input(&case.inputs, "input_a").unwrap_or_default();
    let input_b = get_string_input(&case.inputs, "input_b").unwrap_or_default();

    let score = rapidfuzz::distance::jaro_winkler::similarity(input_a.chars(), input_b.chars());

    case.expected_score = Some(score);
    true
}

fn generate_indel(case: &mut TestCase, overwrite: bool) -> bool {
    if !overwrite && case.expected_distance.is_some() && case.expected_score.is_some() {
        return false;
    }

    let input_a = get_string_input(&case.inputs, "input_a").unwrap_or_default();
    let input_b = get_string_input(&case.inputs, "input_b").unwrap_or_default();

    let distance = rapidfuzz::distance::indel::distance(input_a.chars(), input_b.chars());
    let score = rapidfuzz::distance::indel::normalized_similarity(input_a.chars(), input_b.chars());

    case.expected_distance = Some(distance);
    case.expected_score = Some(score);
    true
}

fn generate_lcs_seq(case: &mut TestCase, overwrite: bool) -> bool {
    if !overwrite && case.expected_distance.is_some() && case.expected_score.is_some() {
        return false;
    }

    let input_a = get_string_input(&case.inputs, "input_a").unwrap_or_default();
    let input_b = get_string_input(&case.inputs, "input_b").unwrap_or_default();

    let distance = rapidfuzz::distance::lcs_seq::distance(input_a.chars(), input_b.chars());
    let score = rapidfuzz::distance::lcs_seq::normalized_similarity(input_a.chars(), input_b.chars());

    case.expected_distance = Some(distance);
    case.expected_score = Some(score);
    true
}

fn generate_ratio(case: &mut TestCase, overwrite: bool) -> bool {
    if !overwrite && case.expected_score.is_some() {
        return false;
    }

    let input_a = get_string_input(&case.inputs, "input_a").unwrap_or_default();
    let input_b = get_string_input(&case.inputs, "input_b").unwrap_or_default();

    let score = rapidfuzz::fuzz::ratio(input_a.chars(), input_b.chars());

    case.expected_score = Some(score);
    true
}

fn generate_unified_distance(case: &mut TestCase, overwrite: bool) -> bool {
    if !overwrite && case.expected_distance.is_some() {
        return false;
    }

    let input_a = get_string_input(&case.inputs, "input_a").unwrap_or_default();
    let input_b = get_string_input(&case.inputs, "input_b").unwrap_or_default();
    let metric = get_string_input(&case.inputs, "metric").unwrap_or_else(|| "levenshtein".to_string());

    let distance = match metric.as_str() {
        "levenshtein" => rapidfuzz::distance::levenshtein::distance(input_a.chars(), input_b.chars()),
        "damerau_levenshtein" => rapidfuzz::distance::damerau_levenshtein::distance(input_a.chars(), input_b.chars()),
        "osa" => rapidfuzz::distance::osa::distance(input_a.chars(), input_b.chars()),
        "indel" => rapidfuzz::distance::indel::distance(input_a.chars(), input_b.chars()),
        "lcs_seq" => rapidfuzz::distance::lcs_seq::distance(input_a.chars(), input_b.chars()),
        _ => {
            eprintln!("⚠️  Unknown distance metric: {}", metric);
            return false;
        }
    };

    case.expected_distance = Some(distance);
    true
}

fn generate_unified_score(case: &mut TestCase, overwrite: bool) -> bool {
    if !overwrite && case.expected_score.is_some() {
        return false;
    }

    let input_a = get_string_input(&case.inputs, "input_a").unwrap_or_default();
    let input_b = get_string_input(&case.inputs, "input_b").unwrap_or_default();
    let metric = get_string_input(&case.inputs, "metric").unwrap_or_else(|| "jaro_winkler".to_string());

    let score = match metric.as_str() {
        "levenshtein" => rapidfuzz::distance::levenshtein::normalized_similarity(input_a.chars(), input_b.chars()),
        "damerau_levenshtein" => rapidfuzz::distance::damerau_levenshtein::normalized_similarity(input_a.chars(), input_b.chars()),
        "osa" => rapidfuzz::distance::osa::normalized_similarity(input_a.chars(), input_b.chars()),
        "jaro" => rapidfuzz::distance::jaro::similarity(input_a.chars(), input_b.chars()),
        "jaro_winkler" => rapidfuzz::distance::jaro_winkler::similarity(input_a.chars(), input_b.chars()),
        "indel" => rapidfuzz::distance::indel::normalized_similarity(input_a.chars(), input_b.chars()),
        "lcs_seq" => rapidfuzz::distance::lcs_seq::normalized_similarity(input_a.chars(), input_b.chars()),
        "ratio" => rapidfuzz::fuzz::ratio(input_a.chars(), input_b.chars()) / 100.0,
        "partial_ratio" | "token_sort_ratio" | "token_set_ratio" => {
            // TypeScript-only - skip generation
            return false;
        }
        _ => {
            eprintln!("⚠️  Unknown score metric: {}", metric);
            return false;
        }
    };

    case.expected_score = Some(score);
    true
}

fn generate_substring(case: &mut TestCase, overwrite: bool) -> bool {
    if !overwrite && case.expected_score.is_some() && case.expected_range.is_some() {
        return false;
    }

    let needle = get_string_input(&case.inputs, "needle").unwrap_or_default();
    let haystack = get_string_input(&case.inputs, "haystack").unwrap_or_default();

    let (score, range) = compute_substring_similarity(&needle, &haystack);

    case.expected_score = Some(score);
    case.expected_range = range;
    true
}

fn generate_normalization(case: &mut TestCase, overwrite: bool) -> bool {
    if !overwrite && case.expected.is_some() {
        return false;
    }

    let input = get_string_input(&case.inputs, "input").unwrap_or_default();
    let preset = get_string_input(&case.inputs, "preset").unwrap_or_default();

    let normalized = normalize(&input, &preset);

    case.expected = Some(serde_yaml::Value::String(normalized));
    true
}

fn generate_suggestions(case: &mut TestCase, overwrite: bool) -> bool {
    if !overwrite && case.expected.is_some() {
        return false;
    }

    // Extract inputs
    let input = get_string_input(&case.inputs, "input").unwrap_or_default();
    let candidates = case
        .inputs
        .get("candidates")
        .and_then(|v| v.as_sequence())
        .map(|seq| {
            seq.iter()
                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                .collect::<Vec<String>>()
        })
        .unwrap_or_default();

    // Extract options
    let options = case
        .inputs
        .get("options")
        .and_then(|v| v.as_mapping())
        .cloned()
        .unwrap_or_default();

    let min_score = options
        .get(&serde_yaml::Value::String("min_score".to_string()))
        .and_then(|v| v.as_f64())
        .unwrap_or(0.6);

    let max_suggestions = options
        .get(&serde_yaml::Value::String("max_suggestions".to_string()))
        .and_then(|v| v.as_u64())
        .unwrap_or(3) as usize;

    let metric = options
        .get(&serde_yaml::Value::String("metric".to_string()))
        .and_then(|v| v.as_str())
        .unwrap_or("levenshtein");

    let normalize_preset = options
        .get(&serde_yaml::Value::String("normalize_preset".to_string()))
        .and_then(|v| v.as_str())
        .unwrap_or("default");

    let prefer_prefix = options
        .get(&serde_yaml::Value::String("prefer_prefix".to_string()))
        .and_then(|v| v.as_bool())
        .unwrap_or(false);

    // Normalize input
    let normalized_input = normalize(&input, normalize_preset);

    // Compute scores for each candidate with original index for stable sorting
    let mut results: Vec<(usize, SuggestionResult)> = candidates
        .iter()
        .enumerate()
        .map(|(idx, candidate)| {
            let normalized_candidate = normalize(candidate, normalize_preset);
            let (mut score, matched_range) =
                compute_score_for_metric(&normalized_input, &normalized_candidate, metric);

            // Apply prefix bonus if enabled
            // Formula: finalScore = min(1.0, score + (1 - score) * 0.1)
            if prefer_prefix && normalized_candidate.starts_with(&normalized_input) {
                let bonus_weight = 0.1;
                score = (score + (1.0 - score) * bonus_weight).min(1.0);
            }

            (
                idx,
                SuggestionResult {
                    value: candidate.clone(),
                    score,
                    matched_range,
                    normalized_value: normalized_candidate.clone(),
                },
            )
        })
        .filter(|(_, r)| r.score >= min_score)
        .collect();

    // Sort by score (descending), preserving original order for ties
    results.sort_by(|(idx_a, a), (idx_b, b)| {
        b.score
            .partial_cmp(&a.score)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| idx_a.cmp(idx_b))
    });

    // Truncate to max_suggestions
    results.truncate(max_suggestions);

    // Extract just the results, discarding indices
    let results: Vec<SuggestionResult> = results.into_iter().map(|(_, r)| r).collect();

    // Convert to YAML format
    let suggestions: Vec<serde_yaml::Value> = results
        .iter()
        .map(|r| {
            let mut map = serde_yaml::Mapping::new();
            map.insert(
                serde_yaml::Value::String("value".to_string()),
                serde_yaml::Value::String(r.value.clone()),
            );
            map.insert(
                serde_yaml::Value::String("score".to_string()),
                serde_yaml::to_value(r.score).expect("Failed to serialize score"),
            );
            // Include normalized_value for debugging
            map.insert(
                serde_yaml::Value::String("normalized_value".to_string()),
                serde_yaml::Value::String(r.normalized_value.clone()),
            );
            if let Some(ref range) = r.matched_range {
                let mut range_map = serde_yaml::Mapping::new();
                range_map.insert(
                    serde_yaml::Value::String("start".to_string()),
                    serde_yaml::Value::Number(serde_yaml::Number::from(range.start)),
                );
                range_map.insert(
                    serde_yaml::Value::String("end".to_string()),
                    serde_yaml::Value::Number(serde_yaml::Number::from(range.end)),
                );
                map.insert(
                    serde_yaml::Value::String("matched_range".to_string()),
                    serde_yaml::Value::Mapping(range_map),
                );
            }
            serde_yaml::Value::Mapping(map)
        })
        .collect();

    case.expected = Some(serde_yaml::Value::Sequence(suggestions));
    true
}

// ============================================================================
// SUBSTRING SIMILARITY (Longest Common Substring)
// ============================================================================

/// Compute substring similarity using Longest Common Substring algorithm
/// Returns (score, matched_range_in_haystack)
/// Score formula: (2 * lcs_length) / (needle_length + haystack_length)
fn compute_substring_similarity(needle: &str, haystack: &str) -> (f64, Option<Range>) {
    let needle_chars: Vec<char> = needle.chars().collect();
    let haystack_chars: Vec<char> = haystack.chars().collect();
    let m = needle_chars.len();
    let n = haystack_chars.len();

    if m == 0 || n == 0 {
        return (0.0, None);
    }

    // DP table for longest common substring
    let mut dp = vec![vec![0usize; n + 1]; m + 1];
    let mut max_len = 0;
    let mut end_in_haystack = 0;

    for i in 1..=m {
        for j in 1..=n {
            if needle_chars[i - 1] == haystack_chars[j - 1] {
                dp[i][j] = dp[i - 1][j - 1] + 1;
                if dp[i][j] > max_len {
                    max_len = dp[i][j];
                    end_in_haystack = j;
                }
            }
        }
    }

    let score = if max_len == 0 {
        0.0
    } else {
        (2.0 * max_len as f64) / (m + n) as f64
    };

    let range = if max_len > 0 {
        Some(Range {
            start: end_in_haystack - max_len,
            end: end_in_haystack,
        })
    } else {
        None
    };

    (score, range)
}

// ============================================================================
// METRIC COMPUTATION UTILITIES
// ============================================================================

/// Compute score for a given metric
/// Returns (score, optional_range) where range is only populated for substring metric
fn compute_score_for_metric(input: &str, candidate: &str, metric: &str) -> (f64, Option<Range>) {
    match metric {
        "levenshtein" => {
            let score = rapidfuzz::distance::levenshtein::normalized_similarity(
                input.chars(),
                candidate.chars(),
            );
            (score, None)
        }
        "damerau_osa" => {
            let score =
                rapidfuzz::distance::osa::normalized_similarity(input.chars(), candidate.chars());
            (score, None)
        }
        "damerau_unrestricted" => {
            let score = rapidfuzz::distance::damerau_levenshtein::normalized_similarity(
                input.chars(),
                candidate.chars(),
            );
            (score, None)
        }
        "jaro_winkler" => {
            let score =
                rapidfuzz::distance::jaro_winkler::similarity(input.chars(), candidate.chars());
            (score, None)
        }
        "substring" => {
            let (score, range) = compute_substring_similarity(input, candidate);
            (score, range)
        }
        _ => (0.0, None), // Unknown metric
    }
}

// ============================================================================
// NORMALIZATION UTILITIES
// ============================================================================
// These functions match the canonical implementation in src/lib.rs

/// Case folding with special handling for Turkish İ and German ß
fn case_fold(s: &str) -> String {
    s.chars()
        .flat_map(|c| match c {
            'İ' => vec!['i', '\u{0307}'], // Turkish dotted capital I
            'ß' => vec!['s', 's'],        // German sharp S
            _ => c.to_lowercase().collect(),
        })
        .collect()
}

fn normalize(input: &str, preset: &str) -> String {
    match preset {
        "none" => input.to_string(),
        "minimal" => input.trim().nfc().collect::<String>(),
        "default" => case_fold(input).trim().nfc().collect::<String>(),
        "aggressive" => {
            let folded = case_fold(input);
            let nfkd: String = folded.nfkd().collect();
            let without_diac: String = nfkd
                .chars()
                .filter(|c| !unicode_normalization::char::is_combining_mark(*c))
                .collect();
            let alphanum: String = without_diac
                .chars()
                .filter(|c| c.is_alphanumeric() || c.is_whitespace())
                .collect();
            alphanum.trim().to_string()
        }
        _ => input.to_string(),
    }
}
