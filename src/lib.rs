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

// Normalization function
fn case_fold(s: &str) -> String {
    s.chars()
        .flat_map(|c| match c {
            'İ' => vec!['i', '\u{0307}'],
            'ß' => vec!['s', 's'],
            _ => c.to_lowercase().collect(),
        })
        .collect()
}

// Normalization function
#[wasm_bindgen]
pub fn normalize(s: &str, preset: &str) -> String {
    match preset {
        "none" => s.to_string(),
        "minimal" => s.trim().chars().nfc().collect::<String>(),
        "default" => case_fold(s).trim().chars().nfc().collect::<String>(),
        "aggressive" => {
            let folded = case_fold(s);
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
