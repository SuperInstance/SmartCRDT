#!/usr/bin/env node
/**
 * Release Script
 * Automates the release process for the LSI Ecosystem monorepo
 *
 * Usage:
 *   node scripts/release.js [options]
 *
 * Options:
 *   --version, -v    Version to release (e.g., 2.1.0)
 *   --type, -t       Release type: major, minor, patch, or pre-release
 *   --dry-run        Simulate release without making changes
 *   --skip-tests     Skip running tests
 *   --help, -h       Show help
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const args = process.argv.slice(2);

// Parse command line arguments
const options = {
  version: null,
  type: null,
  dryRun: false,
  skipTests: false,
  help: false,
};

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  switch (arg) {
    case '--version':
    case '-v':
      options.version = args[++i];
      break;
    case '--type':
    case '-t':
      options.type = args[++i];
      break;
    case '--dry-run':
      options.dryRun = true;
      break;
    case '--skip-tests':
      options.skipTests = true;
      break;
    case '--help':
    case '-h':
      options.help = true;
      break;
  }
}

if (options.help) {
  console.log(`
Release Script - LSI Ecosystem

Usage:
  node scripts/release.js [options]

Options:
  --version, -v <version>   Specific version to release (e.g., 2.1.0)
  --type, -t <type>         Release type: major, minor, patch, pre-release
  --dry-run                 Simulate release without making changes
  --skip-tests              Skip running tests
  --help, -h                Show this help message

Examples:
  node scripts/release.js --version 2.1.0
  node scripts/release.js --type patch
  node scripts/release.js --version 2.2.0-beta.1 --type pre-release
  node scripts/release.js --dry-run
`);
  process.exit(0);
}

// Utility functions
function exec(cmd, silent = false) {
  if (options.dryRun) {
    console.log(`[DRY RUN] Would execute: ${cmd}`);
    return '';
  }
  try {
    const output = execSync(cmd, { encoding: 'utf-8', stdio: silent ? 'pipe' : 'inherit' });
    return output.trim();
  } catch (error) {
    console.error(`Command failed: ${cmd}`);
    throw error;
  }
}

function getCurrentBranch() {
  return exec('git rev-parse --abbrev-ref HEAD', true);
}

function getCurrentVersion() {
  const pkgJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
  return pkgJson.version;
}

function getCommitsSinceTag(tag) {
  try {
    return exec(`git log ${tag}..HEAD --pretty=format:"- %s (%h)"`, true);
  } catch {
    return '';
  }
}

function confirm(message) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(`${message} (y/N) `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

function bumpVersion(current, type) {
  const parts = current.split('.').map(Number);
  switch (type) {
    case 'major':
      return `${parts[0] + 1}.0.0`;
    case 'minor':
      return `${parts[0]}.${parts[1] + 1}.0`;
    case 'patch':
      return `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
    case 'pre-release':
      // Simple pre-release bump (add -beta.X)
      if (current.includes('-')) {
        const [base, pre] = current.split('-');
        const match = pre.match(/beta\.(\d+)/);
        if (match) {
          return `${base}-beta.${parseInt(match[1]) + 1}`;
        }
      }
      return `${parts[0]}.${parts[1]}.${parts[2]}-beta.1`;
    default:
      return current;
  }
}

// Main release process
async function release() {
  console.log('=== LSI Ecosystem Release ===\n');

  // Check we're on main branch
  const currentBranch = getCurrentBranch();
  if (currentBranch !== 'main') {
    console.log(`Warning: You are on branch '${currentBranch}', not 'main'`);
    const proceed = await confirm('Continue anyway?');
    if (!proceed) {
      console.log('Release cancelled.');
      process.exit(1);
    }
  }

  // Check for uncommitted changes
  const status = exec('git status --porcelain', true);
  if (status && !options.dryRun) {
    console.log('Error: You have uncommitted changes');
    console.log(status);
    process.exit(1);
  }

  // Determine version
  let newVersion = options.version;
  if (!newVersion && options.type) {
    const currentVersion = getCurrentVersion();
    newVersion = bumpVersion(currentVersion, options.type);
  }

  if (!newVersion) {
    console.log('Error: Please specify --version or --type');
    process.exit(1);
  }

  if (!newVersion.startsWith('v')) {
    newVersion = `v${newVersion}`;
  }

  console.log(`Release version: ${newVersion}`);
  console.log(`Dry run: ${options.dryRun}\n`);

  // Run checks
  console.log('Running pre-release checks...');

  if (!options.skipTests) {
    console.log('  - Running linter...');
    exec('npm run lint');

    console.log('  - Running type check...');
    exec('npm run build -- --noEmit');

    console.log('  - Running tests...');
    exec('npm test');
  }

  console.log('  - Building packages...');
  exec('npm run build');

  // Update version in package.json
  if (!options.dryRun) {
    const versionNumber = newVersion.replace(/^v/, '');
    exec(`npm version ${versionNumber} --no-git-tag-version`);
  }

  // Generate changelog
  console.log('\nGenerating changelog...');
  const lastTag = exec('git describe --tags --abbrev=0 HEAD^ 2>/dev/null || echo ""', true) || 'v0.0.0';
  const commits = getCommitsSinceTag(lastTag);

  console.log('\n=== Changes since last tag ===');
  console.log(commits || 'No commits found');
  console.log('=============================\n');

  // Commit and tag
  if (!options.dryRun) {
    const proceed = await confirm('Create release commit and tag?');
    if (!proceed) {
      console.log('Release cancelled.');
      process.exit(0);
    }

    exec('git add package.json package-lock.json');
    exec(`git commit -m "chore(release): bump version to ${newVersion}"`);
    exec(`git tag -a ${newVersion} -m "Release ${newVersion}"`);

    console.log(`\nCreated tag: ${newVersion}`);
    console.log('\nTo push the release:');
    console.log(`  git push origin main`);
    console.log(`  git push origin ${newVersion}`);
  } else {
    console.log('\n[DRY RUN] Would create release commit and tag');
  }

  console.log('\n=== Release Summary ===');
  console.log(`Version: ${newVersion}`);
  console.log(`Branch: ${currentBranch}`);
  console.log(`Status: ${options.dryRun ? 'DRY RUN - No changes made' : 'Ready to push'}`);
  console.log('=======================\n');
}

// Run the release
release().catch((error) => {
  console.error('Release failed:', error.message);
  process.exit(1);
});
