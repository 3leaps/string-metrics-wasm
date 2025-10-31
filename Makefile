.PHONY: help bootstrap build test test-coverage clean version-check version-sync bump-patch bump-minor bump-major set-version
.PHONY: quality format format-check lint lint-fix typecheck rust-fmt rust-clippy
.PHONY: precommit prepush
.PHONY: build-validator validate-fixtures

# Default target
help:
	@echo "string-metrics-wasm - Makefile targets"
	@echo ""
	@echo "Build targets:"
	@echo "  make bootstrap      - Install npm deps and ensure wasm-pack is available"
	@echo "  make build          - Build WASM and TypeScript"
	@echo "  make test           - Run tests"
	@echo "  make test-coverage  - Run tests with coverage report"
	@echo "  make clean          - Remove build artifacts"
	@echo ""
	@echo "Code quality:"
	@echo "  make quality        - Run all quality checks (format-check, lint, rust checks)"
	@echo "  make format         - Format all code (Biome + Prettier + rustfmt)"
	@echo "  make format-check   - Check formatting without changes"
	@echo "  make lint           - Lint TypeScript code with Biome"
	@echo "  make lint-fix       - Lint and auto-fix TypeScript code"
	@echo "  make typecheck      - TypeScript type checking"
	@echo "  make rust-fmt       - Format Rust code"
	@echo "  make rust-clippy    - Run Clippy linter on Rust code"
	@echo ""
	@echo "Git hooks:"
	@echo "  make precommit      - Run pre-commit checks (format, lint, typecheck, rust, build, test, validate)"
	@echo "  make prepush        - Run pre-push validation (clean check, version, license, precommit)"
	@echo ""
	@echo "Fixture validation:"
	@echo "  make build-validator      - Build similarity-validator (current platform)"
	@echo "  make build-validator-all  - Build for all platforms (requires 'cross')"
	@echo "  make validate-fixtures    - Validate test fixtures against rapidfuzz-rs"
	@echo "  make generate-fixtures    - Generate fixture expected values"
	@echo ""
	@echo "Version management:"
	@echo "  make version-check  - Verify package.json and Cargo.toml versions match"
	@echo "  make version-sync   - Sync Cargo.toml version from package.json"
	@echo "  make bump-patch     - Bump patch version (0.1.0 -> 0.1.1)"
	@echo "  make bump-minor     - Bump minor version (0.1.0 -> 0.2.0)"
	@echo "  make bump-major     - Bump major version (0.1.0 -> 1.0.0)"
	@echo "  make set-version VERSION=x.y.z - Set explicit version"

bootstrap:
	@echo "Ensuring Rust toolchain is available..."
	@if ! command -v cargo >/dev/null 2>&1; then \
		echo "❌ cargo is required. Install Rust via https://rustup.rs/"; \
		exit 1; \
	fi
	@echo "Ensuring wasm-pack v0.13.1 is installed..."
	@if command -v wasm-pack >/dev/null 2>&1; then \
		if wasm-pack --version | grep -Eq '0\.13\.'; then \
			echo "✅ wasm-pack already present"; \
		else \
			echo "⏳ Updating wasm-pack to v0.13.1..."; \
			cargo install wasm-pack --force --version 0.13.1; \
		fi; \
	else \
		echo "⏳ Installing wasm-pack v0.13.1..."; \
		cargo install wasm-pack --version 0.13.1; \
	fi
	@echo "Installing npm dependencies..."
	@npm install
	@echo "✅ Bootstrap complete"

# Version management
version-check:
	@PKG_VERSION=$$(node -p "require('./package.json').version"); \
	CARGO_VERSION=$$(grep '^version' Cargo.toml | head -1 | cut -d'"' -f2); \
	if [ "$$PKG_VERSION" != "$$CARGO_VERSION" ]; then \
		echo "❌ Version mismatch:"; \
		echo "   package.json: $$PKG_VERSION"; \
		echo "   Cargo.toml:   $$CARGO_VERSION"; \
		exit 1; \
	else \
		echo "✅ Versions match: $$PKG_VERSION"; \
	fi

version-sync:
	@PKG_VERSION=$$(node -p "require('./package.json').version"); \
	if [ "$$(uname)" = "Darwin" ]; then \
		sed -i '' "s/^version = .*/version = \"$$PKG_VERSION\"/" Cargo.toml; \
		sed -i '' "s/^version = .*/version = \"$$PKG_VERSION\"/" similarity-validator/Cargo.toml; \
	else \
		sed -i "s/^version = .*/version = \"$$PKG_VERSION\"/" Cargo.toml; \
		sed -i "s/^version = .*/version = \"$$PKG_VERSION\"/" similarity-validator/Cargo.toml; \
	fi; \
	echo "✅ Synced Cargo.toml and similarity-validator/Cargo.toml to version $$PKG_VERSION"

bump-patch: version-check
	@npm version patch --no-git-tag-version
	@$(MAKE) version-sync
	@echo "✅ Bumped to $$(node -p "require('./package.json').version")"

bump-minor: version-check
	@npm version minor --no-git-tag-version
	@$(MAKE) version-sync
	@echo "✅ Bumped to $$(node -p "require('./package.json').version")"

bump-major: version-check
	@npm version major --no-git-tag-version
	@$(MAKE) version-sync
	@echo "✅ Bumped to $$(node -p "require('./package.json').version")"

set-version:
	@if [ -z "$(VERSION)" ]; then \
		echo "❌ Usage: make set-version VERSION=x.y.z"; \
		exit 1; \
	fi
	@npm version $(VERSION) --no-git-tag-version
	@$(MAKE) version-sync
	@echo "✅ Set version to $(VERSION)"

# Build targets
build: version-check
	@echo "Building WASM..."
	@npm run build:wasm
	@echo "Building TypeScript..."
	@npm run build:ts
	@echo "✅ Build complete"

test: build
	@npm test

test-coverage: build
	@npm run test:coverage

clean:
	@echo "Cleaning build artifacts..."
	@rm -rf pkg dist target
	@echo "✅ Clean complete"

clean-all: clean
	@echo "Removing node_modules..."
	@rm -rf node_modules
	@echo "✅ Full clean complete"

# Code quality targets
quality: version-check format-check lint typecheck rust-fmt-check rust-clippy
	@echo "✅ All quality checks passed"

format: rust-fmt
	@echo "Formatting TypeScript/JavaScript with Biome..."
	@npx biome format --write .
	@echo "Formatting JSON/YAML/Markdown with Prettier..."
	@npx prettier --write '**/*.{json,yaml,yml,md}'
	@echo "✅ Formatting complete"

format-check: rust-fmt-check
	@echo "Checking TypeScript/JavaScript formatting..."
	@npx biome format .
	@echo "Checking JSON/YAML/Markdown formatting..."
	@npx prettier --check '**/*.{json,yaml,yml,md}'
	@echo "✅ Format check complete"

lint:
	@echo "Linting TypeScript with Biome..."
	@npx biome lint --error-on-warnings .
	@echo "✅ Lint complete"

lint-fix:
	@echo "Linting and fixing TypeScript with Biome..."
	@npx biome lint --write .
	@echo "✅ Lint fix complete"

typecheck:
	@echo "Type checking TypeScript..."
	@npm run typecheck
	@echo "✅ Type check complete"

rust-fmt:
	@echo "Formatting Rust code..."
	@cargo fmt
	@echo "✅ Rust format complete"

rust-fmt-check:
	@echo "Checking Rust formatting..."
	@cargo fmt -- --check
	@echo "✅ Rust format check complete"

rust-clippy:
	@echo "Running Clippy on Rust code..."
	@cargo clippy -- -D warnings
	@echo "✅ Clippy complete"

# Git hook targets
precommit:
	@echo "🔧 Running pre-commit checks..."
	@$(MAKE) format
	@$(MAKE) format-check
	@$(MAKE) lint
	@$(MAKE) typecheck
	@$(MAKE) rust-fmt
	@$(MAKE) rust-clippy
	@$(MAKE) build
	@$(MAKE) test
	@$(MAKE) validate-fixtures
	@echo "✅ All pre-commit checks passed!"

prepush:
	@echo "🚀 Running pre-push validation..."
	@if [ -n "$$(git status --porcelain)" ]; then \
		echo "❌ Working tree is not clean. Commit or stash changes before pushing."; \
		echo ""; \
		git status --short; \
		exit 1; \
	fi
	@echo "✅ Working tree is clean"
	@$(MAKE) version-check
	@npm run license:check || { echo "❌ License check failed"; exit 1; }
	@$(MAKE) precommit
	@if [ -n "$$(git status --porcelain)" ]; then \
		echo "❌ Working tree was modified during validation. This indicates a build artifact or hook issue."; \
		echo ""; \
		git status --short; \
		exit 1; \
	fi
	@echo "✅ All pre-push checks passed!"

# Fixture validation targets
build-validator:
	@echo "Building similarity-validator for current platform..."
	@mkdir -p dist
	@cd similarity-validator && cargo build --release --bin similarity-validator
	@PLATFORM=$$(uname -s | tr '[:upper:]' '[:lower:]')-$$(uname -m); \
		cp target/release/similarity-validator dist/similarity-validator-$$PLATFORM; \
		ln -sf similarity-validator-$$PLATFORM dist/similarity-validator; \
		echo "✅ Validator built: dist/similarity-validator-$$PLATFORM"

build-validator-all:
	@echo "Building similarity-validator for all platforms (requires 'cross')..."
	@if ! command -v cross >/dev/null 2>&1; then \
		echo "❌ 'cross' is required for multi-platform builds"; \
		echo "   Install: cargo install cross --git https://github.com/cross-rs/cross"; \
		exit 1; \
	fi
	@mkdir -p dist
	@echo "Building for macOS ARM64..."
	@cd similarity-validator && cross build --release --target aarch64-apple-darwin
	@cp target/aarch64-apple-darwin/release/similarity-validator dist/similarity-validator-darwin-arm64
	@echo "Building for macOS x86_64..."
	@cd similarity-validator && cross build --release --target x86_64-apple-darwin
	@cp target/x86_64-apple-darwin/release/similarity-validator dist/similarity-validator-darwin-x86_64
	@echo "Building for Linux x86_64..."
	@cd similarity-validator && cross build --release --target x86_64-unknown-linux-gnu
	@cp target/x86_64-unknown-linux-gnu/release/similarity-validator dist/similarity-validator-linux-x86_64
	@echo "Building for Windows x86_64..."
	@cd similarity-validator && cross build --release --target x86_64-pc-windows-gnu
	@cp target/x86_64-pc-windows-gnu/release/similarity-validator.exe dist/similarity-validator-windows-x86_64.exe
	@echo "✅ All platform builds complete"

validate-fixtures: build-validator
	@echo "Validating fixtures with rapidfuzz-rs..."
	@./dist/similarity-validator validate 'tests/fixtures/**/*.yaml'

generate-fixtures: build-validator
	@echo "Generating fixture expected values with rapidfuzz-rs..."
	@./dist/similarity-validator generate --input tests/fixtures/v2.0.0/basic.yaml --overwrite
	@./dist/similarity-validator generate --input tests/fixtures/v2.0.0/unicode.yaml --overwrite
	@./dist/similarity-validator generate --input tests/fixtures/v2.0.0/multiline.yaml --overwrite
	@./dist/similarity-validator generate --input tests/fixtures/v2.0.0/normalization.yaml --overwrite
	@./dist/similarity-validator generate --input tests/fixtures/v2.0.0/substring.yaml --overwrite
	@./dist/similarity-validator generate --input tests/fixtures/v2.0.0/suggestions.yaml --overwrite
	@echo "✅ Fixture generation complete"
