# string-metrics-wasm

High-performance string similarity metrics via WASM bindings to strsim-rs.

## Description

This library provides WASM-based implementations of various string similarity metrics, including
Levenshtein, Damerau-Levenshtein, Jaro, and Jaro-Winkler, powered by the Rust `strsim` crate. It
also includes TypeScript extensions for substring similarity and normalization presets.

## Prerequisites

1. Rust toolchain via [rustup](https://rustup.rs/)
2. `wasm-pack` (pinned to the version we build against)

Install `wasm-pack` once per machine:

```bash
cargo install wasm-pack --version 0.13.1
```

## Installation

```bash
npm install string-metrics-wasm
```

## Usage

```typescript
import { levenshtein } from 'string-metrics-wasm';

// Example
const distance = levenshtein('kitten', 'sitting');
console.log(distance); // Output: 3
```

## Building from Source

1. Install dependencies and tooling: `make bootstrap`
2. Build WASM: `npm run build:wasm` or `make build`
3. Build TS: `npm run build:ts`

## Development

This project uses a Makefile for common tasks:

```bash
make help           # Show all available targets
make build          # Build WASM and TypeScript (with version check)
make test           # Run tests
make clean          # Remove build artifacts

# Code quality
make quality        # Run all quality checks (format-check, lint, rust checks)
make format         # Format all code (Biome + Prettier + rustfmt)
make format-check   # Check formatting without changes
make lint           # Lint TypeScript code with Biome
make lint-fix       # Lint and auto-fix TypeScript code

# Version management
make version-check  # Verify package.json and Cargo.toml versions match
make bump-patch     # Bump patch version (0.1.0 -> 0.1.1)
make bump-minor     # Bump minor version (0.1.0 -> 0.2.0)
make bump-major     # Bump major version (0.1.0 -> 1.0.0)
make set-version VERSION=x.y.z  # Set explicit version
```

Additional notes for contributors live in [`docs/development.md`](docs/development.md).

### Code Quality Tools

This project uses modern, fast tooling for code quality:

- **TypeScript/JavaScript**: [Biome](https://biomejs.dev/) for linting and formatting
- **JSON/YAML/Markdown**: [Prettier](https://prettier.io/) for formatting
- **Rust**: `rustfmt` for formatting, `clippy` for linting

Run `make quality` before committing to ensure all checks pass.

### Version Management

This project maintains version sync between `package.json` (npm) and `Cargo.toml` (Rust). The
Makefile provides targets to bump versions and keep them in sync. Additionally, the test suite
includes a version consistency check that will fail if versions drift.

**Important**: Always use `make bump-*` or `make set-version` commands to update versions. This
ensures both files stay synchronized.

## Runtime Compatibility

This library works with:

- Node.js (16+)
- Bun
- Deno (with npm: specifier)

## License

This project is licensed under the [MIT License](LICENSE).

## Contributing

Contributions welcome!

- **Development setup:** [docs/development.md](docs/development.md)
- **Release workflow (maintainers):** [docs/publishing.md](docs/publishing.md)
