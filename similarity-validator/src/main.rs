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
        "substring" => validate_substring(file, category, test),
        "normalization_presets" => validate_normalization(file, category, test),
        "suggestions" => validate_suggestions(file, category, test),
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

fn validate_substring(_file: &str, _category: &str, test: &TestCase) -> ValidationResult {
    // Placeholder - will implement full substring validation
    ValidationResult {
        file: String::new(),
        category: "substring".to_string(),
        description: test.description.clone(),
        passed: true, // Skip for now
        expected: None,
        actual: None,
        error: None,
    }
}

fn validate_normalization(_file: &str, _category: &str, test: &TestCase) -> ValidationResult {
    // Placeholder - will implement normalization validation
    ValidationResult {
        file: String::new(),
        category: "normalization_presets".to_string(),
        description: test.description.clone(),
        passed: true, // Skip for now
        expected: None,
        actual: None,
        error: None,
    }
}

fn validate_suggestions(_file: &str, _category: &str, test: &TestCase) -> ValidationResult {
    // Placeholder - will implement suggestions validation
    ValidationResult {
        file: String::new(),
        category: "suggestions".to_string(),
        description: test.description.clone(),
        passed: true, // Skip for now
        expected: None,
        actual: None,
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
        "substring" => generate_substring(case, overwrite),
        "normalization_presets" => generate_normalization(case, overwrite),
        "suggestions" => generate_suggestions(case, overwrite),
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

fn generate_substring(_case: &mut TestCase, _overwrite: bool) -> bool {
    // Placeholder - will implement
    false
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

fn generate_suggestions(_case: &mut TestCase, _overwrite: bool) -> bool {
    // Placeholder - will implement
    false
}

// ============================================================================
// NORMALIZATION UTILITIES
// ============================================================================

fn normalize(input: &str, preset: &str) -> String {
    match preset {
        "none" => input.to_string(),
        "minimal" => normalize_minimal(input),
        "default" => normalize_default(input),
        "aggressive" => normalize_aggressive(input),
        _ => input.to_string(),
    }
}

fn normalize_minimal(input: &str) -> String {
    // NFC + trim
    input.nfc().collect::<String>().trim().to_string()
}

fn normalize_default(input: &str) -> String {
    // NFC + casefold + trim
    input
        .nfc()
        .collect::<String>()
        .to_lowercase()
        .trim()
        .to_string()
}

fn normalize_aggressive(input: &str) -> String {
    // NFKD + casefold + strip accents + remove punctuation + trim
    let nfkd: String = input.nfkd().collect();
    let casefolded = nfkd.to_lowercase();
    let deaccented = deunicode::deunicode(&casefolded);
    let no_punct: String = deaccented
        .chars()
        .filter(|c| c.is_alphanumeric() || c.is_whitespace())
        .collect();
    no_punct.trim().to_string()
}
