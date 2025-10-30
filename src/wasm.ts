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

const loadWasm = async (): Promise<WasmBindings> => {
  const globalAny = globalThis as typeof globalThis & {
    process?: { versions?: Record<string, string | undefined> };
    Deno?: { readFile?: (path: string | URL) => Promise<Uint8Array> };
  };

  const isNodeLike =
    typeof globalAny.process !== 'undefined' &&
    typeof globalAny.process.versions === 'object' &&
    (typeof globalAny.process.versions.node === 'string' ||
      typeof globalAny.process.versions.bun === 'string');
  const isDeno = typeof globalAny.Deno?.readFile === 'function';

  const wasmUrl = new URL('../pkg/web/string_metrics_wasm_bg.wasm', import.meta.url);
  const wasmModule = await import('../pkg/web/string_metrics_wasm.js');

  if (isNodeLike) {
    const { readFileSync } = await import('node:fs');
    const buf = readFileSync(wasmUrl);
    wasmModule.initSync({ module: new WebAssembly.Module(buf) });
    return wasmModule;
  }

  if (isDeno && globalAny.Deno?.readFile) {
    const rawBytes = await globalAny.Deno.readFile(wasmUrl);
    const wasmBytes = rawBytes.subarray
      ? rawBytes.subarray(0, rawBytes.byteLength)
      : new Uint8Array(rawBytes);
    const moduleSource = wasmBytes.buffer.slice(
      wasmBytes.byteOffset,
      wasmBytes.byteOffset + wasmBytes.byteLength,
    );
    wasmModule.initSync({ module: new WebAssembly.Module(moduleSource as ArrayBuffer) });
    return wasmModule;
  }

  await wasmModule.default(wasmUrl);
  return wasmModule;
};

const wasm = await loadWasm();

export default wasm;
