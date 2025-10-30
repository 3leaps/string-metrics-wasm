#!/usr/bin/env node

/**
 * License compliance checker for string-metrics-wasm
 *
 * Ensures no GPL/LGPL/AGPL or other restrictive licenses in dependencies.
 * Safe for commercial use and redistribution.
 */

import checker from 'license-checker';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Licenses that are NOT allowed (copyleft, restrictive)
const BLOCKED_LICENSES = [
  'GPL',
  'GPL-1.0',
  'GPL-2.0',
  'GPL-3.0',
  'LGPL',
  'LGPL-2.0',
  'LGPL-2.1',
  'LGPL-3.0',
  'AGPL',
  'AGPL-1.0',
  'AGPL-3.0',
  'SSPL', // Server Side Public License
  'EUPL', // European Union Public License
  'OSL', // Open Software License
  'CDDL', // Common Development and Distribution License
  'EPL', // Eclipse Public License
  'UNLICENSED',
  'UNKNOWN',
];

// Licenses that ARE allowed (permissive, commercial-friendly)
const ALLOWED_LICENSES = [
  'MIT',
  'ISC',
  'Apache-2.0',
  'Apache',
  'BSD',
  'BSD-2-Clause',
  'BSD-3-Clause',
  '0BSD',
  'CC0-1.0',
  'CC-BY-3.0',
  'CC-BY-4.0',
  'Unlicense',
  'WTFPL',
  'Python-2.0',
  'Zlib',
  'Artistic-2.0',
];

/**
 * Check if a license string is blocked
 */
function isBlockedLicense(license) {
  if (!license) return true; // No license = blocked

  const licenseUpper = license.toUpperCase();

  // Check for blocked patterns
  for (const blocked of BLOCKED_LICENSES) {
    if (licenseUpper.includes(blocked.toUpperCase())) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a license string is explicitly allowed
 */
function isAllowedLicense(license) {
  if (!license) return false;

  const licenseUpper = license.toUpperCase();

  // Check for allowed patterns
  for (const allowed of ALLOWED_LICENSES) {
    if (licenseUpper.includes(allowed.toUpperCase())) {
      return true;
    }
  }

  // Handle OR licenses (e.g., "MIT OR Apache-2.0")
  if (license.includes(' OR ')) {
    const parts = license.split(' OR ');
    return parts.some((part) => isAllowedLicense(part.trim()));
  }

  // Handle AND licenses (all parts must be allowed)
  if (license.includes(' AND ')) {
    const parts = license.split(' AND ');
    return parts.every((part) => isAllowedLicense(part.trim()));
  }

  return false;
}

/**
 * Main license checking function
 */
function checkLicenses() {
  return new Promise((resolve, reject) => {
    checker.init(
      {
        start: projectRoot,
        production: true, // Only check production dependencies
        excludePrivatePackages: true,
      },
      (err, packages) => {
        if (err) {
          reject(err);
          return;
        }

        const violations = [];
        const warnings = [];
        const summary = {
          total: 0,
          allowed: 0,
          blocked: 0,
          warning: 0,
        };

        for (const [packageName, info] of Object.entries(packages)) {
          summary.total++;

          const license = info.licenses;

          if (isBlockedLicense(license)) {
            violations.push({ package: packageName, license, repository: info.repository });
            summary.blocked++;
          } else if (isAllowedLicense(license)) {
            summary.allowed++;
          } else {
            // Unknown license - warn but don't fail
            warnings.push({ package: packageName, license, repository: info.repository });
            summary.warning++;
          }
        }

        resolve({ violations, warnings, summary, packages });
      },
    );
  });
}

/**
 * Main execution
 */
async function main() {
  console.log('🔍 Checking dependency licenses...\n');

  try {
    const { violations, warnings, summary } = await checkLicenses();

    // Print summary
    console.log('📊 License Summary:');
    console.log(`   Total packages: ${summary.total}`);
    console.log(`   ✅ Allowed: ${summary.allowed}`);
    console.log(`   ❌ Blocked: ${summary.blocked}`);
    console.log(`   ⚠️  Unknown: ${summary.warning}`);
    console.log();

    // Print violations
    if (violations.length > 0) {
      console.error('❌ BLOCKED LICENSES FOUND:\n');
      for (const v of violations) {
        console.error(`   ${v.package}`);
        console.error(`      License: ${v.license}`);
        if (v.repository) console.error(`      Repo: ${v.repository}`);
        console.error();
      }
      console.error('⛔ Cannot use packages with GPL/LGPL/AGPL or restrictive licenses.');
      console.error('   These licenses require derivative works to use the same license.');
      console.error(
        '   Please replace these dependencies with permissively-licensed alternatives.\n',
      );
      process.exit(1);
    }

    // Print warnings
    if (warnings.length > 0) {
      console.warn('⚠️  Unknown or unrecognized licenses:\n');
      for (const w of warnings) {
        console.warn(`   ${w.package}`);
        console.warn(`      License: ${w.license}`);
        if (w.repository) console.warn(`      Repo: ${w.repository}`);
        console.warn();
      }
      console.warn(
        '💡 Please manually verify these licenses are permissive and commercial-friendly.\n',
      );
    }

    // Success
    console.log('✅ All dependency licenses are compliant!\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ License check failed:', error.message);
    process.exit(1);
  }
}

main();
