#!/usr/bin/env node
/**
 * Aequor Changelog Generator
 * Automatically generates changelogs from git commits and PRs
 */

import { Command } from 'commander';
import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';
import semver from 'semver';

const program = new Command();

interface ChangelogConfig {
  repoUrl?: string;
  format: 'markdown' | 'json';
  output: string;
  fromRef?: string;
  toRef?: string;
  categories: string[];
}

interface Commit {
  hash: string;
  author: string;
  date: string;
  message: string;
  type: string;
  scope?: string;
  breaking: boolean;
  pr?: number;
}

interface ChangelogEntry {
  type: string;
  scope?: string;
  message: string;
  hash: string;
  pr?: number;
  breaking: boolean;
}

interface ChangelogCategory {
  name: string;
  label: string;
  entries: ChangelogEntry[];
}

// Default categories
const DEFAULT_CATEGORIES = [
  { name: 'added', label: 'Added' },
  { name: 'changed', label: 'Changed' },
  { name: 'deprecated', label: 'Deprecated' },
  { name: 'removed', label: 'Removed' },
  { name: 'fixed', label: 'Fixed' },
  { name: 'security', label: 'Security' }
];

// Commit type mapping
const TYPE_MAPPING: Record<string, string> = {
  'feat': 'added',
  'feature': 'added',
  'fix': 'fixed',
  'bugfix': 'fixed',
  'docs': 'changed',
  'style': 'changed',
  'refactor': 'changed',
  'perf': 'changed',
  'test': 'changed',
  'build': 'changed',
  'ci': 'changed',
  'chore': 'changed',
  'revert': 'changed',
  'sec': 'security',
  'security': 'security',
  'deprecate': 'deprecated',
  'remove': 'removed',
  'breaking': 'removed'
};

/**
 * Generate changelog command
 */
program
  .command('generate')
  .description('Generate changelog from git history')
  .option('--from <ref>', 'Git ref to start from (e.g., v1.0.0)', 'v0.1.0')
  .option('--to <ref>', 'Git ref to end at (default: HEAD)', 'HEAD')
  .option('--output <path>', 'Output file path', './CHANGELOG.md')
  .option('--format <format>', 'Output format (markdown|json)', 'markdown')
  .option('--repo-url <url>', 'Repository URL for links')
  .option('--append', 'Append to existing changelog instead of overwriting')
  .action(async (options) => {
    await generateChangelog({
      fromRef: options.from,
      toRef: options.to,
      output: options.output,
      format: options.format,
      repoUrl: options.repoUrl,
      categories: DEFAULT_CATEGORIES.map(c => c.name)
    });

    if (options.append) {
      await appendToExistingChangelog(options.output, options.from, options.to);
    }
  });

/**
 * Validate commit messages
 */
program
  .command('validate')
  .description('Validate commit messages follow conventions')
  .option('--from <ref>', 'Git ref to start from', 'HEAD~10')
  .option('--to <ref>', 'Git ref to end at', 'HEAD')
  .action(async (options) => {
    await validateCommitMessages(options.from, options.to);
  });

/**
 * Preview changelog
 */
program
  .command('preview')
  .description('Preview changelog without writing to file')
  .option('--from <ref>', 'Git ref to start from', 'v1.0.0')
  .option('--to <ref>', 'Git ref to end at', 'HEAD')
  .action(async (options) => {
    await previewChangelog(options.from, options.to);
  });

/**
 * Generate version tag
 */
program
  .command('tag')
  .description('Generate and push version tag')
  .option('--version <version>', 'Version to tag (e.g., 1.0.0)')
  .option('--message <message>', 'Tag message', 'Release {version}')
  .action(async (options) => {
    await createVersionTag(options.version, options.message);
  });

/**
 * Main changelog generation
 */
async function generateChangelog(config: ChangelogConfig): Promise<void> {
  console.log(`Generating changelog from ${config.fromRef} to ${config.toRef}...\n`);

  try {
    // Get commits
    const commits = await getCommits(config.fromRef, config.toRef);

    if (commits.length === 0) {
      console.log('No commits found in this range.');
      return;
    }

    console.log(`Found ${commits.length} commits.\n`);

    // Categorize commits
    const categories = categorizeCommits(commits, config.categories);

    // Generate changelog
    let changelog: string;

    if (config.format === 'json') {
      changelog = generateJSONChangelog(categories, config);
    } else {
      changelog = generateMarkdownChangelog(categories, config);
    }

    // Write to file
    await fs.writeFile(config.output, changelog);
    console.log(`✓ Changelog written to: ${config.output}\n`);

    // Print summary
    printSummary(categories);

  } catch (error) {
    console.error('✗ Error generating changelog:', (error as Error).message);
    process.exit(1);
  }
}

/**
 * Get commits from git
 */
async function getCommits(fromRef: string, toRef: string): Promise<Commit[]> {
  try {
    const gitLog = execSync(
      `git log ${fromRef}..${toRef} --pretty=format:"%H|%an|%ad|%s|%b" --date=iso`,
      { encoding: 'utf-8' }
    );

    const lines = gitLog.trim().split('\n');
    const commits: Commit[] = [];

    for (const line of lines) {
      if (!line) continue;

      const [hash, author, date, message, body] = line.split('|');

      // Parse commit message
      const parsed = parseCommitMessage(message, body);
      if (parsed) {
        commits.push({
          hash,
          author,
          date,
          ...parsed
        });
      }
    }

    return commits;

  } catch (error) {
    throw new Error(`Failed to get commits: ${(error as Error).message}`);
  }
}

/**
 * Parse commit message following Conventional Commits
 */
function parseCommitMessage(message: string, body: string): Partial<Commit> | null {
  // Skip merge commits and revert commits
  if (message.startsWith('Merge ') || message.startsWith('Revert ')) {
    return null;
  }

  // Parse conventional commit format: type(scope): subject
  const conventionalCommitRegex = /^(\w+)(?:\(([^)]+)\))?: (.+)/i;
  const match = message.match(conventionalCommitRegex);

  if (!match) {
    // Not a conventional commit, categorize as 'changed'
    return {
      message,
      type: 'changed',
      breaking: message.includes('BREAKING CHANGE') || body.includes('BREAKING CHANGE')
    };
  }

  const [, type, scope, subject] = match;
  const breaking = message.includes('!') ||
                   message.includes('BREAKING CHANGE') ||
                   body.includes('BREAKING CHANGE');

  // Extract PR number from subject or body
  const prMatch = subject.match(/#(\d+)/) || body.match(/#(\d+)/);
  const pr = prMatch ? parseInt(prMatch[1]) : undefined;

  return {
    type: TYPE_MAPPING[type.toLowerCase()] || 'changed',
    scope,
    message: subject,
    breaking,
    pr
  };
}

/**
 * Categorize commits
 */
function categorizeCommits(commits: Commit[], categoryNames: string[]): ChangelogCategory[] {
  const categories: ChangelogCategory[] = categoryNames.map(name => ({
    name,
    label: DEFAULT_CATEGORIES.find(c => c.name === name)?.label || name,
    entries: []
  }));

  for (const commit of commits) {
    const category = categories.find(c => c.name === commit.type);
    if (category) {
      category.entries.push({
        type: commit.type,
        scope: commit.scope,
        message: commit.message,
        hash: commit.hash,
        pr: commit.pr,
        breaking: commit.breaking
      });
    }
  }

  return categories.filter(c => c.entries.length > 0);
}

/**
 * Generate markdown changelog
 */
function generateMarkdownChangelog(
  categories: ChangelogCategory[],
  config: ChangelogConfig
): string {
  const lines: string[] = [];

  // Header
  lines.push('# Changelog');
  lines.push('');
  lines.push('All notable changes to this project will be documented in this file.');
  lines.push('');
  lines.push('The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),');
  lines.push('and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).');
  lines.push('');
  lines.push('---');
  lines.push('');

  // Version section
  const version = config.toRef !== 'HEAD' ? config.toRef : 'Unreleased';
  lines.push(`## [${version}] - ${new Date().toISOString().split('T')[0]}`);
  lines.push('');

  // Categories
  for (const category of categories) {
    if (category.entries.length === 0) continue;

    lines.push(`### ${category.label}`);
    lines.push('');

    // Separate breaking changes
    const breakingEntries = category.entries.filter(e => e.breaking);
    const regularEntries = category.entries.filter(e => !e.breaking);

    // Breaking changes first
    if (breakingEntries.length > 0) {
      for (const entry of breakingEntries) {
        lines.push(formatEntry(entry, config, true));
      }
      lines.push('');
    }

    // Regular entries
    for (const entry of regularEntries) {
      lines.push(formatEntry(entry, config, false));
    }

    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Format a changelog entry
 */
function formatEntry(
  entry: ChangelogEntry,
  config: ChangelogConfig,
  breaking: boolean
): string {
  let line = '';

  if (breaking) {
    line += '**BREAKING CHANGE:** ';
  }

  if (entry.scope) {
    line += `**${entry.scope}**: `;
  }

  line += entry.message.charAt(0).toLowerCase() + entry.message.slice(1);

  // Add commit link
  if (config.repoUrl) {
    const commitLink = `${config.repoUrl}/commit/${entry.hash}`;
    line += ` ([${entry.hash.substring(0, 7)}](${commitLink}))`;
  }

  // Add PR link
  if (entry.pr && config.repoUrl) {
    const prLink = `${config.repoUrl}/pull/${entry.pr}`;
    line += ` ([#${entry.pr}](${prLink}))`;
  }

  return `- ${line}`;
}

/**
 * Generate JSON changelog
 */
function generateJSONChangelog(
  categories: ChangelogCategory[],
  config: ChangelogConfig
): string {
  const changelog = {
    version: config.toRef,
    date: new Date().toISOString(),
    categories: categories.map(cat => ({
      name: cat.name,
      label: cat.label,
      entries: cat.entries
    }))
  };

  return JSON.stringify(changelog, null, 2);
}

/**
 * Append to existing changelog
 */
async function appendToExistingChangelog(
  outputPath: string,
  fromRef: string,
  toRef: string
): Promise<void> {
  try {
    const existingContent = await fs.readFile(outputPath, 'utf-8');
    const newContent = await fs.readFile(outputPath + '.tmp', 'utf-8');

    // Find the position to insert (after the header section)
    const lines = existingContent.split('\n');
    let insertIndex = lines.findIndex(line => line.startsWith('## ['));

    if (insertIndex === -1) {
      insertIndex = lines.length;
    }

    // Insert new content
    lines.splice(insertIndex, 0, ...newContent.split('\n'));

    // Write back
    await fs.writeFile(outputPath, lines.join('\n'));
    await fs.unlink(outputPath + '.tmp');

    console.log('✓ Appended to existing changelog');

  } catch (error) {
    console.log('⚠ Could not append to existing changelog (file might not exist)');
  }
}

/**
 * Print summary
 */
function printSummary(categories: ChangelogCategory[]): void {
  console.log('Summary:');
  console.log('');

  for (const category of categories) {
    console.log(`  ${category.label}: ${category.entries.length}`);
  }

  console.log('');

  // Check for breaking changes
  const hasBreaking = categories.some(cat =>
    cat.entries.some(entry => entry.breaking)
  );

  if (hasBreaking) {
    console.log('⚠️  This release contains BREAKING CHANGES!');
  }
}

/**
 * Validate commit messages
 */
async function validateCommitMessages(fromRef: string, toRef: string): Promise<void> {
  console.log(`Validating commit messages from ${fromRef} to ${toRef}...\n`);

  const commits = await getCommits(fromRef, toRef);
  const invalid: string[] = [];

  for (const commit of commits) {
    if (!commit.type) {
      invalid.push(`- ${commit.hash.substring(0, 7)}: ${commit.message}`);
    }
  }

  if (invalid.length > 0) {
    console.log('❌ Invalid commits found:\n');
    invalid.forEach(msg => console.log(msg));
    console.log('\nPlease use conventional commit format:');
    console.log('  feat(scope): description');
    console.log('  fix(scope): description');
    console.log('  docs(scope): description');
    process.exit(1);
  } else {
    console.log('✓ All commits follow conventions!\n');
  }
}

/**
 * Preview changelog
 */
async function previewChangelog(fromRef: string, toRef: string): Promise<void> {
  const commits = await getCommits(fromRef, toRef);
  const categories = categorizeCommits(commits, DEFAULT_CATEGORIES.map(c => c.name));

  console.log('=== Changelog Preview ===\n');
  console.log(`From: ${fromRef}`);
  console.log(`To: ${toRef}`);
  console.log(`Commits: ${commits.length}\n`);

  for (const category of categories) {
    if (category.entries.length === 0) continue;

    console.log(`### ${category.label}`);
    console.log('');

    for (const entry of category.entries) {
      const breaking = entry.breaking ? '⚠️ ' : '';
      const scope = entry.scope ? `**${entry.scope}**: ` : '';
      console.log(`${breaking}- ${scope}${entry.message} (${entry.hash.substring(0, 7)})`);
    }

    console.log('');
  }
}

/**
 * Create version tag
 */
async function createVersionTag(version: string, messageTemplate: string): Promise<void> {
  if (!version) {
    // Try to auto-detect version from package.json
    try {
      const pkg = JSON.parse(await fs.readFile('./package.json', 'utf-8'));
      version = pkg.version;
    } catch {
      console.error('Cannot determine version. Please specify with --version');
      process.exit(1);
    }
  }

  // Validate version
  if (!semver.valid(version)) {
    console.error(`Invalid version: ${version}`);
    process.exit(1);
  }

  const tagName = `v${version}`;
  const message = messageTemplate.replace('{version}', version);

  console.log(`Creating tag ${tagName}...`);

  try {
    // Check if tag already exists
    execSync(`git rev-parse ${tagName} 2>/dev/null || echo "not exists"`, {
      encoding: 'utf-8',
      stdio: 'pipe'
    }).then((result) => {
      if (!result.includes('not exists')) {
        throw new Error(`Tag ${tagName} already exists`);
      }
    });

    // Create tag
    execSync(`git tag -a ${tagName} -m "${message}"`, { stdio: 'inherit' });
    console.log(`✓ Tag ${tagName} created`);

    // Push tag (optional, requires confirmation)
    console.log('\nTo push the tag, run:');
    console.log(`  git push origin ${tagName}`);

  } catch (error) {
    console.error('✗ Error creating tag:', (error as Error).message);
    process.exit(1);
  }
}

// Parse and execute
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
