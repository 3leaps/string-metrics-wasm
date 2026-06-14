import * as glue from '../pkg/web/string_metrics_wasm.js';
import { WASM_BASE64 } from './wasm-inline.js';

type WasmBindings = {
  levenshtein(a: string, b: string): number;
  normalized_levenshtein(a: string, b: string): number;
  osa_distance(a: string, b: string): number;
  normalized_osa_similarity(a: string, b: string): number;
  damerau_levenshtein(a: string, b: string): number;
  normalized_damerau_levenshtein(a: string, b: string): number;
  jaro(a: string, b: string): number;
  jaro_winkler(a: string, b: string): number;
  jaro_winkler_with_params(a: string, b: string, prefix_scale: number, max_prefix: number): number;
  normalize(input: string, preset: string): string;
  normalize_with_locale(input: string, preset: string, locale: string | undefined): string;
  // RapidFuzz fuzz module
  ratio(a: string, b: string): number;
  // RapidFuzz distance - Indel
  indel_distance(a: string, b: string): number;
  indel_normalized_similarity(a: string, b: string): number;
  // RapidFuzz distance - LCS
  lcs_seq_distance(a: string, b: string): number;
  lcs_seq_similarity(a: string, b: string): number;
  lcs_seq_normalized_similarity(a: string, b: string): number;
};

// Decode the embedded base64 WASM into bytes, using whichever primitive the
// runtime provides (Buffer on Node/Bun, atob elsewhere). Kept dependency-free
// and synchronous so initialization never needs a filesystem read or top-level
// await — this is what lets the package run inside standalone compiled binaries
// and bundlers that don't trace runtime asset paths.
const decodeBase64 = (b64: string): Uint8Array<ArrayBuffer> => {
  const globalBuffer = (globalThis as { Buffer?: { from(s: string, enc: string): Uint8Array } })
    .Buffer;
  if (typeof globalBuffer !== 'undefined') {
    // Copy into a fresh ArrayBuffer-backed view (Buffer is ArrayBufferLike-typed).
    return new Uint8Array(globalBuffer.from(b64, 'base64'));
  }
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

let initialized = false;

// Initialize the WASM module exactly once, on first use (lazy). Importing this
// package has no side effects, so consumers that never call a metric — including
// standalone binaries that only import the module — incur no init and no crash.
const ensureInitialized = (): void => {
  if (initialized) {
    return;
  }
  glue.initSync({ module: new WebAssembly.Module(decodeBase64(WASM_BASE64)) });
  initialized = true;
};

/**
 * Returns the initialized WASM bindings, initializing on first call.
 * Synchronous: safe to call from the library's synchronous public API.
 */
export const getWasm = (): WasmBindings => {
  ensureInitialized();
  return glue as unknown as WasmBindings;
};
