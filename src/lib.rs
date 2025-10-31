use unicode_categories::UnicodeCategories;
use unicode_normalization::UnicodeNormalization;
use wasm_bindgen::prelude::*;

// Levenshtein distance
#[wasm_bindgen]
pub fn levenshtein(a: &str, b: &str) -> usize {
    rapidfuzz::distance::levenshtein::distance(a.chars(), b.chars())
}

// Normalized Levenshtein similarity
#[wasm_bindgen]
pub fn normalized_levenshtein(a: &str, b: &str) -> f64 {
    rapidfuzz::distance::levenshtein::normalized_similarity(a.chars(), b.chars())
}

// Optimal String Alignment (OSA) distance (restricted Damerau-Levenshtein)
#[wasm_bindgen]
pub fn osa_distance(a: &str, b: &str) -> usize {
    rapidfuzz::distance::osa::distance(a.chars(), b.chars())
}

// Normalized OSA similarity
#[wasm_bindgen]
pub fn normalized_osa_similarity(a: &str, b: &str) -> f64 {
    rapidfuzz::distance::osa::normalized_similarity(a.chars(), b.chars())
}

// Damerau-Levenshtein distance (unrestricted)
#[wasm_bindgen]
pub fn damerau_levenshtein(a: &str, b: &str) -> usize {
    rapidfuzz::distance::damerau_levenshtein::distance(a.chars(), b.chars())
}

// Normalized Damerau-Levenshtein similarity
#[wasm_bindgen]
pub fn normalized_damerau_levenshtein(a: &str, b: &str) -> f64 {
    rapidfuzz::distance::damerau_levenshtein::normalized_similarity(a.chars(), b.chars())
}

// Jaro similarity
#[wasm_bindgen]
pub fn jaro(a: &str, b: &str) -> f64 {
    rapidfuzz::distance::jaro::similarity(a.chars(), b.chars())
}

#[wasm_bindgen]
pub fn jaro_winkler_with_params(a: &str, b: &str, prefix_scale: f64, max_prefix: usize) -> f64 {
    let clamped_scale = prefix_scale.clamp(0.0, 0.25);
    let clamped_max = max_prefix.clamp(1, 8);
    let jaro_score = rapidfuzz::distance::jaro::similarity(a.chars(), b.chars());
    if jaro_score == 1.0 {
        return 1.0;
    }

    let mut prefix_len = 0;
    for (ca, cb) in a.chars().zip(b.chars()) {
        if ca == cb {
            prefix_len += 1;
            if prefix_len >= clamped_max {
                break;
            }
        } else {
            break;
        }
    }

    let adjustment = (prefix_len as f64) * clamped_scale * (1.0 - jaro_score);
    (jaro_score + adjustment).min(1.0)
}

// Jaro-Winkler similarity
#[wasm_bindgen]
pub fn jaro_winkler(a: &str, b: &str) -> f64 {
    rapidfuzz::distance::jaro_winkler::similarity(a.chars(), b.chars())
}

// Normalization function with optional locale support
fn case_fold_with_locale(s: &str, locale: Option<&str>) -> String {
    match locale {
        // Turkish and Azerbaijani: special handling for dotted/dotless I
        Some("tr") | Some("az") => s
            .chars()
            .flat_map(|c| match c {
                'İ' => vec!['i'],      // İ (with dot) → i (lowercase with dot)
                'I' => vec!['ı'],      // I (no dot) → ı (lowercase dotless)
                'ß' => vec!['s', 's'], // German sharp S
                _ => c.to_lowercase().collect(),
            })
            .collect(),

        // Lithuanian: add combining dot above for i/j/į when followed by accents
        // For now, we implement basic support - full Lithuanian requires accent detection
        Some("lt") => s
            .chars()
            .flat_map(|c| match c {
                'İ' => vec!['i', '\u{0307}'], // Preserve combining dot behavior
                'ß' => vec!['s', 's'],
                _ => c.to_lowercase().collect(),
            })
            .collect(),

        // Default (no locale or unknown locale): Unicode casefold
        _ => s
            .chars()
            .flat_map(|c| match c {
                'İ' => vec!['i', '\u{0307}'], // İ → i + combining dot (Unicode default)
                'ß' => vec!['s', 's'],
                _ => c.to_lowercase().collect(),
            })
            .collect(),
    }
}

// Normalization function
#[wasm_bindgen]
pub fn normalize(s: &str, preset: &str) -> String {
    normalize_with_locale(s, preset, None)
}

// Normalization function with locale support
#[wasm_bindgen]
pub fn normalize_with_locale(s: &str, preset: &str, locale: Option<String>) -> String {
    let locale_ref = locale.as_deref();

    match preset {
        "none" => s.to_string(),
        "minimal" => s.trim().chars().nfc().collect::<String>(),
        "default" => case_fold_with_locale(s, locale_ref)
            .trim()
            .chars()
            .nfc()
            .collect::<String>(),
        "aggressive" => {
            let folded = case_fold_with_locale(s, locale_ref);
            let nfkd = folded.chars().nfkd().collect::<String>();
            let without_diac = nfkd
                .chars()
                .filter(|c| !c.is_mark_nonspacing())
                .collect::<String>();
            let alphanum = without_diac
                .chars()
                .filter(|c| c.is_alphanumeric() || c.is_whitespace())
                .collect::<String>();
            alphanum.trim().to_string()
        }
        _ => s.to_string(),
    }
}

// ============================================================================
// RapidFuzz Fuzz Module - Ratio-based similarity (0-100 scale)
// ============================================================================

/// Basic fuzzy string comparison using Indel distance
/// Returns similarity score as percentage (0-100)
///
/// This is equivalent to (1 - normalized_indel_distance) * 100
#[wasm_bindgen]
pub fn ratio(a: &str, b: &str) -> f64 {
    // rapidfuzz::fuzz::ratio returns 0-1, scale to 0-100 for Python compatibility
    rapidfuzz::fuzz::ratio(a.chars(), b.chars()) * 100.0
}

// ============================================================================
// RapidFuzz Distance Module - Additional metrics
// ============================================================================

/// Indel distance (insertion/deletion only, no substitutions)
/// Similar to Levenshtein but only allows insertions and deletions
#[wasm_bindgen]
pub fn indel_distance(a: &str, b: &str) -> usize {
    rapidfuzz::distance::indel::distance(a.chars(), b.chars())
}

/// Normalized Indel similarity (0.0-1.0)
#[wasm_bindgen]
pub fn indel_normalized_similarity(a: &str, b: &str) -> f64 {
    rapidfuzz::distance::indel::normalized_similarity(a.chars(), b.chars())
}

/// Longest Common Subsequence (LCS) distance
/// Counts minimum insertions+deletions to transform one string into another
#[wasm_bindgen]
pub fn lcs_seq_distance(a: &str, b: &str) -> usize {
    rapidfuzz::distance::lcs_seq::distance(a.chars(), b.chars())
}

/// LCS similarity (count of matching characters)
#[wasm_bindgen]
pub fn lcs_seq_similarity(a: &str, b: &str) -> usize {
    rapidfuzz::distance::lcs_seq::similarity(a.chars(), b.chars())
}

/// Normalized LCS similarity (0.0-1.0)
#[wasm_bindgen]
pub fn lcs_seq_normalized_similarity(a: &str, b: &str) -> f64 {
    rapidfuzz::distance::lcs_seq::normalized_similarity(a.chars(), b.chars())
}
