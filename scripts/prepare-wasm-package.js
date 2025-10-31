import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const gitignorePath = path.join(rootDir, 'pkg', 'web', '.gitignore');
const distWasmDir = path.join(rootDir, 'dist', 'wasm');

try {
  await fs.rm(gitignorePath, { force: true });
} catch (error) {
  console.error(`[prepare-wasm-package] Failed to clean ${gitignorePath}:`, error);
  process.exitCode = 1;
}

try {
  await fs.rm(distWasmDir, { recursive: true, force: true });
} catch (error) {
  console.error(`[prepare-wasm-package] Failed to remove stale ${distWasmDir}:`, error);
  process.exitCode = 1;
}
